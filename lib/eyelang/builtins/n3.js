// Practical Notation3/SWAP builtin bridge for RDF/N3 compatibility input.
// RDF parser lowers body triples with math:, string:, list:, crypto:, time:, and
// selected log: predicates to n3_* eyelang builtins.  The handlers work on the
// explicit RDF term representation from src/rdf.js.
import { hashHex } from '../hash.js';
import { compareLexicalOrNumeric } from './arithmetic.js';
import { deref, isDecimalInteger, listFromItems, parseFiniteNumber, properListItems, termToString, unify } from '../term.js';
import { RDF_DIR_LANG_STRING, RDF_LANG_STRING, XSD_BOOLEAN, XSD_DECIMAL, XSD_DOUBLE, XSD_INTEGER, XSD_STRING, rdfIri, rdfLiteral } from '../rdf.js';

const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';
const XSD_DATE_TIME = `${XSD_NS}dateTime`;
const XSD_DATE_ONLY = `${XSD_NS}date`;
const XSD_DURATION = `${XSD_NS}duration`;
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const LOG_NS = 'http://www.w3.org/2000/10/swap/log#';
const RDF_LIST = `${RDF_NS}List`;

export const n3Builtins = {
  register(registry) {
    const deterministic = { deterministic: true };

    for (const [name, op] of Object.entries({
      greaterThan: 'gt', lessThan: 'lt', notLessThan: 'ge', notGreaterThan: 'le', equalTo: 'eq', notEqualTo: 'ne',
    })) registry.add(`n3_math_${name}`, 2, mathCompare(op), deterministic);

    for (const [name, fn] of Object.entries({
      sum: mathFold(0, (a, b) => a + b, (a, b) => a + b),
      product: mathFold(1, (a, b) => a * b, (a, b) => a * b),
      difference: mathBinary((a, b) => a - b, false, (a, b) => a - b),
      quotient: mathBinary((a, b) => b === 0 ? null : a / b),
      integerQuotient: mathBinary((a, b) => b === 0 ? null : Math.trunc(a / b), true, (a, b) => b === 0n ? null : a / b),
      remainder: mathBinary((a, b) => b === 0 ? null : a % b, true, (a, b) => b === 0n ? null : a % b),
      exponentiation: mathBinary((a, b) => a ** b, false, bigIntPow),
      max: mathFold(null, (a, b) => Math.max(a, b), (a, b) => a >= b ? a : b),
      min: mathFold(null, (a, b) => Math.min(a, b), (a, b) => a <= b ? a : b),
    })) registry.add(`n3_math_${name}`, 2, fn, deterministic);

    for (const [name, fn] of Object.entries({
      absoluteValue: mathUnary(Math.abs),
      negation: mathUnary((x) => -x),
      rounded: mathUnary((x) => Math.round(x), true),
      sin: mathUnary(Math.sin), cos: mathUnary(Math.cos), tan: mathUnary(Math.tan),
      asin: mathUnary(Math.asin), acos: mathUnary(Math.acos), atan: mathUnary(Math.atan),
      sinh: mathUnary(Math.sinh), cosh: mathUnary(Math.cosh), tanh: mathUnary(Math.tanh),
      degrees: mathUnary((x) => x * 180 / Math.PI),
      radians: mathUnary((x) => x * Math.PI / 180),
    })) registry.add(`n3_math_${name}`, 2, fn, deterministic);

    for (const [name, op] of Object.entries({
      contains: 'contains', containsIgnoringCase: 'contains-i', endsWith: 'ends', equalIgnoringCase: 'eq-i',
      greaterThan: 'gt', lessThan: 'lt', matches: 'matches', notEqualIgnoringCase: 'ne-i',
      notGreaterThan: 'le', notLessThan: 'ge', notMatches: 'not-matches', startsWith: 'starts',
    })) registry.add(`n3_string_${name}`, 2, stringTest(op), deterministic);

    for (const [name, fn] of Object.entries({
      concatenation: stringConcatenation,
      format: stringFormat,
      length: stringLength,
      charAt: stringCharAt,
      replace: stringReplace,
      scrape: stringScrape,
      setCharAt: stringSetCharAt,
    })) registry.add(`n3_string_${name}`, 2, fn, deterministic);

    for (const [name, fn] of Object.entries({
      append: listAppend,
      first: listFirst,
      rest: listRest,
      in: listIn,
      length: listLength,
      notMember: listNotMember,
      remove: listRemove,
      reverse: listReverse,
      sort: listSort,
    })) registry.add(`n3_list_${name}`, 2, fn, deterministic);
    registry.add('n3_list_member', 2, listMember);

    for (const name of ['sha', 'md5', 'sha256', 'sha512']) registry.add(`n3_crypto_${name}`, 2, cryptoHash(name), deterministic);

    for (const name of ['day', 'hour', 'minute', 'month', 'second', 'year']) registry.add(`n3_time_${name}`, 2, timeComponent(name), deterministic);
    registry.add('n3_time_localTime', 2, localTime, deterministic);

    registry.add('n3_log_equalTo', 2, termCompare(true), deterministic);
    registry.add('n3_log_notEqualTo', 2, termCompare(false), deterministic);
    registry.add('n3_log_uri', 2, logUri, deterministic);
    registry.add('n3_log_dtlit', 2, logDtLit, deterministic);
    registry.add('n3_log_rawType', 2, logRawType, deterministic);
  }
};

function* bindOrCheck(output, term, env) {
  const next = env.clone();
  if (unify(output, term, next)) yield next;
}

function* ok(env) { yield env; }

function rdfLiteralInfo(term, env) {
  const t = deref(term, env);
  if (t?.type === 'compound' && t.name === 'literal' && t.arity === 4) {
    return { lex: t.args[0].name, datatype: iriValue(t.args[1]), lang: t.args[2].name, direction: t.args[3].name, term: t };
  }
  if (t?.type === 'number') return { lex: t.name, datatype: numericDatatype(t.name), lang: '', direction: '', term: t };
  if (t?.type === 'string') return { lex: t.name, datatype: XSD_STRING, lang: '', direction: '', term: t };
  return null;
}

function iriValue(term) {
  if (term?.type === 'compound' && term.name === 'iri' && term.arity === 1) return term.args[0].name;
  return null;
}

function numericDatatype(text) {
  return /[eE]/.test(text) ? XSD_DOUBLE : String(text).includes('.') ? XSD_DECIMAL : XSD_INTEGER;
}

function numericInfo(term, env) {
  const info = rdfLiteralInfo(term, env);
  if (!info || !isNumericLex(info.lex)) return null;
  return info;
}

function parseNumber(term, env) {
  const info = numericInfo(term, env);
  if (!info) return null;
  return parseFiniteNumber(info.lex);
}

function isIntegerLex(term, env) {
  const info = numericInfo(term, env);
  return !!info && isDecimalInteger(info.lex) && (info.datatype === XSD_INTEGER || info.datatype?.startsWith(XSD_NS));
}

function isNumericLex(text) {
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(String(text ?? ''));
}

function numberLiteral(value, forceInteger = false) {
  if (typeof value === 'bigint') return rdfLiteral(value.toString(), XSD_INTEGER, '', '');
  if (typeof value === 'string') {
    if (isDecimalInteger(value)) return rdfLiteral(value, XSD_INTEGER, '', '');
    return rdfLiteral(value, XSD_DECIMAL, '', '');
  }
  if (forceInteger || Number.isInteger(value)) return rdfLiteral(String(Math.trunc(value)), XSD_INTEGER, '', '');
  return rdfLiteral(String(value), XSD_DECIMAL, '', '');
}

function jsString(term, env) {
  const t = deref(term, env);
  const lit = rdfLiteralInfo(t, env);
  if (lit) return lit.lex;
  const iri = iriValue(t);
  if (iri != null) return iri;
  if (t?.type === 'atom' || t?.type === 'string' || t?.type === 'number') return t.name;
  return null;
}

function rdfListItems(term, env) {
  return properListItems(deref(term, env), env);
}

function mathCompare(op) {
  return function* ({ goal, env }) {
    const a = numericInfo(goal.args[0], env);
    const b = numericInfo(goal.args[1], env);
    if (!a || !b) return;
    const cmp = compareLexicalOrNumeric(a.lex, b.lex);
    const pass = op === 'gt' ? cmp > 0 : op === 'lt' ? cmp < 0 : op === 'ge' ? cmp >= 0 : op === 'le' ? cmp <= 0 : op === 'eq' ? cmp === 0 : cmp !== 0;
    if (pass) yield env;
  };
}

function mathFold(identity, fn, bigFn = null) {
  return function* ({ goal, env }) {
    const items = rdfListItems(goal.args[0], env);
    if (!items) return;
    if (bigFn && items.every((item) => isIntegerLex(item, env))) {
      let acc = identity === null ? null : BigInt(identity);
      for (const item of items) {
        const n = BigInt(numericInfo(item, env).lex);
        acc = acc === null ? n : bigFn(acc, n);
      }
      if (acc === null) return;
      yield* bindOrCheck(goal.args[1], numberLiteral(acc, true), env);
      return;
    }

    let acc = identity === null ? null : identity;
    let allInts = true;
    for (const item of items) {
      const n = parseNumber(item, env);
      if (n == null) return;
      if (!isIntegerLex(item, env)) allInts = false;
      acc = acc === null ? n : fn(acc, n);
    }
    if (acc === null) return;
    yield* bindOrCheck(goal.args[1], numberLiteral(acc, allInts && Number.isInteger(acc)), env);
  };
}

function mathBinary(fn, forceInteger = false, bigFn = null) {
  return function* ({ goal, env }) {
    const items = rdfListItems(goal.args[0], env);
    if (!items || items.length !== 2) return;
    if (bigFn && isIntegerLex(items[0], env) && isIntegerLex(items[1], env)) {
      const out = bigFn(BigInt(numericInfo(items[0], env).lex), BigInt(numericInfo(items[1], env).lex));
      if (out == null) return;
      yield* bindOrCheck(goal.args[1], numberLiteral(out, true), env);
      return;
    }
    const a = parseNumber(items[0], env), b = parseNumber(items[1], env);
    if (a == null || b == null) return;
    const out = fn(a, b);
    if (out == null || !Number.isFinite(out)) return;
    yield* bindOrCheck(goal.args[1], numberLiteral(out, forceInteger || (isIntegerLex(items[0], env) && isIntegerLex(items[1], env) && Number.isInteger(out))), env);
  };
}

function bigIntPow(a, b) {
  if (b < 0n) return null;
  if (b > 1000000n) return null;
  return a ** b;
}

function mathUnary(fn, forceInteger = false) {
  return function* ({ goal, env }) {
    if ((fn === Math.abs || forceInteger) && isIntegerLex(goal.args[0], env)) {
      const x = BigInt(numericInfo(goal.args[0], env).lex);
      const out = fn === Math.abs ? (x < 0n ? -x : x) : x;
      yield* bindOrCheck(goal.args[1], numberLiteral(out, true), env);
      return;
    }
    const x = parseNumber(goal.args[0], env);
    if (x == null) return;
    const out = fn(x);
    if (out == null || !Number.isFinite(out)) return;
    yield* bindOrCheck(goal.args[1], numberLiteral(out, forceInteger || Number.isInteger(out)), env);
  };
}

function stringTest(op) {
  return function* ({ goal, env }) {
    const a = jsString(goal.args[0], env), b = jsString(goal.args[1], env);
    if (a == null || b == null) return;
    let pass = false;
    if (op === 'contains') pass = a.includes(b);
    else if (op === 'contains-i') pass = a.toLowerCase().includes(b.toLowerCase());
    else if (op === 'ends') pass = a.endsWith(b);
    else if (op === 'starts') pass = a.startsWith(b);
    else if (op === 'eq-i') pass = a.toLowerCase() === b.toLowerCase();
    else if (op === 'ne-i') pass = a.toLowerCase() !== b.toLowerCase();
    else if (op === 'matches' || op === 'not-matches') {
      let re;
      try { re = new RegExp(b); } catch { return; }
      pass = re.test(a);
      if (op === 'not-matches') pass = !pass;
    } else {
      const cmp = a < b ? -1 : a > b ? 1 : 0;
      pass = op === 'gt' ? cmp > 0 : op === 'lt' ? cmp < 0 : op === 'ge' ? cmp >= 0 : cmp <= 0;
    }
    if (pass) yield env;
  };
}

function* stringConcatenation({ goal, env }) {
  const items = rdfListItems(goal.args[0], env);
  if (!items) return;
  const parts = [];
  for (const item of items) {
    const s = jsString(item, env);
    if (s == null) return;
    parts.push(s);
  }
  yield* bindOrCheck(goal.args[1], rdfLiteral(parts.join(''), XSD_STRING, '', ''), env);
}

function* stringFormat({ goal, env }) {
  const items = rdfListItems(goal.args[0], env);
  if (!items || items.length < 1) return;
  const fmt = jsString(items[0], env);
  if (fmt == null) return;
  let i = 1;
  const out = fmt.replace(/%%|%[sdif]/g, (m) => {
    if (m === '%%') return '%';
    const s = i < items.length ? jsString(items[i++], env) : '';
    return s ?? '';
  });
  yield* bindOrCheck(goal.args[1], rdfLiteral(out, XSD_STRING, '', ''), env);
}

function* stringLength({ goal, env }) {
  const s = jsString(goal.args[0], env);
  if (s == null) return;
  yield* bindOrCheck(goal.args[1], numberLiteral(s.length, true), env);
}

function* stringCharAt({ goal, env }) {
  const items = rdfListItems(goal.args[0], env);
  if (!items || items.length !== 2) return;
  const s = jsString(items[0], env), idx = parseNumber(items[1], env);
  if (s == null || idx == null) return;
  const i = Math.trunc(idx);
  yield* bindOrCheck(goal.args[1], rdfLiteral(i >= 0 && i < s.length ? s.charAt(i) : '', XSD_STRING, '', ''), env);
}

function* stringSetCharAt({ goal, env }) {
  const items = rdfListItems(goal.args[0], env);
  if (!items || items.length !== 3) return;
  const s = jsString(items[0], env), idx = parseNumber(items[1], env), ch = jsString(items[2], env);
  if (s == null || idx == null || ch == null) return;
  const i = Math.trunc(idx);
  const out = i >= 0 && i < s.length ? s.slice(0, i) + (ch[0] ?? '') + s.slice(i + 1) : s;
  yield* bindOrCheck(goal.args[1], rdfLiteral(out, XSD_STRING, '', ''), env);
}

function* stringReplace({ goal, env }) {
  const items = rdfListItems(goal.args[0], env);
  if (!items || items.length !== 3) return;
  const s = jsString(items[0], env), pattern = jsString(items[1], env), repl = jsString(items[2], env);
  if (s == null || pattern == null || repl == null) return;
  let re;
  try { re = new RegExp(pattern, 'g'); } catch { return; }
  yield* bindOrCheck(goal.args[1], rdfLiteral(s.replace(re, repl), XSD_STRING, '', ''), env);
}

function* stringScrape({ goal, env }) {
  const items = rdfListItems(goal.args[0], env);
  if (!items || items.length !== 2) return;
  const s = jsString(items[0], env), pattern = jsString(items[1], env);
  if (s == null || pattern == null) return;
  let re;
  try { re = new RegExp(pattern); } catch { return; }
  const m = re.exec(s);
  if (!m || m.length < 2) return;
  yield* bindOrCheck(goal.args[1], rdfLiteral(m[1], XSD_STRING, '', ''), env);
}

function* listAppend({ goal, env }) {
  const lists = rdfListItems(goal.args[0], env);
  if (!lists) return;
  const out = [];
  for (const l of lists) {
    const xs = rdfListItems(l, env);
    if (!xs) return;
    out.push(...xs);
  }
  yield* bindOrCheck(goal.args[1], listFromItems(out), env);
}

function* listFirst({ goal, env }) {
  const xs = rdfListItems(goal.args[0], env);
  if (!xs || xs.length === 0) return;
  yield* bindOrCheck(goal.args[1], xs[0], env);
}

function* listRest({ goal, env }) {
  const xs = rdfListItems(goal.args[0], env);
  if (!xs || xs.length === 0) return;
  yield* bindOrCheck(goal.args[1], listFromItems(xs.slice(1)), env);
}

function* listLength({ goal, env }) {
  const xs = rdfListItems(goal.args[0], env);
  if (!xs) return;
  yield* bindOrCheck(goal.args[1], numberLiteral(xs.length, true), env);
}

function* listMember({ goal, env }) {
  const xs = rdfListItems(goal.args[0], env);
  if (!xs) return;
  for (const item of xs) yield* bindOrCheck(goal.args[1], item, env);
}

function* listIn({ goal, env }) {
  const xs = rdfListItems(goal.args[1], env);
  if (!xs) return;
  for (const item of xs) yield* bindOrCheck(goal.args[0], item, env);
}

function* listNotMember({ goal, env }) {
  const xs = rdfListItems(goal.args[0], env);
  if (!xs) return;
  for (const item of xs) {
    const probe = env.clone();
    if (unify(goal.args[1], item, probe)) return;
  }
  yield env;
}

function* listRemove({ goal, env }) {
  const items = rdfListItems(goal.args[0], env);
  if (!items || items.length !== 2) return;
  const xs = rdfListItems(items[0], env);
  if (!xs) return;
  const out = xs.filter((x) => {
    const probe = env.clone();
    return !unify(x, items[1], probe);
  });
  yield* bindOrCheck(goal.args[1], listFromItems(out), env);
}

function* listReverse({ goal, env }) {
  const xs = rdfListItems(goal.args[0], env);
  if (!xs) return;
  yield* bindOrCheck(goal.args[1], listFromItems([...xs].reverse()), env);
}

function* listSort({ goal, env }) {
  const xs = rdfListItems(goal.args[0], env);
  if (!xs) return;
  const sorted = [...xs].sort((a, b) => compareLexicalOrNumeric(sortKey(a, env), sortKey(b, env)));
  yield* bindOrCheck(goal.args[1], listFromItems(sorted), env);
}

function sortKey(term, env) {
  const s = jsString(term, env);
  if (s != null) return s;
  return termToString(deref(term, env), env, true);
}

function cryptoHash(name) {
  const algo = name === 'sha' ? 'sha1' : name;
  return function* ({ goal, env }) {
    const s = jsString(goal.args[0], env);
    if (s == null) return;
    const out = hashHex(algo, s);
    yield* bindOrCheck(goal.args[1], rdfLiteral(out, XSD_STRING, '', ''), env);
  };
}

function timeParts(term, env) {
  const info = rdfLiteralInfo(term, env);
  if (!info || (info.datatype !== XSD_DATE_TIME && info.datatype !== XSD_DATE_ONLY)) return null;
  const m = /^(-?\d{4,})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(info.lex);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), hour: Number(m[4] ?? 0), minute: Number(m[5] ?? 0), second: Number(m[6] ?? 0) };
}

function timeComponent(name) {
  return function* ({ goal, env }) {
    const parts = timeParts(goal.args[0], env);
    if (!parts) return;
    yield* bindOrCheck(goal.args[1], numberLiteral(parts[name], true), env);
  };
}

function* localTime({ goal, env }) {
  const fixed = typeof process !== 'undefined' ? process.env?.EYELANG_LOCAL_TIME : null;
  const now = fixed || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  yield* bindOrCheck(goal.args[1], rdfLiteral(now, XSD_DATE_TIME, '', ''), env);
}

function termCompare(equal) {
  return function* ({ goal, env }) {
    const probe = env.clone();
    const same = unify(goal.args[0], goal.args[1], probe);
    if (same === equal) yield env;
  };
}

function* logUri({ goal, env }) {
  const iri = iriValue(deref(goal.args[0], env));
  if (iri == null) return;
  yield* bindOrCheck(goal.args[1], rdfLiteral(iri, XSD_STRING, '', ''), env);
}

function* logDtLit({ goal, env }) {
  const parts = rdfListItems(goal.args[0], env);
  if (!parts || parts.length !== 2) return;
  const lex = jsString(parts[0], env);
  const datatype = iriValue(deref(parts[1], env));
  if (lex == null || datatype == null) return;
  yield* bindOrCheck(goal.args[1], rdfLiteral(lex, datatype, '', ''), env);
}

function* logRawType({ goal, env }) {
  const s = deref(goal.args[0], env);
  let iri;
  if (properListItems(s, env)) iri = RDF_LIST;
  else if (s?.type === 'compound' && s.name === 'literal') iri = `${LOG_NS}Literal`;
  else iri = `${LOG_NS}Other`;
  yield* bindOrCheck(goal.args[1], rdfIri(iri), env);
}
