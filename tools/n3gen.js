#!/usr/bin/env node
'use strict';

/*
 * n3gen.js — Convert Turtle (.ttl), TriG (.trig) or SRL (.srl) to N3.
 *
 * This tool always emits N3 to stdout. The input syntax is selected by the file
 * extension:
 *   - .ttl  (RDF 1.2 Turtle)
 *   - .trig (RDF 1.2 TriG)
 *   - .srl  (SRL rules)
 *
 * TriG → N3 mapping (named graphs)
 *   TriG: <graphName> { ...triples... }
 *   N3:   <graphName> rdfg:isGraph { ...triples... } .
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
 *   n3gen file.ttl  > file.n3
 *   n3gen file.trig > file.n3
 *   n3gen file.srl  > file.n3
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const process = require('node:process');

const crypto = require('node:crypto');

function _stripIriRef(s) {
  // Allow passing an IRIREF like <...>
  if (typeof s !== 'string') return '';
  s = s.trim();
  if (s.startsWith('<') && s.endsWith('>')) return s.slice(1, -1);
  return s;
}

function normalizeSkolemRoot(root) {
  root = _stripIriRef(root);
  if (!root) return '';
  // Ensure it ends with '/.well-known/genid/' OR at least with '/'
  if (!root.endsWith('/')) root += '/';
  return root;
}

// Skolemization (Option C)
//
// We mint recognizable Skolem IRIs using a stable, per-input UUID:
//
//   @prefix skolem: <https://eyereasoner.github.io/.well-known/genid/UUID#>.
//
// and then replace cross-scope blank nodes with IRIs like: skolem:e38
//
// The UUID is deterministic from the *input file content* (SHA-256 based).
const SKOLEM_PREFIX = 'skolem';
const DEFAULT_SKOLEM_ROOT = 'https://eyereasoner.github.io/.well-known/genid/';
const SKOLEM_ROOT = normalizeSkolemRoot(process.env.SKOLEM_ROOT) || DEFAULT_SKOLEM_ROOT;

let SKOLEM_UUID = null; // e.g., '3f2504e0-4f89-5d3a-9a0c-0305e82c3301'
let SKOLEM_PREFIX_IRI = null; // e.g., 'https://.../.well-known/genid/<UUID>#'

function _deterministicUuidFromText(inputText) {
  const h = crypto.createHash('sha256').update(inputText, 'utf8').digest();
  const b = Buffer.from(h.subarray(0, 16));

  // Set version (5) and variant (RFC 4122) bits to make it look like a UUID.
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;

  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function initSkolemForInput(inputText) {
  SKOLEM_UUID = _deterministicUuidFromText(inputText);
  SKOLEM_PREFIX_IRI = `${SKOLEM_ROOT}${SKOLEM_UUID}#`;
}

function _pnLocalSafe(s) {
  // Turtle PN_LOCAL allows percent escapes (PLX). We make sure all "special"
  // encodeURIComponent survivors are percent-escaped too.
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

// ---------------------------------------------------------------------------
// Mapping namespace
// ---------------------------------------------------------------------------

// Use the W3C rdfg: vocabulary to represent TriG named graphs as N3 graph terms:
//   <g> rdfg:isGraph { ... } .
const RDFG_NS = 'http://www.w3.org/2009/rdfg#';
const rdfg = {
  isGraph: `${RDFG_NS}isGraph`,
};

// ---------------------------------------------------------------------------
// Minimal Turtle/N3 model + lexer + parser
// ---------------------------------------------------------------------------

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const LOG_NS = 'http://www.w3.org/2000/10/swap/log#';
const MATH_NS = 'http://www.w3.org/2000/10/swap/math#';
const STRING_NS = 'http://www.w3.org/2000/10/swap/string#';
const LIST_NS = 'http://www.w3.org/2000/10/swap/list#';
const CRYPTO_NS = 'http://www.w3.org/2000/10/swap/crypto#';
const TIME_NS = 'http://www.w3.org/2000/10/swap/time#';
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

    // RDF 1.2 Turtle/TriG annotations: annotation blocks {| ... |}
    if (c === '{' && peek(1) === '|') {
      tokens.push(new Token('AnnOpen'));
      i += 2;
      continue;
    }
    if (c === '|' && peek(1) === '}') {
      tokens.push(new Token('AnnClose'));
      i += 2;
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
      const more = this.parsePredicateObjectList(subj);
      // Keep the triples produced by the property list so they are emitted with the surrounding statement.
      this.pendingTriples.push(...more);
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

      out.push(...this.parseAnnotatedObjectList(subject, verb, invert));

      if (this.peek().typ === 'Semicolon') {
        this.next();
        if (
          this.peek().typ === 'Dot' ||
          this.peek().typ === 'RBrace' ||
          this.peek().typ === 'RBracket' ||
          this.peek().typ === 'AnnClose'
        )
          break;
        continue;
      }
      break;
    }

    // Include any triples generated by nested blank node property lists / reifiers
    // that were encountered while parsing this predicate-object list.
    if (this.pendingTriples.length > 0) {
      out.push(...this.pendingTriples);
      this.pendingTriples = [];
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

  // RDF 1.2 Turtle/TriG: triple annotations and reifiers
  // After an object, Turtle 1.2 allows optional:
  //   ~ <reifier>
  //   {| <predicateObjectList> |}
  // We convert these into eyeling-friendly N3 by emitting:
  //   <reifier> rdf:reifies { <s> <p> <o> . } .
  //   <reifier> <annP> <annO> .

  parseAnnotationBlock(reifier) {
    this.expect('AnnOpen');
    const out = [];
    if (this.peek().typ !== 'AnnClose') {
      out.push(...this.parsePredicateObjectList(reifier));
    }
    this.expect('AnnClose');
    return out;
  }

  parseAnnotatedObjectList(subject, verb, invert) {
    const out = [];
    out.push(...this.parseAnnotatedObjectTriples(subject, verb, invert));
    while (this.peek().typ === 'Comma') {
      this.next();
      out.push(...this.parseAnnotatedObjectTriples(subject, verb, invert));
    }
    return out;
  }

  parseAnnotatedObjectTriples(subject, verb, invert) {
    const out = [];

    const obj = this.parseTerm();
    const s = invert ? obj : subject;
    const o = invert ? subject : obj;

    // asserted triple
    out.push(new Triple(s, verb, o));

    // optional reifier and/or annotation blocks
    let reifier = null;

    if (this.peek().typ === 'Tilde') {
      this.next();
      // Allow empty reifier: ~ {| ... |} (fresh blank node)
      if (this.peek().typ === 'AnnOpen') reifier = this.freshReifier();
      else reifier = this.parseTerm();
    }

    // If there is an annotation block without an explicit reifier, allocate one
    if (!reifier && this.peek().typ === 'AnnOpen') {
      reifier = this.freshReifier();
    }

    if (reifier) {
      const tripleTerm = new GraphTerm([new Triple(s, verb, o)]);
      this.emitReifies(reifier, tripleTerm);
      if (this.pendingTriples.length) {
        out.push(...this.pendingTriples);
        this.pendingTriples = [];
      }

      // zero or more annotation blocks
      while (this.peek().typ === 'AnnOpen') {
        out.push(...this.parseAnnotationBlock(reifier));
      }
    }

    return out;
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

      // SPARQL-style named graph block: GRAPH <g> { ... }
      if (
        this.peek().typ === 'Ident' &&
        typeof this.peek().value === 'string' &&
        this.peek().value.toLowerCase() === 'graph'
      ) {
        this.next(); // GRAPH
        const gname = this.parseTerm();
        this.expect('LBrace');
        const f = this.parseGraph();
        if (this.peek().typ === 'Dot') this.next(); // accept optional '.'
        for (const tr of f.triples) quads.push({ s: tr.s, p: tr.p, o: tr.o, g: gname });
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

/**
 * Render a Turtle/N3 literal token string, shrinking any datatype IRIRef (^^<...>)
 * to a prefixed name if possible, e.g. ^^<http://www.w3.org/2001/XMLSchema#date> -> ^^xsd:date
 * when an appropriate prefix is in scope.
 *
 * Note: this keeps the original lexical spelling and only rewrites the datatype IRIRef.
 */
function literalToText(raw, prefixes) {
  if (!raw || typeof raw !== 'string') return String(raw);

  // Typed literal with datatype as IRIREF.
  // Example: "2021-07-07"^^<http://www.w3.org/2001/XMLSchema#date>
  // We only rewrite the datatype part.
  const m = raw.match(/\^\^<([^>]+)>/);
  if (!m) return raw;

  const dtIri = m[1];
  const qn = prefixes ? prefixes.shrinkIri(dtIri) : null;
  if (!qn) return raw;

  // Replace only the first occurrence.
  return raw.replace(`^^<${dtIri}>`, `^^${qn}`);
}

function termToText(t, prefixes, skolemMap) {
  if (t == null) return '[]';
  if (t instanceof Iri) {
    if (t.value === RDF_NS + 'type') return 'a';
    const qn = prefixes ? prefixes.shrinkIri(t.value) : null;
    return qn || `<${t.value}>`;
  }
  if (t instanceof Blank) {
    if (skolemMap && skolemMap.has(t.label)) return skolemMap.get(t.label);
    return t.label;
  }
  if (t instanceof Literal) return literalToText(t.value, prefixes);
  if (t instanceof Var) return `?${t.name}`;
  if (t instanceof ListTerm) return `(${t.elems.map((x) => termToText(x, prefixes, skolemMap)).join(' ')})`;
  if (t instanceof OpenListTerm)
    return `(${t.prefix.map((x) => termToText(x, prefixes, skolemMap)).join(' ')} ... ?${t.tailVar})`;
  if (t instanceof GraphTerm) {
    const inner = t.triples
      .map(
        (tr) =>
          `${termToText(tr.s, prefixes, skolemMap)} ${termToText(tr.p, prefixes, skolemMap)} ${termToText(tr.o, prefixes, skolemMap)} .`,
      )
      .join(' ');
    return `{ ${inner} }`;
  }
  return String(t);
}

// ---------------------------------------------------------------------------
// Skolemize blank nodes that would otherwise "split" across quoted graph terms.
//
// In N3, blank nodes inside { ... } are existentially scoped to that formula,
// so reusing the same _:id outside does NOT imply coreference.
// For RDF 1.2 triple terms we serialize as { s p o . }, we optionally replace
// any blank node that appears both inside a quoted graph term AND outside it
// with a stable IRI constant (<urn:skolem:...>) to preserve identity.
// ---------------------------------------------------------------------------

function buildSkolemMapForBnodesThatCrossScopes(triples) {
  // In RDF (incl. RDF 1.2 triple terms and TriG datasets), blank nodes can be
  // shared across different “scopes” in the concrete syntax (e.g., between the
  // default graph and named graphs, or between multiple named graphs, or between
  // asserted triples and triple terms). In N3, blank nodes inside quoted graph
  // terms (`{ ... }`) do NOT automatically corefer with blank nodes outside, or
  // in other quoted graph terms.
  //
  // To preserve coreference, we Skolemize blank nodes that appear in more than
  // one scope:
  //   - OUT: outside any GraphTerm
  //   - Gk:  inside the k-th encountered GraphTerm (each GraphTerm gets its own)
  //
  // Each such blank node label is replaced by a minted IRI in the skolem: namespace (see SKOLEM_PREFIX_IRI).
  const scopesByLbl = new Map();
  let graphTermId = 0;

  function add(lbl, scope) {
    if (!scopesByLbl.has(lbl)) scopesByLbl.set(lbl, new Set());
    scopesByLbl.get(lbl).add(scope);
  }

  function visitTerm(t, scope) {
    if (!t) return;
    if (t instanceof Blank) {
      add(t.label, scope);
      return;
    }
    if (t instanceof ListTerm) {
      for (const e of t.elems) visitTerm(e, scope);
      return;
    }
    if (t instanceof OpenListTerm) {
      for (const e of t.prefix) visitTerm(e, scope);
      return;
    }
    if (t instanceof GraphTerm) {
      const innerScope = `G${graphTermId++}`;
      for (const tr of t.triples) {
        visitTerm(tr.s, innerScope);
        visitTerm(tr.p, innerScope);
        visitTerm(tr.o, innerScope);
      }
      return;
    }
  }

  for (const tr of triples) {
    visitTerm(tr.s, 'OUT');
    visitTerm(tr.p, 'OUT');
    visitTerm(tr.o, 'OUT');
  }

  const skolemMap = new Map();
  for (const [lbl, scopes] of scopesByLbl.entries()) {
    if (scopes.size <= 1) continue;

    const id = lbl.startsWith('_:') ? lbl.slice(2) : lbl;
    const local = _pnLocalSafe(id);
    skolemMap.set(lbl, `${SKOLEM_PREFIX}:${local}`);
  }
  return skolemMap;
}

// ---------------------------------------------------------------------------
// RDF list (rdf:first/rest) folding
//
// Some producers expand Turtle/N3 list syntax into explicit RDF collection
// triples. When writing N3/Turtle, it is useful to fold those back into
// ListTerm so the output matches common Turtle/N3 expectations.
//
// We fold only “plain” lists where each list node has exactly one rdf:first and
// one rdf:rest triple, and no other outgoing triples. Intermediate nodes must
// not be referenced from outside the list chain. This keeps the transformation
// semantics-preserving.
// ---------------------------------------------------------------------------

function _termKey(t) {
  if (t == null) return 'N:null';
  if (t instanceof Iri) return `I:${t.value}`;
  if (t instanceof Blank) return `B:${t.label}`;
  if (t instanceof Literal) return `L:${t.value}`;
  if (t instanceof Var) return `V:${t.name}`;
  if (t instanceof ListTerm) return `T:(` + t.elems.map(_termKey).join(' ') + `)`;
  if (t instanceof OpenListTerm) return `T:(` + t.prefix.map(_termKey).join(' ') + ` ... ?${t.tailVar})`;
  if (t instanceof GraphTerm)
    return `G:{` + t.triples.map((tr) => `${_termKey(tr.s)} ${_termKey(tr.p)} ${_termKey(tr.o)}`).join(' ; ') + `}`;
  return `X:${String(t)}`;
}

function foldRdfLists(triples) {
  const rdfFirst = RDF_NS + 'first';
  const rdfRest = RDF_NS + 'rest';
  const rdfNil = RDF_NS + 'nil';

  const outBySubj = new Map(); // key -> { term, idxs: number[] }
  const incoming = new Map(); // key -> total incoming as object
  const incomingRest = new Map(); // key -> incoming via rdf:rest

  function addIncoming(objKey, viaRest) {
    incoming.set(objKey, (incoming.get(objKey) || 0) + 1);
    if (viaRest) incomingRest.set(objKey, (incomingRest.get(objKey) || 0) + 1);
  }

  for (let i = 0; i < triples.length; i++) {
    const tr = triples[i];
    const sKey = _termKey(tr.s);
    if (!outBySubj.has(sKey)) outBySubj.set(sKey, { term: tr.s, idxs: [] });
    outBySubj.get(sKey).idxs.push(i);

    const oKey = _termKey(tr.o);
    const viaRest = isIri(tr.p, rdfRest);
    addIncoming(oKey, viaRest);
  }

  function outgoingTriplesOf(key) {
    const rec = outBySubj.get(key);
    if (!rec) return [];
    return rec.idxs.map((idx) => ({ idx, tr: triples[idx] }));
  }

  // Identify candidate list heads: blank nodes with exactly one rdf:first and one rdf:rest.
  //
  // NOTE: This converter currently writes one triple per line (it does not group by subject).
  // In Turtle/N3, repeating a collection term ( ... ) across multiple triples would mint
  // a fresh list each time. To remain semantics-preserving, we only fold “annotated” list
  // heads (i.e., heads with extra outgoing predicates) when:
  //   - the head is not referenced as an object elsewhere, and
  //   - there is at most one extra outgoing triple.
  const listMap = new Map(); // headKey -> { listTerm, removeIdxs:Set<number>, chainKeys:string[] }

  for (const [sKey, rec] of outBySubj.entries()) {
    if (!(rec.term instanceof Blank)) continue;

    const outs = outgoingTriplesOf(sKey);
    const firsts = outs.filter((x) => isIri(x.tr.p, rdfFirst));
    const rests = outs.filter((x) => isIri(x.tr.p, rdfRest));
    if (firsts.length !== 1 || rests.length !== 1) continue;

    const extras = outs.filter((x) => !(isIri(x.tr.p, rdfFirst) || isIri(x.tr.p, rdfRest)));
    const incHead = incoming.get(sKey) || 0;
    const incHeadRest = incomingRest.get(sKey) || 0;

    // Head sharing safety: if the head node is referenced multiple times,
    // folding would duplicate the list (not semantics-preserving).
    if (incHead > 1) continue;

    if (extras.length > 0) {
      if (incHead !== 0 || incHeadRest !== 0) continue;
      if (extras.length > 1) continue;
    }

    // Walk the rdf:rest chain.
    const elems = [];
    const removeIdxs = new Set();
    const chainKeys = [];
    const seen = new Set();
    const headKey = sKey;
    let curKey = sKey;
    let isOk = true;

    while (true) {
      if (seen.has(curKey)) {
        isOk = false;
        break;
      }
      seen.add(curKey);
      chainKeys.push(curKey);

      const outs2 = outgoingTriplesOf(curKey);
      const f2 = outs2.filter((x) => isIri(x.tr.p, rdfFirst));
      const r2 = outs2.filter((x) => isIri(x.tr.p, rdfRest));
      if (f2.length !== 1 || r2.length !== 1) {
        isOk = false;
        break;
      }

      // Only the head is allowed to have extra outgoing predicates.
      if (curKey !== headKey && outs2.length !== 2) {
        isOk = false;
        break;
      }

      elems.push(f2[0].tr.o);
      removeIdxs.add(f2[0].idx);
      removeIdxs.add(r2[0].idx);

      const next = r2[0].tr.o;
      if (next instanceof Iri && next.value === rdfNil) break;
      if (!(next instanceof Blank)) {
        isOk = false;
        break;
      }

      const nextKey = _termKey(next);

      // Intermediate node safety: only referenced via rdf:rest and exactly once.
      const inc = incoming.get(nextKey) || 0;
      const incR = incomingRest.get(nextKey) || 0;
      if (inc !== incR || incR !== 1) {
        isOk = false;
        break;
      }

      curKey = nextKey;
    }

    if (!isOk) continue;

    listMap.set(headKey, { listTerm: new ListTerm(elems), removeIdxs, chainKeys });
  }

  if (listMap.size === 0) return triples;

  // Prevent double folding: intermediate nodes in a folded chain should not also be heads.
  const intermediate = new Set();
  for (const v of listMap.values()) {
    for (let i = 1; i < v.chainKeys.length; i++) intermediate.add(v.chainKeys[i]);
  }
  for (const k of intermediate) {
    if (listMap.has(k)) listMap.delete(k);
  }
  if (listMap.size === 0) return triples;

  // Build set of triple indices to remove (rdf:first/rest only).
  const removeAll = new Set();
  for (const v of listMap.values()) for (const idx of v.removeIdxs) removeAll.add(idx);

  // Replace list-head blank nodes with ListTerm *recursively* so nested collections fold too.
  function replaceTerm(t) {
    if (t == null) return t;

    if (t instanceof Blank) {
      const m = listMap.get(_termKey(t));
      if (m) return replaceTerm(m.listTerm);
      return t;
    }
    if (t instanceof ListTerm) {
      return new ListTerm(t.elems.map((x) => replaceTerm(x)));
    }
    if (t instanceof OpenListTerm) {
      return new OpenListTerm(
        t.prefix.map((x) => replaceTerm(x)),
        t.tailVar,
      );
    }
    if (t instanceof GraphTerm) {
      const inner = t.triples.map((tr) => new Triple(replaceTerm(tr.s), replaceTerm(tr.p), replaceTerm(tr.o)));
      return new GraphTerm(inner);
    }
    return t;
  }

  const newTriples = [];
  for (let i = 0; i < triples.length; i++) {
    if (removeAll.has(i)) continue;
    const tr = triples[i];
    newTriples.push(new Triple(replaceTerm(tr.s), replaceTerm(tr.p), replaceTerm(tr.o)));
  }

  return newTriples;
}

function pruneUnusedPrefixes(prefixes, triples) {
  if (!prefixes || !prefixes.map) return prefixes;

  const used = new Set();

  function visitTerm(t) {
    if (!t) return;
    if (t instanceof Iri) {
      if (t.value === RDF_NS + 'type') return; // written as 'a'
      const qn = prefixes.shrinkIri(t.value);
      if (!qn) return;
      const idx = qn.indexOf(':');
      const pfx = idx === 0 ? '' : qn.slice(0, idx);
      used.add(pfx);
      return;
    }

    if (t instanceof Literal) {
      // A typed literal may reference a QName in its datatype, e.g. "2021-07-07"^^xsd:date.
      // Our Literal stores the full lexical token, so we conservatively scan for ^^prefix:local.
      const re = /\^\^([A-Za-z_][A-Za-z0-9_.-]*|):[A-Za-z_][A-Za-z0-9_.-]*/g;
      for (const m of t.value.matchAll(re)) {
        const pfx = m[1] || '';
        used.add(pfx);
      }
      return;
    }

    if (t instanceof ListTerm) {
      for (const e of t.elems) visitTerm(e);
      return;
    }
    if (t instanceof GraphTerm) {
      for (const tr of t.triples) {
        visitTerm(tr.s);
        visitTerm(tr.p);
        visitTerm(tr.o);
      }
    }
  }

  for (const tr of triples) {
    visitTerm(tr.s);
    visitTerm(tr.p);
    visitTerm(tr.o);
  }

  const newMap = {};
  for (const pfx of used) {
    if (Object.prototype.hasOwnProperty.call(prefixes.map, pfx)) newMap[pfx] = prefixes.map[pfx];
  }

  return new PrefixEnv(newMap, prefixes.baseIri);
}

function isIri(t, iri) {
  return t instanceof Iri && t.value === iri;
}

function renderPrefixPrologue(prefixes, { includeRdfg = false } = {}) {
  const out = [];
  if (includeRdfg) out.push(`@prefix rdfg: <${RDFG_NS}> .`);

  if (prefixes && prefixes.baseIri) out.push(`@base <${prefixes.baseIri}> .`);

  if (prefixes && prefixes.map) {
    for (const [pfx, iri] of Object.entries(prefixes.map)) {
      if (!iri) continue;
      if (includeRdfg && pfx === 'rdfg') continue;
      const label = pfx === '' ? ':' : `${pfx}:`;
      out.push(`@prefix ${label} <${iri}> .`);
    }
  }
  return out.join('\n');
}

function ensureSkolemPrefix(prefixes, skolemMap) {
  if (!skolemMap || skolemMap.size === 0) return prefixes;

  // If initSkolemForInput() was not called (library usage), fall back to a fresh UUID.
  if (!SKOLEM_PREFIX_IRI) SKOLEM_PREFIX_IRI = `${SKOLEM_ROOT}${crypto.randomUUID()}#`;

  const baseMap = prefixes && prefixes.map ? prefixes.map : {};
  const newMap = { ...baseMap, [SKOLEM_PREFIX]: SKOLEM_PREFIX_IRI };
  const baseIri = prefixes ? prefixes.baseIri : '';
  return new PrefixEnv(newMap, baseIri);
}

function usesRdfNamespace(triples) {
  let used = false;

  function visitTerm(t) {
    if (!t || used) return;

    if (t instanceof Iri) {
      // rdf:type is rendered as 'a', so it doesn't require declaring rdf:
      if (t.value.startsWith(RDF_NS) && t.value !== RDF_NS + 'type') used = true;
      return;
    }

    if (t instanceof Literal) {
      // Conservative: detect rdf: appearing in a datatype token, e.g. ^^rdf:langString or ^^<...rdf-syntax-ns#...>
      if (t.value.includes('^^rdf:') || t.value.includes(`^^<${RDF_NS}`)) used = true;
      return;
    }

    if (t instanceof ListTerm) {
      for (const e of t.elems) visitTerm(e);
      return;
    }

    if (t instanceof GraphTerm) {
      for (const tr of t.triples) {
        visitTerm(tr.s);
        visitTerm(tr.p);
        visitTerm(tr.o);
      }
    }
  }

  for (const tr of triples || []) {
    visitTerm(tr.s);
    visitTerm(tr.p);
    visitTerm(tr.o);
    if (used) break;
  }
  return used;
}

function ensureRdfPrefixIfUsed(prefixes, triples) {
  if (!usesRdfNamespace(triples)) return prefixes;

  // If rdf: is already declared, keep it as-is; otherwise add it.
  const baseMap = prefixes && prefixes.map ? prefixes.map : {};
  if (Object.prototype.hasOwnProperty.call(baseMap, 'rdf')) return prefixes;

  const newMap = { ...baseMap, rdf: RDF_NS };
  const baseIri = prefixes ? prefixes.baseIri : '';
  return new PrefixEnv(newMap, baseIri);
}

function usesXsdPrefix(triples) {
  let used = false;

  function visitTerm(t) {
    if (!t || used) return;

    if (t instanceof Iri) {
      // If an XSD namespace IRI is printed (rare, but possible), xsd: prefix is required.
      if (t.value.startsWith(XSD_NS)) used = true;
      return;
    }

    if (t instanceof Literal) {
      // Detect xsd: use in typed literal tokens, e.g. "2021-07-07"^^xsd:date.
      // Also detect explicit IRI datatypes in XSD namespace.
      if (t.value.includes('^^xsd:') || t.value.includes(`^^<${XSD_NS}`)) used = true;
      return;
    }

    if (t instanceof ListTerm) {
      for (const e of t.elems) visitTerm(e);
      return;
    }

    if (t instanceof GraphTerm) {
      for (const tr of t.triples) {
        visitTerm(tr.s);
        visitTerm(tr.p);
        visitTerm(tr.o);
      }
      return;
    }
  }

  for (const tr of triples || []) {
    visitTerm(tr.s);
    visitTerm(tr.p);
    visitTerm(tr.o);
    if (used) break;
  }
  return used;
}

function ensureXsdPrefixIfUsed(prefixes, triples) {
  if (!usesXsdPrefix(triples)) return prefixes;

  // If xsd: is already declared, keep it as-is; otherwise add it.
  const baseMap = prefixes && prefixes.map ? prefixes.map : {};
  if (Object.prototype.hasOwnProperty.call(baseMap, 'xsd')) return prefixes;

  const newMap = { ...baseMap, xsd: XSD_NS };
  const baseIri = prefixes ? prefixes.baseIri : '';
  return new PrefixEnv(newMap, baseIri);
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

function writeN3RdfgIsGraph({ datasetQuads, prefixes }) {
  const blocks = [];
  const grouped = groupQuadsByGraph(datasetQuads);

  // For prefix pruning + Skolemization we build a synthetic triple stream that
  // matches the *output* structure:
  //   - default graph triples are “outside” any GraphTerm
  //   - each named graph is wrapped as: gTerm rdfg:isGraph { ... }
  // This allows us to detect blank nodes that must corefer across graphs.
  const pseudoTriplesForUse = [];
  const rdfgIsGraphIri = new Iri(rdfg.isGraph);

  if (grouped.has('DEFAULT')) {
    const { triples } = grouped.get('DEFAULT');
    pseudoTriplesForUse.push(...foldRdfLists(triples));
  }

  for (const [k, { gTerm, triples }] of grouped.entries()) {
    if (k === 'DEFAULT') continue;
    const folded = foldRdfLists(triples);
    pseudoTriplesForUse.push({ s: gTerm, p: rdfgIsGraphIri, o: new GraphTerm(folded) });
  }

  const prunedPrefixes = pruneUnusedPrefixes(prefixes, pseudoTriplesForUse);
  const skolemMap = buildSkolemMapForBnodesThatCrossScopes(pseudoTriplesForUse);
  const outPrefixes = ensureRdfPrefixIfUsed(
    ensureXsdPrefixIfUsed(ensureSkolemPrefix(prunedPrefixes, skolemMap), pseudoTriplesForUse),
    pseudoTriplesForUse,
  );
  const pro = renderPrefixPrologue(outPrefixes, { includeRdfg: true }).trim();
  if (pro) blocks.push(pro, '');

  function writeGraphTriples(triples) {
    const folded = foldRdfLists(triples);
    return folded
      .map(
        (tr) =>
          `  ${termToText(tr.s, outPrefixes, skolemMap)} ${termToText(tr.p, outPrefixes, skolemMap)} ${termToText(tr.o, outPrefixes, skolemMap)} .`,
      )
      .join('\n');
  }

  // default graph: emit triples at top-level (no rdfg:isGraph wrapper)
  if (grouped.has('DEFAULT')) {
    const { triples } = grouped.get('DEFAULT');
    const folded = foldRdfLists(triples);
    for (const tr of folded) {
      blocks.push(
        `${termToText(tr.s, outPrefixes, skolemMap)} ${termToText(tr.p, outPrefixes, skolemMap)} ${termToText(tr.o, outPrefixes, skolemMap)} .`,
      );
    }
    blocks.push('');
  }

  const named = [...grouped.entries()].filter(([k]) => k !== 'DEFAULT');
  named.sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, { gTerm, triples }] of named) {
    blocks.push(`${termToText(gTerm, outPrefixes, skolemMap)} rdfg:isGraph {`);
    const folded = foldRdfLists(triples);
    if (folded.length) {
      blocks.push(
        folded
          .map(
            (tr) =>
              `  ${termToText(tr.s, outPrefixes, skolemMap)} ${termToText(tr.p, outPrefixes, skolemMap)} ${termToText(tr.o, outPrefixes, skolemMap)} .`,
          )
          .join('\n'),
      );
    }
    blocks.push('} .', '');
  }

  return blocks.join('\n').trim() + '\n';
}

// ---------------------------------------------------------------------------
// Roundtrip: TriG <-> N3 (rdfg:isGraph mapping)
// ---------------------------------------------------------------------------

function parseTriG(text) {
  const p = new TriGParser(lex(text));
  return p.parseTrigDocument();
}

function parseTurtle(text) {
  const p = new TurtleParser(lex(text));
  return p.parseTurtleDocument();
}

function writeN3Triples({ triples, prefixes }) {
  const foldedTriples = foldRdfLists(triples);
  const prunedPrefixes = pruneUnusedPrefixes(prefixes, foldedTriples);
  const skolemMap = buildSkolemMapForBnodesThatCrossScopes(foldedTriples);
  const outPrefixes = ensureRdfPrefixIfUsed(
    ensureXsdPrefixIfUsed(ensureSkolemPrefix(prunedPrefixes, skolemMap), foldedTriples),
    foldedTriples,
  );
  const blocks = [];
  const pro = renderPrefixPrologue(outPrefixes, { includeRdfg: false }).trim();
  if (pro) blocks.push(pro, '');
  for (const tr of foldedTriples) {
    blocks.push(
      `${termToText(tr.s, outPrefixes, skolemMap)} ${termToText(tr.p, outPrefixes, skolemMap)} ${termToText(tr.o, outPrefixes, skolemMap)} .`,
    );
  }
  return blocks.join('\n').trim() + '\n';
}

function turtleToN3(ttlText) {
  const { triples, prefixes } = parseTurtle(ttlText);
  return writeN3Triples({ triples, prefixes });
}

function trigToN3(trigText) {
  const { quads, prefixes } = parseTriG(trigText);
  return writeN3RdfgIsGraph({ datasetQuads: quads, prefixes });
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


function makeTempVarGenerator(prefix = '__e') {
  let n = 0;
  return () => `?${prefix}${++n}`;
}

function stripOuterParensAll(expr) {
  let t = (expr || '').trim();
  while (t.startsWith('(')) {
    try {
      const par = readBalancedParens(t, 0);
      if (par.endIdx === t.length) {
        t = (par.content || '').trim();
        continue;
      }
    } catch {}
    break;
  }
  return t;
}

function mergeUsed(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b || {})) out[k] = out[k] || b[k];
  return out;
}

function isStringLiteral(s) {
  const t = (s || '').trim();
  return t.startsWith('"') || t.startsWith("'");
}

function isNumericLike(s) {
  const t = (s || '').trim();
  // Plain numbers (with optional sign/decimal/exponent)
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(t)) return true;
  // Typed numeric literals like "1"^^xsd:integer or "1"^^<...#integer>
  if (/^".*"\s*\^\^\s*(xsd:(?:integer|decimal|double|float)|<[^>]+#(?:integer|decimal|double|float)>)\s*$/i.test(t))
    return true;
  return false;
}

function prevNonWsChar(s, i) {
  for (let j = i; j >= 0; j--) {
    const ch = s[j];
    if (!/\s/.test(ch)) return ch;
  }
  return null;
}

function findTopLevelBinaryOp(expr, ops, fromRight = true) {
  // Scan left-to-right and then choose either the first or last match.
  // This avoids incorrect parenthesis-depth tracking when scanning right-to-left.
  const t = expr || '';
  let depth = 0;
  let inString = false;
  let quote = null;
  let escaped = false;

  const candidates = [];
  // Prefer longer operators first (e.g., "NOT IN" before "IN", ">=" before ">").
  const opsSorted = [...(ops || [])].sort((a, b) => b.length - a.length);

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];

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

    if (ch === '(') {
      depth++;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;

    let matchedHere = false;

    for (const op of opsSorted) {
      if (/^[A-Za-z]/.test(op)) {
        // Word operator, case-insensitive, with simple boundary checks.
        const slice = t.slice(i, i + op.length);
        if (slice.length !== op.length) continue;
        if (slice.toUpperCase() !== op.toUpperCase()) continue;
        const beforeAdj = i > 0 ? t[i - 1] : ' ';
        const afterAdj = t[i + op.length] || ' ';
        if (/[A-Za-z0-9_]/.test(beforeAdj)) continue;
        if (/[A-Za-z0-9_]/.test(afterAdj)) continue;
        candidates.push({ idx: i, op, len: op.length });
        i += op.length - 1;
        matchedHere = true;
        break;
      } else {
        const slice = t.slice(i, i + op.length);
        if (slice !== op) continue;

        // For + and -, ensure it's binary (not unary)
        if (op === '+' || op === '-') {
          const before = prevNonWsChar(t, i - 1);
          if (!before || /[\(\,\=\+\-\*\/\^\&\|\!\<\>]/.test(before)) continue;
        }

        candidates.push({ idx: i, op, len: op.length });
        i += op.length - 1;
        matchedHere = true;
        break;
      }
    }

    if (matchedHere) continue;
  }

  if (!candidates.length) return null;
  return fromRight ? candidates[candidates.length - 1] : candidates[0];
}

function tryParseFunctionCall(expr) {
  const t = stripOuterParensAll(expr);
  // Look for the first '(' at top-level
  let depth = 0;
  let inString = false;
  let quote = null;
  let escaped = false;
  let openIdx = -1;

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];

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

    if (ch === '(') {
      if (depth === 0) {
        openIdx = i;
        break;
      }
      depth++;
      continue;
    }
  }

  if (openIdx < 0) return null;
  const name = t.slice(0, openIdx).trim();
  if (!name) return null;

  try {
    const par = readBalancedParens(t, openIdx);
    if (par.endIdx !== t.length) return null;
    return { name, argsRaw: par.content || '' };
  } catch {
    return null;
  }
}

function normalizeFnName(name) {
  const n = (name || '').trim();
  // Strip surrounding <>
  if (n.startsWith('<') && n.endsWith('>')) return n.slice(1, -1);
  return n;
}

function fnLocalName(name) {
  const n = normalizeFnName(name);
  const idx = n.lastIndexOf('#');
  if (idx >= 0) return n.slice(idx + 1);
  const c = n.indexOf(':');
  if (c >= 0) return n.slice(c + 1);
  return n;
}

function compileValueExpr(expr, ctx, targetVar = null) {
  const used0 = {
    usedMath: false,
    usedString: false,
    usedTime: false,
    usedLog: false,
    usedList: false,
    usedCrypto: false,
  };

  let t = stripOuterParensAll(expr);

  // Atomic?
  if (
    /^\s*[$?][A-Za-z_][A-Za-z0-9_-]*\s*$/.test(t) ||
    isNumericLike(t) ||
    isStringLiteral(t) ||
    /^\s*<[^>]*>\s*$/.test(t) ||
    /^\s*[_:][A-Za-z0-9_][A-Za-z0-9_-]*\s*$/.test(t) ||
    /^\s*[A-Za-z][A-Za-z0-9_-]*:[A-Za-z_][A-Za-z0-9._-]*\s*$/.test(t) ||
    /^\s*(true|false)\s*$/i.test(t)
  ) {
    if (!targetVar) return { term: t.trim(), stmts: [], used: used0 };
    return {
      term: targetVar,
      stmts: [`${targetVar} log:equalTo ${t.trim()} .`],
      used: { ...used0, usedLog: true },
    };
  }

  // Unary '!' is value-error in SPARQL; keep as TODO.
  // Unary minus (negation)
  if (t.startsWith('-')) {
    const rest = t.slice(1).trim();
    // If "-<num>" then atomic already handled above; so here it's expression negation.
    const out = targetVar || ctx.newVar();
    const inner = compileValueExpr(rest, ctx, null);
    const stmts = [...inner.stmts, `${inner.term} math:negation ${out} .`];
    const used = mergeUsed(inner.used, { ...used0, usedMath: true });
    return { term: out, stmts, used };
  }

  // Function call?
  const call = tryParseFunctionCall(t);
  if (call) {
    const local0 = fnLocalName(call.name);
    const local = local0.toLowerCase();
    const localKey = local.replace(/_/g, '');
    const args = splitTopLevelCommaArgs(call.argsRaw).map((x) => x.trim()).filter(Boolean);

    // time-fn:* (keep existing mapping)
    {
      let timeFnLocal = null;
      const norm = normalizeFnName(call.name);
      if (norm.startsWith(TIMEFN_NS)) timeFnLocal = norm.slice(TIMEFN_NS.length);
      if (!timeFnLocal && call.name.includes(':')) timeFnLocal = call.name.split(':').slice(-1)[0];
      if (timeFnLocal && TIMEFN_BUILTIN_NAMES.has(timeFnLocal)) {
        const out = targetVar || ctx.newVar();
        if (timeFnLocal === 'bindDefaultTimezone') {
          if (args.length !== 2) return { term: out, stmts: [`# TODO BIND: ${t}`], used: used0 };
        } else {
          if (args.length !== 1) return { term: out, stmts: [`# TODO BIND: ${t}`], used: used0 };
        }
        const list = `(${args.join(' ')})`;
        return { term: out, stmts: [`${list} ${call.name.trim()} ${out} .`], used: used0 };
      }
    }

    const compiledArgs = args.map((a) => compileValueExpr(a, ctx, null));
    let stmts = [];
    let used = used0;
    const argTerms = [];
    for (const ca of compiledArgs) {
      stmts = stmts.concat(ca.stmts);
      used = mergeUsed(used, ca.used);
      argTerms.push(ca.term);
    }

    const out = targetVar || ctx.newVar();

    // SPARQL/XPath-ish builtins -> N3 builtins
    if (local === 'concat') {
      stmts.push(`(${argTerms.join(' ')}) string:concatenation ${out} .`);
      used = mergeUsed(used, { usedString: true });
      return { term: out, stmts, used };
    }

    if (local === 'replace') {
      if (argTerms.length !== 3) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`(${argTerms.join(' ')}) string:replace ${out} .`);
      used = mergeUsed(used, { usedString: true });
      return { term: out, stmts, used };
    }

    if (local === 'format') {
      if (argTerms.length < 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`(${argTerms.join(' ')}) string:format ${out} .`);
      used = mergeUsed(used, { usedString: true });
      return { term: out, stmts, used };
    }

    if (local === 'abs') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`${argTerms[0]} math:absoluteValue ${out} .`);
      used = mergeUsed(used, { usedMath: true });
      return { term: out, stmts, used };
    }

    if (local === 'round') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`${argTerms[0]} math:rounded ${out} .`);
      used = mergeUsed(used, { usedMath: true });
      return { term: out, stmts, used };
    }

    if (local === 'ceil' || local === 'ceiling') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`${argTerms[0]} math:ceiling ${out} .`);
      used = mergeUsed(used, { usedMath: true });
      return { term: out, stmts, used };
    }

    if (local === 'floor') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`${argTerms[0]} math:floor ${out} .`);
      used = mergeUsed(used, { usedMath: true });
      return { term: out, stmts, used };
    }

    if (local === 'substr' || local === 'substring') {
      if (argTerms.length !== 2 && argTerms.length !== 3) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`(${argTerms.join(' ')}) string:substring ${out} .`);
      used = mergeUsed(used, { usedString: true });
      return { term: out, stmts, used };
    }

    if (local === 'strlen') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`${argTerms[0]} string:length ${out} .`);
      used = mergeUsed(used, { usedString: true });
      return { term: out, stmts, used };
    }

    if (local === 'ucase') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`${argTerms[0]} string:upperCase ${out} .`);
      used = mergeUsed(used, { usedString: true });
      return { term: out, stmts, used };
    }

    if (local === 'lcase') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`${argTerms[0]} string:lowerCase ${out} .`);
      used = mergeUsed(used, { usedString: true });
      return { term: out, stmts, used };
    }

    if (localKey === 'encodeforuri') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`${argTerms[0]} string:encodeForURI ${out} .`);
      used = mergeUsed(used, { usedString: true });
      return { term: out, stmts, used };
    }

    if (local === 'hours' || local === 'hour') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`${argTerms[0]} time:hour ${out} .`);
      used = mergeUsed(used, { usedTime: true });
      return { term: out, stmts, used };
    }

    if (local === 'tz') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`${argTerms[0]} time:timeZone ${out} .`);
      used = mergeUsed(used, { usedTime: true });
      return { term: out, stmts, used };
    }

    if (local === 'now') {
      if (argTerms.length !== 0) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`"" time:localTime ${out} .`);
      used = mergeUsed(used, { usedTime: true });
      return { term: out, stmts, used };
    }

    if (local === 'uuid') {
      if (argTerms.length !== 0) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`"" log:uuid ${out} .`);
      used = mergeUsed(used, { usedLog: true });
      return { term: out, stmts, used };
    }

    if (localKey === 'struuid') {
      if (argTerms.length !== 0) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`"" log:struuid ${out} .`);
      used = mergeUsed(used, { usedLog: true });
      return { term: out, stmts, used };
    }

    if (local === 'triple') {
      if (argTerms.length !== 3) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      const tripleTerm = `{ ${argTerms[0]} ${argTerms[1]} ${argTerms[2]} . }`;
      stmts.push(`${out} log:equalTo ${tripleTerm} .`);
      used = mergeUsed(used, { usedLog: true });
      return { term: out, stmts, used };
    }

    if (local === 'subject' || local === 'predicate' || local === 'object') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      const sVar = ctx.newVar();
      const pVar = ctx.newVar();
      const oVar = ctx.newVar();
      if (local === 'subject') {
        stmts.push(`${argTerms[0]} log:includes { ${out} ${pVar} ${oVar} . } .`);
      } else if (local === 'predicate') {
        stmts.push(`${argTerms[0]} log:includes { ${sVar} ${out} ${oVar} . } .`);
      } else {
        stmts.push(`${argTerms[0]} log:includes { ${sVar} ${pVar} ${out} . } .`);
      }
      used = mergeUsed(used, { usedLog: true });
      return { term: out, stmts, used };
    }

    if (local === 'md5' || local === 'sha256' || local === 'sha384' || local === 'sha512') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      const pred = local === 'md5' ? 'crypto:md5' : local === 'sha256' ? 'crypto:sha256' : local === 'sha384' ? 'crypto:sha384' : 'crypto:sha512';
      stmts.push(`${argTerms[0]} ${pred} ${out} .`);
      used = mergeUsed(used, { usedCrypto: true });
      return { term: out, stmts, used };
    }

    if (local === 'year' || local === 'month' || local === 'day' || local === 'minutes' || local === 'minute' || local === 'seconds' || local === 'second' || local === 'timezone') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      const pred =
        local === 'minutes' || local === 'minute'
          ? 'time:minute'
          : local === 'seconds' || local === 'second'
            ? 'time:second'
            : local === 'timezone'
              ? 'time:timeZone'
              : `time:${local}`;
      stmts.push(`${argTerms[0]} ${pred} ${out} .`);
      used = mergeUsed(used, { usedTime: true });
      return { term: out, stmts, used };
    }

    if (local === 'strdt') {
      if (argTerms.length !== 2) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`(${argTerms.join(' ')}) log:dtlit ${out} .`);
      used = mergeUsed(used, { usedLog: true });
      return { term: out, stmts, used };
    }

    if (local === 'strlang') {
      if (argTerms.length !== 2) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`(${argTerms.join(' ')}) log:langlit ${out} .`);
      used = mergeUsed(used, { usedLog: true });
      return { term: out, stmts, used };
    }

    if (local === 'sha' || local === 'sha1') {
      if (argTerms.length !== 1) return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
      stmts.push(`${argTerms[0]} crypto:sha ${out} .`);
      used = mergeUsed(used, { usedCrypto: true });
      return { term: out, stmts, used };
    }

    return { term: out, stmts: [...stmts, `# TODO BIND: ${t}`], used };
  }

  // Arithmetic ops (+,-,*,/,^,MOD,%)
  // Precedence: ^, *,/,MOD,%, +,-
  const opAdd = findTopLevelBinaryOp(t, ['+', '-'], true);
  if (opAdd) {
    const left = t.slice(0, opAdd.idx).trim();
    const right = t.slice(opAdd.idx + opAdd.len).trim();
    const out = targetVar || ctx.newVar();
    const l = compileValueExpr(left, ctx, null);
    const r = compileValueExpr(right, ctx, null);
    const pred = opAdd.op === '+' ? 'math:sum' : 'math:difference';
    const stmts = [...l.stmts, ...r.stmts, `(${l.term} ${r.term}) ${pred} ${out} .`];
    const used = mergeUsed(mergeUsed(l.used, r.used), { ...used0, usedMath: true });
    return { term: out, stmts, used };
  }

  const opMul = findTopLevelBinaryOp(t, ['*', '/', 'MOD', '%'], true);
  if (opMul) {
    const left = t.slice(0, opMul.idx).trim();
    const right = t.slice(opMul.idx + opMul.len).trim();
    const out = targetVar || ctx.newVar();
    const l = compileValueExpr(left, ctx, null);
    const r = compileValueExpr(right, ctx, null);
    const pred =
      opMul.op === '*'
        ? 'math:product'
        : opMul.op === '/'
          ? 'math:quotient'
          : 'math:remainder';
    const stmts = [...l.stmts, ...r.stmts, `(${l.term} ${r.term}) ${pred} ${out} .`];
    const used = mergeUsed(mergeUsed(l.used, r.used), { ...used0, usedMath: true });
    return { term: out, stmts, used };
  }

  const opPow = findTopLevelBinaryOp(t, ['^'], false);
  if (opPow) {
    const left = t.slice(0, opPow.idx).trim();
    const right = t.slice(opPow.idx + opPow.len).trim();
    const out = targetVar || ctx.newVar();
    const l = compileValueExpr(left, ctx, null);
    const r = compileValueExpr(right, ctx, null);
    const stmts = [...l.stmts, ...r.stmts, `(${l.term} ${r.term}) math:exponentiation ${out} .`];
    const used = mergeUsed(mergeUsed(l.used, r.used), { ...used0, usedMath: true });
    return { term: out, stmts, used };
  }

  // Fallback: emit TODO
  if (!targetVar) return { term: t.trim(), stmts: [`# TODO expr: ${t.trim()}`], used: used0 };
  return { term: targetVar, stmts: [`# TODO BIND: ${t.trim()} => ${targetVar}`], used: used0 };
}

function compileBooleanFactor(expr, ctx, invert = false) {
  let t = stripOuterParensAll(expr).trim();
  const used0 = {
    usedMath: false,
    usedString: false,
    usedTime: false,
    usedLog: false,
    usedList: false,
    usedCrypto: false,
  };

  // Handle unary !
  if (t.startsWith('!')) {
    return compileBooleanFactor(t.slice(1), ctx, !invert);
  }

  // IN / NOT IN
  {
    // Look for top-level IN keyword
    const opIn = findTopLevelBinaryOp(t, ['NOT IN', 'IN'], true);
    if (opIn && (opIn.op.toUpperCase() === 'IN' || opIn.op.toUpperCase() === 'NOT IN')) {
      const leftExpr = t.slice(0, opIn.idx).trim();
      const rightExpr = t.slice(opIn.idx + opIn.len).trim();
      let listInner = rightExpr;
      // Expect (...) list
      listInner = stripOuterParensAll(listInner);
      const items = splitTopLevelCommaArgs(listInner).map((x) => x.trim()).filter(Boolean);
      const list = `(${items.join(' ')})`;
      const left = compileValueExpr(leftExpr, ctx, null);
      let stmts = [...left.stmts];
      let used = mergeUsed(used0, left.used);
      used = mergeUsed(used, { usedList: true });

      const coreStmt = `${left.term} list:in ${list} .`;

      const neg = invert || opIn.op.toUpperCase() === 'NOT IN';
      if (neg) {
        stmts.push(`?SCOPE log:notIncludes { ${coreStmt} } .`);
        used = mergeUsed(used, { usedLog: true });
      } else {
        stmts.push(coreStmt);
      }
      return { stmts, used };
    }
  }

  // Function call booleans: CONTAINS, STRSTARTS, STRENDS, REGEX, sameTerm
  const call = tryParseFunctionCall(t);
  if (call) {
    const local0 = fnLocalName(call.name);
    const local = local0.toLowerCase();
    const localKey = local.replace(/_/g, '');
    const args = splitTopLevelCommaArgs(call.argsRaw).map((x) => x.trim()).filter(Boolean);
    const compiledArgs = args.map((a) => compileValueExpr(a, ctx, null));

    let stmts = [];
    let used = used0;
    const argTerms = [];
    for (const ca of compiledArgs) {
      stmts = stmts.concat(ca.stmts);
      used = mergeUsed(used, ca.used);
      argTerms.push(ca.term);
    }

    const unaryTest = (pred) => {
      if (argTerms.length !== 1) return { stmts: [...stmts, `# TODO FILTER: ${t}`], used };
      const innerStmt = `${argTerms[0]} ${pred} true .`;
      used = mergeUsed(used, { usedLog: true });
      if (invert) makeNegatedNAF(innerStmt);
      else stmts.push(innerStmt);
      return { stmts, used };
    };

    if (localKey === 'isiri' || localKey === 'isuri') return unaryTest('log:isIRI');
    if (localKey === 'isliteral') return unaryTest('log:isLiteral');
    if (localKey === 'isblank') return unaryTest('log:isBlank');
    if (localKey === 'isnumeric') return unaryTest('log:isNumeric');
    if (localKey === 'istriple') return unaryTest('log:isTriple');

    const makeNegatedNAF = (innerStmt) => {
      stmts.push(`?SCOPE log:notIncludes { ${innerStmt} } .`);
      used = mergeUsed(used, { usedLog: true });
    };

    if (local === 'contains' || local === 'strstarts' || local === 'strends') {
      if (argTerms.length !== 2) return { stmts: [...stmts, `# TODO FILTER: ${t}`], used };
      const pred =
        local === 'contains' ? 'string:contains' : local === 'strstarts' ? 'string:startsWith' : 'string:endsWith';
      const innerStmt = `${argTerms[0]} ${pred} ${argTerms[1]} .`;
      used = mergeUsed(used, { usedString: true });
      if (invert) makeNegatedNAF(innerStmt);
      else stmts.push(innerStmt);
      return { stmts, used };
    }

    if (local === 'regex') {
      if (argTerms.length < 2) return { stmts: [...stmts, `# TODO FILTER: ${t}`], used };
      // Ignore SPARQL regex flags (3rd arg) for now.
      const pred = invert ? 'string:notMatches' : 'string:matches';
      const innerStmt = `${argTerms[0]} ${pred} ${argTerms[1]} .`;
      used = mergeUsed(used, { usedString: true });
      stmts.push(innerStmt);
      return { stmts, used };
    }

    if (local === 'sameterm') {
      if (argTerms.length !== 2) return { stmts: [...stmts, `# TODO FILTER: ${t}`], used };
      const pred = invert ? 'log:notEqualTo' : 'log:equalTo';
      stmts.push(`${argTerms[0]} ${pred} ${argTerms[1]} .`);
      used = mergeUsed(used, { usedLog: true });
      return { stmts, used };
    }
  }

  // Comparison
  const cmp = parseSimpleComparison(t);
  if (!cmp) return null;

  const left = compileValueExpr(cmp.left, ctx, null);
  const right = compileValueExpr(cmp.right, ctx, null);

  let stmts = [...left.stmts, ...right.stmts];
  let used = mergeUsed(mergeUsed(used0, left.used), right.used);

  // Decide namespace: numeric => math; string literals => string for ordering; otherwise:
  const leftNum = isNumericLike(cmp.left) || isNumericLike(left.term);
  const rightNum = isNumericLike(cmp.right) || isNumericLike(right.term);
  const anyNum = leftNum || rightNum;
  const anyStr = isStringLiteral(cmp.left) || isStringLiteral(cmp.right);

  const neg = invert;

  // Equality/inequality: prefer math for numeric, log otherwise.
  if (cmp.op === '=' || cmp.op === '!=') {
    if (anyNum) {
      const pred = neg
        ? cmp.op === '='
          ? 'math:notEqualTo'
          : 'math:equalTo'
        : `math:${cmp.pred}`;
      stmts.push(`${left.term} ${pred} ${right.term} .`);
      used = mergeUsed(used, { usedMath: true });
      return { stmts, used };
    }

    const pred = neg ? (cmp.op === '=' ? 'log:notEqualTo' : 'log:equalTo') : cmp.op === '=' ? 'log:equalTo' : 'log:notEqualTo';
    stmts.push(`${left.term} ${pred} ${right.term} .`);
    used = mergeUsed(used, { usedLog: true });
    return { stmts, used };
  }

  // Relational: numeric => math; string literal ordering => string; default math
  if (!anyNum && anyStr) {
    // string ordering
    const map = (op, inv) => {
      const base =
        op === '>'
          ? 'greaterThan'
          : op === '<'
            ? 'lessThan'
            : op === '>='
              ? 'notLessThan'
              : op === '<='
                ? 'notGreaterThan'
                : null;
      if (!base) return null;

      if (!inv) return `string:${base}`;

      // invert
      if (op === '>') return 'string:notGreaterThan';
      if (op === '<') return 'string:notLessThan';
      if (op === '>=') return 'string:lessThan';
      if (op === '<=') return 'string:greaterThan';
      return null;
    };
    const pred = map(cmp.op, neg);
    if (!pred) return null;
    stmts.push(`${left.term} ${pred} ${right.term} .`);
    used = mergeUsed(used, { usedString: true });
    return { stmts, used };
  }

  // numeric/default math
  {
    const map = (op, inv, pred) => {
      if (!inv) return `math:${pred}`;
      if (op === '>') return 'math:notGreaterThan';
      if (op === '<') return 'math:notLessThan';
      if (op === '>=') return 'math:lessThan';
      if (op === '<=') return 'math:greaterThan';
      return null;
    };
    const pred = map(cmp.op, neg, cmp.pred);
    if (!pred) return null;
    stmts.push(`${left.term} ${pred} ${right.term} .`);
    used = mergeUsed(used, { usedMath: true });
    return { stmts, used };
  }
}

function bindExprToN3Alternatives(bindInner, ctx) {
  // bindInner is the inside of BIND(...), e.g. 'concat(?a," ",?b) AS ?x'
  const s = (bindInner || '').trim();
  const m = s.match(/^(.*)\s+AS\s+(\?[A-Za-z_][A-Za-z0-9_-]*)\s*$/i);
  if (!m) return null;

  const expr = m[1].trim();
  const outVar = m[2].trim();

  // Special forms that need rule-distribution instead of a single builtin triple.
  const call = tryParseFunctionCall(expr);
  if (call) {
    const local0 = fnLocalName(call.name);
    const local = local0.toLowerCase();
    const localKey = local.replace(/_/g, '');
    const args = splitTopLevelCommaArgs(call.argsRaw).map((x) => x.trim()).filter(Boolean);

    // IF(cond, then, else): distribute into rule alternatives using filter compilation.
    if (localKey === 'if') {
      if (args.length !== 3) return { alts: [[`# TODO BIND: ${bindInner}`]], used: { usedMath: false, usedString: false, usedTime: false, usedLog: false, usedList: false, usedCrypto: false } };

      const cond = filterExprToN3Alternatives(args[0], ctx);
      if (!cond) return { alts: [[`# TODO BIND(IF): ${bindInner}`]], used: { usedMath: false, usedString: false, usedTime: false, usedLog: false, usedList: false, usedCrypto: false } };

      const thenC = compileValueExpr(args[1], ctx, outVar);
      const elseC = compileValueExpr(args[2], ctx, outVar);

      let used = mergeUsed(cond.used, mergeUsed(thenC.used, elseC.used));
      used = mergeUsed(used, { usedLog: true }); // else branch uses log:notIncludes guards

      const alts = [];
      // THEN alts: each conjunction of the condition DNF
      for (const conj of cond.alts) {
        alts.push([...(conj || []), ...thenC.stmts]);
      }

      // ELSE alt: AND_i not(conj_i)
      const elseGuards = [];
      for (const conj of cond.alts) {
        const inner = (conj || []).join(' ');
        elseGuards.push(`?SCOPE log:notIncludes { ${inner} } .`);
      }
      alts.push([...elseGuards, ...elseC.stmts]);

      return { alts, used };
    }

    // COALESCE(e1,e2,...): pick first expression that is satisfiable under current bindings.
    if (localKey === 'coalesce') {
      if (args.length < 1) return { alts: [[`# TODO BIND: ${bindInner}`]], used: { usedMath: false, usedString: false, usedTime: false, usedLog: false, usedList: false, usedCrypto: false } };

      const compiled = args.map((a) => compileValueExpr(a, ctx, outVar));
      let used = { usedMath: false, usedString: false, usedTime: false, usedLog: false, usedList: false, usedCrypto: false };
      for (const c of compiled) used = mergeUsed(used, c.used);
      used = mergeUsed(used, { usedLog: true }); // guards use log:notIncludes

      const alts = [];
      for (let i = 0; i < compiled.length; i++) {
        const guards = [];
        for (let j = 0; j < i; j++) {
          const inner = compiled[j].stmts.join(' ');
          guards.push(`?SCOPE log:notIncludes { ${inner} } .`);
        }
        alts.push([...guards, ...compiled[i].stmts]);
      }
      return { alts, used };
    }
  }

  // Default: compile as a single value expression (one alternative).
  const compiled = compileValueExpr(expr, ctx, outVar);
  return { alts: [compiled.stmts], used: compiled.used };
}


function extractSrlBinds(bodyRaw, ctx) {
  const s = bodyRaw || '';
  let i = 0;
  let out = '';

  /** @type {string[][]} */
  let bindAlts = [[]];

  let used = {
    usedMath: false,
    usedString: false,
    usedTime: false,
    usedLog: false,
    usedList: false,
    usedCrypto: false,
  };

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

    const conv = bindExprToN3Alternatives(inner, ctx);
    if (!conv) throw new Error(`Unsupported SRL BIND expression for N3 mapping: ${inner}`);

    // Cross product with existing bind alternatives
    const next = [];
    for (const acc of bindAlts) {
      for (const opt of conv.alts) next.push(acc.concat(opt || []));
    }
    bindAlts = next;

    used = mergeUsed(used, conv.used);

    i = blk.endIdx;
  }

  return { body: normalizeInsideBracesKeepStyle(out), bindAlts, used };
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

function filterExprToN3Alternatives(expr, ctx) {
  // Returns {alts, used} where:
  // - alts is an array of alternatives
  // - each alternative is an array of N3 statements (strings) to be added to the rule body
  //
  // Supports nested disjunction distribution, e.g.:
  //   a && (b || c)  ==>  (a && b) || (a && c)
  // and De Morgan for leading '!' over composite subexpressions.
  const e0 = (expr || '').trim();
  if (!e0) return null;

  function crossProductDnfs(dnfA, dnfB) {
    const next = [];
    for (const a of dnfA) {
      for (const b of dnfB) {
        next.push(a.concat(b));
      }
    }
    return next;
  }

  function toDnf(rawExpr, negate = false) {
    let t = (rawExpr || '').trim();
    if (!t) return [[]];

    // Normalize leading '!' (can appear multiple times)
    let neg = negate;
    while (t.startsWith('!')) {
      neg = !neg;
      t = t.slice(1).trim();
    }

    t = stripOuterParensAll(t);

    // OR has lower precedence than AND.
    const orParts = splitTopLevelOr(t);
    if (orParts) {
      if (!neg) {
        let out = [];
        for (const p of orParts) out = out.concat(toDnf(p, false));
        return out;
      }
      // NOT (A OR B)  ==  (NOT A) AND (NOT B)
      let out = [[]];
      for (const p of orParts) {
        out = crossProductDnfs(out, toDnf(p, true));
      }
      return out;
    }

    const andParts = splitTopLevelAnd(t);
    if (andParts) {
      if (!neg) {
        let out = [[]];
        for (const p of andParts) out = crossProductDnfs(out, toDnf(p, false));
        return out;
      }
      // NOT (A AND B)  ==  (NOT A) OR (NOT B)
      let out = [];
      for (const p of andParts) out = out.concat(toDnf(p, true));
      return out;
    }

    // Atomic
    return [[neg ? '!' + t : t]];
  }

  const conjunctions = toDnf(e0, false);

  const alts = [];
  let used = {
    usedMath: false,
    usedString: false,
    usedTime: false,
    usedLog: false,
    usedList: false,
    usedCrypto: false,
  };

  for (const conj of conjunctions) {
    let stmts = [];
    for (const factor of conj) {
      const bf = compileBooleanFactor(factor, ctx, false);
      if (!bf) return null;
      stmts = stmts.concat(bf.stmts);
      used = mergeUsed(used, bf.used);
    }
    alts.push(stmts);
  }

  return { alts, used };
}


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

    out += ` ?SCOPE log:notIncludes { ${inner} } . `;
    usedLog = true;
    i = blk.endIdx;
  }

  return { body: normalizeInsideBracesKeepStyle(out), usedLog };
}

// N3 :   ?SCOPE log:notIncludes { ... } .
// SRL:   NOT { ... }
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
  let needsList = false;
  let needsCrypto = false;
  let needsTime = false;

  for (const r of rules) {
    const ctx = { newVar: makeTempVarGenerator('__e') };

    // 1) NOT { ... }  ->  ?SCOPE log:notIncludes { ... } .
    const convNot = srlWhereBodyToN3Body(r.body);
    needsLog = needsLog || convNot.usedLog;
    if (convNot.usedLog && !env.map.log) env.setPrefix('log', LOG_NS);

    // 2) FILTER(...) -> math:* builtins (possibly multiple alternative rules for OR)
    const convFilter = extractSrlFilters(convNot.body);
    const bodyNoFilter = convFilter.body;
    const filterExprs = convFilter.filters;

    // 3) BIND(concat(... ) AS ?v) -> string:concatenation builtins
    const convBind = extractSrlBinds(bodyNoFilter, ctx);
    const bodyNoBind = convBind.body;
    const bindAlts = (convBind.bindAlts && convBind.bindAlts.length) ? convBind.bindAlts : [[]];
    if (convBind.used.usedString) {
      needsString = true;
      if (!env.map.string) env.setPrefix('string', STRING_NS);
    }
    if (convBind.used.usedTime) {
      needsTime = true;
      if (!env.map.time) env.setPrefix('time', TIME_NS);
    }
    if (convBind.used.usedLog) {
      needsLog = true;
      if (!env.map.log) env.setPrefix('log', LOG_NS);
    }
    if (convBind.used.usedMath) {
      needsMath = true;
      if (!env.map.math) env.setPrefix('math', MATH_NS);
    }
    if (convBind.used.usedList) {
      needsList = true;
      if (!env.map.list) env.setPrefix('list', LIST_NS);
    }
    if (convBind.used.usedCrypto) {
      needsCrypto = true;
      if (!env.map.crypto) env.setPrefix('crypto', CRYPTO_NS);
    }

    // Build rule alternatives (disjunction => multiple rules)
    let alts = [{ builtins: [] }];

    for (const f of filterExprs) {
      const conv = filterExprToN3Alternatives(f, ctx);
      if (!conv) {
        throw new Error(`Unsupported SRL FILTER expression for N3 mapping: ${f}`);
      }

      // Ensure needed builtin prefixes
      if (conv.used.usedMath) {
        needsMath = true;
        if (!env.map.math) env.setPrefix('math', MATH_NS);
      }
      if (conv.used.usedString) {
        needsString = true;
        if (!env.map.string) env.setPrefix('string', STRING_NS);
      }
      if (conv.used.usedLog) {
        needsLog = true;
        if (!env.map.log) env.setPrefix('log', LOG_NS);
      }
      if (conv.used.usedList) {
        needsList = true;
        if (!env.map.list) env.setPrefix('list', LIST_NS);
      }
      if (conv.used.usedCrypto) {
        needsCrypto = true;
        if (!env.map.crypto) env.setPrefix('crypto', CRYPTO_NS);
      }
      if (conv.used.usedTime) {
        needsTime = true;
        if (!env.map.time) env.setPrefix('time', TIME_NS);
      }

      // Expand OR alternatives
      const next = [];
      for (const a of alts) {
        for (const option of conv.alts) {
          next.push({ builtins: a.builtins.concat(option) });
        }
      }
      alts = next;
    }

    const head = srlDollarVarsToQVars(normalizeInsideBracesKeepStyle(r.head));

    for (const a of alts) {
      const extra = a.builtins.length ? ` ${a.builtins.join(' ')} ` : '';
      for (const bindBuiltins of bindAlts) {
        const bindExtra = bindBuiltins.length ? ` ${bindBuiltins.join(' ')} ` : '';
        const combined = `${bodyNoBind} ${extra} ${bindExtra}`.trim();
        const triples = parseTriplesBlockAllowImplicitDots(combined, env);
        const body = triplesToN3Body(triples, env);
        renderedRules.push(`{ ${body} } => { ${head} } .`);
      }
    }
  }

  // Build body first (data + rules), then decide which prefixes are actually needed.
  const bodyParts = [];

  // Emit "plain" data triples first (outside SRL DATA blocks)
  if (dataOutside.trim()) bodyParts.push(dataOutside.trim(), '');

  // Emit each SRL DATA { ... } block as plain N3 data triples
  for (const blk of dataBlocks) {
    if (blk.trim()) bodyParts.push(blk.trim(), '');
  }

  bodyParts.push(...renderedRules);

  let bodyText = bodyParts.join('\n').trim();

  // Decide whether rdf:/xsd: are needed in the final output (SRL emits a lot as raw text).
  const usesRdf = /\brdf:/.test(bodyText) || bodyText.includes(`<${RDF_NS}`) || bodyText.includes(`^^<${RDF_NS}`);
  const usesXsd = /\bxsd:/.test(bodyText) || bodyText.includes(`<${XSD_NS}`) || bodyText.includes(`^^<${XSD_NS}`);

  // Ensure prefixes requested by generated content are declared.
  if (usesRdf && !env.map.rdf) env.setPrefix('rdf', RDF_NS);
  if (usesXsd && !env.map.xsd) env.setPrefix('xsd', XSD_NS);

  // If we have xsd:, prefer qname datatypes in the body, e.g. ^^xsd:date.
  if (env.map.xsd) {
    const esc = XSD_NS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    bodyText = bodyText.replace(new RegExp(`\\^\\^<${esc}([^>]+)>`, 'g'), '^^xsd:$1');
  }

  const out = [];
  const pro = renderPrefixPrologue(env, { includeRdfg: false }).trim();
  if (pro) out.push(pro, '');
  if (bodyText) out.push(bodyText);

  return out.join('\n').trim() + '\n';
}

function printHelp() {
  process.stdout.write(`Usage:
  n3gen <file.ttl|file.trig|file.srl>

Converts RDF 1.2 Turtle/TriG and SHACL 1.2 Rules to N3.

Examples:
  n3gen file.ttl > file.n3
  n3gen file.trig > file.n3
  n3gen file.srl > file.n3
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
  initSkolemForInput(text);

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
