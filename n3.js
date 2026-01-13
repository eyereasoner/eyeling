#!/usr/bin/env node
'use strict';

/*
 * n3.js — Convert Turtle (.ttl), TriG (.trig) or SRL (.srl) to N3.
 *
 * This tool always emits N3 to stdout. The input syntax is selected by the file
 * extension:
 *   - .ttl  (RDF 1.2 Turtle)
 *   - .trig (RDF 1.2 TriG)
 *   - .srl  (SRL rules)
 *
 * TriG → N3 mapping (named graphs)
 *   TriG: <graphName> { ...triples... }
 *   N3:   <graphName> rt:graph { ...triples... } .
 *
 * SRL → N3 mapping (rules)
 *   SRL: RULE { Head } WHERE { Body }
 *   N3:  { Body } => { Head } .
 *
 * RDF 1.2 Turtle-star / TriG-star
 *   - triple terms:    rdf:reifies <<( s p o )>>
 *   - sugar form:      << s p o >> :is true .
 *   triple terms are emitted as singleton graph terms in N3:
 *     rdf:reifies { s p o . } .
 *
 * ----------------------------------------------------------------------------
 * Usage
 *   n3 file.ttl  > file.n3
 *   n3 file.trig > file.n3
 *   n3 file.srl  > file.n3
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const process = require('node:process');

// ---------------------------------------------------------------------------
// Mapping namespace
// ---------------------------------------------------------------------------

const RT = 'urn:return#';
const rt = {
  default: `${RT}default`,
  graph: `${RT}graph`,
};

// ---------------------------------------------------------------------------
// Minimal Turtle/N3 model + lexer + parser
// ---------------------------------------------------------------------------

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const LOG_NS = 'http://www.w3.org/2000/10/swap/log#';
const MATH_NS = 'http://www.w3.org/2000/10/swap/math#';
const STRING_NS = 'http://www.w3.org/2000/10/swap/string#';
const TIMEFN_NS = 'https://w3id.org/time-fn#';
const TIMEFN_BUILTIN_NAMES = new Set([
  'periodMinInclusive',
  'periodMaxInclusive',
  'periodMinExclusive',
  'periodMaxExclusive',
  'bindDefaultTimezone',
]);

// Avoid literal triple-quote sequences in this source (helps embedding in tools).
const DQ3 = '"'.repeat(3);
const SQ3 = "'".repeat(3);

// RDF 1.2: language tags follow BCP47 and may be followed by an initial direction suffix ("--ltr" / "--rtl").
// We validate in the lexer so downstream code can treat it as an opaque tag string.
const LANGTAG_WITH_DIR_REGEX = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*(?:--(?:ltr|rtl))?$/i;

function resolveIriRef(ref, base) {
  // RDF 1.2: resolve relative IRI references using RFC3986 basic algorithm (via WHATWG URL).
  // If the reference is malformed, fail fast rather than silently returning a broken IRI.
  if (!base) return ref;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) return ref; // already absolute
  const resolved = new URL(ref, base); // throws on invalid
  return resolved.href;
}

class Term {}
class Iri extends Term {
  constructor(value) {
    super();
    this.value = value;
  }
}
class Literal extends Term {
  constructor(value) {
    super();
    this.value = value; // raw lexical form, e.g. "foo", 12, or "\"x\"^^<dt>"
  }
}
class Blank extends Term {
  constructor(label) {
    super();
    this.label = label; // _:b1 etc
  }
}
class Var extends Term {
  constructor(name) {
    super();
    this.name = name; // no leading '?'
  }
}
class ListTerm extends Term {
  constructor(elems) {
    super();
    this.elems = elems;
  }
}
class OpenListTerm extends Term {
  constructor(prefix, tailVar) {
    super();
    this.prefix = prefix; // Term[]
    this.tailVar = tailVar; // string
  }
}
class GraphTerm extends Term {
  constructor(triples) {
    super();
    this.triples = triples; // Triple[]
  }
}
class Triple {
  constructor(s, p, o) {
    this.s = s;
    this.p = p;
    this.o = o;
  }
}

const __iriIntern = new Map();
const __literalIntern = new Map();
function internIri(value) {
  let t = __iriIntern.get(value);
  if (!t) {
    t = new Iri(value);
    __iriIntern.set(value, t);
  }
  return t;
}
function internLiteral(value) {
  let t = __literalIntern.get(value);
  if (!t) {
    t = new Literal(value);
    __literalIntern.set(value, t);
  }
  return t;
}

class PrefixEnv {
  constructor(map, baseIri) {
    this.map = map || {}; // prefix -> IRI (including "" for @prefix :)
    this.baseIri = baseIri || ''; // base IRI
  }

  static newDefault() {
    return new PrefixEnv({}, '');
  }

  setPrefix(pfx, iri) {
    this.map[pfx] = iri;
  }

  setBase(iri) {
    this.baseIri = iri;
  }

  expandQName(qn) {
    const idx = qn.indexOf(':');
    if (idx < 0) return qn;
    const pfx = qn.slice(0, idx);
    const local = qn.slice(idx + 1);
    const base = Object.prototype.hasOwnProperty.call(this.map, pfx) ? this.map[pfx] : null;
    if (base == null) return qn;
    return base + local;
  }

  // Best-effort QName compaction for writing (safe-ish, not fully Turtle grammar)
  shrinkIri(iri) {
    let bestPfx = null;
    let bestBase = '';
    for (const [pfx, base] of Object.entries(this.map)) {
      if (!base) continue;
      if (iri.startsWith(base) && base.length > bestBase.length) {
        bestPfx = pfx;
        bestBase = base;
      }
    }
    if (bestPfx == null) return null;

    const local = iri.slice(bestBase.length);

    // Conservative “looks like PN_LOCAL-ish”
    if (!local) return null;
    if (!/^[A-Za-z0-9_\-\.~]+$/.test(local)) return null;

    if (bestPfx === '') return `:${local}`;
    return `${bestPfx}:${local}`;
  }
}

// -------------------- LEXER ------------------------------

class Token {
  constructor(typ, value = null) {
    this.typ = typ;
    this.value = value;
  }
  toString() {
    if (this.value == null) return `Token(${this.typ})`;
    return `Token(${this.typ}, ${JSON.stringify(this.value)})`;
  }
}

function isWs(c) {
  return /\s/.test(c);
}
function isNameChar(c) {
  return /[0-9A-Za-z_\-:]/.test(c);
}

function stripQuotes(s) {
  if (s.startsWith(DQ3) && s.endsWith(DQ3)) return s.slice(3, -3);
  if (s.startsWith(SQ3) && s.endsWith(SQ3)) return s.slice(3, -3);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

function decodeN3StringEscapes(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') {
      out += c;
      continue;
    }
    if (i + 1 >= s.length) {
      out += '\\';
      continue;
    }
    const e = s[++i];
    switch (e) {
      case 't':
        out += '\t';
        break;
      case 'n':
        out += '\n';
        break;
      case 'r':
        out += '\r';
        break;
      case 'b':
        out += '\b';
        break;
      case 'f':
        out += '\f';
        break;
      case '"':
        out += '"';
        break;
      case "'":
        out += "'";
        break;
      case '\\':
        out += '\\';
        break;
      case 'u': {
        const hex = s.slice(i + 1, i + 5);
        if (/^[0-9A-Fa-f]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else out += '\\u';
        break;
      }
      case 'U': {
        const hex = s.slice(i + 1, i + 9);
        if (/^[0-9A-Fa-f]{8}$/.test(hex)) {
          const cp = parseInt(hex, 16);
          if (cp >= 0 && cp <= 0x10ffff) out += String.fromCodePoint(cp);
          else out += '\\U' + hex;
          i += 8;
        } else out += '\\U';
        break;
      }
      default:
        out += '\\' + e;
    }
  }
  return out;
}

function lex(inputText) {
  const chars = Array.from(inputText);
  const n = chars.length;
  let i = 0;
  const tokens = [];

  function peek(offset = 0) {
    const j = i + offset;
    return j >= 0 && j < n ? chars[j] : null;
  }

  while (i < n) {
    let c = peek();
    if (c === null) break;

    // 1) whitespace
    if (isWs(c)) {
      i++;
      continue;
    }

    // 2) # comments
    if (c === '#') {
      while (i < n && chars[i] !== '\n' && chars[i] !== '\r') i++;
      continue;
    }
    // 3) operators: =>, <= ; single '=' as owl:sameAs
    if (c === '=') {
      if (peek(1) === '>') {
        tokens.push(new Token('OpImplies'));
        i += 2;
        continue;
      } else {
        tokens.push(new Token('Equals'));
        i += 1;
        continue;
      }
    }

    // RDF 1.2 Turtle-star / TriG-star tokens
    if (c === '>' && peek(1) === '>') {
      tokens.push(new Token('StarClose'));
      i += 2;
      continue;
    }
    if (c === '~') {
      tokens.push(new Token('Tilde'));
      i += 1;
      continue;
    }

    if (c === '<') {
      if (peek(1) === '<') {
        tokens.push(new Token('StarOpen'));
        i += 2;
        continue;
      }
      if (peek(1) === '=') {
        tokens.push(new Token('OpImpliedBy'));
        i += 2;
        continue;
      }
      if (peek(1) === '-') {
        tokens.push(new Token('OpPredInvert'));
        i += 2;
        continue;
      }
      i++; // consume '<'
      const iriChars = [];
      while (i < n && chars[i] !== '>') {
        iriChars.push(chars[i]);
        i++;
      }
      if (i >= n || chars[i] !== '>') throw new Error('Unterminated IRI <...>');
      i++; // consume '>'
      tokens.push(new Token('IriRef', iriChars.join('')));
      continue;
    }

    // 4) path operators: !, ^, ^^
    if (c === '!') {
      tokens.push(new Token('OpPathFwd'));
      i++;
      continue;
    }
    if (c === '^') {
      if (peek(1) === '^') {
        tokens.push(new Token('HatHat'));
        i += 2;
        continue;
      }
      tokens.push(new Token('OpPathRev'));
      i++;
      continue;
    }

    // 5) punctuation
    // RDF 1.2: allow decimal literals that start with ".<digit>" (e.g., .5)
    if ('{}()[];,~'.includes(c) || c === '.' || c === ',') {
      if (c === '.' && peek(1) !== null && /[0-9]/.test(peek(1))) {
        // handled by numeric literal logic below
      } else {
        const mapping = {
          '{': 'LBrace',
          '}': 'RBrace',
          '(': 'LParen',
          ')': 'RParen',
          '[': 'LBracket',
          ']': 'RBracket',
          ';': 'Semicolon',
          '~': 'Tilde',
          ',': 'Comma',
          '.': 'Dot',
        };
        tokens.push(new Token(mapping[c]));
        i++;
        continue;
      }
    }

    // 6) string literals: short or long (double or single)
    if (c === '"') {
      if (peek(1) === '"' && peek(2) === '"') {
        i += 3;
        const sChars = [];
        let closed = false;
        while (i < n) {
          const cc = chars[i];
          if (cc === '\\') {
            i++;
            if (i < n) {
              const esc = chars[i];
              i++;
              sChars.push('\\', esc);
            } else sChars.push('\\');
            continue;
          }
          if (cc === '"') {
            let run = 0;
            while (i + run < n && chars[i + run] === '"') run++;
            if (run >= 3) {
              for (let k = 0; k < run - 3; k++) sChars.push('"');
              i += run;
              closed = true;
              break;
            }
            for (let k = 0; k < run; k++) sChars.push('"');
            i += run;
            continue;
          }
          sChars.push(cc);
          i++;
        }
        if (!closed) throw new Error('Unterminated long string literal');
        const raw = DQ3 + sChars.join('') + DQ3;
        const decoded = decodeN3StringEscapes(stripQuotes(raw));
        const canon = JSON.stringify(decoded);
        tokens.push(new Token('Literal', canon));
        continue;
      }

      i++;
      const sChars = [];
      while (i < n) {
        let cc = chars[i];
        i++;
        if (cc === '\\') {
          if (i < n) {
            const esc = chars[i];
            i++;
            sChars.push('\\', esc);
          }
          continue;
        }
        if (cc === '"') break;
        sChars.push(cc);
      }
      const raw = '"' + sChars.join('') + '"';
      const decoded = decodeN3StringEscapes(stripQuotes(raw));
      const canon = JSON.stringify(decoded);
      tokens.push(new Token('Literal', canon));
      continue;
    }

    if (c === "'") {
      if (peek(1) === "'" && peek(2) === "'") {
        i += 3;
        const sChars = [];
        let closed = false;
        while (i < n) {
          const cc = chars[i];
          if (cc === '\\') {
            i++;
            if (i < n) {
              const esc = chars[i];
              i++;
              sChars.push('\\', esc);
            } else sChars.push('\\');
            continue;
          }
          if (cc === "'") {
            let run = 0;
            while (i + run < n && chars[i + run] === "'") run++;
            if (run >= 3) {
              for (let k = 0; k < run - 3; k++) sChars.push("'");
              i += run;
              closed = true;
              break;
            }
            for (let k = 0; k < run; k++) sChars.push("'");
            i += run;
            continue;
          }
          sChars.push(cc);
          i++;
        }
        if (!closed) throw new Error('Unterminated long string literal');
        const raw = SQ3 + sChars.join('') + SQ3;
        const decoded = decodeN3StringEscapes(stripQuotes(raw));
        const canon = JSON.stringify(decoded);
        tokens.push(new Token('Literal', canon));
        continue;
      }

      i++;
      const sChars = [];
      while (i < n) {
        let cc = chars[i];
        i++;
        if (cc === '\\') {
          if (i < n) {
            const esc = chars[i];
            i++;
            sChars.push('\\', esc);
          }
          continue;
        }
        if (cc === "'") break;
        sChars.push(cc);
      }
      const raw = "'" + sChars.join('') + "'";
      const decoded = decodeN3StringEscapes(stripQuotes(raw));
      const canon = JSON.stringify(decoded);
      tokens.push(new Token('Literal', canon));
      continue;
    }

    // 7) directives or language tags with '@'
    if (c === '@') {
      const prevTok = tokens.length ? tokens[tokens.length - 1] : null;
      const prevWasQuotedLiteral =
        prevTok && prevTok.typ === 'Literal' && typeof prevTok.value === 'string' && prevTok.value.startsWith('"');

      i++; // consume '@'

      if (prevWasQuotedLiteral) {
        // RDF 1.2: language tags follow BCP47 and may be followed by an initial text direction: @lang--ltr / @lang--rtl
        const tagChars = [];
        let cc = peek();
        if (cc === null || !/[A-Za-z]/.test(cc)) throw new Error("Invalid language tag (expected [A-Za-z] after '@')");

        // Primary language subtag (1..8 alpha)
        while ((cc = peek()) !== null && /[A-Za-z]/.test(cc)) {
          tagChars.push(cc);
          i++;
          // primary subtag length limit
          if (tagChars.length > 8) throw new Error('Invalid language tag (primary subtag too long; max 8)');
        }

        // Additional BCP47 subtags: -[A-Za-z0-9]{1,8}
        while ((cc = peek()) === '-' && peek(1) !== '-') {
          tagChars.push('-');
          i++;
          const segChars = [];
          let dd = peek();
          if (dd === null || !/[A-Za-z0-9]/.test(dd))
            throw new Error("Invalid language tag (expected [A-Za-z0-9]+ after '-')");
          while ((dd = peek()) !== null && /[A-Za-z0-9]/.test(dd)) {
            segChars.push(dd);
            i++;
            if (segChars.length > 8) throw new Error('Invalid language tag subtag too long; max 8');
          }
          if (!segChars.length) throw new Error("Invalid language tag (expected [A-Za-z0-9]+ after '-')");
          tagChars.push(...segChars);
        }

        // Optional initial direction suffix: --ltr / --rtl
        if (peek() === '-' && peek(1) === '-') {
          i += 2;
          const dirChars = [];
          let dd;
          while ((dd = peek()) !== null && /[A-Za-z]/.test(dd)) {
            dirChars.push(dd);
            i++;
            if (dirChars.length > 3) break;
          }
          const dir = dirChars.join('').toLowerCase();
          if (dir !== 'ltr' && dir !== 'rtl') {
            throw new Error('Invalid language direction (expected --ltr or --rtl)');
          }
          tagChars.push('-', '-', dir);
        }

        const lang = tagChars.join('');
        if (!LANGTAG_WITH_DIR_REGEX.test(lang)) {
          throw new Error(`Invalid BCP47 language tag: ${lang}`);
        }

        tokens.push(new Token('LangTag', lang));
        continue;
      }

      const wordChars = [];
      let cc;
      while ((cc = peek()) !== null && /[A-Za-z]/.test(cc)) {
        wordChars.push(cc);
        i++;
      }
      const word = wordChars.join('');
      if (word === 'prefix') tokens.push(new Token('AtPrefix'));
      else if (word === 'base') tokens.push(new Token('AtBase'));
      else throw new Error(`Unknown directive @${word}`);
      continue;
    }

    // 8) numeric literals (RDF 1.2 Turtle shorthand: integer / decimal / double)
    //   integer: [+-]?[0-9]+
    //   decimal: [+-]?[0-9]*\.[0-9]+   (allows .5)
    //   double : [+-]?(?:[0-9]+\.[0-9]*|\.[0-9]+|[0-9]+)[eE][+-]?[0-9]+
    if (
      /[0-9]/.test(c) ||
      (c === '.' && peek(1) !== null && /[0-9]/.test(peek(1))) ||
      ((c === '-' || c === '+') &&
        peek(1) !== null &&
        (/[0-9]/.test(peek(1)) || (peek(1) === '.' && peek(2) !== null && /[0-9]/.test(peek(2)))))
    ) {
      const rest = chars.slice(i).join('');

      let m = rest.match(/^[+-]?(?:[0-9]+\.[0-9]*|\.[0-9]+|[0-9]+)[eE][+-]?[0-9]+/);
      if (m) {
        tokens.push(new Token('Literal', m[0]));
        i += m[0].length;
        continue;
      }

      m = rest.match(/^[+-]?[0-9]*\.[0-9]+/);
      if (m) {
        tokens.push(new Token('Literal', m[0]));
        i += m[0].length;
        continue;
      }

      m = rest.match(/^[+-]?[0-9]+/);
      if (m) {
        tokens.push(new Token('Literal', m[0]));
        i += m[0].length;
        continue;
      }

      // If we got here, it looked like a number start but didn't match any legal form.
      throw new Error(`Invalid numeric literal near: ${rest.slice(0, 32)}`);
    }

    // 9) var: ?x  (SPARQL vars)  or  $this / $value (SHACL SPARQL vars)
    if (c === '?' || c === '$') {
      const sigil = c;
      i++;
      const nameChars = [];
      let cc;
      while ((cc = peek()) !== null && isNameChar(cc)) {
        nameChars.push(cc);
        i++;
      }
      if (!nameChars.length) throw new Error(`Expected variable name after '${sigil}'`);
      tokens.push(new Token('Var', nameChars.join('')));
      continue;
    }

    // 10) identifier / qname / keywords
    if (isNameChar(c) || c === '_') {
      const nameChars = [c];
      i++;
      while (i < n) {
        const cc = chars[i];
        if (isNameChar(cc) || cc === '_' || cc === '.') {
          nameChars.push(cc);
          i++;
          continue;
        }
        break;
      }
      const word = nameChars.join('');

      // If an identifier ends with one or more '.' characters, treat them as statement terminators.
      // This allows Turtle like ':s :p :o.' (no whitespace before '.').
      // Keep '...' as a single identifier (used by some N3 syntaxes).
      if (word !== '...' && word.endsWith('.') && word.length > 1) {
        let w = word;
        let dots = 0;
        while (w.endsWith('.') && w.length > 0 && w !== '...') {
          w = w.slice(0, -1);
          dots++;
        }
        if (w.length > 0) {
          // Re-run the literal/ident decision on w, then emit Dot tokens.
          if (w === 'true' || w === 'false') tokens.push(new Token('Literal', w));
          else tokens.push(new Token('Ident', w));
          for (let d = 0; d < dots; d++) tokens.push(new Token('Dot'));
          continue;
        }
      }

      // true/false as literals
      if (word === 'true' || word === 'false') tokens.push(new Token('Literal', word));
      else tokens.push(new Token('Ident', word));
      continue;
    }

    throw new Error(`Unexpected character in input: ${JSON.stringify(c)}`);
  }

  tokens.push(new Token('EOF'));
  return tokens;
}

// -------------------- PARSER (Turtle + N3-graphs; TriG extension separately) --------------------

class TurtleParser {
  constructor(tokens) {
    this.toks = tokens;
    this.pos = 0;
    this.prefixes = PrefixEnv.newDefault();
    this.blankCounter = 0;
    this.pendingTriples = [];
    this.reifierCounter = 0;
    this._reifiesEmitted = new Set();
  }

  peek() {
    return this.toks[this.pos];
  }

  next() {
    const tok = this.toks[this.pos];
    this.pos += 1;
    return tok;
  }

  expect(typ) {
    const tok = this.next();
    if (tok.typ !== typ) throw new Error(`Expected ${typ}, got ${tok.toString()}`);
    return tok;
  }

  // Generate a fresh blank node used for RDF 1.2 reifiedTriple sugar (<< s p o >>)
  freshReifier() {
    this.reifierCounter += 1;
    return new Blank(`_:n3r${this.reifierCounter}`);
  }

  _termKey(t) {
    if (t == null) return '[]';
    if (t instanceof Iri) return `I:${t.value}`;
    if (t instanceof Blank) return `B:${t.label}`;
    if (t instanceof Literal) return `L:${t.value}`;
    if (t instanceof Var) return `V:${t.name}`;
    if (t instanceof ListTerm) return `T:(` + t.elems.map((x) => this._termKey(x)).join(' ') + `)`;
    if (t instanceof GraphTerm) {
      const inner = t.triples
        .map((tr) => `${this._termKey(tr.s)} ${this._termKey(tr.p)} ${this._termKey(tr.o)}`)
        .join(' | ');
      return `G:{${inner}}`;
    }
    return `X:${String(t)}`;
  }

  // Emit the implicit (or explicit) reifier triple required by RDF 1.2 reifiedTriple sugar:
  //   reifier rdf:reifies tripleTerm .
  // We represent tripleTerm in N3 as a quoted graph term: { s p o . }
  emitReifies(reifier, tripleGraph) {
    const key = `${this._termKey(reifier)}|${this._termKey(tripleGraph)}`;
    if (this._reifiesEmitted.has(key)) return;
    this._reifiesEmitted.add(key);
    this.pendingTriples.push(new Triple(reifier, internIri(RDF_NS + 'reifies'), tripleGraph));
  }

  // Accept '.' OR (when inside {...}) accept '}' as implicit terminator for last triple
  expectDotOrRBrace() {
    const tok = this.peek();
    if (tok.typ === 'Dot') {
      this.next();
      return;
    }
    if (tok.typ === 'RBrace') return;
    throw new Error(`Expected '.' (or '}'), got ${tok.toString()}`);
  }

  parsePrefixDirective() {
    // @prefix pfx: <iri> .
    const pfxTok = this.next();
    if (pfxTok.typ !== 'Ident') throw new Error(`Expected prefix label after @prefix, got ${pfxTok.toString()}`);
    const label = (pfxTok.value || '').replace(/:$/, '');
    const iriTok = this.next();
    let iri;
    if (iriTok.typ === 'IriRef') iri = iriTok.value || '';
    else if (iriTok.typ === 'Ident') iri = iriTok.value || '';
    else throw new Error(`Expected IRI after @prefix, got ${iriTok.toString()}`);
    this.expect('Dot');
    this.prefixes.setPrefix(label, iri);
  }

  parseSparqlPrefixDirective() {
    // PREFIX pfx: <iri>   (no trailing '.')
    const pfxTok = this.next();
    if (pfxTok.typ !== 'Ident') throw new Error(`Expected prefix label after PREFIX, got ${pfxTok.toString()}`);
    const label = (pfxTok.value || '').replace(/:$/, '');
    const iriTok = this.next();
    let iri;
    if (iriTok.typ === 'IriRef') iri = iriTok.value || '';
    else if (iriTok.typ === 'Ident') iri = iriTok.value || '';
    else throw new Error(`Expected IRI after PREFIX, got ${iriTok.toString()}`);
    if (this.peek().typ === 'Dot') this.next(); // permissive
    this.prefixes.setPrefix(label, iri);
  }

  parseBaseDirective() {
    // @base <iri> .
    const iriTok = this.next();
    let iri;
    if (iriTok.typ === 'IriRef') iri = iriTok.value || '';
    else if (iriTok.typ === 'Ident') iri = iriTok.value || '';
    else throw new Error(`Expected IRI after @base, got ${iriTok.toString()}`);
    this.expect('Dot');
    this.prefixes.setBase(iri);
  }

  parseSparqlBaseDirective() {
    // BASE <iri>
    const iriTok = this.next();
    if (iriTok.typ !== 'IriRef') throw new Error(`Expected <IRI> after BASE, got ${iriTok.toString()}`);
    const iri = iriTok.value || '';
    if (this.peek().typ === 'Dot') this.next(); // permissive
    this.prefixes.setBase(iri);
  }

  parseTurtleDocument() {
    const triples = [];
    while (this.peek().typ !== 'EOF') {
      // RDF 1.2: VERSION announcement (e.g., VERSION "1.2")
      if (
        this.peek().typ === 'Ident' &&
        typeof this.peek().value === 'string' &&
        this.peek().value.toLowerCase() === 'version'
      ) {
        this.next(); // VERSION
        const vTok = this.next();
        if (vTok.typ !== 'Literal') throw new Error(`Expected a literal after VERSION, got ${vTok.toString()}`);
        if (this.peek().typ === 'Dot') this.next(); // permissive
        continue;
      }

      if (this.peek().typ === 'AtPrefix') {
        this.next();
        this.parsePrefixDirective();
        continue;
      }
      if (this.peek().typ === 'AtBase') {
        this.next();
        this.parseBaseDirective();
        continue;
      }
      // SPARQL-style directives
      if (
        this.peek().typ === 'Ident' &&
        typeof this.peek().value === 'string' &&
        this.peek().value.toLowerCase() === 'prefix' &&
        this.toks[this.pos + 1] &&
        this.toks[this.pos + 1].typ === 'Ident' &&
        typeof this.toks[this.pos + 1].value === 'string' &&
        this.toks[this.pos + 1].value.endsWith(':')
      ) {
        this.next(); // PREFIX
        this.parseSparqlPrefixDirective();
        continue;
      }
      if (
        this.peek().typ === 'Ident' &&
        typeof this.peek().value === 'string' &&
        this.peek().value.toLowerCase() === 'base' &&
        this.toks[this.pos + 1] &&
        this.toks[this.pos + 1].typ === 'IriRef'
      ) {
        this.next(); // BASE
        this.parseSparqlBaseDirective();
        continue;
      }

      const subj = this.parseTerm();

      let more;
      if (this.peek().typ === 'Dot') {
        more = [];
        if (this.pendingTriples.length > 0) {
          more = this.pendingTriples;
          this.pendingTriples = [];
          this.reifierCounter = 0;
          this._reifiesEmitted = new Set();
        }
        this.next();
      } else {
        more = this.parsePredicateObjectList(subj);
        this.expect('Dot');
      }
      triples.push(...more);
    }
    return { triples, prefixes: this.prefixes };
  }

  parseTerm() {
    let t = this.parsePathItem();
    while (this.peek().typ === 'OpPathFwd' || this.peek().typ === 'OpPathRev') {
      const dir = this.next().typ;
      const pred = this.parsePathItem();

      this.blankCounter += 1;
      const bn = new Blank(`_:b${this.blankCounter}`);
      this.pendingTriples.push(dir === 'OpPathFwd' ? new Triple(t, pred, bn) : new Triple(bn, pred, t));
      t = bn;
    }
    return t;
  }

  parsePathItem() {
    const tok = this.next();
    const typ = tok.typ;
    const val = tok.value;

    if (typ === 'Equals') return internIri(OWL_NS + 'sameAs');

    if (typ === 'IriRef') {
      const base = this.prefixes.baseIri || '';
      return internIri(resolveIriRef(val || '', base));
    }

    if (typ === 'Ident') {
      const name = val || '';
      if (name === 'a') return internIri(RDF_NS + 'type');
      if (name.startsWith('_:')) return new Blank(name);
      if (name.includes(':')) return internIri(this.prefixes.expandQName(name));
      return internIri(name);
    }

    if (typ === 'Literal') {
      let s = val || '';

      // Optional language tag: "... "@en
      if (this.peek().typ === 'LangTag') {
        if (!(s.startsWith('"') && s.endsWith('"')))
          throw new Error('Language tag is only allowed on quoted string literals');
        const langTok = this.next();
        s = `${s}@${langTok.value || ''}`;
        if (this.peek().typ === 'HatHat') throw new Error('A literal cannot have both a language tag and a datatype');
      }

      // Optional datatype: ^^ <...> or ^^ qname
      if (this.peek().typ === 'HatHat') {
        this.next();
        const dtTok = this.next();
        let dtIri;
        if (dtTok.typ === 'IriRef') dtIri = dtTok.value || '';
        else if (dtTok.typ === 'Ident') {
          const qn = dtTok.value || '';
          dtIri = qn.includes(':') ? this.prefixes.expandQName(qn) : qn;
        } else throw new Error(`Expected datatype after ^^, got ${dtTok.toString()}`);
        s = `${s}^^<${dtIri}>`;
      }

      return internLiteral(s);
    }

    if (typ === 'Var') return new Var(val || '');
    if (typ === 'LParen') return this.parseList();
    if (typ === 'LBracket') return this.parseBlank();
    if (typ === 'LBrace') return this.parseGraph(); // N3 graph term
    if (typ === 'StarOpen') return this.parseStarTerm();

    throw new Error(`Unexpected term token: ${tok.toString()}`);
  }

  parseStarTerm() {
    // RDF 1.2 Turtle-star / TriG-star:
    // - tripleTerm: <<( s p o )>>
    // - reifiedTriple (syntactic sugar): << s p o [~ reifier] >>
    if (this.peek().typ === 'LParen') {
      // tripleTerm
      this.next(); // '('
      const s = this.parseTerm();
      const p = this.parseTerm();
      const o = this.parseTerm();
      this.expect('RParen');
      this.expect('StarClose');
      return new GraphTerm([new Triple(s, p, o)]);
    }

    // reifiedTriple sugar -> expand to a reifier node that rdf:reifies a tripleTerm
    const s = this.parseTerm();
    const p = this.parseTerm();
    const o = this.parseTerm();

    let reifier;
    if (this.peek().typ === 'Tilde') {
      this.next();
      reifier = this.parseTerm();
    } else {
      reifier = this.freshReifier();
    }

    this.expect('StarClose');

    const tripleTerm = new GraphTerm([new Triple(s, p, o)]);
    this.emitReifies(reifier, tripleTerm);
    return reifier;
  }

  parseList() {
    const elems = [];
    while (this.peek().typ !== 'RParen') {
      // Be permissive: allow commas inside lists (even though Turtle lists are whitespace-separated).
      if (this.peek().typ === 'Comma') {
        this.next();
        continue;
      }
      elems.push(this.parseTerm());
      if (this.peek().typ === 'EOF') throw new Error("Unterminated list '(' ... ')'");
    }
    this.next(); // ')'
    return new ListTerm(elems);
  }

  parseBlank() {
    // [] or [ ... ] property list
    if (this.peek().typ === 'RBracket') {
      this.next();
      this.blankCounter += 1;
      return new Blank(`_:b${this.blankCounter}`);
    }

    let id = null;
    if (this.peek().typ === 'Ident' && (this.peek().value || '').startsWith('_:')) id = this.next().value;
    else {
      this.blankCounter += 1;
      id = `_:b${this.blankCounter}`;
    }

    const subj = new Blank(id);
    if (this.peek().typ !== 'RBracket') {
      void this.parsePredicateObjectList(subj);
    }

    this.expect('RBracket');
    return new Blank(id);
  }

  // Parses inside "{ ... }" AFTER the '{' has been consumed.
  // We accept both "s p o ." and "s p o" before '}' as last triple (permissive).
  parseGraph() {
    const triples = [];
    while (this.peek().typ !== 'RBrace') {
      const subj = this.parseTerm();

      let more;
      if (this.peek().typ === 'Dot') {
        more = [];
        if (this.pendingTriples.length > 0) {
          more = this.pendingTriples;
          this.pendingTriples = [];
          this.reifierCounter = 0;
          this._reifiesEmitted = new Set();
        }
        this.next();
      } else {
        more = this.parsePredicateObjectList(subj);
        this.expectDotOrRBrace();
        if (this.peek().typ === 'Dot') this.next();
      }

      triples.push(...more);
    }
    this.next(); // consume '}'
    return new GraphTerm(triples);
  }

  parsePredicateObjectList(subject) {
    const out = [];

    if (this.pendingTriples.length > 0) {
      out.push(...this.pendingTriples);
      this.pendingTriples = [];
      this.reifierCounter = 0;
      this._reifiesEmitted = new Set();
    }

    while (true) {
      let verb;
      let invert = false;

      if (this.peek().typ === 'Ident' && (this.peek().value || '') === 'a') {
        this.next();
        verb = internIri(RDF_NS + 'type');
      } else if (this.peek().typ === 'Ident' && (this.peek().value || '') === 'has') {
        this.next();
        invert = true;
        verb = this.parseTerm();
      } else {
        if (this.peek().typ === 'OpPredInvert') {
          invert = true;
          this.next();
        }
        verb = this.parseTerm();
      }

      const objs = this.parseObjectList();
      for (const o of objs) out.push(invert ? new Triple(o, verb, subject) : new Triple(subject, verb, o));

      if (this.peek().typ === 'Semicolon') {
        this.next();
        if (this.peek().typ === 'Dot' || this.peek().typ === 'RBrace' || this.peek().typ === 'RBracket') break;
        continue;
      }
      break;
    }

    return out;
  }

  parseObjectList() {
    const objs = [this.parseTerm()];
    while (this.peek().typ === 'Comma') {
      this.next();
      objs.push(this.parseTerm());
    }
    return objs;
  }
}

// TriG: Turtle + graph blocks (graphName { ... })
class TriGParser extends TurtleParser {
  parseTrigDocument() {
    const quads = []; // { s,p,o,g } where g is Term|null

    while (this.peek().typ !== 'EOF') {
      // RDF 1.2: VERSION announcement (e.g., VERSION "1.2")
      if (
        this.peek().typ === 'Ident' &&
        typeof this.peek().value === 'string' &&
        this.peek().value.toLowerCase() === 'version'
      ) {
        this.next(); // VERSION
        const vTok = this.next();
        if (vTok.typ !== 'Literal') throw new Error(`Expected a literal after VERSION, got ${vTok.toString()}`);
        if (this.peek().typ === 'Dot') this.next(); // permissive
        continue;
      }

      // directives
      if (this.peek().typ === 'AtPrefix') {
        this.next();
        this.parsePrefixDirective();
        continue;
      }
      if (this.peek().typ === 'AtBase') {
        this.next();
        this.parseBaseDirective();
        continue;
      }
      if (
        this.peek().typ === 'Ident' &&
        typeof this.peek().value === 'string' &&
        this.peek().value.toLowerCase() === 'prefix' &&
        this.toks[this.pos + 1] &&
        this.toks[this.pos + 1].typ === 'Ident' &&
        typeof this.toks[this.pos + 1].value === 'string' &&
        this.toks[this.pos + 1].value.endsWith(':')
      ) {
        this.next();
        this.parseSparqlPrefixDirective();
        continue;
      }
      if (
        this.peek().typ === 'Ident' &&
        typeof this.peek().value === 'string' &&
        this.peek().value.toLowerCase() === 'base' &&
        this.toks[this.pos + 1] &&
        this.toks[this.pos + 1].typ === 'IriRef'
      ) {
        this.next();
        this.parseSparqlBaseDirective();
        continue;
      }

      // Default graph block: { ... }
      if (this.peek().typ === 'LBrace') {
        this.next(); // consume '{'
        const f = this.parseGraph();
        if (this.peek().typ === 'Dot') this.next(); // accept optional '.'
        for (const tr of f.triples) quads.push({ s: tr.s, p: tr.p, o: tr.o, g: null });
        continue;
      }

      // Either a Turtle triple in default graph, or a named graph block: graphName { ... }
      const first = this.parseTerm();

      if (this.peek().typ === 'LBrace') {
        this.next(); // consume '{'
        const f = this.parseGraph();
        if (this.peek().typ === 'Dot') this.next(); // accept optional '.'
        for (const tr of f.triples) quads.push({ s: tr.s, p: tr.p, o: tr.o, g: first });
        continue;
      }

      // Plain Turtle triple statement in default graph
      let more;
      if (this.peek().typ === 'Dot') {
        more = [];
        if (this.pendingTriples.length > 0) {
          more = this.pendingTriples;
          this.pendingTriples = [];
          this.reifierCounter = 0;
          this._reifiesEmitted = new Set();
        }
        this.next();
      } else {
        more = this.parsePredicateObjectList(first);
        this.expect('Dot');
      }
      for (const tr of more) quads.push({ s: tr.s, p: tr.p, o: tr.o, g: null });
    }

    return { quads, prefixes: this.prefixes };
  }
}

// ---------------------------------------------------------------------------
// Serializers (Turtle-ish / TriG-ish / N3-ish)
// ---------------------------------------------------------------------------

function termToText(t, prefixes) {
  if (t == null) return '[]';
  if (t instanceof Iri) {
    if (t.value === RDF_NS + 'type') return 'a';
    const qn = prefixes ? prefixes.shrinkIri(t.value) : null;
    return qn || `<${t.value}>`;
  }
  if (t instanceof Blank) return t.label;
  if (t instanceof Literal) return t.value;
  if (t instanceof Var) return `?${t.name}`;
  if (t instanceof ListTerm) return `(${t.elems.map((x) => termToText(x, prefixes)).join(' ')})`;
  if (t instanceof OpenListTerm) return `(${t.prefix.map((x) => termToText(x, prefixes)).join(' ')} ... ?${t.tailVar})`;
  if (t instanceof GraphTerm) {
    const inner = t.triples
      .map((tr) => `${termToText(tr.s, prefixes)} ${termToText(tr.p, prefixes)} ${termToText(tr.o, prefixes)} .`)
      .join(' ');
    return `{ ${inner} }`;
  }
  return String(t);
}

function isIri(t, iri) {
  return t instanceof Iri && t.value === iri;
}

function isGraphTermTripleTerm(t) {
  return t instanceof GraphTerm && Array.isArray(t.triples) && t.triples.length === 1;
}

function tripleTermToTurtle12Text(gt, prefixes) {
  if (!isGraphTermTripleTerm(gt)) throw new Error('Not a tripleTerm graph term');
  const tr = gt.triples[0];
  const s = termToText(tr.s, prefixes);
  const p = termToText(tr.p, prefixes);
  const o = termToText(tr.o, prefixes);
  // tripleTerm syntax uses parentheses: <<( s p o )>>
  return `<<(${s} ${p} ${o})>>`;
}

function assertTurtleableTerm(t, ctx) {
  if (t instanceof Var) throw new Error(`Cannot write ${ctx}: variables are not allowed in Turtle/TriG`);
  if (t instanceof OpenListTerm) throw new Error(`Cannot write ${ctx}: open lists are not allowed in Turtle/TriG`);
  if (t instanceof GraphTerm) {
    // GraphTerm is only representable in Turtle/TriG 1.2 when used as a tripleTerm (in rdf:reifies object position).
    throw new Error(`Cannot write ${ctx}: N3 graph terms are not Turtle/TriG (except rdf:reifies tripleTerm)`);
  }
}

function writeTurtle12Triples(triples, prefixes, { indent = '' } = {}) {
  const lines = [];
  for (const tr of triples) {
    let sTxt = termToText(tr.s, prefixes);
    let pTxt = termToText(tr.p, prefixes);
    let oTxt;

    // subjects/predicates must be turtleable terms
    assertTurtleableTerm(tr.s, 'subject');
    assertTurtleableTerm(tr.p, 'predicate');

    if (isIri(tr.p, RDF_NS + 'reifies')) {
      if (!isGraphTermTripleTerm(tr.o)) {
        throw new Error('rdf:reifies object must be a tripleTerm (in this converter, a { s p o . } graph term)');
      }
      oTxt = tripleTermToTurtle12Text(tr.o, prefixes);
    } else {
      if (tr.o instanceof GraphTerm) assertTurtleableTerm(tr.o, 'object');
      else assertTurtleableTerm(tr.o, 'object');
      oTxt = termToText(tr.o, prefixes);
    }

    lines.push(`${indent}${sTxt} ${pTxt} ${oTxt} .`);
  }
  return lines.join('\n');
}

function writeTurtle12({ triples, prefixes }) {
  const pro = renderPrefixPrologue(prefixes, { includeRt: false }).trim();
  const blocks = [];
  if (pro) blocks.push(pro, '');
  if (triples.length) blocks.push(writeTurtle12Triples(triples, prefixes));
  return blocks.join('\n').trim() + '\n';
}

function writeTriG12Star({ quads, prefixes }) {
  const pro = renderPrefixPrologue(prefixes, { includeRt: false }).trim();
  const blocks = [];
  if (pro) blocks.push(pro, '');

  const grouped = groupQuadsByGraph(quads);

  // Default graph first
  if (grouped.has('DEFAULT')) {
    const { triples } = grouped.get('DEFAULT');
    if (triples.length) blocks.push(writeTurtle12Triples(triples, prefixes), '');
  }

  // Named graphs
  const named = [...grouped.entries()].filter(([k]) => k !== 'DEFAULT');
  named.sort((a, b) => a[0].localeCompare(b[0]));

  for (const [, { gTerm, triples }] of named) {
    assertTurtleableTerm(gTerm, 'graph name');
    blocks.push(`${termToText(gTerm, prefixes)} {`);
    if (triples.length) blocks.push(writeTurtle12Triples(triples, prefixes, { indent: '  ' }));
    blocks.push('}', '');
  }

  return blocks.join('\n').trim() + '\n';
}

function renderPrefixPrologue(prefixes, { includeRt = false } = {}) {
  const out = [];
  if (includeRt) out.push(`@prefix rt: <${RT}> .`);

  if (prefixes && prefixes.baseIri) out.push(`@base <${prefixes.baseIri}> .`);

  if (prefixes && prefixes.map) {
    for (const [pfx, iri] of Object.entries(prefixes.map)) {
      if (!iri) continue;
      if (includeRt && pfx === 'rt' && iri === RT) continue;
      const label = pfx === '' ? ':' : `${pfx}:`;
      out.push(`@prefix ${label} <${iri}> .`);
    }
  }
  return out.join('\n');
}

function groupQuadsByGraph(quads) {
  const m = new Map(); // key -> { gTerm, triples: Triple[] }
  function keyOfGraph(g) {
    if (g == null) return 'DEFAULT';
    if (g instanceof Iri) return `I:${g.value}`;
    if (g instanceof Blank) return `B:${g.label}`;
    return `X:${String(g)}`;
  }
  for (const q of quads) {
    const k = keyOfGraph(q.g);
    if (!m.has(k)) m.set(k, { gTerm: q.g, triples: [] });
    m.get(k).triples.push(new Triple(q.s, q.p, q.o));
  }
  return m;
}

function writeTriG({ quads, prefixes }) {
  const pro = renderPrefixPrologue(prefixes, { includeRt: false }).trim();
  const blocks = [];
  if (pro) blocks.push(pro, '');

  const grouped = groupQuadsByGraph(quads);

  // Default graph first
  if (grouped.has('DEFAULT')) {
    const { triples } = grouped.get('DEFAULT');
    for (const tr of triples)
      blocks.push(`${termToText(tr.s, prefixes)} ${termToText(tr.p, prefixes)} ${termToText(tr.o, prefixes)} .`);
    blocks.push('');
  }

  // Named graphs
  const named = [...grouped.entries()].filter(([k]) => k !== 'DEFAULT');
  named.sort((a, b) => a[0].localeCompare(b[0]));

  for (const [, { gTerm, triples }] of named) {
    blocks.push(`${termToText(gTerm, prefixes)} {`);
    for (const tr of triples)
      blocks.push(`  ${termToText(tr.s, prefixes)} ${termToText(tr.p, prefixes)} ${termToText(tr.o, prefixes)} .`);
    blocks.push('}', '');
  }

  return blocks.join('\n').trim() + '\n';
}

function writeN3RtGraph({ datasetQuads, prefixes }) {
  const blocks = [];
  const pro = renderPrefixPrologue(prefixes, { includeRt: true }).trim();
  if (pro) blocks.push(pro, '');

  const grouped = groupQuadsByGraph(datasetQuads);

  function writeGraphTriples(triples) {
    return triples
      .map((tr) => `  ${termToText(tr.s, prefixes)} ${termToText(tr.p, prefixes)} ${termToText(tr.o, prefixes)} .`)
      .join('\n');
  }

  // default graph: emit triples at top-level (no rt:graph wrapper)
  if (grouped.has('DEFAULT')) {
    const { triples } = grouped.get('DEFAULT');
    for (const tr of triples) {
      blocks.push(`${termToText(tr.s, prefixes)} ${termToText(tr.p, prefixes)} ${termToText(tr.o, prefixes)} .`);
    }
    blocks.push('');
  }

  const named = [...grouped.entries()].filter(([k]) => k !== 'DEFAULT');
  named.sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, { gTerm, triples }] of named) {
    blocks.push(`${termToText(gTerm, prefixes)} rt:graph {`);
    if (triples.length) blocks.push(writeGraphTriples(triples));
    blocks.push('} .', '');
  }

  return blocks.join('\n').trim() + '\n';
}

// ---------------------------------------------------------------------------
// Roundtrip: TriG <-> N3 (rt:graph mapping)
// ---------------------------------------------------------------------------

function parseTriG(text) {
  const p = new TriGParser(lex(text));
  return p.parseTrigDocument();
}

function parseN3(text) {
  // We only need enough N3 to read mapping triples and graph blocks,
  // which is the same as TurtleParser.parseTurtleDocument() because parseTerm supports { ... }.
  const p = new TurtleParser(lex(text));
  return p.parseTurtleDocument();
}

function parseTurtle(text) {
  const p = new TurtleParser(lex(text));
  return p.parseTurtleDocument();
}

function writeN3Triples({ triples, prefixes }) {
  const blocks = [];
  const pro = renderPrefixPrologue(prefixes, { includeRt: false }).trim();
  if (pro) blocks.push(pro, '');
  for (const tr of triples) {
    blocks.push(`${termToText(tr.s, prefixes)} ${termToText(tr.p, prefixes)} ${termToText(tr.o, prefixes)} .`);
  }
  return blocks.join('\n').trim() + '\n';
}

function turtleToN3(ttlText) {
  const { triples, prefixes } = parseTurtle(ttlText);
  return writeN3Triples({ triples, prefixes });
}

function trigToN3(trigText) {
  const { quads, prefixes } = parseTriG(trigText);
  return writeN3RtGraph({ datasetQuads: quads, prefixes });
}

function ttlToN3(ttlText) {
  // Turtle is a subset of TriG, so we reuse the TriG parser and then enforce "single graph".
  const { quads, prefixes } = parseTriG(ttlText);
  const hasNamedGraph = quads.some((q) => q.g != null);
  if (hasNamedGraph) throw new Error('Input appears to contain named graphs; use --from trig for datasets');
  return writeN3RtGraph({ datasetQuads: quads, prefixes });
}

function n3ToTtl(n3Text) {
  const { triples, prefixes } = parseN3(n3Text);

  // Turtle cannot represent datasets (rt:graph mapping).
  for (const tr of triples) {
    const isGraphMapping = tr.p instanceof Iri && tr.p.value === rt.graph && tr.o instanceof GraphTerm;
    if (isGraphMapping) throw new Error('N3 contains rt:graph dataset mapping; use --to trig instead of --to ttl');
  }

  return writeTurtle12({ triples, prefixes });
}

function n3ToTrig(n3Text) {
  const { triples, prefixes } = parseN3(n3Text);

  // Read dataset mapping:
  // - Named graphs:   <g> rt:graph { ... } .
  // - Default graph:  any other top-level triples
  // - Back-compat:    rt:default rt:graph { ... } .
  const outQuads = [];
  for (const tr of triples) {
    const isGraphMapping = tr.p instanceof Iri && tr.p.value === rt.graph && tr.o instanceof GraphTerm;

    if (isGraphMapping) {
      const g = tr.s;
      const isDefault = g instanceof Iri && g.value === rt.default; // back-compat
      for (const inner of tr.o.triples) {
        outQuads.push({ s: inner.s, p: inner.p, o: inner.o, g: isDefault ? null : g });
      }
      continue;
    }

    // regular top-level triple -> default graph
    outQuads.push({ s: tr.s, p: tr.p, o: tr.o, g: null });
  }

  // Don't leak rt: prefix into TriG output unless user explicitly had it
  if (prefixes && prefixes.map && prefixes.map.rt === RT) delete prefixes.map.rt;

  return writeTriG12Star({ quads: outQuads, prefixes });
}

// ---------------------------------------------------------------------------
// SRL <-> N3 rules (text transforms)
// ---------------------------------------------------------------------------

function hasPrefixForIri(prefixes, iri) {
  return Array.isArray(prefixes) && prefixes.some((p) => (p.iri || '').trim() === iri);
}

function logPrefixLabels(prefixes) {
  if (!Array.isArray(prefixes)) return [];
  return prefixes.filter((p) => (p.iri || '').trim() === LOG_NS).map((p) => p.label);
}

function prefixEnvFromSrlPrefixes(prefixLines) {
  const env = PrefixEnv.newDefault();
  if (Array.isArray(prefixLines)) {
    for (const { label, iri } of prefixLines) {
      const lab = (label || '').trim();
      const base = (iri || '').trim();
      if (!lab || !base) continue;
      // SRL uses "PREFIX :" for default prefix; store it as "" in PrefixEnv.
      let pfx = lab.replace(/:$/, '');
      if (pfx === ':') pfx = '';
      env.setPrefix(pfx, base);
    }
  }
  return env;
}

function parseTriplesBlockAllowImplicitDots(bodyText, env) {
  const p = new TurtleParser(lex(bodyText));
  if (env) p.prefixes = env;
  const triples = [];

  function canStartSubject(tok) {
    if (!tok) return false;
    return (
      tok.typ === 'IriRef' ||
      tok.typ === 'Ident' ||
      tok.typ === 'Var' ||
      tok.typ === 'LBracket' ||
      tok.typ === 'LParen' ||
      tok.typ === 'LBrace'
    );
  }

  while (p.peek().typ !== 'EOF') {
    // Skip stray dots (permissive)
    if (p.peek().typ === 'Dot') {
      p.next();
      continue;
    }

    const subj = p.parseTerm();

    let more;
    if (p.peek().typ === 'Dot') {
      more = [];
      if (p.pendingTriples.length > 0) {
        more = p.pendingTriples;
        p.pendingTriples = [];
      }
      p.next(); // consume dot
    } else {
      more = p.parsePredicateObjectList(subj);
      // In SPARQL graph patterns, the '.' between triple blocks is optional.
      if (p.peek().typ === 'Dot') p.next();
      else if (p.peek().typ === 'EOF') {
        /* ok */
      } else if (canStartSubject(p.peek())) {
        /* implicit separator */
      } else throw new Error(`Expected '.' or start of next triple, got ${p.peek().toString()}`);
    }

    triples.push(...more);
  }

  return triples;
}

function triplesToN3Body(triples, env) {
  // Render as explicit triple statements (with dots)
  return normalizeInsideBracesKeepStyle(
    triples.map((tr) => `${termToText(tr.s, env)} ${termToText(tr.p, env)} ${termToText(tr.o, env)} .`).join(' '),
  );
}

function mathPrefixLabels(prefixes) {
  if (!Array.isArray(prefixes)) return [];
  return prefixes.filter((p) => (p.iri || '').trim() === MATH_NS).map((p) => p.label);
}

function stringPrefixLabels(prefixes) {
  if (!Array.isArray(prefixes)) return [];
  return prefixes.filter((p) => (p.iri || '').trim() === STRING_NS).map((p) => p.label);
}

function timeFnPrefixLabels(prefixes) {
  if (!Array.isArray(prefixes)) return [];
  return prefixes.filter((p) => (p.iri || '').trim() === TIMEFN_NS).map((p) => p.label);
}

function readBalancedParens(s, i) {
  if (s[i] !== '(') throw new Error("Unclosed '(...)'");
  let depth = 0;
  let j = i;
  let inString = false;
  let quote = null;
  let escaped = false;

  for (; j < s.length; j++) {
    const ch = s[j];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }

    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return { content: s.slice(i + 1, j), endIdx: j + 1 };
      }
    }
  }

  throw new Error("Unclosed '(...)'");
}

function extractSrlDataBlocks(text) {
  const blocks = [];
  let i = 0;
  let out = '';
  const s = text || '';

  while (i < s.length) {
    const idx = s.indexOf('DATA', i);
    if (idx < 0) {
      out += s.slice(i);
      break;
    }

    const before = idx === 0 ? ' ' : s[idx - 1];
    const after = idx + 4 < s.length ? s[idx + 4] : ' ';
    if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after)) {
      i = idx + 4;
      continue;
    }

    out += s.slice(i, idx);
    let j = idx + 4;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] !== '{') {
      // Not a DATA block, keep literal "DATA"
      out += 'DATA';
      i = idx + 4;
      continue;
    }

    const blk = readBalancedBraces(s, j);
    blocks.push((blk.content || '').trim());
    i = blk.endIdx;
  }

  return { dataText: out.trim(), dataBlocks: blocks };
}

// Extract SRL FILTER(...) clauses from a WHERE body and return them as raw expressions.
function extractSrlFilters(bodyRaw) {
  const s = bodyRaw || '';
  let i = 0;
  let out = '';
  const filters = [];

  while (i < s.length) {
    const idx = s.indexOf('FILTER', i);
    if (idx < 0) {
      out += s.slice(i);
      break;
    }

    const before = idx === 0 ? ' ' : s[idx - 1];
    const after = idx + 6 < s.length ? s[idx + 6] : ' ';
    if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after)) {
      i = idx + 6;
      continue;
    }

    out += s.slice(i, idx);

    let j = idx + 6;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] !== '(') {
      // Not a FILTER(...), keep it
      out += 'FILTER';
      i = idx + 6;
      continue;
    }

    const par = readBalancedParens(s, j);
    filters.push((par.content || '').trim());
    i = par.endIdx;
  }

  return { body: normalizeInsideBracesKeepStyle(out), filters };
}

function stripOuterParensOnce(expr) {
  const t = (expr || '').trim();
  if (!t.startsWith('(') || !t.endsWith(')')) return t;
  try {
    const par = readBalancedParens(t, 0);
    // Only strip if it consumes the whole string
    if (par.endIdx === t.length) return (par.content || '').trim();
  } catch {}
  return t;
}

function splitTopLevelOr(expr) {
  // Split on '||' that occurs at paren depth 0 (ignoring strings).
  const s = expr || '';
  const parts = [];
  let buf = '';
  let depth = 0;
  let inString = false;
  let quote = null;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      buf += ch;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      buf += ch;
      continue;
    }

    if (ch === '(') {
      depth++;
      buf += ch;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      buf += ch;
      continue;
    }

    if (depth === 0 && ch === '|' && s[i + 1] === '|') {
      parts.push(buf.trim());
      buf = '';
      i++;
      continue;
    }

    buf += ch;
  }

  if (buf.trim()) parts.push(buf.trim());
  return parts.length > 1 ? parts : null;
}

function splitTopLevelAnd(expr) {
  // Split on '&&' that occurs at paren depth 0 (ignoring strings).
  const s = expr || '';
  const parts = [];
  let buf = '';
  let depth = 0;
  let inString = false;
  let quote = null;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      buf += ch;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      buf += ch;
      continue;
    }

    if (ch === '(') {
      depth++;
      buf += ch;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      buf += ch;
      continue;
    }

    if (depth === 0 && ch === '&' && s[i + 1] === '&') {
      parts.push(buf.trim());
      buf = '';
      i++;
      continue;
    }

    buf += ch;
  }

  if (buf.trim()) parts.push(buf.trim());
  return parts.length > 1 ? parts : null;
}

function splitTopLevelCommaArgs(s) {
  const parts = [];
  let buf = '';
  let depthPar = 0;
  let depthBr = 0;
  let depthSq = 0;
  let inString = false;
  let quote = null;
  let escaped = false;

  for (let i = 0; i < (s || '').length; i++) {
    const ch = s[i];

    if (inString) {
      buf += ch;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      buf += ch;
      continue;
    }

    if (ch === '(') {
      depthPar++;
      buf += ch;
      continue;
    }
    if (ch === ')') {
      depthPar--;
      buf += ch;
      continue;
    }
    if (ch === '{') {
      depthBr++;
      buf += ch;
      continue;
    }
    if (ch === '}') {
      depthBr--;
      buf += ch;
      continue;
    }
    if (ch === '[') {
      depthSq++;
      buf += ch;
      continue;
    }
    if (ch === ']') {
      depthSq--;
      buf += ch;
      continue;
    }

    if (depthPar === 0 && depthBr === 0 && depthSq === 0 && ch === ',') {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
      continue;
    }

    buf += ch;
  }

  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function bindExprToN3Statements(bindInner) {
  // bindInner is the inside of BIND(...), e.g. 'tfn:periodMinInclusive(?d) AS ?min'
  const s = (bindInner || '').trim();
  const m = s.match(/^(.*)\s+AS\s+(\?[A-Za-z_][A-Za-z0-9_-]*)\s*$/i);
  if (!m) return null;

  const expr = m[1].trim();
  const outVar = m[2].trim();

  // 1) concat(...)  ->  ( ... ) string:concatenation ?outVar .
  const mConcat = expr.match(/^concat\s*\((.*)\)\s*$/i);
  if (mConcat) {
    const argsRaw = mConcat[1];
    const args = splitTopLevelCommaArgs(argsRaw)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!args.length) return null;
    const list = `(${args.join(' ')})`;
    return { stmt: `${list} string:concatenation ${outVar} .`, usedString: true, usedTime: false };
  }

  // 2) Time Functions (Section 2.2 in the UGent time-fn paper)
  //    SRL: BIND( tfn:periodMinInclusive(?x) AS ?y )
  //    N3 : ( ?x ) tfn:periodMinInclusive ?y .
  const mFn = expr.match(/^([A-Za-z][A-Za-z0-9_-]*:[A-Za-z_][A-Za-z0-9_-]*|<[^>]+>)\s*\((.*)\)\s*$/);
  if (mFn) {
    const fnTok = mFn[1].trim();
    const argsRaw = mFn[2];

    // Determine local name (for checking we support it)
    let local = null;
    if (fnTok.startsWith('<') && fnTok.endsWith('>')) {
      const iri = fnTok.slice(1, -1);
      if (iri.startsWith(TIMEFN_NS)) local = iri.slice(TIMEFN_NS.length);
    } else {
      const idx = fnTok.indexOf(':');
      if (idx >= 0) local = fnTok.slice(idx + 1);
    }

    if (local && TIMEFN_BUILTIN_NAMES.has(local)) {
      const args = splitTopLevelCommaArgs(argsRaw)
        .map((x) => x.trim())
        .filter(Boolean);

      if (!args.length) return null;
      if (local === 'bindDefaultTimezone') {
        if (args.length !== 2) return null;
      } else {
        if (args.length !== 1) return null;
      }

      const list = `(${args.join(' ')})`;
      return { stmt: `${list} ${fnTok} ${outVar} .`, usedString: false, usedTime: true };
    }
  }

  return null;
}

function extractSrlBinds(bodyRaw) {
  const s = bodyRaw || '';
  let i = 0;
  let out = '';
  const binds = [];
  let usedString = false;
  let usedTime = false;

  while (i < s.length) {
    const idx = s.indexOf('BIND', i);
    if (idx < 0) {
      out += s.slice(i);
      break;
    }

    const before = idx === 0 ? ' ' : s[idx - 1];
    const after = idx + 4 < s.length ? s[idx + 4] : ' ';
    if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after)) {
      i = idx + 4;
      continue;
    }

    let j = idx + 4;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] !== '(') {
      out += s.slice(i, idx + 4);
      i = idx + 4;
      continue;
    }

    out += s.slice(i, idx);
    const blk = readBalancedParens(s, j);
    const inner = (blk.content || '').trim();

    const conv = bindExprToN3Statements(inner);
    if (!conv) throw new Error(`Unsupported SRL BIND expression for N3 mapping: ${inner}`);
    binds.push(conv.stmt);
    usedString = usedString || !!conv.usedString;
    usedTime = usedTime || !!conv.usedTime;

    i = blk.endIdx;
  }

  return { body: normalizeInsideBracesKeepStyle(out), binds, usedString, usedTime };
}

function parseSimpleComparison(expr) {
  const t0 = stripOuterParensOnce(expr);
  const t = (t0 || '').trim();
  if (!t) return null;

  const ops2 = ['>=', '<=', '!='];
  const ops1 = ['=', '>', '<'];

  let depth = 0;
  let inString = false;
  let quote = null;
  let escaped = false;

  function mapPred(op) {
    return op === '>'
      ? 'greaterThan'
      : op === '<'
        ? 'lessThan'
        : op === '='
          ? 'equalTo'
          : op === '!='
            ? 'notEqualTo'
            : op === '>='
              ? 'notLessThan'
              : op === '<='
                ? 'notGreaterThan'
                : null;
  }

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }

    if (ch === '(') {
      depth++;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth !== 0) continue;

    // 2-char ops first
    const two = t.slice(i, i + 2);
    if (ops2.includes(two)) {
      const left = t.slice(0, i).trim();
      const right = t.slice(i + 2).trim();
      const pred = mapPred(two);
      if (!left || !right || !pred) return null;
      return { left, op: two, right, pred };
    }

    if (ops1.includes(ch)) {
      const left = t.slice(0, i).trim();
      const right = t.slice(i + 1).trim();
      const pred = mapPred(ch);
      if (!left || !right || !pred) return null;
      return { left, op: ch, right, pred };
    }
  }

  return null;
}

function filterExprToN3Alternatives(expr) {
  // Returns an array of alternatives.
  // Each alternative is an array of N3 statements (strings) to be added to the rule body.
  const e = (expr || '').trim();
  if (!e) return null;

  const orParts = splitTopLevelOr(e);
  const options = orParts ? orParts : [e];

  const alts = [];
  for (const opt of options) {
    const andParts = splitTopLevelAnd(opt) || [opt];
    const stmts = [];

    for (const p of andParts) {
      const cmp = parseSimpleComparison(p);
      if (!cmp) return null;
      stmts.push(`${cmp.left} math:${cmp.pred} ${cmp.right} .`);
    }

    alts.push(stmts);
  }

  return alts;
}

function splitListTermsFromN3List(listInner) {
  const s = (listInner || '').trim();
  const terms = [];
  let buf = '';
  let inString = false;
  let quote = null;
  let escaped = false;
  let depthPar = 0;
  let depthBr = 0;
  let depthSq = 0;

  function flush() {
    if (buf.trim()) terms.push(buf.trim());
    buf = '';
  }

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      buf += ch;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      buf += ch;
      continue;
    }

    if (ch === '(') {
      depthPar++;
      buf += ch;
      continue;
    }
    if (ch === ')') {
      depthPar--;
      buf += ch;
      continue;
    }
    if (ch === '{') {
      depthBr++;
      buf += ch;
      continue;
    }
    if (ch === '}') {
      depthBr--;
      buf += ch;
      continue;
    }
    if (ch === '[') {
      depthSq++;
      buf += ch;
      continue;
    }
    if (ch === ']') {
      depthSq--;
      buf += ch;
      continue;
    }

    // allow commas as separators too
    if (depthPar === 0 && depthBr === 0 && depthSq === 0 && (ch === ',' || /\s/.test(ch))) {
      flush();
      continue;
    }

    buf += ch;
  }

  flush();
  return terms;
}

function extractStringBindsFromBody(bodyRaw, stringLabels) {
  const labels = Array.isArray(stringLabels) && stringLabels.length ? stringLabels : ['string:'];
  const s = bodyRaw || '';
  const binds = [];
  let out = '';
  let i = 0;

  while (i < s.length) {
    const idx = s.indexOf('(', i);
    if (idx < 0) {
      out += s.slice(i);
      break;
    }

    out += s.slice(i, idx);

    let blk;
    try {
      blk = readBalancedParens(s, idx);
    } catch {
      out += s.slice(idx, idx + 1);
      i = idx + 1;
      continue;
    }
    const inner = (blk.content || '').trim();
    let j = blk.endIdx;
    while (j < s.length && /\s/.test(s[j])) j++;

    // predicate
    const full = `<${STRING_NS}concatenation>`;
    let predLen = 0;
    let matched = false;
    if (s.startsWith(full, j)) {
      matched = true;
      predLen = full.length;
    } else {
      for (const lab of labels) {
        const tok = `${lab}concatenation`;
        if (s.startsWith(tok, j)) {
          matched = true;
          predLen = tok.length;
          break;
        }
      }
    }

    if (!matched) {
      out += '(' + inner + ')';
      i = blk.endIdx;
      continue;
    }

    j += predLen;
    while (j < s.length && /\s/.test(s[j])) j++;

    const mVar = s.slice(j).match(/^(\?[A-Za-z_][A-Za-z0-9_-]*)/);
    if (!mVar) {
      out += '(' + inner + ')';
      i = blk.endIdx;
      continue;
    }

    const outVar = mVar[1];
    j += outVar.length;

    // consume optional trailing dot
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] === '.') j++;

    const terms = splitListTermsFromN3List(inner);
    const bind = `BIND(concat(${terms.join(', ')}) AS ${outVar})`;
    binds.push(bind);

    i = j;
  }

  return { baseBody: normalizeInsideBracesKeepStyle(out), binds };
}

function extractTimeFnBindsFromBody(bodyRaw, timeLabels) {
  const labels = Array.isArray(timeLabels) && timeLabels.length ? timeLabels : [];
  const s = bodyRaw || '';
  const binds = [];
  let out = '';
  let i = 0;

  const fullPreds = Array.from(TIMEFN_BUILTIN_NAMES).map((n) => `<${TIMEFN_NS}${n}>`);

  while (i < s.length) {
    const idx = s.indexOf('(', i);
    if (idx < 0) {
      out += s.slice(i);
      break;
    }

    out += s.slice(i, idx);

    let blk;
    try {
      blk = readBalancedParens(s, idx);
    } catch {
      out += s.slice(idx, idx + 1);
      i = idx + 1;
      continue;
    }

    const inner = (blk.content || '').trim();
    let j = blk.endIdx;
    while (j < s.length && /\s/.test(s[j])) j++;

    // Predicate token after list
    let matchedLocal = null;
    let matchedPredToken = null;

    // Full IRI match
    for (const fp of fullPreds) {
      if (s.startsWith(fp, j)) {
        matchedPredToken = fp;
        matchedLocal = fp.slice(1, -1).slice(TIMEFN_NS.length);
        j += fp.length;
        break;
      }
    }

    // Prefixed match
    if (!matchedPredToken) {
      for (const lab of labels) {
        for (const local of TIMEFN_BUILTIN_NAMES) {
          const tok = `${lab}${local}`;
          if (s.startsWith(tok, j)) {
            matchedPredToken = tok;
            matchedLocal = local;
            j += tok.length;
            break;
          }
        }
        if (matchedPredToken) break;
      }
    }

    if (!matchedPredToken || !matchedLocal) {
      out += '(' + inner + ')';
      i = blk.endIdx;
      continue;
    }

    while (j < s.length && /\s/.test(s[j])) j++;

    const mVar = s.slice(j).match(/^(\?[A-Za-z_][A-Za-z0-9_-]*)/);
    if (!mVar) {
      out += '(' + inner + ')';
      i = blk.endIdx;
      continue;
    }

    const outVar = mVar[1];
    j += outVar.length;

    // consume optional trailing dot
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] === '.') j++;

    const terms = splitListTermsFromN3List(inner);
    const fnSrl = matchedPredToken.startsWith('<') && labels.length ? `${labels[0]}${matchedLocal}` : matchedPredToken;

    const bind = `BIND(${fnSrl}(${terms.join(', ')}) AS ${outVar})`;
    binds.push(bind);

    i = j;
  }

  return { baseBody: normalizeInsideBracesKeepStyle(out), binds };
}

function extractMathFiltersFromBody(bodyRaw, mathLabels) {
  const labels = Array.isArray(mathLabels) && mathLabels.length ? mathLabels : ['math:'];
  const s = bodyRaw || '';
  const filters = [];
  let out = s;

  // Predicate alternatives (prefixed + full IRI)
  const preds = [
    { name: 'greaterThan', op: '>' },
    { name: 'lessThan', op: '<' },
    { name: 'equalTo', op: '=' },
    { name: 'notEqualTo', op: '!=' },
    { name: 'notLessThan', op: '>=' },
    { name: 'notGreaterThan', op: '<=' },
  ];

  // Token-ish term matcher that works for variables, prefixed names, IRIs and typical typed literals.
  // (Not a full N3 grammar — deliberately minimal for the roundtripper subset.)
  const TERM = String.raw`(?:\?[A-Za-z_][A-Za-z0-9_-]*|<[^>]*>|[A-Za-z][A-Za-z0-9_-]*:[A-Za-z0-9_.-]+|_:[A-Za-z0-9_-]+|"[^"\\]*(?:\\.[^"\\]*)*"(?:(?:\^\^)[^\s;]+|@[A-Za-z0-9-]+)?|[-+]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)`;

  for (const { name, op } of preds) {
    const full = `<${MATH_NS}${name}>`;
    const pref = labels.map((lab) => `${lab}${name}`);

    const predGroup = [full, ...pref.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))].join('|');

    const reStmt = new RegExp(
      '(^|[\\s;\\n\\r\\t])' + `(${TERM})\\s+` + `(?:${predGroup})\\s+` + `(${TERM})\\s*\\.?(?=\\s|$)`,
      'g',
    );

    out = out.replace(reStmt, (m0, lead, left, right) => {
      filters.push({ expr: `${left} ${op} ${right}` });
      return lead || ' ';
    });
  }

  return { baseBody: normalizeInsideBracesKeepStyle(out), filters };
}

// SRL:   NOT { ... }
// N3 :   (1 { ... } ()) log:collectAllIn ?SCOPE .
function srlWhereBodyToN3Body(bodyRaw) {
  const s = bodyRaw || '';
  let i = 0;
  let out = '';
  let usedLog = false;

  while (i < s.length) {
    const idx = s.indexOf('NOT', i);
    if (idx < 0) {
      out += s.slice(i);
      break;
    }

    // token boundary check for "NOT"
    const before = idx === 0 ? ' ' : s[idx - 1];
    const after = idx + 3 < s.length ? s[idx + 3] : ' ';
    if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after)) {
      i = idx + 3;
      continue;
    }

    // Look ahead for "{"
    let j = idx + 3;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] !== '{') {
      // Not a negation element; keep the text and continue
      out += s.slice(i, idx + 3);
      i = idx + 3;
      continue;
    }

    // Capture the NOT {...} block
    out += s.slice(i, idx);
    const blk = readBalancedBraces(s, j);
    const inner = (blk.content || '').trim();

    out += ` (1 { ${inner} } ()) log:collectAllIn ?SCOPE . `;
    usedLog = true;
    i = blk.endIdx;
  }

  return { body: normalizeInsideBracesKeepStyle(out), usedLog };
}

// N3 :   (1 { ... } ()) log:collectAllIn ?SCOPE .
// SRL:   NOT { ... }
function n3BodyToSrlWhereBody(bodyRaw, logLabels) {
  const s = bodyRaw || '';
  const labels = Array.isArray(logLabels) && logLabels.length ? logLabels : ['log:'];
  const scope = '?SCOPE';

  const predTokens = [`<${LOG_NS}collectAllIn>`, ...labels.map((lab) => `${lab}collectAllIn`)];
  let i = 0;
  let out = '';

  function isBoundary(ch) {
    return ch == null || /\s/.test(ch) || '{}();,.\n\r\t'.includes(ch);
  }

  while (i < s.length) {
    // Find the next collectAllIn predicate occurrence
    let bestPos = -1;
    let bestTok = null;
    for (const tok of predTokens) {
      const pos = s.indexOf(tok, i);
      if (pos >= 0 && (bestPos < 0 || pos < bestPos)) {
        bestPos = pos;
        bestTok = tok;
      }
    }

    if (bestPos < 0) {
      out += s.slice(i);
      break;
    }

    const predPos = bestPos;

    // Subject must be a (...) list ending right before the predicate
    let k = predPos - 1;
    while (k >= 0 && /\s/.test(s[k])) k--;
    if (k < 0 || s[k] !== ')') {
      out += s.slice(i, predPos + bestTok.length);
      i = predPos + bestTok.length;
      continue;
    }
    const subjEndIdx = k + 1;

    // Find the matching '(' for this ')'
    let subjStart = -1;
    let subjPar = null;
    let searchFrom = k;

    while (true) {
      const cand = s.lastIndexOf('(', searchFrom);
      if (cand < 0) break;
      const before = cand === 0 ? null : s[cand - 1];
      if (!isBoundary(before)) {
        searchFrom = cand - 1;
        continue;
      }
      try {
        const par = readBalancedParens(s, cand);
        if (par.endIdx === subjEndIdx) {
          subjStart = cand;
          subjPar = par;
          break;
        }
      } catch {}
      searchFrom = cand - 1;
    }

    if (subjStart < 0 || !subjPar) {
      out += s.slice(i, predPos + bestTok.length);
      i = predPos + bestTok.length;
      continue;
    }

    // Match: (1 { ... } ()) log:collectAllIn ?SCOPE .
    const terms = splitListTermsFromN3List(subjPar.content);
    if (terms.length !== 3) {
      out += s.slice(i, predPos + bestTok.length);
      i = predPos + bestTok.length;
      continue;
    }
    const t0 = (terms[0] || '').trim();
    const t1 = (terms[1] || '').trim();
    const t2 = (terms[2] || '').trim();

    if (t0 !== '1' || t2 !== '()' || !t1.startsWith('{')) {
      out += s.slice(i, predPos + bestTok.length);
      i = predPos + bestTok.length;
      continue;
    }

    let inner = null;
    try {
      const blk = readBalancedBraces(t1, 0);
      inner = (blk.content || '').trim();
    } catch {
      out += s.slice(i, predPos + bestTok.length);
      i = predPos + bestTok.length;
      continue;
    }

    // Object must be ?SCOPE (scope position); consume optional trailing '.'
    let j = predPos + bestTok.length;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (!s.startsWith(scope, j)) {
      out += s.slice(i, predPos + bestTok.length);
      i = predPos + bestTok.length;
      continue;
    }
    j += scope.length;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] === '.') j++;

    out += s.slice(i, subjStart);
    out += `NOT { ${inner} } `;
    i = j;
  }

  return normalizeInsideBracesKeepStyle(out);
}

function stripOnlyWholeLineHashComments(src) {
  // IMPORTANT: do NOT treat '#' as an inline comment marker here,
  // because IRIs commonly contain '#', e.g. <http://example.org/#>.
  return src
    .split('\n')
    .map((line) => (line.trim().startsWith('#') ? '' : line))
    .join('\n');
}

function normalizeInsideBracesKeepStyle(s) {
  return (s || '').trim().replace(/\s+/g, ' ').trim();
}

function srlDollarVarsToQVars(text) {
  // SHACL SPARQL uses $this/$value; N3 uses ?vars.
  // Convert $name -> ?name, ignoring occurrences inside strings.
  const s = text || '';
  let out = '';
  let inString = false;
  let quote = null;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += ch;
      continue;
    }

    if (ch === '$') {
      let j = i + 1;
      let name = '';
      while (j < s.length && /[A-Za-z0-9_\-]/.test(s[j])) {
        name += s[j];
        j++;
      }
      if (name.length) {
        out += '?' + name;
        i = j - 1;
        continue;
      }
    }

    out += ch;
  }

  return out;
}

function indentLines(s, n) {
  const pad = ' '.repeat(n);
  return (s || '')
    .split('\n')
    .map((line) => (line.trim().length ? pad + line : line))
    .join('\n');
}

function parseSrlPrefixLines(src) {
  const prefixes = [];
  const other = [];

  for (const rawLine of src.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const m = line.match(/^PREFIX\s+([^\s]+)\s*<([^>]+)>\s*\.?\s*$/i);
    if (m) prefixes.push({ label: m[1].trim(), iri: m[2].trim() });
    else other.push(rawLine);
  }

  return { prefixes, rest: other.join('\n') };
}

function parseN3PrefixLines(src) {
  const prefixes = [];
  const other = [];

  for (const rawLine of src.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const m = line.match(/^@prefix\s+([^\s]+)\s*<([^>]+)>\s*\.\s*$/i);
    if (m) prefixes.push({ label: m[1].trim(), iri: m[2].trim() });
    else other.push(rawLine);
  }

  return { prefixes, rest: other.join('\n') };
}

function readBalancedBraces(src, startIdx) {
  if (src[startIdx] !== '{') throw new Error("Expected '{'");

  let i = startIdx;
  let depth = 0;
  let inString = false;
  let quote = null;
  let escaped = false;
  let out = '';

  for (; i < src.length; i++) {
    const ch = src[i];

    if (inString) {
      out += ch;

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    // Treat \" or \' outside strings as literal quotes (common when SRL is copy-pasted from JS strings)
    if ((ch === '"' || ch === "'") && i > 0 && src[i - 1] === '\\') {
      out += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += ch;
      continue;
    }

    if (ch === '{') {
      depth++;
      if (depth > 1) out += ch;
      continue;
    }

    if (ch === '}') {
      depth--;
      if (depth === 0) return { content: out, endIdx: i + 1 };
      out += ch;
      continue;
    }

    if (depth >= 1) out += ch;
  }

  throw new Error("Unclosed '{...}'");
}

function extractSrlRules(src) {
  const rules = [];
  let i = 0;
  let dataParts = [];
  const s = src;

  while (i < s.length) {
    const idx = s.indexOf('RULE', i);
    if (idx < 0) {
      dataParts.push(s.slice(i));
      break;
    }

    const before = idx === 0 ? ' ' : s[idx - 1];
    const after = idx + 4 < s.length ? s[idx + 4] : ' ';
    if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after)) {
      i = idx + 4;
      continue;
    }

    dataParts.push(s.slice(i, idx));
    i = idx + 4;

    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] !== '{') throw new Error("SRL parse error: expected '{' after RULE");
    const head = readBalancedBraces(s, i);
    i = head.endIdx;

    while (i < s.length && /\s/.test(s[i])) i++;
    if (!s.slice(i, i + 5).match(/^WHERE/i)) throw new Error('SRL parse error: expected WHERE');
    i += 5;

    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] !== '{') throw new Error("SRL parse error: expected '{' after WHERE");
    const body = readBalancedBraces(s, i);
    i = body.endIdx;

    rules.push({ head: head.content, body: body.content });
  }

  return { dataText: dataParts.join('').trim(), rules };
}

function extractN3Rules(src) {
  const rules = [];
  let i = 0;
  let dataParts = [];
  const s = src;

  while (i < s.length) {
    const idx = s.indexOf('{', i);
    if (idx < 0) {
      dataParts.push(s.slice(i));
      break;
    }

    dataParts.push(s.slice(i, idx));
    i = idx;

    let body;
    try {
      body = readBalancedBraces(s, i);
    } catch {
      dataParts.push('{');
      i++;
      continue;
    }

    let j = body.endIdx;
    while (j < s.length && /\s/.test(s[j])) j++;

    if (!(s[j] === '=' && s[j + 1] === '>')) {
      dataParts.push(s.slice(i, body.endIdx));
      i = body.endIdx;
      continue;
    }
    j += 2;

    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] !== '{') {
      dataParts.push(s.slice(i, body.endIdx));
      i = body.endIdx;
      continue;
    }

    let head;
    try {
      head = readBalancedBraces(s, j);
    } catch {
      dataParts.push(s.slice(i, body.endIdx));
      i = body.endIdx;
      continue;
    }

    let k = head.endIdx;
    while (k < s.length && /\s/.test(s[k])) k++;
    if (s[k] === '.') k++;

    rules.push({ body: body.content, head: head.content });
    i = k;
  }

  return { dataText: dataParts.join('').trim(), rules };
}

function srlToN3(srlText) {
  const cleaned = stripOnlyWholeLineHashComments(srlText);
  const { prefixes, rest } = parseSrlPrefixLines(cleaned);
  const { dataText, rules } = extractSrlRules(rest);
  const env = prefixEnvFromSrlPrefixes(prefixes);

  // DATA { ... } blocks are SRL-only; map their content to plain N3 data triples.
  const dataExtract = extractSrlDataBlocks(dataText);
  const dataOutside = dataExtract.dataText || '';
  const dataBlocks = dataExtract.dataBlocks || [];

  // Convert rules first so we know whether we need log:/math:
  const renderedRules = [];
  let needsLog = false;
  let needsMath = false;
  let needsString = false;

  for (const r of rules) {
    // 1) NOT { ... }  ->  (1 { ... } ()) log:collectAllIn ?SCOPE .
    const convNot = srlWhereBodyToN3Body(r.body);
    needsLog = needsLog || convNot.usedLog;
    if (convNot.usedLog && !env.map.log) env.setPrefix('log', LOG_NS);

    // 2) FILTER(...) -> math:* builtins (possibly multiple alternative rules for OR)
    const convFilter = extractSrlFilters(convNot.body);
    const bodyNoFilter = convFilter.body;
    const filterExprs = convFilter.filters;

    // 3) BIND(concat(... ) AS ?v) -> string:concatenation builtins
    const convBind = extractSrlBinds(bodyNoFilter);
    const bodyNoBind = convBind.body;
    const bindBuiltins = convBind.binds;
    if (convBind.usedString) {
      needsString = true;
      if (!env.map.string) env.setPrefix('string', STRING_NS);
    }

    // Build rule alternatives (disjunction => multiple rules)
    let alts = [{ builtins: [] }];

    for (const f of filterExprs) {
      const n3alts = filterExprToN3Alternatives(f);
      if (!n3alts) {
        throw new Error(`Unsupported SRL FILTER expression for N3 mapping: ${f}`);
      }

      needsMath = true;
      if (!env.map.math) env.setPrefix('math', MATH_NS);

      // Expand OR alternatives
      const next = [];
      for (const a of alts) {
        for (const option of n3alts) {
          next.push({ builtins: a.builtins.concat(option) });
        }
      }
      alts = next;
    }

    const head = srlDollarVarsToQVars(normalizeInsideBracesKeepStyle(r.head));

    for (const a of alts) {
      const extra = a.builtins.length ? ` ${a.builtins.join(' ')} ` : '';
      const bindExtra = bindBuiltins.length ? ` ${bindBuiltins.join(' ')} ` : '';
      const combined = `${bodyNoBind} ${extra} ${bindExtra}`.trim();
      const triples = parseTriplesBlockAllowImplicitDots(combined, env);
      const body = triplesToN3Body(triples, env);
      renderedRules.push(`{ ${body} } => { ${head} } .`);
    }
  }

  const out = [];

  for (const { label, iri } of prefixes) out.push(`@prefix ${label} <${iri}> .`);
  if (needsLog && !hasPrefixForIri(prefixes, LOG_NS)) out.push(`@prefix log: <${LOG_NS}> .`);
  if (needsMath && !hasPrefixForIri(prefixes, MATH_NS)) out.push(`@prefix math: <${MATH_NS}> .`);
  if (needsString && !hasPrefixForIri(prefixes, STRING_NS)) out.push(`@prefix string: <${STRING_NS}> .`);
  if (prefixes.length || needsLog || needsMath || needsString) out.push('');

  // Emit "plain" data triples first (outside SRL DATA blocks)
  if (dataOutside.trim()) out.push(dataOutside.trim(), '');

  // Emit each SRL DATA { ... } block as plain N3 data triples
  for (const blk of dataBlocks) {
    if (blk.trim()) out.push(blk.trim(), '');
  }

  out.push(...renderedRules);

  return out.join('\n').trim() + '\n';
}

function n3ToSrl(n3Text) {
  const cleaned = stripOnlyWholeLineHashComments(n3Text);
  const { prefixes, rest } = parseN3PrefixLines(cleaned);
  const { dataText, rules } = extractN3Rules(rest);

  const out = [];

  for (const { label, iri } of prefixes) out.push(`PREFIX ${label} <${iri}>`);
  if (prefixes.length) out.push('');

  // N3 has no explicit SRL DATA block marker, so we serialize top-level data as DATA { ... }.
  if (dataText.trim()) {
    const inner = dataText.trim();
    if (inner.includes('\n')) {
      out.push('DATA {');
      out.push(indentLines(inner, 2));
      out.push('}', '');
    } else {
      out.push(`DATA { ${inner} }`, '');
    }
  }

  const logLabels = logPrefixLabels(prefixes);
  const mathLabels = mathPrefixLabels(prefixes);
  const stringLabels = stringPrefixLabels(prefixes);
  const timeLabels = timeFnPrefixLabels(prefixes);

  // First pass: convert bodies, extract FILTER-able math statements, and group for possible OR merge.
  const cooked = [];
  for (const r of rules) {
    const head = normalizeInsideBracesKeepStyle(r.head);

    // NOT mapping
    const body1 = n3BodyToSrlWhereBody(r.body, logLabels);

    // FILTER mapping (math builtins)
    const ex = extractMathFiltersFromBody(body1, mathLabels);
    const bx = extractStringBindsFromBody(ex.baseBody, stringLabels);
    const tx = extractTimeFnBindsFromBody(bx.baseBody, timeLabels);

    cooked.push({
      head,
      baseBody: tx.baseBody,
      filters: ex.filters.map((f) => f.expr),
      binds: (bx.binds || []).concat(tx.binds || []),
    });
  }

  // Group by head + baseBody to optionally merge disjunctions into a single FILTER with '||'
  const groups = new Map();
  for (const r of cooked) {
    const key = `${r.head}@@${r.baseBody}@@${(r.binds || []).join(' ')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  for (const group of groups.values()) {
    if (group.length === 1) {
      const r = group[0];
      const filterText = r.filters.map((e) => `FILTER ( ${e} )`).join(' ');
      const bindText = (r.binds || []).join(' ');
      const body = normalizeInsideBracesKeepStyle(`${r.baseBody} ${filterText} ${bindText}`.trim());
      out.push(`RULE { ${r.head} } WHERE { ${body} }`);
      continue;
    }

    // Try OR merge: same head+baseBody and each has exactly one filter expression
    const ok = group.every((r) => r.filters.length === 1);
    if (ok) {
      const parts = group.map((r) => r.filters[0]);
      const orExpr = parts.map((p) => `( ${p} )`).join(' || ');
      const body = normalizeInsideBracesKeepStyle(`${group[0].baseBody} FILTER ( ${orExpr} )`.trim());
      out.push(`RULE { ${group[0].head} } WHERE { ${body} }`);
      continue;
    }

    // Fallback: emit them as separate rules
    for (const r of group) {
      const filterText = r.filters.map((e) => `FILTER ( ${e} )`).join(' ');
      const bindText = (r.binds || []).join(' ');
      const body = normalizeInsideBracesKeepStyle(`${r.baseBody} ${filterText} ${bindText}`.trim());
      out.push(`RULE { ${r.head} } WHERE { ${body} }`);
    }
  }

  return out.join('\n').trim() + '\n';
}

// ---------------------------------------------------------------------------
// Demo + CLI
// ---------------------------------------------------------------------------

const EXAMPLE_TRIG = `@prefix ex: <http://example.org/#> .

ex:s ex:p "o" .

_:g1 {
  ex:s ex:p "o1" .
}

_:g2 {
  ex:s ex:p "o2" .
}
`;

const EXAMPLE_SRL = `PREFIX : <http://example.org/#>

DATA { :A :fatherOf :X . :B :motherOf :X . :C :motherOf :A . }

RULE { ?x :childOf ?y } WHERE { ?y :fatherOf ?x }
RULE { ?x :childOf ?y } WHERE { ?y :motherOf ?x }

RULE { ?x :descendedFrom ?y } WHERE { ?x :childOf ?y }
RULE { ?x :descendedFrom ?y } WHERE { ?x :childOf ?z . ?z :childOf ?y }

RULE { ?x :ancestorOf ?y } WHERE { ?y :descendedFrom ?x }
RULE { ?a :ancestorOf ?b } WHERE { ?a :ancestorOf ?c . ?c :ancestorOf ?b }
`;

function quadToNQuadString(q) {
  function term(t) {
    if (t == null) return '';
    if (t instanceof Iri) return `<${t.value}>`;
    if (t instanceof Blank) return t.label;
    if (t instanceof Literal) return t.value;
    return String(t);
  }
  const g = q.g == null ? '' : ` ${term(q.g)}`;
  return `${term(q.s)} ${term(q.p)} ${term(q.o)}${g} .`;
}

function sortedNQuadsFromTriG(trigText) {
  const { quads } = parseTriG(trigText);
  return quads
    .map(quadToNQuadString)
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join('\n');
}

function printHelp() {
  process.stdout.write(
    `return.js — RDF 1.2 Turtle/TriG <-> N3

Conversions:
  node return.js --from ttl  --to n3   input.ttl  > out.n3
  node return.js --from trig --to n3   input.trig > out.n3

  node return.js --from n3   --to ttl  input.n3   > out.ttl
  node return.js --from n3   --to trig input.n3   > out.trig

  node return.js --from srl  --to n3   input.srl  > out.n3
  node return.js --from n3   --to srl  input.n3   > out.srl

Notes:
  * TriG datasets are represented in N3 using: <g> rt:graph { ... } .
  * RDF 1.2 triple terms / Turtle-star are represented in N3 as a single-triple graph term:
      rdf:reifies { s p o . } .

Options:
  --help
`,
  );
}

async function readStdinUtf8() {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
  });
}

function printHelp() {
  process.stdout.write(`Usage:
  n3 <file.ttl|file.trig|file.srl>

Converts RDF 1.2 Turtle/TriG and SHACL 1.2 Rules to N3.

Examples:
  n3 file.ttl > file.n3
  n3 file.trig > file.n3
  n3 file.srl > file.n3
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    if (args.length === 0) process.exitCode = 2;
    return;
  }
  if (args.length !== 1) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const inputFile = args[0];
  const ext = path.extname(inputFile).toLowerCase();

  const text = await fs.readFile(inputFile, 'utf8');

  if (ext === '.ttl') {
    process.stdout.write(turtleToN3(text));
    return;
  }
  if (ext === '.trig') {
    process.stdout.write(trigToN3(text));
    return;
  }
  if (ext === '.srl') {
    process.stdout.write(srlToN3(text));
    return;
  }

  throw new Error(`Unsupported file extension "${ext}". Use .ttl, .trig or .srl`);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exitCode = 1;
});
