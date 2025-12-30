#!/usr/bin/env node
'use strict';

/*
 * return.js — Roundtripper RDF+SRL N3.
 *
 * TriG<->N3
 *   <graphName> rt:graph { ...triples... } .
 *
 * SRL<->N3
 *   SRL: RULE { Head } WHERE { Body }
 *   N3:  { Body } => { Head } .
 *
 * ----------------------------------------------------------------------------
 * Usage
 *   node return.js --help
 *   node return.js --demo trig
 *   node return.js --demo srl [--reason]
 *
 *   node return.js --from trig --to n3   input.trig > out.n3
 *   node return.js --from n3   --to trig input.n3   > out.trig
 *
 *   node return.js --from srl  --to n3   input.srl  > out.n3
 *   node return.js --from n3   --to srl  input.n3   > out.srl
 *
 * Optional:
 *   --reason  Run eyeling on produced N3 (if eyeling is available)
 */

const fs = require('node:fs/promises');
const process = require('node:process');

// Eyeling (optional)
let reason = null;
try {
  ({ reason } = require('eyeling'));
} catch {
  try {
    ({ reason } = require('./index.js')); // if running inside eyeling repo
  } catch {
    reason = null;
  }
}

// ---------------------------------------------------------------------------
// Mapping namespace
// ---------------------------------------------------------------------------

const RT = 'urn:return#';
const rt = {
  default: `${RT}default`,
  graph: `${RT}graph`,
};

// ---------------------------------------------------------------------------
// Minimal Turtle/N3 model + lexer + parser (adapted from eyeling.js)
// ---------------------------------------------------------------------------

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';

// Avoid literal triple-quote sequences in this source (helps embedding in tools).
const DQ3 = '"'.repeat(3);
const SQ3 = "'".repeat(3);

function resolveIriRef(ref, base) {
  if (!base) return ref;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) return ref; // already absolute
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
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
class FormulaTerm extends Term {
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

// -------------------- LEXER (adapted) --------------------

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
      case 't': out += '\t'; break;
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      case '"': out += '"'; break;
      case "'": out += "'"; break;
      case '\\': out += '\\'; break;
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
    if (c === '<') {
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
    if ('{}()[];,.'.includes(c)) {
      const mapping = {
        '{': 'LBrace',
        '}': 'RBrace',
        '(': 'LParen',
        ')': 'RParen',
        '[': 'LBracket',
        ']': 'RBracket',
        ';': 'Semicolon',
        ',': 'Comma',
        '.': 'Dot',
      };
      tokens.push(new Token(mapping[c]));
      i++;
      continue;
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
        const tagChars = [];
        let cc = peek();
        if (cc === null || !/[A-Za-z]/.test(cc)) throw new Error("Invalid language tag (expected [A-Za-z] after '@')");
        while ((cc = peek()) !== null && /[A-Za-z]/.test(cc)) {
          tagChars.push(cc);
          i++;
        }
        while ((cc = peek()) === '-') {
          tagChars.push('-');
          i++;
          const segChars = [];
          let dd = peek();
          if (dd === null || !/[A-Za-z0-9]/.test(dd)) throw new Error("Invalid language tag (expected [A-Za-z0-9]+ after '-')");
          while ((dd = peek()) !== null && /[A-Za-z0-9]/.test(dd)) {
            segChars.push(dd);
            i++;
          }
          if (!segChars.length) throw new Error("Invalid language tag (expected [A-Za-z0-9]+ after '-')");
          tagChars.push(...segChars);
        }
        tokens.push(new Token('LangTag', tagChars.join('')));
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

    // 8) numeric literals (int/float)
    if (/[0-9]/.test(c) || (c === '-' && peek(1) !== null && /[0-9]/.test(peek(1)))) {
      const numChars = [c];
      i++;
      while (i < n) {
        const cc = chars[i];
        if (/[0-9]/.test(cc)) {
          numChars.push(cc);
          i++;
          continue;
        }
        if (cc === '.' && i + 1 < n && /[0-9]/.test(chars[i + 1])) {
          numChars.push(cc);
          i++;
          continue;
        }
        break;
      }
      if (i < n && (chars[i] === 'e' || chars[i] === 'E')) {
        let j = i + 1;
        if (j < n && (chars[j] === '+' || chars[j] === '-')) j++;
        if (j < n && /[0-9]/.test(chars[j])) {
          numChars.push(chars[i]);
          i++;
          if (i < n && (chars[i] === '+' || chars[i] === '-')) {
            numChars.push(chars[i]);
            i++;
          }
          while (i < n && /[0-9]/.test(chars[i])) {
            numChars.push(chars[i]);
            i++;
          }
        }
      }
      tokens.push(new Token('Literal', numChars.join('')));
      continue;
    }

    // 9) var: ?x
    if (c === '?') {
      i++;
      const nameChars = [];
      let cc;
      while ((cc = peek()) !== null && isNameChar(cc)) {
        nameChars.push(cc);
        i++;
      }
      if (!nameChars.length) throw new Error("Expected variable name after '?'");
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

// -------------------- PARSER (Turtle + N3-formulas; TriG extension separately) --------------------

class TurtleParser {
  constructor(tokens) {
    this.toks = tokens;
    this.pos = 0;
    this.prefixes = PrefixEnv.newDefault();
    this.blankCounter = 0;
    this.pendingTriples = [];
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
        if (!(s.startsWith('"') && s.endsWith('"'))) throw new Error('Language tag is only allowed on quoted string literals');
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
    if (typ === 'LBrace') return this.parseFormula(); // N3 formula term

    throw new Error(`Unexpected term token: ${tok.toString()}`);
  }

  parseList() {
    const elems = [];
    while (this.peek().typ !== 'RParen') {
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
  parseFormula() {
    const triples = [];
    while (this.peek().typ !== 'RBrace') {
      const subj = this.parseTerm();

      let more;
      if (this.peek().typ === 'Dot') {
        more = [];
        if (this.pendingTriples.length > 0) {
          more = this.pendingTriples;
          this.pendingTriples = [];
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
    return new FormulaTerm(triples);
  }

  parsePredicateObjectList(subject) {
    const out = [];

    if (this.pendingTriples.length > 0) {
      out.push(...this.pendingTriples);
      this.pendingTriples = [];
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
        const f = this.parseFormula();
        if (this.peek().typ === 'Dot') this.next(); // accept optional '.'
        for (const tr of f.triples) quads.push({ s: tr.s, p: tr.p, o: tr.o, g: null });
        continue;
      }

      // Either a Turtle triple in default graph, or a named graph block: graphName { ... }
      const first = this.parseTerm();

      if (this.peek().typ === 'LBrace') {
        this.next(); // consume '{'
        const f = this.parseFormula();
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
    const qn = prefixes ? prefixes.shrinkIri(t.value) : null;
    return qn || `<${t.value}>`;
  }
  if (t instanceof Blank) return t.label;
  if (t instanceof Literal) return t.value;
  if (t instanceof Var) return `?${t.name}`;
  if (t instanceof ListTerm) return `(${t.elems.map((x) => termToText(x, prefixes)).join(' ')})`;
  if (t instanceof OpenListTerm) return `(${t.prefix.map((x) => termToText(x, prefixes)).join(' ')} ... ?${t.tailVar})`;
  if (t instanceof FormulaTerm) {
    const inner = t.triples.map((tr) => `${termToText(tr.s, prefixes)} ${termToText(tr.p, prefixes)} ${termToText(tr.o, prefixes)} .`).join(' ');
    return `{ ${inner} }`;
  }
  return String(t);
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
    for (const tr of triples) blocks.push(`${termToText(tr.s, prefixes)} ${termToText(tr.p, prefixes)} ${termToText(tr.o, prefixes)} .`);
    blocks.push('');
  }

  // Named graphs
  const named = [...grouped.entries()].filter(([k]) => k !== 'DEFAULT');
  named.sort((a, b) => a[0].localeCompare(b[0]));

  for (const [, { gTerm, triples }] of named) {
    blocks.push(`${termToText(gTerm, prefixes)} {`);
    for (const tr of triples) blocks.push(`  ${termToText(tr.s, prefixes)} ${termToText(tr.p, prefixes)} ${termToText(tr.o, prefixes)} .`);
    blocks.push('}', '');
  }

  return blocks.join('\n').trim() + '\n';
}

function writeN3RtGraph({ datasetQuads, prefixes }) {
  const blocks = [];
  const pro = renderPrefixPrologue(prefixes, { includeRt: true }).trim();
  if (pro) blocks.push(pro, '');

  const grouped = groupQuadsByGraph(datasetQuads);

  function writeFormulaTriples(triples) {
    return triples.map((tr) => `  ${termToText(tr.s, prefixes)} ${termToText(tr.p, prefixes)} ${termToText(tr.o, prefixes)} .`).join('\n');
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
    if (triples.length) blocks.push(writeFormulaTriples(triples));
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
  // We only need enough N3 to read mapping triples and formula blocks,
  // which is the same as TurtleParser.parseTurtleDocument() because parseTerm supports { ... }.
  const p = new TurtleParser(lex(text));
  return p.parseTurtleDocument();
}

function trigToN3(trigText) {
  const { quads, prefixes } = parseTriG(trigText);
  return writeN3RtGraph({ datasetQuads: quads, prefixes });
}

function n3ToTrig(n3Text) {
  const { triples, prefixes } = parseN3(n3Text);

  // Read dataset mapping:
  // - Named graphs:   <g> rt:graph { ... } .
  // - Default graph:  any other top-level triples
  // - Back-compat:    rt:default rt:graph { ... } .
  const outQuads = [];
  for (const tr of triples) {
    const isGraphMapping =
      tr.p instanceof Iri &&
      tr.p.value === rt.graph &&
      tr.o instanceof FormulaTerm;

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

  return writeTriG({ quads: outQuads, prefixes });
}

// ---------------------------------------------------------------------------
// SRL <-> N3 rules (text transforms)
// ---------------------------------------------------------------------------

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
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
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

  const out = [];

  for (const { label, iri } of prefixes) out.push(`@prefix ${label} <${iri}> .`);
  if (prefixes.length) out.push('');

  if (dataText.trim()) out.push(dataText.trim(), '');

  for (const r of rules) {
    const body = normalizeInsideBracesKeepStyle(r.body);
    const head = normalizeInsideBracesKeepStyle(r.head);
    out.push(`{ ${body} } => { ${head} } .`);
  }

  return out.join('\n').trim() + '\n';
}

function n3ToSrl(n3Text) {
  const cleaned = stripOnlyWholeLineHashComments(n3Text);
  const { prefixes, rest } = parseN3PrefixLines(cleaned);
  const { dataText, rules } = extractN3Rules(rest);

  const out = [];

  for (const { label, iri } of prefixes) out.push(`PREFIX ${label} <${iri}>`);
  if (prefixes.length) out.push('');

  if (dataText.trim()) out.push(dataText.trim(), '');

  for (const r of rules) {
    const body = normalizeInsideBracesKeepStyle(r.body);
    const head = normalizeInsideBracesKeepStyle(r.head);
    out.push(`RULE { ${head} } WHERE { ${body} }`);
  }

  return out.join('\n').trim() + '\n';
}

// ---------------------------------------------------------------------------
// Demo + CLI
// ---------------------------------------------------------------------------

const EXAMPLE_TRIG = `@prefix ex: <http://example.org/#> .

ex:s ex:p "o" .

ex:g1 {
  ex:s ex:p "o1" .
}

ex:g2 {
  ex:s ex:p "o2" .
}
`;

const EXAMPLE_SRL = `PREFIX : <http://example.org/#>

:A :fatherOf :X .
:B :motherOf :X .
:C :motherOf :A .

RULE { ?x :childOf ?y } WHERE { ?y :fatherOf ?x }
RULE { ?x :childOf ?y } WHERE { ?y :motherOf ?x }

RULE { ?x :descendedFrom ?y } WHERE { ?x :childOf ?y }
RULE { ?x :descendedFrom ?y } WHERE { ?x :childOf ?z . ?z :childOf ?y }
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
  return quads.map(quadToNQuadString).map((s) => s.trim()).filter(Boolean).sort().join('\n');
}

function printHelp() {
  process.stdout.write(
`return.js — TriG<->N3 (rt:graph) and SRL<->N3 (rules)

Demos:
  node return.js --demo trig
  node return.js --demo srl [--reason]

TriG dataset roundtrip via rt:graph:
  node return.js --from trig --to n3   input.trig > out.n3
  node return.js --from n3   --to trig input.n3   > out.trig

SRL (PREFIX + RULE/WHERE) <-> N3 rules:
  node return.js --from srl  --to n3   input.srl > out.n3
  node return.js --from n3   --to srl  input.n3  > out.srl

Options:
  --help
  --reason   run eyeling on produced N3 (if available)
`
  );
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (f) => args.includes(f);

  if (args.length === 0 || flag('--help') || flag('-h')) {
    printHelp();
    return;
  }

  const inputFile = (() => {
    const skipNext = new Set(['--from', '--to', '--demo']);
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (skipNext.has(a)) {
        i++;
        continue;
      }
      if (a.startsWith('-')) continue;
      return a;
    }
    return null;
  })();
  const from = (() => {
    const i = args.indexOf('--from');
    return i >= 0 ? args[i + 1] : null;
  })();
  const to = (() => {
    const i = args.indexOf('--to');
    return i >= 0 ? args[i + 1] : null;
  })();
  const demo = (() => {
    const i = args.indexOf('--demo');
    return i >= 0 ? args[i + 1] : null;
  })();

  const doReason = flag('--reason');

  if (demo === 'trig') {
    const n3 = trigToN3(EXAMPLE_TRIG);
    const trig2 = n3ToTrig(n3);

    const eq = sortedNQuadsFromTriG(EXAMPLE_TRIG) === sortedNQuadsFromTriG(trig2);

    process.stdout.write('### INPUT (TriG)\n');
    process.stdout.write(EXAMPLE_TRIG + '\n');
    process.stdout.write('### OUTPUT (N3 rt:graph mapping)\n');
    process.stdout.write(n3 + '\n');
    process.stdout.write('### ROUNDTRIPPED (TriG)\n');
    process.stdout.write(trig2 + '\n');
    process.stdout.write(`### CHECK\nRoundtrip equal (sorted N-Quads): ${eq}\n`);
    return;
  }

  if (demo === 'srl') {
    const n3 = srlToN3(EXAMPLE_SRL);
    const srl2 = n3ToSrl(n3);

    process.stdout.write('### INPUT (SRL)\n');
    process.stdout.write(EXAMPLE_SRL + '\n');
    process.stdout.write('### OUTPUT (N3)\n');
    process.stdout.write(n3 + '\n');
    process.stdout.write('### ROUNDTRIPPED (SRL)\n');
    process.stdout.write(srl2 + '\n');

    if (doReason && reason) {
      const derived = reason({ proofComments: false }, n3);
      process.stderr.write('\n# eyeling derived facts:\n');
      process.stderr.write(derived + '\n');
    }
    return;
  }

  const text = inputFile
    ? await fs.readFile(inputFile, 'utf8')
    : (from === 'srl' || to === 'srl')
      ? EXAMPLE_SRL
      : EXAMPLE_TRIG;

  if (from === 'trig' && to === 'n3') {
    process.stdout.write(trigToN3(text));
    return;
  }
  if ((from === 'n3' || from === 'notation3') && to === 'trig') {
    process.stdout.write(n3ToTrig(text));
    return;
  }

  if (from === 'srl' && to === 'n3') {
    const n3 = srlToN3(text);
    process.stdout.write(n3);

    if (doReason && reason) {
      const derived = reason({ proofComments: false }, n3);
      process.stderr.write('\n# eyeling derived facts:\n');
      process.stderr.write(derived + '\n');
    }
    return;
  }
  if ((from === 'n3' || from === 'notation3') && to === 'srl') {
    process.stdout.write(n3ToSrl(text));
    return;
  }

  printHelp();
  process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

module.exports = {
  trigToN3,
  n3ToTrig,
  srlToN3,
  n3ToSrl,
  parseTriG,
  parseN3,
};
