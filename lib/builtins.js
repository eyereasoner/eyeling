/**
 * Eyeling Reasoner — builtins
 *
 * Builtin evaluation plus shared literal/number/string helpers.
 * This module is initialized by lib/engine.js via makeBuiltins(deps).
 */
'use strict';

const {
  RDF_NS,
  RDFS_NS,
  OWL_NS,
  XSD_NS,
  CRYPTO_NS,
  MATH_NS,
  TIME_NS,
  LIST_NS,
  LOG_NS,
  STRING_NS,
  SKOLEM_NS,
  Literal,
  Iri,
  Var,
  Blank,
  ListTerm,
  OpenListTerm,
  GraphTerm,
  Triple,
  Rule,
  DerivedFact,
  internIri,
  internLiteral,
  PrefixEnv,
  resolveIriRef,
  collectIrisInTerm,
  collectBlankLabelsInTriples,
  literalParts,
} = require('./prelude');

const { decodeN3StringEscapes } = require('./lexer');
const trace = require('./trace');
const time = require('./time');
const deref = require('./deref');

let nodeCrypto = null;
try {
  if (typeof require === 'function') nodeCrypto = require('crypto');
} catch (_) {}

//
// Hot caches (moved from engine.js)
//
const __parseNumCache = new Map(); // lit string -> number|null
const __parseIntCache = new Map(); // lit string -> bigint|null
const __parseNumericInfoCache = new Map(); // lit string -> info|null

//
// Engine hooks (injected once by makeBuiltins)
//
let applySubstTerm;
let applySubstTriple;
let unifyTerm;
let unifyTermListAppend;
let termsEqual;
let proveGoals;
let isGroundTerm;
let iriValue;
let skolemIriFromGroundTerm;
let computeConclusionFromFormula;
let getSuperRestrictedMode;
// Optional hooks from engine for fact indexing & strict numeric equality
let termFastKey;
let ensureFactIndexes;
let termsEqualNoIntDecimal;

function makeBuiltins(deps) {
  applySubstTerm = deps.applySubstTerm;
  applySubstTriple = deps.applySubstTriple;
  unifyTerm = deps.unifyTerm;
  unifyTermListAppend = deps.unifyTermListAppend;
  termsEqual = deps.termsEqual;
  proveGoals = deps.proveGoals;
  isGroundTerm = deps.isGroundTerm;
  iriValue = deps.iriValue;
  skolemIriFromGroundTerm = deps.skolemIriFromGroundTerm;
  computeConclusionFromFormula = deps.computeConclusionFromFormula;
  getSuperRestrictedMode = deps.getSuperRestrictedMode;
  termFastKey = deps.termFastKey;
  ensureFactIndexes = deps.ensureFactIndexes;
  termsEqualNoIntDecimal = deps.termsEqualNoIntDecimal;
  return { evalBuiltin, isBuiltinPred };
}

function literalHasLangTag(lit) {
  // True iff the literal is a quoted string literal with a language tag suffix,
  // e.g. "hello"@en or """hello"""@en.
  // (The parser rejects language tags combined with datatypes.)
  if (typeof lit !== 'string') return false;
  if (lit.indexOf('^^') >= 0) return false;
  if (!lit.startsWith('"')) return false;

  if (lit.startsWith('"""')) {
    const end = lit.lastIndexOf('"""');
    if (end < 0) return false;
    const after = end + 3;
    return after < lit.length && lit[after] === '@';
  }

  const lastQuote = lit.lastIndexOf('"');
  if (lastQuote < 0) return false;
  const after = lastQuote + 1;
  return after < lit.length && lit[after] === '@';
}

function isPlainStringLiteralValue(lit) {
  // Plain string literal: quoted, no datatype, no lang.
  if (typeof lit !== 'string') return false;
  if (lit.indexOf('^^') >= 0) return false;
  if (!isQuotedLexical(lit)) return false;
  return !literalHasLangTag(lit);
}

function literalsEquivalentAsXsdString(aLit, bLit) {
  // Treat "abc" and "abc"^^xsd:string as equal, but do NOT conflate language-tagged strings.
  if (typeof aLit !== 'string' || typeof bLit !== 'string') return false;

  const [alex, adt] = literalParts(aLit);
  const [blex, bdt] = literalParts(bLit);
  if (alex !== blex) return false;

  const aPlain = adt === null && isPlainStringLiteralValue(aLit);
  const bPlain = bdt === null && isPlainStringLiteralValue(bLit);
  const aXsdStr = adt === XSD_NS + 'string';
  const bXsdStr = bdt === XSD_NS + 'string';

  return (aPlain && bXsdStr) || (bPlain && aXsdStr);
}

function normalizeLiteralForFastKey(lit) {
  // Canonicalize so that "abc" and "abc"^^xsd:string share the same index/dedup key.
  if (typeof lit !== 'string') return lit;
  const [lex, dt] = literalParts(lit);

  if (dt === XSD_NS + 'string') {
    return `${lex}^^<${XSD_NS}string>`;
  }
  if (dt === null && isPlainStringLiteralValue(lit)) {
    return `${lex}^^<${XSD_NS}string>`;
  }
  return lit;
}

// ---------------------------------------------------------------------------
// Fast-key helpers (used for cheap dedup/indexing)
// ---------------------------------------------------------------------------
// Note: the engine also has a richer termFastKey for indexing facts. Builtins
// use these local helpers for purely syntactic fast-paths (e.g., dedup in
// log:conjunction) and should remain robust even if the engine changes.

function __termFastKeyLocal(t) {
  if (t instanceof Iri) return `I:${t.value}`;
  if (t instanceof Literal) return `L:${normalizeLiteralForFastKey(t.value)}`;
  return null;
}

function tripleFastKey(tr) {
  const ks = __termFastKeyLocal(tr.s);
  const kp = __termFastKeyLocal(tr.p);
  const ko = __termFastKeyLocal(tr.o);
  if (ks === null || kp === null || ko === null) return null;
  return `${ks}|${kp}|${ko}`;
}

function stripQuotes(lex) {
  if (typeof lex !== 'string') return lex;
  // Handle both short ('...' / "...") and long ('''...''' / """...""") forms.
  if (lex.length >= 6) {
    if (lex.startsWith('"""') && lex.endsWith('"""')) return lex.slice(3, -3);
    if (lex.startsWith("'''") && lex.endsWith("'''")) return lex.slice(3, -3);
  }
  if (lex.length >= 2) {
    const a = lex[0];
    const b = lex[lex.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) return lex.slice(1, -1);
  }
  return lex;
}

function termToJsXsdStringNoLang(t) {
  // Strict xsd:string extraction *without* language tags.
  // Accept:
  //   - plain string literals ("...")
  //   - "..."^^xsd:string
  // Reject:
  //   - language-tagged strings ("..."@en)
  //   - any other datatype
  if (!(t instanceof Literal)) return null;
  if (literalHasLangTag(t.value)) return null;

  const [lex, dt] = literalParts(t.value);
  if (!isQuotedLexical(lex)) return null;
  if (dt !== null && dt !== XSD_NS + 'string' && dt !== 'xsd:string') return null;
  return decodeN3StringEscapes(stripQuotes(lex));
}

function termToJsString(t) {
  // Domain is xsd:string for SWAP/N3 string builtins (string:*).
  //
  // Per the N3 Builtins spec, when the domain is xsd:string we must be able to
  // cast *any* IRI or literal value (incl. numeric, boolean, dateTime, anyURI,
  // rdf:langString, and plain literals) to a string.
  //
  // We implement this as:
  //   - IRI    -> its IRI string
  //   - Literal:
  //       * quoted lexical form: decode N3/Turtle escapes and strip quotes
  //       * unquoted lexical form: use as-is (e.g., 1234, true, 1971-..., 1.23E4)
  //   - Everything else (blank nodes, lists, formulas, vars) -> fail
  if (t instanceof Iri) return t.value;
  if (!(t instanceof Literal)) return null;

  const [lex, _dt] = literalParts(t.value);

  if (isQuotedLexical(lex)) {
    // Interpret N3/Turtle string escapes (\" \n \uXXXX \UXXXXXXXX …)
    // to obtain the actual string value.
    return decodeN3StringEscapes(stripQuotes(lex));
  }

  // Unquoted lexical (numbers/booleans/dateTimes, etc.)
  return typeof lex === 'string' ? lex : String(lex);
}

function makeStringLiteral(str) {
  // JSON.stringify gives us a valid N3/Turtle-style quoted string
  // (with proper escaping for quotes, backslashes, newlines, …).
  return internLiteral(JSON.stringify(str));
}

function termToJsStringDecoded(t) {
  // Like termToJsString, but for short literals it *also* interprets escapes
  // (\" \n \uXXXX …) by attempting JSON.parse on the quoted lexical form.
  if (!(t instanceof Literal)) return null;
  const [lex, _dt] = literalParts(t.value);

  // Long strings: """ ... """ are taken verbatim.
  if (lex.length >= 6 && lex.startsWith('"""') && lex.endsWith('"""')) {
    return lex.slice(3, -3);
  }

  // Short strings: try to decode escapes (this makes "{\"a\":1}" usable too).
  if (lex.length >= 2 && lex[0] === '"' && lex[lex.length - 1] === '"') {
    try {
      return JSON.parse(lex);
    } catch (e) {
      /* fall through */
    }
    return stripQuotes(lex);
  }

  return stripQuotes(lex);
}


// Tiny subset of sprintf: supports only %s and %%.
// Good enough for most N3 string:format use cases that just splice strings.
function simpleStringFormat(fmt, args) {
  let out = '';
  let argIndex = 0;

  for (let i = 0; i < fmt.length; i++) {
    const ch = fmt[i];
    if (ch === '%' && i + 1 < fmt.length) {
      const spec = fmt[i + 1];

      if (spec === 's') {
        const arg = argIndex < args.length ? args[argIndex++] : '';
        out += arg;
        i++;
        continue;
      }

      if (spec === '%') {
        out += '%';
        i++;
        continue;
      }

      // Unsupported specifier (like %d, %f, …) ⇒ fail the builtin.
      return null;
    }
    out += ch;
  }

  return out;
}

// -----------------------------------------------------------------------------
// SWAP/N3 regex compatibility helper
// -----------------------------------------------------------------------------
function regexNeedsUnicodeMode(pattern) {
  // JS requires /u for Unicode property escapes and code point escapes.
  return /\\[pP]\{/.test(pattern) || /\\u\{/.test(pattern);
}

function sanitizeForUnicodeMode(pattern) {
  // In JS Unicode mode, “identity escapes” like \! are a SyntaxError.
  // In Perl-ish regexes they commonly mean “literal !”. So drop the redundant "\".
  // Keep escapes that are regex-syntax or are commonly needed in char classes.
  const KEEP = '^$\\.*+?()[]{}|/-';
  return pattern.replace(/\\([^A-Za-z0-9])/g, (m, ch) => {
    return KEEP.includes(ch) ? m : ch;
  });
}

function compileSwapRegex(pattern, extraFlags) {
  const needU = regexNeedsUnicodeMode(pattern);
  const flags = (extraFlags || '') + (needU ? 'u' : '');
  try {
    return new RegExp(pattern, flags);
  } catch (e) {
    if (needU) {
      const p2 = sanitizeForUnicodeMode(pattern);
      if (p2 !== pattern) {
        try {
          return new RegExp(p2, flags);
        } catch (_e2) {}
      }
    }
    return null;
  }
}

// -----------------------------------------------------------------------------
// Strict numeric literal parsing for math: builtins
// -----------------------------------------------------------------------------
const XSD_DECIMAL_DT = XSD_NS + 'decimal';
const XSD_DOUBLE_DT = XSD_NS + 'double';
const XSD_FLOAT_DT = XSD_NS + 'float';
const XSD_INTEGER_DT = XSD_NS + 'integer';

// Integer-derived datatypes from XML Schema Part 2 (and commonly used ones).
const XSD_INTEGER_DERIVED_DTS = new Set([
  XSD_INTEGER_DT,
  XSD_NS + 'nonPositiveInteger',
  XSD_NS + 'negativeInteger',
  XSD_NS + 'long',
  XSD_NS + 'int',
  XSD_NS + 'short',
  XSD_NS + 'byte',
  XSD_NS + 'nonNegativeInteger',
  XSD_NS + 'unsignedLong',
  XSD_NS + 'unsignedInt',
  XSD_NS + 'unsignedShort',
  XSD_NS + 'unsignedByte',
  XSD_NS + 'positiveInteger',
]);

function parseBooleanLiteralInfo(t) {
  if (!(t instanceof Literal)) return null;

  const boolDt = XSD_NS + 'boolean';
  const v = t.value;
  const [lex, dt] = literalParts(v);

  // Typed xsd:boolean: accept "true"/"false"/"1"/"0"
  if (dt !== null) {
    if (dt !== boolDt) return null;
    const s = stripQuotes(lex);
    if (s === 'true' || s === '1') return { dt: boolDt, value: true };
    if (s === 'false' || s === '0') return { dt: boolDt, value: false };
    return null;
  }

  // Untyped boolean token: true/false
  if (v === 'true') return { dt: boolDt, value: true };
  if (v === 'false') return { dt: boolDt, value: false };
  return null;
}

function parseXsdFloatSpecialLex(s) {
  if (s === 'INF' || s === '+INF') return Infinity;
  if (s === '-INF') return -Infinity;
  if (s === 'NaN') return NaN;
  return null;
}

// ===========================================================================
// Math builtin helpers
// ===========================================================================

function formatXsdFloatSpecialLex(n) {
  if (n === Infinity) return 'INF';
  if (n === -Infinity) return '-INF';
  if (Number.isNaN(n)) return 'NaN';
  return null;
}

function isQuotedLexical(lex) {
  // Accept both Turtle/N3 quoting styles:
  //   short:  "..."  or  '...'
  //   long:   """..."""  or  '''...'''
  if (typeof lex !== 'string') return false;
  const n = lex.length;
  if (n >= 6 && ((lex.startsWith('"""') && lex.endsWith('"""')) || (lex.startsWith("'''") && lex.endsWith("'''"))))
    return true;
  if (n >= 2) {
    const a = lex[0];
    const b = lex[n - 1];
    return (a === '"' && b === '"') || (a === "'" && b === "'");
  }
  return false;
}

function isXsdNumericDatatype(dt) {
  if (dt === null) return false;
  return dt === XSD_DECIMAL_DT || dt === XSD_DOUBLE_DT || dt === XSD_FLOAT_DT || XSD_INTEGER_DERIVED_DTS.has(dt);
}

function isXsdIntegerDatatype(dt) {
  if (dt === null) return false;
  return XSD_INTEGER_DERIVED_DTS.has(dt);
}

function looksLikeUntypedNumericTokenLex(lex) {
  // We only treat *unquoted* tokens as "untyped numeric" (Turtle/N3 numeric literal).
  // Quoted literals without datatype are strings, never numbers.
  if (isQuotedLexical(lex)) return false;

  // integer
  if (/^[+-]?\d+$/.test(lex)) return true;

  // decimal (no exponent)
  if (/^[+-]?(?:\d+\.\d*|\.\d+)$/.test(lex)) return true;

  // double (with exponent)
  if (/^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)$/.test(lex)) return true;

  return false;
}

function parseNum(t) {
  // Parse as JS Number, but ONLY for xsd numeric datatypes or untyped numeric tokens.
  // For xsd:float/xsd:double, accept INF/-INF/NaN (and +INF).
  if (!(t instanceof Literal)) return null;

  const key = t.value;
  if (__parseNumCache.has(key)) return __parseNumCache.get(key);

  const [lex, dt] = literalParts(key);

  // Typed literals: must be xsd numeric.
  if (dt !== null) {
    if (!isXsdNumericDatatype(dt)) {
      __parseNumCache.set(key, null);
      return null;
    }
    const val = stripQuotes(lex);

    // float/double: allow INF/-INF/NaN and allow +/-Infinity results
    if (dt === XSD_FLOAT_DT || dt === XSD_DOUBLE_DT) {
      const sp = parseXsdFloatSpecialLex(val);
      if (sp !== null) {
        __parseNumCache.set(key, sp);
        return sp;
      }
      const n = Number(val);
      if (Number.isNaN(n)) {
        __parseNumCache.set(key, null);
        return null;
      }
      __parseNumCache.set(key, n);
      return n; // may be finite, +/-Infinity
    }

    // decimal/integer-derived: keep strict finite parsing
    const n = Number(val);
    if (!Number.isFinite(n)) {
      __parseNumCache.set(key, null);
      return null;
    }
    __parseNumCache.set(key, n);
    return n;
  }

  // Untyped literals: accept only unquoted numeric tokens.
  if (!looksLikeUntypedNumericTokenLex(lex)) {
    __parseNumCache.set(key, null);
    return null;
  }
  const n = Number(lex);
  if (!Number.isFinite(n)) {
    __parseNumCache.set(key, null);
    return null;
  }
  __parseNumCache.set(key, n);
  return n;
}

function parseIntLiteral(t) {
  // Parse as BigInt if (and only if) it is an integer literal in an integer datatype,
  // or an untyped integer token.
  if (!(t instanceof Literal)) return null;

  const key = t.value;
  if (__parseIntCache.has(key)) return __parseIntCache.get(key);

  const [lex, dt] = literalParts(key);

  if (dt !== null) {
    if (!isXsdIntegerDatatype(dt)) {
      __parseIntCache.set(key, null);
      return null;
    }
    const val = stripQuotes(lex);
    if (!/^[+-]?\d+$/.test(val)) {
      __parseIntCache.set(key, null);
      return null;
    }
    try {
      const out = BigInt(val);
      __parseIntCache.set(key, out);
      return out;
    } catch {
      __parseIntCache.set(key, null);
      return null;
    }
  }

  // Untyped: only accept unquoted integer tokens.
  if (isQuotedLexical(lex)) {
    __parseIntCache.set(key, null);
    return null;
  }
  if (!/^[+-]?\d+$/.test(lex)) {
    __parseIntCache.set(key, null);
    return null;
  }
  try {
    const out = BigInt(lex);
    __parseIntCache.set(key, out);
    return out;
  } catch {
    __parseIntCache.set(key, null);
    return null;
  }
}

function formatNum(n) {
  return String(n);
}

function parseXsdDecimalToBigIntScale(s) {
  let t = String(s).trim();
  let sign = 1n;

  if (t.startsWith('+')) t = t.slice(1);
  else if (t.startsWith('-')) {
    sign = -1n;
    t = t.slice(1);
  }

  // xsd:decimal lexical: (\d+(\.\d*)?|\.\d+)
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(t)) return null;

  let intPart = '0';
  let fracPart = '';

  if (t.includes('.')) {
    const parts = t.split('.');
    intPart = parts[0] === '' ? '0' : parts[0];
    fracPart = parts[1] || '';
  } else {
    intPart = t;
  }

  // normalize
  intPart = intPart.replace(/^0+(?=\d)/, '');
  fracPart = fracPart.replace(/0+$/, ''); // drop trailing zeros

  const scale = fracPart.length;
  const digits = intPart + fracPart || '0';

  return { num: sign * BigInt(digits), scale };
}

function pow10n(k) {
  return 10n ** BigInt(k);
}

// ===========================================================================
// Time & duration builtin helpers
// ===========================================================================

function parseXsdDateTerm(t) {
  if (!(t instanceof Literal)) return null;
  const [lex, dt] = literalParts(t.value);
  if (dt !== XSD_NS + 'date') return null;
  const val = stripQuotes(lex);
  const d = new Date(val + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseXsdDatetimeTerm(t) {
  if (!(t instanceof Literal)) return null;
  const [lex, dt] = literalParts(t.value);
  if (dt !== XSD_NS + 'dateTime') return null;
  const val = stripQuotes(lex);
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d; // Date in local/UTC, we only use timestamp
}

function parseXsdDateTimeLexParts(t) {
  // Parse *lexical* components of an xsd:dateTime literal without timezone normalization.
  // Returns { yearStr, month, day, hour, minute, second, tz } or null.
  if (!(t instanceof Literal)) return null;
  const [lex, dt] = literalParts(t.value);
  if (dt !== XSD_NS + 'dateTime') return null;
  const val = stripQuotes(lex);

  // xsd:dateTime lexical: YYYY-MM-DDThh:mm:ss(.s+)?(Z|(+|-)hh:mm)?
  const m = /^(-?\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(val);
  if (!m) return null;

  const yearStr = m[1];
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  const second = parseInt(m[6], 10);
  const tz = m[7] || null;

  if (!(month >= 1 && month <= 12)) return null;
  if (!(day >= 1 && day <= 31)) return null;
  if (!(hour >= 0 && hour <= 23)) return null;
  if (!(minute >= 0 && minute <= 59)) return null;
  if (!(second >= 0 && second <= 59)) return null;

  return { yearStr, month, day, hour, minute, second, tz };
}

function parseDatetimeLike(t) {
  const d = parseXsdDateTerm(t);
  if (d !== null) return d;
  return parseXsdDatetimeTerm(t);
}

function parseIso8601DurationToSeconds(s) {
  if (!s) return null;
  if (s[0] !== 'P') return null;
  const it = s.slice(1);
  let num = '';
  let inTime = false;
  let years = 0,
    months = 0,
    weeks = 0,
    days = 0,
    hours = 0,
    minutes = 0,
    seconds = 0;

  for (const c of it) {
    if (c === 'T') {
      inTime = true;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      num += c;
      continue;
    }
    if (!num) return null;
    const val = Number(num);
    if (Number.isNaN(val)) return null;
    num = '';
    if (!inTime && c === 'Y') years += val;
    else if (!inTime && c === 'M') months += val;
    else if (!inTime && c === 'W') weeks += val;
    else if (!inTime && c === 'D') days += val;
    else if (inTime && c === 'H') hours += val;
    else if (inTime && c === 'M') minutes += val;
    else if (inTime && c === 'S') seconds += val;
    else return null;
  }

  const totalDays =
    years * 365.2425 +
    months * 30.436875 +
    weeks * 7.0 +
    days +
    hours / 24.0 +
    minutes / (24.0 * 60.0) +
    seconds / (24.0 * 3600.0);

  return totalDays * 86400.0;
}

function parseNumericForCompareTerm(t) {
  // Strict: only accept xsd numeric literals, xsd:duration, xsd:date, xsd:dateTime
  // (or untyped numeric tokens).
  const bi = parseIntLiteral(t);
  if (bi !== null) return { kind: 'bigint', value: bi };

  const nDur = parseNumOrDuration(t);
  if (nDur !== null) return { kind: 'number', value: nDur };
  return null;
}

function cmpNumericInfo(aInfo, bInfo, op) {
  // op is one of ">", "<", ">=", "<=", "==", "!="
  if (!aInfo || !bInfo) return false;

  if (aInfo.kind === 'bigint' && bInfo.kind === 'bigint') {
    if (op === '>') return aInfo.value > bInfo.value;
    if (op === '<') return aInfo.value < bInfo.value;
    if (op === '>=') return aInfo.value >= bInfo.value;
    if (op === '<=') return aInfo.value <= bInfo.value;
    if (op === '==') return aInfo.value == bInfo.value;
    if (op === '!=') return aInfo.value != bInfo.value;
    return false;
  }

  const a = typeof aInfo.value === 'bigint' ? Number(aInfo.value) : aInfo.value;
  const b = typeof bInfo.value === 'bigint' ? Number(bInfo.value) : bInfo.value;

  if (op === '>') return a > b;
  if (op === '<') return a < b;
  if (op === '>=') return a >= b;
  if (op === '<=') return a <= b;
  if (op === '==') return a == b;
  if (op === '!=') return a != b;
  return false;
}

function evalNumericComparisonBuiltin(g, subst, op) {
  const aInfo = parseNumericForCompareTerm(g.s);
  const bInfo = parseNumericForCompareTerm(g.o);
  if (aInfo && bInfo && cmpNumericInfo(aInfo, bInfo, op)) return [{ ...subst }];

  if (g.s instanceof ListTerm && g.s.elems.length === 2) {
    const a2 = parseNumericForCompareTerm(g.s.elems[0]);
    const b2 = parseNumericForCompareTerm(g.s.elems[1]);
    if (a2 && b2 && cmpNumericInfo(a2, b2, op)) return [{ ...subst }];
  }
  return [];
}

function parseNumOrDuration(t) {
  const n = parseNum(t);
  if (n !== null) return n;

  // xsd:duration
  if (t instanceof Literal) {
    const [lex, dt] = literalParts(t.value);
    if (dt === XSD_NS + 'duration') {
      const val = stripQuotes(lex);
      const negative = val.startsWith('-');
      const core = negative ? val.slice(1) : val;
      if (!core.startsWith('P')) return null;
      const secs = parseIso8601DurationToSeconds(core);
      if (secs === null) return null;
      return negative ? -secs : secs;
    }
  }

  // xsd:date / xsd:dateTime
  const dtval = parseDatetimeLike(t);
  if (dtval !== null) {
    return dtval.getTime() / 1000.0;
  }
  return null;
}

function formatDurationLiteralFromSeconds(secs) {
  const neg = secs < 0;
  const days = Math.round(Math.abs(secs) / 86400.0);
  const literalLex = neg ? `"-P${days}D"` : `"P${days}D"`;
  return internLiteral(`${literalLex}^^<${XSD_NS}duration>`);
}
function numEqualTerm(t, n, eps = 1e-9) {
  const v = parseNum(t);
  if (v === null) return false;

  // NaN is not equal to anything (including itself) for our numeric-equality use.
  if (Number.isNaN(v) || Number.isNaN(n)) return false;

  // Infinity handling
  if (!Number.isFinite(v) || !Number.isFinite(n)) return v === n;

  return Math.abs(v - n) < eps;
}

function numericDatatypeFromLex(lex) {
  if (/[eE]/.test(lex)) return XSD_DOUBLE_DT;
  if (lex.includes('.')) return XSD_DECIMAL_DT;
  return XSD_INTEGER_DT;
}

function parseNumericLiteralInfo(t) {
  if (!(t instanceof Literal)) return null;

  const key = t.value;
  if (__parseNumericInfoCache.has(key)) return __parseNumericInfoCache.get(key);

  const v = key;
  const [lex, dt] = literalParts(v);

  let dt2 = dt;
  let lexStr;

  if (dt2 !== null) {
    // Accept all xsd numeric datatypes; normalize integer-derived to xsd:integer.
    if (!isXsdNumericDatatype(dt2)) {
      __parseNumericInfoCache.set(key, null);
      return null;
    }
    if (isXsdIntegerDatatype(dt2)) dt2 = XSD_INTEGER_DT;
    lexStr = stripQuotes(lex);
  } else {
    // Untyped numeric token (N3/Turtle numeric literal)
    if (typeof v !== 'string') {
      __parseNumericInfoCache.set(key, null);
      return null;
    }
    if (v.startsWith('"')) {
      __parseNumericInfoCache.set(key, null);
      return null; // exclude quoted strings
    }
    if (!/^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?$/.test(v)) {
      __parseNumericInfoCache.set(key, null);
      return null;
    }

    dt2 = numericDatatypeFromLex(v);
    lexStr = v;
  }

  if (dt2 === XSD_INTEGER_DT) {
    try {
      const info = { dt: dt2, kind: 'bigint', value: BigInt(lexStr), lexStr };
      __parseNumericInfoCache.set(key, info);
      return info;
    } catch {
      __parseNumericInfoCache.set(key, null);
      return null;
    }
  }

  // float/double special lexicals
  if (dt2 === XSD_FLOAT_DT || dt2 === XSD_DOUBLE_DT) {
    const sp = parseXsdFloatSpecialLex(lexStr);
    if (sp !== null) {
      const info = { dt: dt2, kind: 'number', value: sp, lexStr };
      __parseNumericInfoCache.set(key, info);
      return info;
    }
  }

  const num = Number(lexStr);
  if (Number.isNaN(num)) {
    __parseNumericInfoCache.set(key, null);
    return null;
  }

  // allow +/-Infinity for float/double
  if (dt2 === XSD_DECIMAL_DT && !Number.isFinite(num)) {
    __parseNumericInfoCache.set(key, null);
    return null;
  }

  const info = { dt: dt2, kind: 'number', value: num, lexStr };
  __parseNumericInfoCache.set(key, info);
  return info;
}

function numericRank(dt) {
  if (dt === XSD_INTEGER_DT) return 0;
  if (dt === XSD_DECIMAL_DT) return 1;
  if (dt === XSD_FLOAT_DT) return 2;
  if (dt === XSD_DOUBLE_DT) return 3;
  return -1;
}

function numericDatatypeOfTerm(t) {
  if (!(t instanceof Literal)) return null;
  const [lex, dt] = literalParts(t.value);

  if (dt !== null) {
    if (!isXsdNumericDatatype(dt)) return null;
    if (isXsdIntegerDatatype(dt)) return XSD_INTEGER_DT;
    if (dt === XSD_DECIMAL_DT || dt === XSD_FLOAT_DT || dt === XSD_DOUBLE_DT) return dt;
    return null;
  }

  // Untyped numeric token
  if (!looksLikeUntypedNumericTokenLex(lex)) return null;
  return numericDatatypeFromLex(lex);
}

function commonNumericDatatype(terms, outTerm) {
  let r = 0;
  const all = Array.isArray(terms) ? terms.slice() : [];
  if (outTerm) all.push(outTerm);

  for (const t of all) {
    const dt = numericDatatypeOfTerm(t);
    if (!dt) continue;
    const rr = numericRank(dt);
    if (rr > r) r = rr;
  }

  if (r === 3) return XSD_DOUBLE_DT;
  if (r === 2) return XSD_FLOAT_DT;
  if (r === 1) return XSD_DECIMAL_DT;
  return XSD_INTEGER_DT;
}

function makeNumericOutputLiteral(val, dt) {
  if (dt === XSD_INTEGER_DT) {
    if (typeof val === 'bigint') return internLiteral(val.toString());
    if (Number.isInteger(val)) return internLiteral(String(val));
    // If a non-integer sneaks in, promote to decimal.
    return internLiteral(`"${formatNum(val)}"^^<${XSD_DECIMAL_DT}>`);
  }

  if (dt === XSD_FLOAT_DT || dt === XSD_DOUBLE_DT) {
    const sp = formatXsdFloatSpecialLex(val);
    const lex = sp !== null ? sp : formatNum(val);
    return internLiteral(`"${lex}"^^<${dt}>`);
  }

  // decimal
  const lex = typeof val === 'bigint' ? val.toString() : formatNum(val);
  return internLiteral(`"${lex}"^^<${dt}>`);
}

function evalUnaryMathRel(g, subst, forwardFn, inverseFn /* may be null */) {
  const sIsUnbound = g.s instanceof Var || g.s instanceof Blank;
  const oIsUnbound = g.o instanceof Var || g.o instanceof Blank;

  const a = parseNum(g.s); // subject numeric?
  const b = parseNum(g.o); // object numeric?

  // Forward: s numeric => compute o
  if (a !== null) {
    const outVal = forwardFn(a);
    if (!Number.isFinite(outVal)) return [];

    let outDt = commonNumericDatatype([g.s], g.o);
    if (outDt === XSD_INTEGER_DT && !Number.isInteger(outVal)) outDt = XSD_DECIMAL_DT;

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = makeNumericOutputLiteral(outVal, outDt);
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];
    if (numEqualTerm(g.o, outVal)) return [{ ...subst }];
    return [];
  }

  // Reverse (bounded): o numeric => compute s
  if (b !== null && typeof inverseFn === 'function') {
    const inVal = inverseFn(b);
    if (!Number.isFinite(inVal)) return [];

    let inDt = commonNumericDatatype([g.o], g.s);
    if (inDt === XSD_INTEGER_DT && !Number.isInteger(inVal)) inDt = XSD_DECIMAL_DT;

    if (g.s instanceof Var) {
      const s2 = { ...subst };
      s2[g.s.name] = makeNumericOutputLiteral(inVal, inDt);
      return [s2];
    }
    if (g.s instanceof Blank) return [{ ...subst }];
    if (numEqualTerm(g.s, inVal)) return [{ ...subst }];
    return [];
  }

  // Fully unbound: do *not* treat as immediately satisfiable.
  // In goal proving, succeeding with no bindings can let a conjunction
  // "pass" before other goals bind one side, preventing later evaluation
  // in the now-solvable direction. Instead, we fail here so the engine's
  // builtin deferral can retry the goal once variables are bound.
  if (sIsUnbound && oIsUnbound) return [];

  return [];
}

// ===========================================================================
// List builtin helpers
// ===========================================================================

function listAppendSplit(parts, resElems, subst) {
  if (!parts.length) {
    if (!resElems.length) return [{ ...subst }];
    return [];
  }
  const out = [];
  const n = resElems.length;
  for (let k = 0; k <= n; k++) {
    const left = new ListTerm(resElems.slice(0, k));
    let s1 = unifyTermListAppend(parts[0], left, subst);
    if (s1 === null) continue;
    const restElems = resElems.slice(k);
    out.push(...listAppendSplit(parts.slice(1), restElems, s1));
  }
  return out;
}


// ---------------------------------------------------------------------------
// RDF-list support for list:* builtins
// ---------------------------------------------------------------------------

function __rdfListObjectsForSP(facts, predIri, subj) {
  ensureFactIndexes(facts);
  const sk = termFastKey(subj);
  if (sk !== null) {
    const ps = facts.__byPS.get(predIri);
    if (ps) {
      const bucket = ps.get(sk);
      if (bucket && bucket.length) return bucket.map((tr) => tr.o);
    }
  }

  // Fallback scan (covers non-indexable terms)
  const pb = facts.__byPred.get(predIri) || [];
  const out = [];
  for (const tr of pb) {
    if (termsEqual(tr.s, subj)) out.push(tr.o);
  }
  return out;
}

function __rdfListElemsFromNode(head, facts) {
  if (!(head instanceof Iri || head instanceof Blank)) return null;

  // Cache per fact-set (important in forward chaining)
  if (!Object.prototype.hasOwnProperty.call(facts, '__rdfListCache')) {
    Object.defineProperty(facts, '__rdfListCache', {
      value: new Map(),
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }

  const key = termFastKey(head);
  if (key === null) return null;
  const cache = facts.__rdfListCache;
  if (cache.has(key)) return cache.get(key);

  const RDF_FIRST = RDF_NS + 'first';
  const RDF_REST = RDF_NS + 'rest';
  const RDF_NIL = RDF_NS + 'nil';

  const elems = [];
  const seen = new Set();
  let cur = head;

  // RDF graphs are sets: duplicate triples are semantically irrelevant.
  // In practice, users may concatenate files or repeat blocks, which can
  // duplicate rdf:first/rdf:rest statements. Treat identical duplicates as
  // a single value; but keep detection of *conflicting* values.
  function __uniqTerms(ts) {
    /** @type {any[]} */
    const out = [];
    for (const t of ts) {
      if (!out.some((u) => termsEqual(u, t))) out.push(t);
    }
    return out;
  }

  while (true) {
    if (cur instanceof Iri && cur.value === RDF_NIL) {
      cache.set(key, elems);
      return elems;
    }

    if (!(cur instanceof Iri || cur instanceof Blank)) {
      cache.set(key, null);
      return null;
    }

    const ck = termFastKey(cur);
    if (ck === null) {
      cache.set(key, null);
      return null;
    }
    if (seen.has(ck)) {
      cache.set(key, null);
      return null; // cycle
    }
    seen.add(ck);

    const firsts = __uniqTerms(__rdfListObjectsForSP(facts, RDF_FIRST, cur));
    const rests = __uniqTerms(__rdfListObjectsForSP(facts, RDF_REST, cur));

    if (firsts.length !== 1 || rests.length !== 1) {
      cache.set(key, null);
      return null;
    }

    elems.push(firsts[0]);
    const rest = rests[0];

    if (rest instanceof Iri && rest.value === RDF_NIL) {
      cache.set(key, elems);
      return elems;
    }

    // Mixed tail: rdf:rest can be an N3 list literal (e.g., (:b))
    if (rest instanceof ListTerm) {
      elems.push(...rest.elems);
      cache.set(key, elems);
      return elems;
    }
    if (rest instanceof OpenListTerm) {
      elems.push(...rest.prefix);
      elems.push(new Var(rest.tailVar));
      cache.set(key, elems);
      return elems;
    }

    cur = rest;
  }
}

function __listElemsForBuiltin(listLike, facts) {
  if (listLike instanceof ListTerm) return listLike.elems;
  if (listLike instanceof Iri || listLike instanceof Blank) return __rdfListElemsFromNode(listLike, facts);
  return null;
}

function evalListFirstLikeBuiltin(sTerm, oTerm, subst) {
  if (!(sTerm instanceof ListTerm)) return [];
  if (!sTerm.elems.length) return [];
  const first = sTerm.elems[0];
  const s2 = unifyTerm(oTerm, first, subst);
  return s2 !== null ? [s2] : [];
}

function evalListRestLikeBuiltin(sTerm, oTerm, subst) {
  // Closed list: (a b c) -> (b c)
  if (sTerm instanceof ListTerm) {
    if (!sTerm.elems.length) return [];
    const rest = new ListTerm(sTerm.elems.slice(1));
    const s2 = unifyTerm(oTerm, rest, subst);
    return s2 !== null ? [s2] : [];
  }

  // Open list: (a b ... ?T) -> (b ... ?T)
  if (sTerm instanceof OpenListTerm) {
    if (!sTerm.prefix.length) return [];
    if (sTerm.prefix.length === 1) {
      const s2 = unifyTerm(oTerm, new Var(sTerm.tailVar), subst);
      return s2 !== null ? [s2] : [];
    }
    const rest = new OpenListTerm(sTerm.prefix.slice(1), sTerm.tailVar);
    const s2 = unifyTerm(oTerm, rest, subst);
    return s2 !== null ? [s2] : [];
  }

  return [];
}

// ===========================================================================
// RDF list materialization
// ===========================================================================

// Turn RDF Collections described with rdf:first/rdf:rest (+ rdf:nil) into ListTerm terms.
// This mutates triples/rules in-place so list:* builtins work on RDF-serialized lists too.
function materializeRdfLists(triples, forwardRules, backwardRules) {
  const RDF_FIRST = RDF_NS + 'first';
  const RDF_REST = RDF_NS + 'rest';
  const RDF_NIL = RDF_NS + 'nil';

  function nodeKey(t) {
    // Only rewrite anonymous RDF list nodes (blank nodes). Named list nodes
    // must keep their identity; list:* builtins can traverse rdf:first/rest.
    if (t instanceof Blank) return `b:${t.label}`;
    return null;
  }

  // Collect first/rest arcs from *input triples*
  const firstMap = new Map(); // key(subject) -> Term (object)
  const restMap = new Map(); // key(subject) -> Term (object)
  for (const tr of triples) {
    if (!(tr.p instanceof Iri)) continue;
    const k = nodeKey(tr.s);
    if (!k) continue;
    if (tr.p.value === RDF_FIRST) firstMap.set(k, tr.o);
    else if (tr.p.value === RDF_REST) restMap.set(k, tr.o);
  }
  if (!firstMap.size && !restMap.size) return;

  const cache = new Map(); // key(node) -> ListTerm
  const visiting = new Set(); // cycle guard

  function buildListForKey(k) {
    if (cache.has(k)) return cache.get(k);
    if (visiting.has(k)) return null; // cycle => not a well-formed list
    visiting.add(k);

    // rdf:nil => ()
    if (k === 'I:' + RDF_NIL) {
      const empty = new ListTerm([]);
      cache.set(k, empty);
      visiting.delete(k);
      return empty;
    }

    const head = firstMap.get(k);
    const tail = restMap.get(k);
    if (head === undefined || tail === undefined) {
      visiting.delete(k);
      return null; // not a full cons cell
    }

    const headTerm = rewriteTerm(head);

    let tailListElems = null;
    if (tail instanceof Iri && tail.value === RDF_NIL) {
      tailListElems = [];
    } else {
      const tk = nodeKey(tail);
      if (!tk) {
        visiting.delete(k);
        return null;
      }
      const tailList = buildListForKey(tk);
      if (!tailList) {
        visiting.delete(k);
        return null;
      }
      tailListElems = tailList.elems;
    }

    const out = new ListTerm([headTerm, ...tailListElems]);
    cache.set(k, out);
    visiting.delete(k);
    return out;
  }

  function rewriteTerm(t) {
    // Replace list nodes (Blank/Iri) by their constructed ListTerm when possible
    const k = nodeKey(t);
    if (k) {
      const built = buildListForKey(k);
      if (built) return built;
      // Also rewrite rdf:nil even if not otherwise referenced
      if (t instanceof Iri && t.value === RDF_NIL) return new ListTerm([]);
      return t;
    }
    if (t instanceof ListTerm) {
      let changed = false;
      const elems = t.elems.map((e) => {
        const r = rewriteTerm(e);
        if (r !== e) changed = true;
        return r;
      });
      return changed ? new ListTerm(elems) : t;
    }
    if (t instanceof OpenListTerm) {
      let changed = false;
      const prefix = t.prefix.map((e) => {
        const r = rewriteTerm(e);
        if (r !== e) changed = true;
        return r;
      });
      return changed ? new OpenListTerm(prefix, t.tailVar) : t;
    }
    if (t instanceof GraphTerm) {
      for (const tr of t.triples) rewriteTriple(tr);
      return t;
    }
    return t;
  }

  function rewriteTriple(tr) {
    tr.s = rewriteTerm(tr.s);
    tr.p = rewriteTerm(tr.p);
    tr.o = rewriteTerm(tr.o);
  }

  // Pre-build all reachable list heads
  for (const k of firstMap.keys()) buildListForKey(k);

  // Rewrite input triples + rules in-place
  for (const tr of triples) rewriteTriple(tr);
  for (const r of forwardRules) {
    for (const tr of r.premise) rewriteTriple(tr);
    for (const tr of r.conclusion) rewriteTriple(tr);
  }
  for (const r of backwardRules) {
    for (const tr of r.premise) rewriteTriple(tr);
    for (const tr of r.conclusion) rewriteTriple(tr);
  }
}

// ===========================================================================
// Crypto builtin helpers
// ===========================================================================

function hashLiteralTerm(t, algo) {
  if (!(t instanceof Literal)) return null;
  const [lex] = literalParts(t.value);
  const input = stripQuotes(lex);
  try {
    const digest = nodeCrypto.createHash(algo).update(input, 'utf8').digest('hex');
    return internLiteral(JSON.stringify(digest));
  } catch (e) {
    return null;
  }
}

function evalCryptoHashBuiltin(g, subst, algo) {
  const lit = hashLiteralTerm(g.s, algo);
  if (!lit) return [];
  if (g.o instanceof Var) {
    const s2 = { ...subst };
    s2[g.o.name] = lit;
    return [s2];
  }
  const s2 = unifyTerm(g.o, lit, subst);
  return s2 !== null ? [s2] : [];
}

// ---------------------------------------------------------------------------
// log: scoped-closure priority helper
// ---------------------------------------------------------------------------
// When log:collectAllIn / log:forAllIn are used with an object that is a
// positive integer literal (>= 1), that number is treated as a *priority* (closure level).
// See the adapted semantics near those builtins.
function __logNaturalPriorityFromTerm(t) {
  const info = parseNumericLiteralInfo(t);
  if (!info) return null;
  if (info.dt !== XSD_INTEGER_DT) return null;

  const v = info.value;
  if (typeof v === 'bigint') {
    if (v < 1n) return null;
    if (v > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(v);
  }
  if (typeof v === 'number') {
    if (!Number.isInteger(v) || v < 1) return null;
    return v;
  }
  return null;
}

// ===========================================================================
// Builtin evaluation
// ===========================================================================
// Backward proof & builtins mutual recursion — declarations first

function evalBuiltin(goal, subst, facts, backRules, depth, varGen, maxResults) {
  const g = applySubstTriple(goal, subst);
  const pv = iriValue(g.p);
  if (pv === null) return null;

  // Super restricted mode: disable *all* builtins except => / <= (log:implies / log:impliedBy)
  if (typeof getSuperRestrictedMode === 'function' && getSuperRestrictedMode()) {
    const allow1 = LOG_NS + 'implies';
    const allow2 = LOG_NS + 'impliedBy';
    if (pv !== allow1 && pv !== allow2) return [];
  }

  // -----------------------------------------------------------------
  // 4.1 crypto: builtins
  // -----------------------------------------------------------------

  // crypto:sha, crypto:md5, crypto:sha256, crypto:sha512
  // Digest builtins. crypto:sha uses SHA-1 per the N3/crypto convention.
  const cryptoAlgo =
    pv === CRYPTO_NS + 'sha'
      ? 'sha1'
      : pv === CRYPTO_NS + 'md5'
        ? 'md5'
        : pv === CRYPTO_NS + 'sha256'
          ? 'sha256'
          : pv === CRYPTO_NS + 'sha512'
            ? 'sha512'
            : null;
  if (cryptoAlgo) return evalCryptoHashBuiltin(g, subst, cryptoAlgo);

  // -----------------------------------------------------------------
  // 4.2 math: builtins
  // -----------------------------------------------------------------

  // math:greaterThan / lessThan / notLessThan / notGreaterThan / equalTo / notEqualTo
  const mathCmpOp =
    pv === MATH_NS + 'greaterThan'
      ? '>'
      : pv === MATH_NS + 'lessThan'
        ? '<'
        : pv === MATH_NS + 'notLessThan'
          ? '>='
          : pv === MATH_NS + 'notGreaterThan'
            ? '<='
            : pv === MATH_NS + 'equalTo'
              ? '=='
              : pv === MATH_NS + 'notEqualTo'
                ? '!='
                : null;
  if (mathCmpOp) return evalNumericComparisonBuiltin(g, subst, mathCmpOp);

  // math:sum
  // Schema: ( $s.i+ )+ math:sum $o-
  if (pv === MATH_NS + 'sum') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length < 2) return [];
    const xs = g.s.elems;

    const dtOut0 = commonNumericDatatype(xs, g.o);

    // Exact integer mode
    if (dtOut0 === XSD_INTEGER_DT) {
      let total = 0n;
      for (const t of xs) {
        const v = parseIntLiteral(t);
        if (v === null) return [];
        total += v;
      }

      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = makeNumericOutputLiteral(total, XSD_INTEGER_DT);
        return [s2];
      }
      if (g.o instanceof Blank) return [{ ...subst }];

      const oi = parseIntLiteral(g.o);
      if (oi !== null && oi === total) return [{ ...subst }];

      // Fallback numeric compare
      if (numEqualTerm(g.o, Number(total))) return [{ ...subst }];
      return [];
    }

    // Numeric mode (decimal/float/double)
    let total = 0.0;
    for (const t of xs) {
      const v = parseNum(t);
      if (v === null) return [];
      total += v;
    }

    let dtOut = dtOut0;
    if (dtOut === XSD_INTEGER_DT && !Number.isInteger(total)) dtOut = XSD_DECIMAL_DT;
    const lit = makeNumericOutputLiteral(total, dtOut);

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = lit;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];
    if (numEqualTerm(g.o, total)) return [{ ...subst }];
    return [];
  }

  // math:product
  // Schema: ( $s.i+ )+ math:product $o-
  if (pv === MATH_NS + 'product') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length < 2) return [];
    const xs = g.s.elems;

    const dtOut0 = commonNumericDatatype(xs, g.o);

    // Exact integer mode
    if (dtOut0 === XSD_INTEGER_DT) {
      let prod = 1n;
      for (const t of xs) {
        const v = parseIntLiteral(t);
        if (v === null) return [];
        prod *= v;
      }

      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = makeNumericOutputLiteral(prod, XSD_INTEGER_DT);
        return [s2];
      }
      if (g.o instanceof Blank) return [{ ...subst }];

      const oi = parseIntLiteral(g.o);
      if (oi !== null && oi === prod) return [{ ...subst }];
      if (numEqualTerm(g.o, Number(prod))) return [{ ...subst }];
      return [];
    }

    // Numeric mode (decimal/float/double)
    let prod = 1.0;
    for (const t of xs) {
      const v = parseNum(t);
      if (v === null) return [];
      prod *= v;
    }

    let dtOut = dtOut0;
    if (dtOut === XSD_INTEGER_DT && !Number.isInteger(prod)) dtOut = XSD_DECIMAL_DT;
    const lit = makeNumericOutputLiteral(prod, dtOut);

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = lit;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];
    if (numEqualTerm(g.o, prod)) return [{ ...subst }];
    return [];
  }

  // math:difference
  // Schema: ( $s.1+ $s.2+ )+ math:difference $o-
  if (pv === MATH_NS + 'difference') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
    const [a0, b0] = g.s.elems;

    // 1) Date/datetime difference -> duration   (needed for examples/age.n3)
    const aDt = parseDatetimeLike(a0);
    const bDt = parseDatetimeLike(b0);
    if (aDt !== null && bDt !== null) {
      const diffSecs = (aDt.getTime() - bDt.getTime()) / 1000.0;
      const durTerm = formatDurationLiteralFromSeconds(diffSecs);
      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = durTerm;
        return [s2];
      }
      const s2 = unifyTerm(g.o, durTerm, subst);
      return s2 !== null ? [s2] : [];
    }

    // 2) Date/datetime minus duration/seconds -> dateTime (keeps older functionality)
    if (aDt !== null) {
      const secs = parseNumOrDuration(b0);
      if (secs !== null) {
        const outSecs = aDt.getTime() / 1000.0 - secs;
        const lex = time.utcIsoDateTimeStringFromEpochSeconds(outSecs);
        const lit = internLiteral(`"${lex}"^^<${XSD_NS}dateTime>`);
        if (g.o instanceof Var) {
          const s2 = { ...subst };
          s2[g.o.name] = lit;
          return [s2];
        }
        const s2 = unifyTerm(g.o, lit, subst);
        return s2 !== null ? [s2] : [];
      }
    }

    // 3) Exact integer difference (BigInt)
    const ai = parseIntLiteral(a0);
    const bi = parseIntLiteral(b0);
    if (ai !== null && bi !== null) {
      const ci = ai - bi;
      const lit = internLiteral(ci.toString());
      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = lit;
        return [s2];
      }
      const s2 = unifyTerm(g.o, lit, subst);
      return s2 !== null ? [s2] : [];
    }

    // 4) Numeric difference (your “typed output + numeric compare” version)
    const a = parseNum(a0);
    const b = parseNum(b0);
    if (a === null || b === null) return [];

    const c = a - b;
    if (!Number.isFinite(c)) return [];

    // If you added commonNumericDatatype/makeNumericOutputLiteral, keep using them:
    if (typeof commonNumericDatatype === 'function' && typeof makeNumericOutputLiteral === 'function') {
      let dtOut = commonNumericDatatype([a0, b0], g.o);
      if (dtOut === XSD_INTEGER_DT && !Number.isInteger(c)) dtOut = XSD_DECIMAL_DT;
      const lit = makeNumericOutputLiteral(c, dtOut);

      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = lit;
        return [s2];
      }
      if (g.o instanceof Blank) return [{ ...subst }];
      if (numEqualTerm(g.o, c)) return [{ ...subst }];
      return [];
    }

    // Fallback (if you *don’t* have those helpers yet):
    const lit = internLiteral(formatNum(c));
    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = lit;
      return [s2];
    }
    const s2 = unifyTerm(g.o, lit, subst);
    return s2 !== null ? [s2] : [];
  }

  // math:quotient
  // Schema: ( $s.1+ $s.2+ )+ math:quotient $o-
  if (pv === MATH_NS + 'quotient') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
    const [a0, b0] = g.s.elems;

    const a = parseNum(a0);
    const b = parseNum(b0);
    if (a === null || b === null) return [];
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return [];

    const c = a / b;
    if (!Number.isFinite(c)) return [];

    let dtOut = commonNumericDatatype([a0, b0], g.o);
    if (dtOut === XSD_INTEGER_DT && !Number.isInteger(c)) dtOut = XSD_DECIMAL_DT;
    const lit = makeNumericOutputLiteral(c, dtOut);

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = lit;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];
    if (numEqualTerm(g.o, c)) return [{ ...subst }];
    return [];
  }

  // math:integerQuotient
  // Schema: ( $a $b ) math:integerQuotient $q
  // Cwm: divide first integer by second integer, ignoring remainder. :contentReference[oaicite:1]{index=1}
  if (pv === MATH_NS + 'integerQuotient') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
    const [a0, b0] = g.s.elems;

    // Prefer exact integer division using BigInt when possible
    const ai = parseIntLiteral(a0);
    const bi = parseIntLiteral(b0);
    if (ai !== null && bi !== null) {
      if (bi === 0n) return [];
      const q = ai / bi; // BigInt division truncates toward zero
      const lit = internLiteral(q.toString());
      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = lit;
        return [s2];
      }
      if (g.o instanceof Blank) return [{ ...subst }];

      const oi = parseIntLiteral(g.o);
      if (oi !== null && oi === q) return [{ ...subst }];

      // Only do numeric compare when safe enough to convert
      const qNum = Number(q);
      if (Number.isFinite(qNum) && Math.abs(qNum) <= Number.MAX_SAFE_INTEGER) {
        if (numEqualTerm(g.o, qNum)) return [{ ...subst }];
      }

      const s2 = unifyTerm(g.o, lit, subst);
      return s2 !== null ? [s2] : [];
    }

    // Fallback: allow Number literals that still represent integers
    const a = parseNum(a0);
    const b = parseNum(b0);
    if (a === null || b === null) return [];
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return [];
    if (!Number.isInteger(a) || !Number.isInteger(b)) return [];

    const q = Math.trunc(a / b);
    const lit = internLiteral(String(q));
    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = lit;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];

    if (numEqualTerm(g.o, q)) return [{ ...subst }];

    const s2 = unifyTerm(g.o, lit, subst);
    return s2 !== null ? [s2] : [];
  }

  // math:exponentiation
  if (pv === MATH_NS + 'exponentiation') {
    if (g.s instanceof ListTerm && g.s.elems.length === 2) {
      const baseTerm = g.s.elems[0];
      const expTerm = g.s.elems[1];

      const a = parseNum(baseTerm);
      let b = null;
      if (a !== null) b = parseNum(expTerm);

      // Forward mode: base and exponent are numeric
      if (a !== null && b !== null) {
        const cVal = a ** b;
        if (!Number.isFinite(cVal)) return [];

        let dtOut = commonNumericDatatype([baseTerm, expTerm], g.o);
        if (dtOut === XSD_INTEGER_DT && !Number.isInteger(cVal)) dtOut = XSD_DECIMAL_DT;
        const lit = makeNumericOutputLiteral(cVal, dtOut);

        if (g.o instanceof Var) {
          const s2 = { ...subst };
          s2[g.o.name] = lit;
          return [s2];
        }
        if (g.o instanceof Blank) return [{ ...subst }];
        if (numEqualTerm(g.o, cVal)) return [{ ...subst }];
      }

      // Inverse mode: solve exponent
      const c = parseNum(g.o);
      if (a !== null && expTerm instanceof Var && c !== null) {
        if (a > 0.0 && a !== 1.0 && c > 0.0) {
          const bVal = Math.log(c) / Math.log(a);
          if (!Number.isFinite(bVal)) return [];

          let dtB = commonNumericDatatype([baseTerm, g.o], expTerm);
          if (dtB === XSD_INTEGER_DT && !Number.isInteger(bVal)) dtB = XSD_DECIMAL_DT;

          const s2 = { ...subst };
          s2[expTerm.name] = makeNumericOutputLiteral(bVal, dtB);
          return [s2];
        }
      }
      return [];
    }
  }

  // math:absoluteValue
  if (pv === MATH_NS + 'absoluteValue') {
    const a = parseNum(g.s);
    if (a === null) return [];

    const outVal = Math.abs(a);
    if (!Number.isFinite(outVal)) return [];

    let dtOut = commonNumericDatatype([g.s], g.o);
    if (dtOut === XSD_INTEGER_DT && !Number.isInteger(outVal)) dtOut = XSD_DECIMAL_DT;

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = makeNumericOutputLiteral(outVal, dtOut);
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];
    if (numEqualTerm(g.o, outVal)) return [{ ...subst }];
    return [];
  }

  // math:acos
  if (pv === MATH_NS + 'acos') {
    return evalUnaryMathRel(g, subst, Math.acos, Math.cos);
  }

  // math:asin
  if (pv === MATH_NS + 'asin') {
    return evalUnaryMathRel(g, subst, Math.asin, Math.sin);
  }

  // math:atan
  if (pv === MATH_NS + 'atan') {
    return evalUnaryMathRel(g, subst, Math.atan, Math.tan);
  }

  // math:sin  (inverse uses principal asin)
  if (pv === MATH_NS + 'sin') {
    return evalUnaryMathRel(g, subst, Math.sin, Math.asin);
  }

  // math:cos  (inverse uses principal acos)
  if (pv === MATH_NS + 'cos') {
    return evalUnaryMathRel(g, subst, Math.cos, Math.acos);
  }

  // math:tan  (inverse uses principal atan)
  if (pv === MATH_NS + 'tan') {
    return evalUnaryMathRel(g, subst, Math.tan, Math.atan);
  }

  // math:sinh / cosh / tanh (guard for JS availability)
  if (pv === MATH_NS + 'sinh') {
    if (typeof Math.sinh !== 'function' || typeof Math.asinh !== 'function') return [];
    return evalUnaryMathRel(g, subst, Math.sinh, Math.asinh);
  }
  if (pv === MATH_NS + 'cosh') {
    if (typeof Math.cosh !== 'function' || typeof Math.acosh !== 'function') return [];
    return evalUnaryMathRel(g, subst, Math.cosh, Math.acosh);
  }
  if (pv === MATH_NS + 'tanh') {
    if (typeof Math.tanh !== 'function' || typeof Math.atanh !== 'function') return [];
    return evalUnaryMathRel(g, subst, Math.tanh, Math.atanh);
  }

  // math:degrees (inverse is radians)
  if (pv === MATH_NS + 'degrees') {
    const toDeg = (rad) => (rad * 180.0) / Math.PI;
    const toRad = (deg) => (deg * Math.PI) / 180.0;
    return evalUnaryMathRel(g, subst, toDeg, toRad);
  }

  // math:negation (inverse is itself)
  if (pv === MATH_NS + 'negation') {
    const neg = (x) => -x;
    return evalUnaryMathRel(g, subst, neg, neg);
  }

  // math:remainder
  // Subject is a list (dividend divisor); object is the remainder.
  // Schema: ( $a $b ) math:remainder $r
  if (pv === MATH_NS + 'remainder') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
    const [a0, b0] = g.s.elems;

    // Prefer exact integer arithmetic (BigInt)
    const ai = parseIntLiteral(a0);
    const bi = parseIntLiteral(b0);
    if (ai !== null && bi !== null) {
      if (bi === 0n) return [];
      const r = ai % bi;
      const lit = makeNumericOutputLiteral(r, XSD_INTEGER_DT);

      if (g.o instanceof Var) {
        const s2 = { ...subst };
        s2[g.o.name] = lit;
        return [s2];
      }
      if (g.o instanceof Blank) return [{ ...subst }];

      const oi = parseIntLiteral(g.o);
      if (oi !== null && oi === r) return [{ ...subst }];
      if (numEqualTerm(g.o, Number(r))) return [{ ...subst }];
      return [];
    }

    // Fallback: allow Number literals that still represent integers
    const a = parseNum(a0);
    const b = parseNum(b0);
    if (a === null || b === null) return [];
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return [];
    if (!Number.isInteger(a) || !Number.isInteger(b)) return [];

    const rVal = a % b;
    const lit = makeNumericOutputLiteral(rVal, XSD_INTEGER_DT);

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = lit;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];
    if (numEqualTerm(g.o, rVal)) return [{ ...subst }];
    return [];
  }

  // math:rounded
  // Round to nearest integer.
  // If there are two such numbers, then the one closest to positive infinity is returned.
  // Schema: $s+ math:rounded $o-
  // Note: spec says $o is xsd:integer, but we also accept any numeric $o that equals the rounded value.
  if (pv === MATH_NS + 'rounded') {
    const a = parseNum(g.s);
    if (a === null) return [];
    if (Number.isNaN(a)) return [];

    const rVal = Math.round(a); // ties go toward +∞ in JS (e.g., -1.5 -> -1)
    const lit = internLiteral(String(rVal)); // integer token

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = lit;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];

    // Accept typed numeric literals too (e.g., "3"^^xsd:float) if numerically equal.
    if (numEqualTerm(g.o, rVal)) return [{ ...subst }];

    // Fallback to strict unification
    const s2 = unifyTerm(g.o, lit, subst);
    return s2 !== null ? [s2] : [];
  }

  // -----------------------------------------------------------------
  // 4.3 time: builtins
  // -----------------------------------------------------------------

  // time:day
  // Gets as object the integer day component of the subject xsd:dateTime.
  // Schema: $s+ time:day $o-
  if (pv === TIME_NS + 'day') {
    const parts = parseXsdDateTimeLexParts(g.s);
    if (!parts) return [];
    const out = internLiteral(String(parts.day));

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = out;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];

    const oi = parseIntLiteral(g.o);
    if (oi !== null) {
      try {
        if (oi === BigInt(parts.day)) return [{ ...subst }];
      } catch {}
    }

    const s2 = unifyTerm(g.o, out, subst);
    return s2 !== null ? [s2] : [];
  }

  // time:hour
  // Gets as object the integer hour component of the subject xsd:dateTime.
  // Schema: $s+ time:hour $o-
  if (pv === TIME_NS + 'hour') {
    const parts = parseXsdDateTimeLexParts(g.s);
    if (!parts) return [];
    const out = internLiteral(String(parts.hour));

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = out;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];

    const oi = parseIntLiteral(g.o);
    if (oi !== null) {
      try {
        if (oi === BigInt(parts.hour)) return [{ ...subst }];
      } catch {}
    }

    const s2 = unifyTerm(g.o, out, subst);
    return s2 !== null ? [s2] : [];
  }

  // time:minute
  // Gets as object the integer minutes component of the subject xsd:dateTime.
  // Schema: $s+ time:minute $o-
  if (pv === TIME_NS + 'minute') {
    const parts = parseXsdDateTimeLexParts(g.s);
    if (!parts) return [];
    const out = internLiteral(String(parts.minute));

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = out;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];

    const oi = parseIntLiteral(g.o);
    if (oi !== null) {
      try {
        if (oi === BigInt(parts.minute)) return [{ ...subst }];
      } catch {}
    }

    const s2 = unifyTerm(g.o, out, subst);
    return s2 !== null ? [s2] : [];
  }

  // time:month
  // Gets as object the integer month component of the subject xsd:dateTime.
  // Schema: $s+ time:month $o-
  if (pv === TIME_NS + 'month') {
    const parts = parseXsdDateTimeLexParts(g.s);
    if (!parts) return [];
    const out = internLiteral(String(parts.month));

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = out;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];

    const oi = parseIntLiteral(g.o);
    if (oi !== null) {
      try {
        if (oi === BigInt(parts.month)) return [{ ...subst }];
      } catch {}
    }

    const s2 = unifyTerm(g.o, out, subst);
    return s2 !== null ? [s2] : [];
  }

  // time:second
  // Gets as object the integer seconds component of the subject xsd:dateTime.
  // Schema: $s+ time:second $o-
  if (pv === TIME_NS + 'second') {
    const parts = parseXsdDateTimeLexParts(g.s);
    if (!parts) return [];
    const out = internLiteral(String(parts.second));

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = out;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];

    const oi = parseIntLiteral(g.o);
    if (oi !== null) {
      try {
        if (oi === BigInt(parts.second)) return [{ ...subst }];
      } catch {}
    }

    const s2 = unifyTerm(g.o, out, subst);
    return s2 !== null ? [s2] : [];
  }

  // time:timeZone
  // Gets as object the trailing timezone offset of the subject xsd:dateTime (e.g., "-05:00" or "Z").
  // Schema: $s+ time:timeZone $o-
  if (pv === TIME_NS + 'timeZone') {
    const parts = parseXsdDateTimeLexParts(g.s);
    if (!parts) return [];
    if (parts.tz === null) return [];
    const out = internLiteral(`"${parts.tz}"`);

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = out;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];

    if (termsEqual(g.o, out)) return [{ ...subst }];

    // Also accept explicitly typed xsd:string literals.
    if (g.o instanceof Literal) {
      const [lexO, dtO] = literalParts(g.o.value);
      if (dtO === XSD_NS + 'string' && stripQuotes(lexO) === parts.tz) return [{ ...subst }];
    }
    return [];
  }

  // time:year
  // Gets as object the integer year component of the subject xsd:dateTime.
  // Schema: $s+ time:year $o-
  if (pv === TIME_NS + 'year') {
    const parts = parseXsdDateTimeLexParts(g.s);
    if (!parts) return [];
    const out = internLiteral(String(parts.yearStr));

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = out;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];

    const oi = parseIntLiteral(g.o);
    if (oi !== null) {
      try {
        if (oi === BigInt(parts.yearStr)) return [{ ...subst }];
      } catch {}
    }

    const s2 = unifyTerm(g.o, out, subst);
    return s2 !== null ? [s2] : [];
  }

  // time:localTime
  // "" time:localTime ?D.  binds ?D to “now” as xsd:dateTime.
  if (pv === TIME_NS + 'localTime') {
    const now = time.getNowLex();

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = internLiteral(`"${now}"^^<${XSD_NS}dateTime>`);
      return [s2];
    }
    if (g.o instanceof Literal) {
      const [lexO] = literalParts(g.o.value);
      if (stripQuotes(lexO) === now) return [{ ...subst }];
    }
    return [];
  }

  // -----------------------------------------------------------------
  // 4.4 list: builtins
  // -----------------------------------------------------------------

  // list:append
  // true if and only if $o is the concatenation of all lists $s.i.
  // Schema: ( $s.i?[*] )+ list:append $o?
  if (pv === LIST_NS + 'append') {
    if (!(g.s instanceof ListTerm)) return [];
    const parts = g.s.elems;
    if (g.o instanceof ListTerm) {
      return listAppendSplit(parts, g.o.elems, subst);
    }
    const outElems = [];
    for (const part of parts) {
      if (!(part instanceof ListTerm)) return [];
      outElems.push(...part.elems);
    }
    const result = new ListTerm(outElems);
    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = result;
      return [s2];
    }
    if (termsEqual(g.o, result)) return [{ ...subst }];
    return [];
  }

  // list:first and rdf:first
  // true iff $s is a list and $o is the first member of that list.
  // Schema: $s+ list:first $o-
  if (pv === LIST_NS + 'first') {
    const xs = __listElemsForBuiltin(g.s, facts);
    if (!xs || !xs.length) return [];
    const s2 = unifyTerm(g.o, xs[0], subst);
    return s2 !== null ? [s2] : [];
  }
  if (pv === RDF_NS + 'first') {
    return evalListFirstLikeBuiltin(g.s, g.o, subst);
  }

  // list:rest and rdf:rest
  // true iff $s is a (non-empty) list and $o is the rest (tail) of that list.
  // Schema: $s+ list:rest $o-
  if (pv === LIST_NS + 'rest') {
    if (g.s instanceof ListTerm || g.s instanceof OpenListTerm) return evalListRestLikeBuiltin(g.s, g.o, subst);
    const xs = __listElemsForBuiltin(g.s, facts);
    if (!xs || !xs.length) return [];
    const rest = new ListTerm(xs.slice(1));
    const s2 = unifyTerm(g.o, rest, subst);
    return s2 !== null ? [s2] : [];
  }
  if (pv === RDF_NS + 'rest') {
    return evalListRestLikeBuiltin(g.s, g.o, subst);
  }

  // list:iterate
  // Multi-solution builtin:
  // For a list subject $s, generate solutions by unifying $o with (index value).
  // This allows $o to be a variable (e.g., ?Y) or a pattern (e.g., (?i "Dewey")).
  if (pv === LIST_NS + 'iterate') {
    const xs = __listElemsForBuiltin(g.s, facts);
    if (!xs) return [];
    const outs = [];

    for (let i = 0; i < xs.length; i++) {
      const idxLit = internLiteral(String(i)); // 0-based
      const val = xs[i];

      // Fast path: object is exactly a 2-element list (idx, value)
      if (g.o instanceof ListTerm && g.o.elems.length === 2) {
        const [idxPat, valPat] = g.o.elems;

        const s1 = unifyTerm(idxPat, idxLit, subst);
        if (s1 === null) continue;

        // If value-pattern is ground after subst: require STRICT term equality
        const valPat2 = applySubstTerm(valPat, s1);
        if (isGroundTerm(valPat2)) {
          if (termsEqualNoIntDecimal(valPat2, val)) outs.push({ ...s1 });
          continue;
        }

        // Otherwise, allow normal unification/binding
        const s2 = unifyTerm(valPat, val, s1);
        if (s2 !== null) outs.push(s2);
        continue;
      }

      // Fallback: original behavior
      const pair = new ListTerm([idxLit, val]);
      const s2 = unifyTerm(g.o, pair, subst);
      if (s2 !== null) outs.push(s2);
    }

    return outs;
  }

  // list:last
  // true iff $s is a list and $o is the last member of that list.
  // Schema: $s+ list:last $o-
  if (pv === LIST_NS + 'last') {
    const xs = __listElemsForBuiltin(g.s, facts);
    if (!xs || !xs.length) return [];
    const last = xs[xs.length - 1];
    const s2 = unifyTerm(g.o, last, subst);
    return s2 !== null ? [s2] : [];
  }

  // list:memberAt
  // true iff $s.1 is a list, $s.2 is a valid index, and $o is the member at that index.
  // Schema: ( $s.1+ $s.2?[*] )+ list:memberAt $o?[*]
  if (pv === LIST_NS + 'memberAt') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
    const [listRef, indexTerm] = g.s.elems;

    const xs = __listElemsForBuiltin(listRef, facts);
    if (!xs) return [];
    const outs = [];

    for (let i = 0; i < xs.length; i++) {
      const idxLit = internLiteral(String(i)); // index starts at 0

      // --- index side: strict if ground, otherwise unify/bind
      let s1 = null;
      const idxPat2 = applySubstTerm(indexTerm, subst);
      if (isGroundTerm(idxPat2)) {
        if (!termsEqualNoIntDecimal(idxPat2, idxLit)) continue;
        s1 = { ...subst };
      } else {
        s1 = unifyTerm(indexTerm, idxLit, subst);
        if (s1 === null) continue;
      }

      // --- value side: strict if ground, otherwise unify/bind
      const o2 = applySubstTerm(g.o, s1);
      if (isGroundTerm(o2)) {
        if (termsEqualNoIntDecimal(o2, xs[i])) outs.push({ ...s1 });
        continue;
      }

      const s2 = unifyTerm(g.o, xs[i], s1);
      if (s2 !== null) outs.push(s2);
    }

    return outs;
  }

  // list:remove
  // true iff $s.1 is a list and $o is that list with all occurrences of $s.2 removed.
  // Schema: ( $s.1+ $s.2+ )+ list:remove $o-
  if (pv === LIST_NS + 'remove') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
    const [listTerm, itemTerm] = g.s.elems;
    if (!(listTerm instanceof ListTerm)) return [];

    // item must be bound
    const item2 = applySubstTerm(itemTerm, subst);
    if (!isGroundTerm(item2)) return [];

    const xs = listTerm.elems;
    const filtered = [];
    for (const e of xs) {
      // strict term match (still allows plain "abc" == "abc"^^xsd:string)
      if (!termsEqualNoIntDecimal(e, item2)) filtered.push(e);
    }

    const resList = new ListTerm(filtered);
    const s2 = unifyTerm(g.o, resList, subst);
    return s2 !== null ? [s2] : [];
  }

  // list:member
  if (pv === LIST_NS + 'member') {
    const xs = __listElemsForBuiltin(g.s, facts);
    if (!xs) return [];
    const outs = [];
    for (const x of xs) {
      const s2 = unifyTerm(g.o, x, subst);
      if (s2 !== null) outs.push(s2);
    }
    return outs;
  }

  // list:in
  if (pv === LIST_NS + 'in') {
    if (!(g.o instanceof ListTerm)) return [];
    const outs = [];
    for (const x of g.o.elems) {
      const s2 = unifyTerm(g.s, x, subst);
      if (s2 !== null) outs.push(s2);
    }
    return outs;
  }

  // list:length  (strict: do not accept integer<->decimal matches for a ground object)
  if (pv === LIST_NS + 'length') {
    const xs = __listElemsForBuiltin(g.s, facts);
    if (!xs) return [];
    const nTerm = internLiteral(String(xs.length));

    const o2 = applySubstTerm(g.o, subst);
    if (isGroundTerm(o2)) {
      return termsEqualNoIntDecimal(o2, nTerm) ? [{ ...subst }] : [];
    }

    const s2 = unifyTerm(g.o, nTerm, subst);
    return s2 !== null ? [s2] : [];
  }

  // list:notMember
  if (pv === LIST_NS + 'notMember') {
    const xs = __listElemsForBuiltin(g.s, facts);
    if (!xs) return [];
    for (const el of xs) {
      if (unifyTerm(g.o, el, subst) !== null) return [];
    }
    return [{ ...subst }];
  }

  // list:reverse
  if (pv === LIST_NS + 'reverse') {
    // Forward: compute o from s
    if (g.s instanceof ListTerm) {
      const rev = [...g.s.elems].reverse();
      const rterm = new ListTerm(rev);
      const s2 = unifyTerm(g.o, rterm, subst);
      return s2 !== null ? [s2] : [];
    }

    const xs = __listElemsForBuiltin(g.s, facts);
    if (xs) {
      const rev = [...xs].reverse();
      const rterm = new ListTerm(rev);
      const s2 = unifyTerm(g.o, rterm, subst);
      return s2 !== null ? [s2] : [];
    }

    // Reverse: compute s from o (only for explicit list terms)
    if (g.o instanceof ListTerm) {
      const rev = [...g.o.elems].reverse();
      const rterm = new ListTerm(rev);
      const s2 = unifyTerm(g.s, rterm, subst);
      return s2 !== null ? [s2] : [];
    }
    return [];
  }

  // list:sort
  if (pv === LIST_NS + 'sort') {
    function cmpTermForSort(a, b) {
      if (a instanceof Literal && b instanceof Literal) {
        const [lexA] = literalParts(a.value);
        const [lexB] = literalParts(b.value);
        const sa = stripQuotes(lexA);
        const sb = stripQuotes(lexB);
        const na = Number(sa);
        const nb = Number(sb);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) {
          if (na < nb) return -1;
          if (na > nb) return 1;
          return 0;
        }
        if (sa < sb) return -1;
        if (sa > sb) return 1;
        return 0;
      }
      if (a instanceof ListTerm && b instanceof ListTerm) {
        const xs = a.elems;
        const ys = b.elems;
        let i = 0;
        // lexicographic
        while (true) {
          if (i >= xs.length && i >= ys.length) return 0;
          if (i >= xs.length) return -1;
          if (i >= ys.length) return 1;
          const c = cmpTermForSort(xs[i], ys[i]);
          if (c !== 0) return c;
          i++;
        }
      }
      if (a instanceof Iri && b instanceof Iri) {
        if (a.value < b.value) return -1;
        if (a.value > b.value) return 1;
        return 0;
      }
      // lists before non-lists
      if (a instanceof ListTerm && !(b instanceof ListTerm)) return -1;
      if (!(a instanceof ListTerm) && b instanceof ListTerm) return 1;
      const sa = JSON.stringify(a);
      const sb = JSON.stringify(b);
      if (sa < sb) return -1;
      if (sa > sb) return 1;
      return 0;
    }

    let inputList;
    if (g.s instanceof ListTerm) inputList = g.s.elems;
    else if (g.o instanceof ListTerm) inputList = g.o.elems;
    else return [];

    if (!inputList.every((e) => isGroundTerm(e))) return [];

    const sortedList = [...inputList].sort(cmpTermForSort);
    const sortedTerm = new ListTerm(sortedList);
    if (g.s instanceof ListTerm) {
      const s2 = unifyTerm(g.o, sortedTerm, subst);
      return s2 !== null ? [s2] : [];
    }
    if (g.o instanceof ListTerm) {
      const s2 = unifyTerm(g.s, sortedTerm, subst);
      return s2 !== null ? [s2] : [];
    }
    return [];
  }

  // list:map
  if (pv === LIST_NS + 'map') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
    const [inputTerm, predTerm] = g.s.elems;
    if (!(inputTerm instanceof ListTerm)) return [];
    const inputList = inputTerm.elems;
    if (!(predTerm instanceof Iri)) return [];
    const pred = internIri(predTerm.value);

    // Allow mapping *any* predicate (not just builtins).
    // Semantics: for each input element `el`, collect *all* solutions of `el pred ?y`
    // (facts, rules, and builtins), in order, and concatenate them into the output list.
    // If an element has no solutions, it contributes nothing.
    if (!inputList.every((e) => isGroundTerm(e))) return [];

    const results = [];
    for (const el of inputList) {
      const yvar = new Var('_mapY');
      const goal2 = new Triple(el, pred, yvar);
      const sols = proveGoals([goal2], subst, facts, backRules, depth + 1, [], varGen);

      for (const sol of sols) {
        const yval = applySubstTerm(yvar, sol);
        if (yval instanceof Var) continue;
        results.push(yval);
      }
    }

    const outList = new ListTerm(results);
    const s2 = unifyTerm(g.o, outList, subst);
    return s2 !== null ? [s2] : [];
  }

  // list:firstRest
  if (pv === LIST_NS + 'firstRest') {
    if (g.s instanceof ListTerm) {
      if (!g.s.elems.length) return [];
      const first = g.s.elems[0];
      const rest = new ListTerm(g.s.elems.slice(1));
      const pair = new ListTerm([first, rest]);
      const s2 = unifyTerm(g.o, pair, subst);
      return s2 !== null ? [s2] : [];
    }
    if (g.o instanceof ListTerm && g.o.elems.length === 2) {
      const first = g.o.elems[0];
      const rest = g.o.elems[1];
      if (rest instanceof ListTerm) {
        const xs = [first, ...rest.elems];
        const constructed = new ListTerm(xs);
        const s2 = unifyTerm(g.s, constructed, subst);
        return s2 !== null ? [s2] : [];
      }
      if (rest instanceof Var) {
        const constructed = new OpenListTerm([first], rest.name);
        const s2 = unifyTerm(g.s, constructed, subst);
        return s2 !== null ? [s2] : [];
      }
      if (rest instanceof OpenListTerm) {
        const newPrefix = [first, ...rest.prefix];
        const constructed = new OpenListTerm(newPrefix, rest.tailVar);
        const s2 = unifyTerm(g.s, constructed, subst);
        return s2 !== null ? [s2] : [];
      }
    }
    return [];
  }

  // -----------------------------------------------------------------
  // 4.5 log: builtins
  // -----------------------------------------------------------------

  // log:equalTo
  if (pv === LOG_NS + 'equalTo') {
    const s2 = unifyTerm(goal.s, goal.o, subst);
    return s2 !== null ? [s2] : [];
  }

  // log:notEqualTo
  if (pv === LOG_NS + 'notEqualTo') {
    const s2 = unifyTerm(goal.s, goal.o, subst);
    if (s2 !== null) return [];
    return [{ ...subst }];
  }

  // log:conjunction
  // Schema: ( $s.i+ )+ log:conjunction $o?
  // $o is a formula containing a copy of each formula in the subject list.
  // Duplicates are removed.
  if (pv === LOG_NS + 'conjunction') {
    if (!(g.s instanceof ListTerm)) return [];

    const parts = g.s.elems;
    if (!parts.length) return [];

    /** @type {Triple[]} */
    const merged = [];

    // Fast-path dedup for IRI/Literal-only triples.
    const fastKeySet = new Set();

    for (const part of parts) {
      // Support the empty formula token `true`.
      if (part instanceof Literal && part.value === 'true') continue;

      if (!(part instanceof GraphTerm)) return [];

      for (const tr of part.triples) {
        const k = tripleFastKey(tr);
        if (k !== null) {
          if (fastKeySet.has(k)) continue;
          fastKeySet.add(k);
          merged.push(tr);
          continue;
        }

        // Fallback: structural equality (still respects plain-string == xsd:string).
        let dup = false;
        for (const ex of merged) {
          if (triplesEqual(tr, ex)) {
            dup = true;
            break;
          }
        }
        if (!dup) merged.push(tr);
      }
    }

    const outFormula = new GraphTerm(merged);

    // Allow blank nodes as a don't-care output (common in builtin schemas).
    if (g.o instanceof Blank) return [{ ...subst }];

    const s2 = unifyTerm(g.o, outFormula, subst);
    return s2 !== null ? [s2] : [];
  }

  // log:conclusion
  // Schema: $s+ log:conclusion $o?
  // $o is the deductive closure of the subject formula $s (including rule inferences).
  if (pv === LOG_NS + 'conclusion') {
    // Accept 'true' as the empty formula.
    let inFormula = null;
    if (g.s instanceof GraphTerm) inFormula = g.s;
    else if (g.s instanceof Literal && g.s.value === 'true') inFormula = new GraphTerm([]);
    else return [];

    const conclusion = computeConclusionFromFormula(inFormula);
    if (!(conclusion instanceof GraphTerm)) return [];

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = conclusion;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];

    const s2 = unifyTerm(g.o, conclusion, subst);
    return s2 !== null ? [s2] : [];
  }

  // log:content
  // Schema: $s+ log:content $o?
  // Dereferences $s and returns the online resource as an xsd:string.
  if (pv === LOG_NS + 'content') {
    const iri = iriValue(g.s);
    if (iri === null) return [];
    const docIri = deref.stripFragment(iri);

    const text = deref.derefTextSync(docIri);
    if (typeof text !== 'string') return [];

    const lit = internLiteral(`${JSON.stringify(text)}^^<${XSD_NS}string>`);

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = lit;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];

    const s2 = unifyTerm(g.o, lit, subst);
    return s2 !== null ? [s2] : [];
  }

  // log:semantics
  // Schema: $s+ log:semantics $o?
  // Dereferences $s, parses the retrieved resource, and returns it as a formula.
  if (pv === LOG_NS + 'semantics') {
    const iri = iriValue(g.s);
    if (iri === null) return [];
    const docIri = deref.stripFragment(iri);

    const formula = deref.derefSemanticsSync(docIri);
    if (!(formula instanceof GraphTerm)) return [];

    // Avoid variable capture between the returned quoted formula and the
    // surrounding proof environment.
    const formulaStd = standardizeTermApart(formula, varGen);
    if (g.o instanceof Blank) return [{ ...subst }];

    const s2 = unifyTerm(g.o, formulaStd, subst);
    return s2 !== null ? [s2] : [];
  }

  // log:semanticsOrError
  // Schema: $s+ log:semanticsOrError $o?
  // Like log:semantics, but yields an xsd:string error message on failure.
  if (pv === LOG_NS + 'semanticsOrError') {
    const iri = iriValue(g.s);
    if (iri === null) return [];

    const docIri = deref.stripFragment(iri);
    let term = deref.derefSemanticsOrError(docIri);

    // Avoid variable capture between the returned quoted formula and the
    // surrounding proof environment.
    if (term instanceof GraphTerm) term = standardizeTermApart(term, varGen);

    if (g.o instanceof Blank) return [{ ...subst }];

    const s2 = unifyTerm(g.o, term, subst);
    return s2 !== null ? [s2] : [];
  }

  // log:parsedAsN3
  // Schema: $s+ log:parsedAsN3 $o-
  // Parses the subject xsd:string as N3 and returns it as a formula.
  if (pv === LOG_NS + 'parsedAsN3') {
    const txt = termToJsXsdStringNoLang(g.s);
    if (txt === null) return [];

    let formula;
    try {
      // No external base is specified in the builtin definition; the parsed
      // string may contain its own @base / @prefix directives.
      formula = deref.parseSemanticsToFormula(txt, '');
    } catch {
      return [];
    }

    // Avoid variable capture between the parsed quoted formula and the
    // surrounding proof environment.
    formula = standardizeTermApart(formula, varGen);

    if (g.o instanceof Blank) return [{ ...subst }];

    const s2 = unifyTerm(g.o, formula, subst);
    return s2 !== null ? [s2] : [];
  }

  // log:rawType
  // Schema: $s+ log:rawType $o-
  // Returns one of log:Formula, log:Literal, rdf:List, or log:Other.
  if (pv === LOG_NS + 'rawType') {
    if (g.s instanceof Var) return [];

    let ty;
    if (g.s instanceof GraphTerm) ty = internIri(LOG_NS + 'Formula');
    else if (g.s instanceof Literal) ty = internIri(LOG_NS + 'Literal');
    else if (g.s instanceof ListTerm || g.s instanceof OpenListTerm) ty = internIri(RDF_NS + 'List');
    else ty = internIri(LOG_NS + 'Other');

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = ty;
      return [s2];
    }
    if (g.o instanceof Blank) return [{ ...subst }];

    const s2 = unifyTerm(g.o, ty, subst);
    return s2 !== null ? [s2] : [];
  }

  // log:dtlit
  // Schema: ( $s.1? $s.2? )? log:dtlit $o?
  // true iff $o is a datatyped literal with string value $s.1 and datatype IRI $s.2
  if (pv === LOG_NS + 'dtlit') {
    // Fully unbound (both arguments '?'-mode): treat as satisfiable, succeed once.
    // Required by notation3tests "success-fullUnbound-*".
    if (g.s instanceof Var && g.o instanceof Var) return [{ ...subst }];

    const results = [];

    // Direction 1: object literal -> subject list (string, datatype)
    if (g.o instanceof Literal) {
      const [oLex, oDt0] = literalParts(g.o.value);
      let oDt = oDt0;

      // literalParts() strips @lang into the lexical part and leaves dt null,
      // but RDF 1.1 language-tagged strings have datatype rdf:langString.
      if (oDt === null) {
        if (literalHasLangTag(g.o.value)) oDt = RDF_NS + 'langString';
        else if (isPlainStringLiteralValue(g.o.value)) oDt = XSD_NS + 'string';
      }

      if (oDt !== null) {
        const strLit = isQuotedLexical(oLex) ? internLiteral(oLex) : makeStringLiteral(String(oLex));
        const subjList = new ListTerm([strLit, internIri(oDt)]);
        const s2 = unifyTerm(goal.s, subjList, subst);
        if (s2 !== null) results.push(s2);
      }
    }

    // Direction 2: subject list -> object literal
    if (g.s instanceof ListTerm && g.s.elems.length === 2) {
      const a = g.s.elems[0];
      const b = g.s.elems[1];

      if (a instanceof Literal && b instanceof Iri) {
        const [sLex, sDt0] = literalParts(a.value);

        // $s.1 must be xsd:string (plain or ^^xsd:string), not language-tagged.
        const okString = (sDt0 === null && isPlainStringLiteralValue(a.value)) || sDt0 === XSD_NS + 'string';
        if (okString) {
          const dtIri = b.value;
          // For xsd:string, prefer the plain string literal form.
          const outLit = dtIri === XSD_NS + 'string' ? internLiteral(sLex) : internLiteral(`${sLex}^^<${dtIri}>`);
          const s2 = unifyTerm(goal.o, outLit, subst);
          if (s2 !== null) results.push(s2);
        }
      }
    }

    return results;
  }

  // log:langlit
  // Schema: ( $s.1? $s.2? )? log:langlit $o?
  // true iff $o is a language-tagged literal with string value $s.1 and language tag $s.2
  if (pv === LOG_NS + 'langlit') {
    // Fully unbound (both arguments '?'-mode): treat as satisfiable, succeed once.
    if (g.s instanceof Var && g.o instanceof Var) return [{ ...subst }];
    const results = [];
    const LANG_RE = /^[A-Za-z]+(?:-[A-Za-z0-9]+)*$/; // (same notion as literalParts/literalHasLangTag)

    function extractLangTag(litVal) {
      if (typeof litVal !== 'string') return null;
      if (!literalHasLangTag(litVal)) return null;
      const lastQuote = litVal.lastIndexOf('"');
      if (lastQuote < 0) return null;
      const after = lastQuote + 1;
      if (after >= litVal.length || litVal[after] !== '@') return null;
      const tag = litVal.slice(after + 1);
      if (!LANG_RE.test(tag)) return null;
      return tag;
    }

    // Direction 1: object language-tagged literal -> subject list (string, langtag)
    if (g.o instanceof Literal) {
      const tag = extractLangTag(g.o.value);
      if (tag !== null) {
        const [oLex] = literalParts(g.o.value); // strips @lang into lexical part
        const strLit = isQuotedLexical(oLex) ? internLiteral(oLex) : makeStringLiteral(String(oLex));
        const langLit = makeStringLiteral(tag);
        const subjList = new ListTerm([strLit, langLit]);
        const s2 = unifyTerm(goal.s, subjList, subst);
        if (s2 !== null) results.push(s2);
      }
    }

    // Direction 2: subject list -> object language-tagged literal
    if (g.s instanceof ListTerm && g.s.elems.length === 2) {
      const a = g.s.elems[0]; // string
      const b = g.s.elems[1]; // lang tag string
      if (a instanceof Literal && b instanceof Literal) {
        const [sLex, sDt0] = literalParts(a.value);
        const okString = (sDt0 === null && isPlainStringLiteralValue(a.value)) || sDt0 === XSD_NS + 'string';
        const [langLex, langDt0] = literalParts(b.value);
        const okLang = (langDt0 === null && isPlainStringLiteralValue(b.value)) || langDt0 === XSD_NS + 'string';
        if (okString && okLang) {
          const tag = stripQuotes(langLex);
          if (LANG_RE.test(tag)) {
            const outLit = internLiteral(`${sLex}@${tag}`);
            const s2 = unifyTerm(goal.o, outLit, subst);
            if (s2 !== null) results.push(s2);
          }
        }
      }
    }
    return results;
  }

  // log:implies — expose internal forward rules as data
  if (pv === LOG_NS + 'implies') {
    const allFw = backRules.__allForwardRules || [];
    const results = [];

    for (const r0 of allFw) {
      if (!r0.isForward) continue;

      // fresh copy of the rule with fresh variable names
      const r = standardizeRule(r0, varGen);

      const premF = new GraphTerm(r.premise);
      const concTerm = r0.isFuse ? internLiteral('false') : new GraphTerm(r.conclusion);

      // unify subject with the premise formula
      let s2 = unifyTerm(goal.s, premF, subst);
      if (s2 === null) continue;

      // unify object with the conclusion formula
      s2 = unifyTerm(goal.o, concTerm, s2);
      if (s2 === null) continue;

      results.push(s2);
    }

    return results;
  }

  // log:impliedBy — expose internal backward rules as data
  if (pv === LOG_NS + 'impliedBy') {
    const allBw = backRules.__allBackwardRules || backRules;
    const results = [];

    for (const r0 of allBw) {
      if (r0.isForward) continue; // only backward rules

      // fresh copy of the rule with fresh variable names
      const r = standardizeRule(r0, varGen);

      // For backward rules, r.conclusion is the head, r.premise is the body
      const headF = new GraphTerm(r.conclusion);
      const bodyF = new GraphTerm(r.premise);

      // unify subject with the head formula
      let s2 = unifyTerm(goal.s, headF, subst);
      if (s2 === null) continue;

      // unify object with the body formula
      s2 = unifyTerm(goal.o, bodyF, s2);
      if (s2 === null) continue;

      results.push(s2);
    }

    return results;
  }

  // log:includes
  // Schema: $s? log:includes $o+
  // Object may be a concrete formula or the literal `true` (empty formula).
  //
  // Priority / closure semantics (subject-driven):
  //   - subject = GraphTerm: explicit scope, run immediately (no closure gating)
  //   - subject = positive integer literal N (>= 1): delay until saturated closure level >= N
  //   - subject = Var: treat as priority 1 (do not bind)
  //   - any other subject: backward-compatible default priority 1
  if (pv === LOG_NS + 'includes') {
    let scopeFacts = null;
    let scopeBackRules = backRules;

    if (g.s instanceof GraphTerm) {
      // Explicit scope graph: immediate, and do not use rules outside the quoted graph.
      scopeFacts = g.s.triples.slice();
      ensureFactIndexes(scopeFacts);
      Object.defineProperty(scopeFacts, '__scopedSnapshot', {
        value: scopeFacts,
        enumerable: false,
        writable: true,
      });
      const lvlHere = facts && typeof facts.__scopedClosureLevel === 'number' ? facts.__scopedClosureLevel : 0;
      Object.defineProperty(scopeFacts, '__scopedClosureLevel', {
        value: lvlHere,
        enumerable: false,
        writable: true,
      });
      scopeBackRules = [];
    } else {
      // Priority-gated scope: query the frozen snapshot for the requested closure level.
      let prio = 1;
      if (g.s instanceof Var) {
        prio = 1; // do not bind
      } else {
        const p0 = __logNaturalPriorityFromTerm(g.s);
        if (p0 !== null) prio = p0;
      }

      const snap = facts.__scopedSnapshot || null;
      const lvl = (facts && typeof facts.__scopedClosureLevel === 'number' && facts.__scopedClosureLevel) || 0;
      if (!snap) return []; // DELAY until snapshot exists
      if (lvl < prio) return []; // DELAY until saturated closure prio exists
      scopeFacts = snap;
    }

    // Empty formula is always included (but may be priority-gated above).
    if (g.o instanceof Literal && g.o.value === 'true') return [{ ...subst }];
    if (!(g.o instanceof GraphTerm)) return [];

    const visited2 = [];
    // Start from the incoming substitution so bindings flow outward.
    return proveGoals(
      Array.from(g.o.triples),
      { ...subst },
      scopeFacts,
      scopeBackRules,
      depth + 1,
      visited2,
      varGen,
      maxResults,
    );
  }

  // log:notIncludes
  // Schema: $s? log:notIncludes $o+
  //
  // Priority / closure semantics (subject-driven): same as log:includes above.
  if (pv === LOG_NS + 'notIncludes') {
    let scopeFacts = null;
    let scopeBackRules = backRules;

    if (g.s instanceof GraphTerm) {
      // Explicit scope graph: immediate, and do not use rules outside the quoted graph.
      scopeFacts = g.s.triples.slice();
      ensureFactIndexes(scopeFacts);
      Object.defineProperty(scopeFacts, '__scopedSnapshot', {
        value: scopeFacts,
        enumerable: false,
        writable: true,
      });
      const lvlHere = facts && typeof facts.__scopedClosureLevel === 'number' ? facts.__scopedClosureLevel : 0;
      Object.defineProperty(scopeFacts, '__scopedClosureLevel', {
        value: lvlHere,
        enumerable: false,
        writable: true,
      });
      scopeBackRules = [];
    } else {
      // Priority-gated scope: query the frozen snapshot for the requested closure level.
      let prio = 1;
      if (g.s instanceof Var) {
        prio = 1; // do not bind
      } else {
        const p0 = __logNaturalPriorityFromTerm(g.s);
        if (p0 !== null) prio = p0;
      }

      const snap = facts.__scopedSnapshot || null;
      const lvl = (facts && typeof facts.__scopedClosureLevel === 'number' && facts.__scopedClosureLevel) || 0;
      if (!snap) return []; // DELAY until snapshot exists
      if (lvl < prio) return []; // DELAY until saturated closure prio exists
      scopeFacts = snap;
    }

    // Empty formula is always included, so it is never "not included" (but may be priority-gated above).
    if (g.o instanceof Literal && g.o.value === 'true') return [];
    if (!(g.o instanceof GraphTerm)) return [];

    const visited2 = [];
    const sols = proveGoals(
      Array.from(g.o.triples),
      { ...subst },
      scopeFacts,
      scopeBackRules,
      depth + 1,
      visited2,
      varGen,
      1,
    );
    return sols.length ? [] : [{ ...subst }];
  }

  // log:trace
  // Schema: $s? log:trace $o?
  // Side-effecting debug output (to stderr). Always succeeds once.
  // to mimic EYE's fm(...) formatting branch.
  if (pv === LOG_NS + 'trace') {
    const pref = trace.getTracePrefixes() || PrefixEnv.newDefault();

    const xStr = termToN3(g.s, pref);
    const yStr = termToN3(g.o, pref);

    trace.writeTraceLine(`${xStr} TRACE ${yStr}`);
    return [{ ...subst }];
  }

  // log:outputString
  // Schema: $s+ log:outputString $o+
  // Side-effecting output directive. As a builtin goal, we simply succeed
  // when both sides are bound and the object is a string literal.
  // Actual printing is handled at the end of a reasoning run (see --strings).
  if (pv === LOG_NS + 'outputString') {
    // Require subject to be bound (not a variable) and object to be a concrete string literal.
    if (g.s instanceof Var) return [];
    if (g.o instanceof Var) return [];
    const s = termToJsString(g.o);
    if (s === null) return [];
    return [{ ...subst }];
  }

  // log:collectAllIn (scoped)
  if (pv === LOG_NS + 'collectAllIn') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length !== 3) return [];
    const [valueTempl, clauseTerm, listTerm] = g.s.elems;
    if (!(clauseTerm instanceof GraphTerm)) return [];

    // Priority / closure semantics:
    //   - object = GraphTerm: explicit scope, run immediately (no closure gating)
    //   - object = positive integer literal N (>= 1): delay until saturated closure level >= N
    //   - object = Var: treat as priority 1 (do not bind)
    //   - any other object: backward-compatible default priority 1

    let outSubst = { ...subst };
    let scopeFacts = null;
    let scopeBackRules = backRules;

    if (g.o instanceof GraphTerm) {
      scopeFacts = g.o.triples.slice();
      ensureFactIndexes(scopeFacts);
      Object.defineProperty(scopeFacts, '__scopedSnapshot', {
        value: scopeFacts,
        enumerable: false,
        writable: true,
      });
      const lvlHere = facts && typeof facts.__scopedClosureLevel === 'number' ? facts.__scopedClosureLevel : 0;
      Object.defineProperty(scopeFacts, '__scopedClosureLevel', {
        value: lvlHere,
        enumerable: false,
        writable: true,
      });
      scopeBackRules = [];
    } else {
      let prio = 1;
      if (g.o instanceof Var) {
        // Unbound var: behave as priority 1 (do not bind)
        prio = 1;
      } else {
        const p0 = __logNaturalPriorityFromTerm(g.o);
        if (p0 !== null) prio = p0;
      }

      const snap = facts.__scopedSnapshot || null;
      const lvl = (facts && typeof facts.__scopedClosureLevel === 'number' && facts.__scopedClosureLevel) || 0;
      if (!snap) return []; // DELAY until snapshot exists
      if (lvl < prio) return []; // DELAY until saturated closure prio exists
      scopeFacts = snap;
    }

    // If sols is a blank node succeed without collecting/binding.
    if (listTerm instanceof Blank) {
      return [outSubst];
    }

    const visited2 = [];
    const sols = proveGoals(
      Array.from(clauseTerm.triples),
      {},
      scopeFacts,
      scopeBackRules,
      depth + 1,
      visited2,
      varGen,
    );

    const collected = sols.map((sBody) => applySubstTerm(valueTempl, sBody));
    const collectedList = new ListTerm(collected);

    const s2 = unifyTerm(listTerm, collectedList, outSubst);
    return s2 ? [s2] : [];
  }

  // log:forAllIn (scoped)
  if (pv === LOG_NS + 'forAllIn') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
    const [whereClause, thenClause] = g.s.elems;
    if (!(whereClause instanceof GraphTerm) || !(thenClause instanceof GraphTerm)) return [];

    // See log:collectAllIn above for the priority / closure semantics.

    let outSubst = { ...subst };
    let scopeFacts = null;
    let scopeBackRules = backRules;

    if (g.o instanceof GraphTerm) {
      scopeFacts = g.o.triples.slice();
      ensureFactIndexes(scopeFacts);
      Object.defineProperty(scopeFacts, '__scopedSnapshot', {
        value: scopeFacts,
        enumerable: false,
        writable: true,
      });
      const lvlHere = facts && typeof facts.__scopedClosureLevel === 'number' ? facts.__scopedClosureLevel : 0;
      Object.defineProperty(scopeFacts, '__scopedClosureLevel', {
        value: lvlHere,
        enumerable: false,
        writable: true,
      });
      scopeBackRules = [];
    } else {
      let prio = 1;
      if (g.o instanceof Var) {
        // Unbound var: behave as priority 1 (do not bind)
        prio = 1;
      } else {
        const p0 = __logNaturalPriorityFromTerm(g.o);
        if (p0 !== null) prio = p0;
      }

      const snap = facts.__scopedSnapshot || null;
      const lvl = (facts && typeof facts.__scopedClosureLevel === 'number' && facts.__scopedClosureLevel) || 0;
      if (!snap) return []; // DELAY until snapshot exists
      if (lvl < prio) return []; // DELAY until saturated closure prio exists
      scopeFacts = snap;
    }

    const visited1 = [];
    const sols1 = proveGoals(
      Array.from(whereClause.triples),
      {},
      scopeFacts,
      scopeBackRules,
      depth + 1,
      visited1,
      varGen,
    );

    for (const s1 of sols1) {
      const visited2 = [];
      const sols2 = proveGoals(
        Array.from(thenClause.triples),
        s1,
        scopeFacts,
        scopeBackRules,
        depth + 1,
        visited2,
        varGen,
      );
      if (!sols2.length) return [];
    }
    return [outSubst];
  }

  // log:skolem
  if (pv === LOG_NS + 'skolem') {
    // Subject must be ground; commonly a list, but we allow any ground term.
    if (!isGroundTerm(g.s)) return [];
    if (typeof skolemIriFromGroundTerm !== 'function') return [];

    const iri = skolemIriFromGroundTerm(g.s);
    const s2 = unifyTerm(goal.o, iri, subst);
    return s2 !== null ? [s2] : [];
  }

  // log:uri
  // log:uri
  if (pv === LOG_NS + 'uri') {
    // Direction 1: subject is an IRI -> object is its string representation
    if (g.s instanceof Iri) {
      const uriStr = g.s.value; // raw IRI string
      const lit = makeStringLiteral(uriStr); // "..."
      const s2 = unifyTerm(goal.o, lit, subst);
      return s2 !== null ? [s2] : [];
    }

    // Direction 2: object is a string literal -> subject is the corresponding IRI
    if (g.o instanceof Literal) {
      const uriStr = termToJsString(g.o); // JS string from the literal
      if (uriStr === null) return [];

      // Reject strings that cannot be safely serialized as <...> in Turtle/N3.
      // Turtle IRIREF forbids control/space and these characters: < > " { } | ^ ` \
      // (and eyeling also prints IRIs starting with "_:" as blank-node labels)
      if (uriStr.startsWith('_:') || /[\u0000-\u0020<>"{}|^`\\]/.test(uriStr)) {
        return [];
      }

      const iri = internIri(uriStr);
      const s2 = unifyTerm(goal.s, iri, subst);
      return s2 !== null ? [s2] : [];
    }

    const sOk = g.s instanceof Var || g.s instanceof Blank || g.s instanceof Iri;
    const oOk = g.o instanceof Var || g.o instanceof Blank || g.o instanceof Literal;
    if (!sOk || !oOk) return [];
    return [{ ...subst }];
  }

  // -----------------------------------------------------------------
  // 4.6 string: builtins
  // -----------------------------------------------------------------

  // string:concatenation
  if (pv === STRING_NS + 'concatenation') {
    if (!(g.s instanceof ListTerm)) return [];
    const parts = [];
    for (const t of g.s.elems) {
      const sStr = termToJsString(t);
      if (sStr === null) return [];
      parts.push(sStr);
    }
    const lit = makeStringLiteral(parts.join(''));

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = lit;
      return [s2];
    }
    const s2 = unifyTerm(g.o, lit, subst);
    return s2 !== null ? [s2] : [];
  }

  // string:contains
  if (pv === STRING_NS + 'contains') {
    const sStr = termToJsString(g.s);
    const oStr = termToJsString(g.o);
    if (sStr === null || oStr === null) return [];
    return sStr.includes(oStr) ? [{ ...subst }] : [];
  }

  // string:containsIgnoringCase
  if (pv === STRING_NS + 'containsIgnoringCase') {
    const sStr = termToJsString(g.s);
    const oStr = termToJsString(g.o);
    if (sStr === null || oStr === null) return [];
    return sStr.toLowerCase().includes(oStr.toLowerCase()) ? [{ ...subst }] : [];
  }

  // string:endsWith
  if (pv === STRING_NS + 'endsWith') {
    const sStr = termToJsString(g.s);
    const oStr = termToJsString(g.o);
    if (sStr === null || oStr === null) return [];
    return sStr.endsWith(oStr) ? [{ ...subst }] : [];
  }

  // string:equalIgnoringCase
  if (pv === STRING_NS + 'equalIgnoringCase') {
    const sStr = termToJsString(g.s);
    const oStr = termToJsString(g.o);
    if (sStr === null || oStr === null) return [];
    return sStr.toLowerCase() === oStr.toLowerCase() ? [{ ...subst }] : [];
  }

  // string:format
  // (limited: only %s and %% are supported, anything else ⇒ builtin fails)
  if (pv === STRING_NS + 'format') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length < 1) return [];
    const fmtStr = termToJsString(g.s.elems[0]);
    if (fmtStr === null) return [];

    const args = [];
    for (let i = 1; i < g.s.elems.length; i++) {
      const aStr = termToJsString(g.s.elems[i]);
      if (aStr === null) return [];
      args.push(aStr);
    }

    const formatted = simpleStringFormat(fmtStr, args);
    if (formatted === null) return []; // unsupported format specifier(s)

    const lit = makeStringLiteral(formatted);
    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = lit;
      return [s2];
    }
    const s2 = unifyTerm(g.o, lit, subst);
    return s2 !== null ? [s2] : [];
  }


  // string:greaterThan
  if (pv === STRING_NS + 'greaterThan') {
    const sStr = termToJsString(g.s);
    const oStr = termToJsString(g.o);
    if (sStr === null || oStr === null) return [];
    return sStr > oStr ? [{ ...subst }] : [];
  }

  // string:lessThan
  if (pv === STRING_NS + 'lessThan') {
    const sStr = termToJsString(g.s);
    const oStr = termToJsString(g.o);
    if (sStr === null || oStr === null) return [];
    return sStr < oStr ? [{ ...subst }] : [];
  }

  // string:matches
  if (pv === STRING_NS + 'matches') {
    const sStr = termToJsString(g.s);
    const pattern = termToJsString(g.o);
    if (sStr === null || pattern === null) return [];
    const re = compileSwapRegex(pattern, '');
    if (!re) return [];
    return re.test(sStr) ? [{ ...subst }] : [];
  }

  // string:notEqualIgnoringCase
  if (pv === STRING_NS + 'notEqualIgnoringCase') {
    const sStr = termToJsString(g.s);
    const oStr = termToJsString(g.o);
    if (sStr === null || oStr === null) return [];
    return sStr.toLowerCase() !== oStr.toLowerCase() ? [{ ...subst }] : [];
  }

  // string:notGreaterThan  (≤ in Unicode code order)
  if (pv === STRING_NS + 'notGreaterThan') {
    const sStr = termToJsString(g.s);
    const oStr = termToJsString(g.o);
    if (sStr === null || oStr === null) return [];
    return sStr <= oStr ? [{ ...subst }] : [];
  }

  // string:notLessThan  (≥ in Unicode code order)
  if (pv === STRING_NS + 'notLessThan') {
    const sStr = termToJsString(g.s);
    const oStr = termToJsString(g.o);
    if (sStr === null || oStr === null) return [];
    return sStr >= oStr ? [{ ...subst }] : [];
  }

  // string:notMatches
  if (pv === STRING_NS + 'notMatches') {
    const sStr = termToJsString(g.s);
    const pattern = termToJsString(g.o);
    if (sStr === null || pattern === null) return [];
    const re = compileSwapRegex(pattern, '');
    if (!re) return [];
    return re.test(sStr) ? [] : [{ ...subst }];
  }

  // string:replace
  if (pv === STRING_NS + 'replace') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length !== 3) return [];
    const dataStr = termToJsString(g.s.elems[0]);
    const searchStr = termToJsString(g.s.elems[1]);
    const replStr = termToJsString(g.s.elems[2]);
    if (dataStr === null || searchStr === null || replStr === null) return [];

    const re = compileSwapRegex(searchStr, 'g');
    if (!re) return [];

    const outStr = dataStr.replace(re, replStr);
    const lit = makeStringLiteral(outStr);

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = lit;
      return [s2];
    }
    const s2 = unifyTerm(g.o, lit, subst);
    return s2 !== null ? [s2] : [];
  }

  // string:scrape
  if (pv === STRING_NS + 'scrape') {
    if (!(g.s instanceof ListTerm) || g.s.elems.length !== 2) return [];
    const dataStr = termToJsString(g.s.elems[0]);
    const pattern = termToJsString(g.s.elems[1]);
    if (dataStr === null || pattern === null) return [];

    const re = compileSwapRegex(pattern, '');
    if (!re) return [];

    const m = re.exec(dataStr);
    // Spec says “exactly 1 group”; we just use the first capturing group if present.
    if (!m || m.length < 2) return [];
    const group = m[1];
    const lit = makeStringLiteral(group);

    if (g.o instanceof Var) {
      const s2 = { ...subst };
      s2[g.o.name] = lit;
      return [s2];
    }
    const s2 = unifyTerm(g.o, lit, subst);
    return s2 !== null ? [s2] : [];
  }

  // string:startsWith
  if (pv === STRING_NS + 'startsWith') {
    const sStr = termToJsString(g.s);
    const oStr = termToJsString(g.o);
    if (sStr === null || oStr === null) return [];
    return sStr.startsWith(oStr) ? [{ ...subst }] : [];
  }

  // Unknown builtin
  return [];
}

function isBuiltinPred(p) {
  if (!(p instanceof Iri)) return false;
  const v = p.value;

  // Super restricted mode: only treat => / <= as builtins.
  // Everything else should be handled as ordinary predicates (and thus must be
  // provided explicitly as facts/rules, without builtin evaluation).
  if (typeof getSuperRestrictedMode === 'function' && getSuperRestrictedMode()) {
    return v === LOG_NS + 'implies' || v === LOG_NS + 'impliedBy';
  }

  // Treat RDF Collections as list-term builtins too.
  if (v === RDF_NS + 'first' || v === RDF_NS + 'rest') {
    return true;
  }

  return (
    v.startsWith(CRYPTO_NS) ||
    v.startsWith(MATH_NS) ||
    v.startsWith(LOG_NS) ||
    v.startsWith(STRING_NS) ||
    v.startsWith(TIME_NS) ||
    v.startsWith(LIST_NS)
  );
}

// ===========================================================================
// Backward proof (SLD-style)
// ===========================================================================

// Standardize variables inside an arbitrary term (including quoted formulas)
// to fresh names, to avoid variable capture when a builtin returns a formula.
//
// This is similar to standardizeRule(), but operates on a single term.
function standardizeTermApart(term, gen) {
  function renameTerm(t, vmap, genArr) {
    if (t instanceof Var) {
      if (!vmap.hasOwnProperty(t.name)) {
        const name = `__n3_${genArr[0]}`;
        genArr[0] += 1;
        vmap[t.name] = name;
      }
      return new Var(vmap[t.name]);
    }
    if (t instanceof ListTerm) {
      let changed = false;
      const elems2 = t.elems.map((e) => {
        const e2 = renameTerm(e, vmap, genArr);
        if (e2 !== e) changed = true;
        return e2;
      });
      return changed ? new ListTerm(elems2) : t;
    }
    if (t instanceof OpenListTerm) {
      let changed = false;
      const newXs = t.prefix.map((e) => {
        const e2 = renameTerm(e, vmap, genArr);
        if (e2 !== e) changed = true;
        return e2;
      });
      if (!vmap.hasOwnProperty(t.tailVar)) {
        const name = `__n3_${genArr[0]}`;
        genArr[0] += 1;
        vmap[t.tailVar] = name;
      }
      const newTail = vmap[t.tailVar];
      if (newTail !== t.tailVar) changed = true;
      return changed ? new OpenListTerm(newXs, newTail) : t;
    }
    if (t instanceof GraphTerm) {
      let changed = false;
      const triples2 = t.triples.map((tr) => {
        const s2 = renameTerm(tr.s, vmap, genArr);
        const p2 = renameTerm(tr.p, vmap, genArr);
        const o2 = renameTerm(tr.o, vmap, genArr);
        if (s2 !== tr.s || p2 !== tr.p || o2 !== tr.o) changed = true;
        return s2 === tr.s && p2 === tr.p && o2 === tr.o ? tr : new Triple(s2, p2, o2);
      });
      return changed ? new GraphTerm(triples2) : t;
    }
    return t;
  }

  const vmap = {};
  return renameTerm(term, vmap, gen);
}

function standardizeRule(rule, gen) {
  function renameTerm(t, vmap, genArr) {
    if (t instanceof Var) {
      if (!vmap.hasOwnProperty(t.name)) {
        const name = `${t.name}__${genArr[0]}`;
        genArr[0] += 1;
        vmap[t.name] = name;
      }
      return new Var(vmap[t.name]);
    }
    if (t instanceof ListTerm) {
      let changed = false;
      const elems2 = t.elems.map((e) => {
        const e2 = renameTerm(e, vmap, genArr);
        if (e2 !== e) changed = true;
        return e2;
      });
      return changed ? new ListTerm(elems2) : t;
    }
    if (t instanceof OpenListTerm) {
      let changed = false;
      const newXs = t.prefix.map((e) => {
        const e2 = renameTerm(e, vmap, genArr);
        if (e2 !== e) changed = true;
        return e2;
      });
      if (!vmap.hasOwnProperty(t.tailVar)) {
        const name = `${t.tailVar}__${genArr[0]}`;
        genArr[0] += 1;
        vmap[t.tailVar] = name;
      }
      const newTail = vmap[t.tailVar];
      if (newTail !== t.tailVar) changed = true;
      return changed ? new OpenListTerm(newXs, newTail) : t;
    }
    if (t instanceof GraphTerm) {
      let changed = false;
      const triples2 = t.triples.map((tr) => {
        const s2 = renameTerm(tr.s, vmap, genArr);
        const p2 = renameTerm(tr.p, vmap, genArr);
        const o2 = renameTerm(tr.o, vmap, genArr);
        if (s2 !== tr.s || p2 !== tr.p || o2 !== tr.o) changed = true;
        return s2 === tr.s && p2 === tr.p && o2 === tr.o ? tr : new Triple(s2, p2, o2);
      });
      return changed ? new GraphTerm(triples2) : t;
    }
    return t;
  }

  const vmap2 = {};
  const premise = rule.premise.map((tr) => {
    const s2 = renameTerm(tr.s, vmap2, gen);
    const p2 = renameTerm(tr.p, vmap2, gen);
    const o2 = renameTerm(tr.o, vmap2, gen);
    return s2 === tr.s && p2 === tr.p && o2 === tr.o ? tr : new Triple(s2, p2, o2);
  });
  const conclusion = rule.conclusion.map((tr) => {
    const s2 = renameTerm(tr.s, vmap2, gen);
    const p2 = renameTerm(tr.p, vmap2, gen);
    const o2 = renameTerm(tr.o, vmap2, gen);
    return s2 === tr.s && p2 === tr.p && o2 === tr.o ? tr : new Triple(s2, p2, o2);
  });
  return new Rule(premise, conclusion, rule.isForward, rule.isFuse, rule.headBlankLabels);
}


function triplesEqual(a, b) {
  return termsEqual(a.s, b.s) && termsEqual(a.p, b.p) && termsEqual(a.o, b.o);
}

function listHasTriple(list, tr) {
  return list.some((t) => triplesEqual(t, tr));
}

// ===========================================================================
// Substitution compaction (to avoid O(depth^2) in deep backward chains)


module.exports = {
  makeBuiltins,
  // shared helpers used by engine/explain
  parseBooleanLiteralInfo,
  parseNumericLiteralInfo,
  // numeric helpers used by engine unification / equality
  parseXsdDecimalToBigIntScale,
  pow10n,
  normalizeLiteralForFastKey,
  literalsEquivalentAsXsdString,
  termToJsString,
  termToJsStringDecoded,
  materializeRdfLists,
  // used by backward chaining
  standardizeRule,
  standardizeTermApart,
  listHasTriple,
};
