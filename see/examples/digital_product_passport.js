#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { fail, loadInput } = require('./_see');

const crypto = require('crypto');

function canonical(term) {
  if (term.kind === 'list') return ['list', term.items.map(canonical)];
  if (term.kind === 'triple') return ['triple', canonical(term.s), canonical(term.p), canonical(term.o)];
  if (term.kind === 'formula') return ['formula', term.atoms.map((a) => [canonical(a.s), canonical(a.p), canonical(a.o)])];
  return [term.kind, term.value];
}
function factKey(f) { return JSON.stringify([canonical(f.s), canonical(f.p), canonical(f.o)]); }
function termIndexKey(t) { return JSON.stringify(canonical(t)); }
function compoundIndexKey() { return Array.from(arguments).map(termIndexKey).join('\u001f'); }
function termIsConcrete(t) {
  if (!t || t.kind === 'var') return false;
  if (t.kind === 'list') return t.items.every(termIsConcrete);
  if (t.kind === 'triple') return termIsConcrete(t.s) && termIsConcrete(t.p) && termIsConcrete(t.o);
  if (t.kind === 'formula') return t.atoms.every((a) => termIsConcrete(a.s) && termIsConcrete(a.p) && termIsConcrete(a.o));
  return true;
}
function isVar(t) { return t && t.kind === 'var'; }
function isIri(t, iri) { return t && t.kind === 'iri' && t.value === iri; }
function lit(value) { return { kind: 'lit', value }; }
function blank(value) { return { kind: 'blank', value }; }
function list(items) { return { kind: 'list', items }; }
function cloneTerm(t) { return JSON.parse(JSON.stringify(t)); }
function primitive(t) {
  if (!t) return undefined;
  if (t.kind === 'lit') return t.value;
  if (t.kind === 'iri') return t.value.replace(/^:/, '');
  if (t.kind === 'blank') return t.value;
  if (t.kind === 'list') return t.items.map(primitive);
  if (t.kind === 'triple') return termToN3(t);
  if (t.kind === 'formula') return termToN3(t);
  return undefined;
}
function literalToN3(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (Object.is(value, -0)) return '0';
    if (Number.isInteger(value)) return String(value);
    return Number(value.toPrecision(15)).toString();
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return JSON.stringify(value);
}
function termToN3(t) {
  if (!t) return 'undefined';
  if (t.kind === 'iri') return t.value;
  if (t.kind === 'lit') return literalToN3(t.value);
  if (t.kind === 'var') return '?' + t.value;
  if (t.kind === 'blank') return t.value.startsWith('_:') ? t.value : '_:' + t.value.replace(/^_+/, '');
  if (t.kind === 'list') return '(' + t.items.map(termToN3).join(' ') + ')';
  if (t.kind === 'triple') return '<<( ' + termToN3(t.s) + ' ' + termToN3(t.p) + ' ' + termToN3(t.o) + ' )>>';
  if (t.kind === 'formula') return '{ ' + t.atoms.map(atomToN3).join(' . ') + ' }';
  return String(t.value ?? t);
}
function atomToN3(f) { return termToN3(f.s) + ' ' + termToN3(f.p) + ' ' + termToN3(f.o); }
function display(t) {
  const value = primitive(t);
  if (Array.isArray(value)) return value.map(String).join(' ');
  return String(value);
}
function deepEqual(a, b) {
  if (a?.kind === 'lit' && b?.kind === 'lit' && typeof a.value === 'number' && typeof b.value === 'number') {
    return Math.abs(a.value - b.value) < 1e-12;
  }
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
function resolve(term, env, seen = new Set()) {
  if (term.kind === 'var' && Object.hasOwn(env, term.value)) {
    if (seen.has(term.value)) return term;
    seen.add(term.value);
    return resolve(env[term.value], env, seen);
  }
  if (term.kind === 'list') return list(term.items.map((item) => resolve(item, env, seen)));
  if (term.kind === 'triple') return { kind: 'triple', s: resolve(term.s, env), p: resolve(term.p, env), o: resolve(term.o, env) };
  if (term.kind === 'formula') return { kind: 'formula', atoms: term.atoms.map((a) => ({ s: resolve(a.s, env), p: resolve(a.p, env), o: resolve(a.o, env) })) };
  return term;
}
function unify(a, b, env) {
  a = resolve(a, env);
  b = resolve(b, env);
  if (a.kind === 'var') return { ...env, [a.value]: b };
  if (b.kind === 'var') return { ...env, [b.value]: a };
  if (a.kind === 'list' || b.kind === 'list') {
    if (a.kind !== 'list' || b.kind !== 'list' || a.items.length !== b.items.length) return null;
    let out = env;
    for (let i = 0; i < a.items.length; i += 1) {
      out = unify(a.items[i], b.items[i], out);
      if (!out) return null;
    }
    return out;
  }
  if (a.kind === 'triple' || b.kind === 'triple') {
    if (a.kind !== 'triple' || b.kind !== 'triple') return null;
    let out = unify(a.s, b.s, env);
    if (!out) return null;
    out = unify(a.p, b.p, out);
    if (!out) return null;
    return unify(a.o, b.o, out);
  }
  return deepEqual(a, b) ? env : null;
}
function bind(pattern, value, env) { return unify(pattern, value, env); }
function matchFact(atom, fact, env) {
  let out = unify(atom.p, fact.p, env); if (!out) return null;
  out = unify(atom.s, fact.s, out); if (!out) return null;
  return unify(atom.o, fact.o, out);
}
function atomIsGround(atom, env) {
  return termIsGround(atom.s, env) && termIsGround(atom.p, env) && termIsGround(atom.o, env);
}
function termIsGround(t, env) {
  const r = resolve(t, env);
  if (r.kind === 'var') return false;
  if (r.kind === 'list') return r.items.every((item) => termIsGround(item, env));
  if (r.kind === 'triple') return termIsGround(r.s, env) && termIsGround(r.p, env) && termIsGround(r.o, env);
  if (r.kind === 'formula') return r.atoms.every((atom) => atomIsGround(atom, env));
  return true;
}
function stringValue(t) {
  const r = t;
  if (!r) return null;
  if (r.kind === 'lit') return String(r.value);
  if (r.kind === 'iri') return r.value.replace(/[<>]/g, '');
  if (r.kind === 'blank' || r.kind === 'var') return null;
  return termToN3(r);
}
function xsdDurationSeconds(value) {
  const m = String(value || '').match(/^(-)?P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return null;
  const sign = m[1] ? -1 : 1;
  const years = Number(m[2] || 0);
  const months = Number(m[3] || 0);
  const weeks = Number(m[4] || 0);
  const days = Number(m[5] || 0);
  const hours = Number(m[6] || 0);
  const minutes = Number(m[7] || 0);
  const seconds = Number(m[8] || 0);

  // xsd:duration years/months are calendar-relative. SEE uses Gregorian averages
  // for standalone numeric comparisons such as "age above P80Y".
  return sign * (
    years * 365.2425 * 86400 +
    months * (365.2425 / 12) * 86400 +
    weeks * 7 * 86400 +
    days * 86400 +
    hours * 3600 +
    minutes * 60 +
    seconds
  );
}

function toNumberMaybe(t) {
  const v = primitive(t);
  if (typeof v === 'number') return Number.isFinite(v) || Number.isNaN(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v !== 'string') return null;
  const dur = xsdDurationSeconds(v);
  if (dur !== null) return dur;
  const d = Date.parse(v);
  if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(v) && Number.isFinite(d)) return d / 1000;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function toNumber(t) {
  const n = toNumberMaybe(t);
  if (n === null || !Number.isFinite(n)) throw new Error('Expected numeric value, got ' + JSON.stringify(primitive(t)));
  return n;
}
function toIntegerMaybe(t) {
  const n = toNumberMaybe(t);
  if (n === null || !Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}
function parseDate(t) {
  const v = primitive(t);
  if (typeof v !== 'string') return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms) : null;
}
function dateTimeLiteral(date) { return lit(date.toISOString().replace(/\.000Z$/, 'Z')); }
function durationLiteral(seconds) { return lit('PT' + Number(seconds.toPrecision(15)).toString() + 'S'); }
function termFrom(value) {
  if (Array.isArray(value)) return list(value.map(termFrom));
  if (value && typeof value === 'object' && value.kind) return value;
  return lit(value);
}
function allBoundList(term, env) {
  const r = resolve(term, env);
  if (r.kind !== 'list') throw new Error('Expected N3 list');
  if (r.items.some((item) => resolve(item, env).kind === 'var')) return null;
  return r.items.map((item) => resolve(item, env));
}
function bindResult(pattern, value, env) {
  return bind(pattern, termFrom(value), env);
}
function bindTermResult(pattern, term, env) {
  const out = bind(pattern, term, env);
  return out ? [out] : [];
}
function succeedIf(ok, env) { return ok ? [env] : []; }
function compareNumericTerms(a, b) {
  const na = toNumberMaybe(a), nb = toNumberMaybe(b);
  if (na === null || nb === null) return null;
  if (Number.isNaN(na) || Number.isNaN(nb)) return NaN;
  return na < nb ? -1 : na > nb ? 1 : 0;
}
function comparisonOperands(s, o, env) {
  const left = resolve(s, env), right = resolve(o, env);
  if (left.kind === 'list' && left.items.length === 2 && (right.kind === 'lit' ? right.value === true : right.kind === 'iri' && right.value === 'true')) {
    return [resolve(left.items[0], env), resolve(left.items[1], env)];
  }
  return [left, right];
}
function bindNumericOutput(pattern, value, env) {
  if (!Number.isFinite(value)) return [];
  const normalized = Number.isInteger(value) ? value : Number(value.toPrecision(15));
  return bindTermResult(pattern, lit(normalized), env);
}
function unaryMath(name, s, o, env, fwd, inv) {
  const left = resolve(s, env), right = resolve(o, env);
  if (left.kind !== 'var') return bindNumericOutput(o, fwd(toNumber(left)), env);
  if (right.kind !== 'var' && inv) return bindNumericOutput(s, inv(toNumber(right)), env);
  if (left.kind === 'var' && right.kind === 'var') return [env];
  return [];
}
function builtinMath(name, s, o, env) {
  const left = resolve(s, env);
  const right = resolve(o, env);
  const testCmp = (pred) => {
    const [a, b] = comparisonOperands(s, o, env);
    if (a.kind === 'var' || b.kind === 'var') return [];
    const cmp = compareNumericTerms(a, b);
    if (cmp === null || Number.isNaN(cmp)) return [];
    return succeedIf(pred(cmp), env);
  };
  if (name === 'math:lessThan') return testCmp((c) => c < 0);
  if (name === 'math:notLessThan') return testCmp((c) => c >= 0);
  if (name === 'math:greaterThan') return testCmp((c) => c > 0);
  if (name === 'math:notGreaterThan') return testCmp((c) => c <= 0);
  if (name === 'math:equalTo') return testCmp((c) => c === 0);
  if (name === 'math:notEqualTo') {
    const [a, b] = comparisonOperands(s, o, env);
    if (a.kind === 'var' || b.kind === 'var') return [];
    const cmp = compareNumericTerms(a, b);
    if (cmp !== null) return succeedIf(Number.isNaN(cmp) || cmp !== 0, env);
    return succeedIf(!deepEqual(a, b), env);
  }
  if (name === 'math:negation') return unaryMath(name, s, o, env, (x) => -x, (x) => -x);
  if (name === 'math:absoluteValue') {
    if (left.kind === 'var' && right.kind === 'var') return [env];
    if (left.kind !== 'var') return bindNumericOutput(o, Math.abs(toNumber(left)), env);
    const n = toNumber(right);
    const outs = [];
    for (const v of n === 0 ? [0] : [n, -n]) {
      const out = bind(s, lit(v), env); if (out) outs.push(out);
    }
    return outs;
  }
  if (name === 'math:degrees') return unaryMath(name, s, o, env, (x) => x * 180 / Math.PI, (x) => x * Math.PI / 180);
  const unary = {
    'math:sin': [Math.sin, Math.asin], 'math:cos': [Math.cos, Math.acos], 'math:tan': [Math.tan, Math.atan],
    'math:asin': [Math.asin, Math.sin], 'math:acos': [Math.acos, Math.cos], 'math:atan': [Math.atan, Math.tan],
    'math:sinh': [Math.sinh, Math.asinh], 'math:cosh': [Math.cosh, Math.acosh], 'math:tanh': [Math.tanh, Math.atanh],
    'math:rounded': [Math.round, null], 'math:floor': [Math.floor, null]
  };
  if (Object.hasOwn(unary, name)) {
    const [fwd, inv] = unary[name];
    if (typeof fwd !== 'function') return [];
    return unaryMath(name, s, o, env, fwd, typeof inv === 'function' ? inv : null);
  }
  if (name === 'math:exponentiation') {
    const l = resolve(s, env);
    if (l.kind !== 'list' || l.items.length !== 2) return [];
    const base = resolve(l.items[0], env);
    const exponent = resolve(l.items[1], env);
    const result = resolve(o, env);
    if (base.kind !== 'var' && exponent.kind !== 'var') return bindNumericOutput(o, Math.pow(toNumber(base), toNumber(exponent)), env);
    if (base.kind !== 'var' && result.kind !== 'var') {
      const b = toNumber(base), r = toNumber(result);
      if (b > 0 && b !== 1 && r > 0) return bindNumericOutput(l.items[1], Math.log(r) / Math.log(b), env);
      return [];
    }
    if (exponent.kind !== 'var' && result.kind !== 'var') {
      const e = toNumber(exponent), r = toNumber(result);
      if (e !== 0) return bindNumericOutput(l.items[0], Math.pow(r, 1 / e), env);
      return [];
    }
    return [];
  }
  if (name === 'math:product' || name === 'math:sum') {
    const vals = allBoundList(s, env); if (!vals) return [];
    if (vals.length === 2) {
      const [aT, bT] = vals;
      const aD = parseDate(aT);
      if (name === 'math:sum' && aD) {
        const secs = toNumberMaybe(bT);
        if (secs !== null && Number.isFinite(secs)) return bindTermResult(o, dateTimeLiteral(new Date(aD.getTime() + secs * 1000)), env);
      }
    }
    const value = name === 'math:product' ? vals.reduce((a, x) => a * toNumber(x), 1) : vals.reduce((a, x) => a + toNumber(x), 0);
    return bindNumericOutput(o, value, env);
  }
  if (name === 'math:difference' || name === 'math:quotient' || name === 'math:integerQuotient' || name === 'math:remainder') {
    const vals = allBoundList(s, env); if (!vals || vals.length !== 2) return [];
    const aD = parseDate(vals[0]), bD = parseDate(vals[1]);
    if (name === 'math:difference' && aD && bD) return bindTermResult(o, durationLiteral((aD.getTime() - bD.getTime()) / 1000), env);
    if (name === 'math:difference' && aD && !bD) {
      const secs = toNumberMaybe(vals[1]);
      if (secs !== null && Number.isFinite(secs)) return bindTermResult(o, dateTimeLiteral(new Date(aD.getTime() - secs * 1000)), env);
    }
    const a = toNumber(vals[0]), b = toNumber(vals[1]);
    if ((name === 'math:quotient' || name === 'math:integerQuotient' || name === 'math:remainder') && b === 0) return [];
    if (name === 'math:difference') return bindNumericOutput(o, a - b, env);
    if (name === 'math:quotient') return bindNumericOutput(o, a / b, env);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return [];
    if (name === 'math:integerQuotient') return bindNumericOutput(o, Math.trunc(a / b), env);
    return bindNumericOutput(o, a % b, env);
  }
  return null;
}
function applyFormat(fmt, args) {
  let i = 0;
  return String(fmt).replace(/%([-0]?\d+)?(?:\.(\d+))?([%sdiufFeEgGc])/g, (m, width, precision, conv) => {
    if (conv === '%') return '%';
    const arg = args[i++];
    if (conv === 's') return String(arg ?? '');
    if (conv === 'c') return String.fromCodePoint(Number(arg));
    if ('diu'.includes(conv)) return String(Math.trunc(Number(arg)));
    const n = Number(arg);
    if (conv === 'f' || conv === 'F') return n.toFixed(precision == null ? 6 : Number(precision));
    if (conv === 'e' || conv === 'E') return n.toExponential(precision == null ? 6 : Number(precision));
    if (conv === 'g' || conv === 'G') return n.toPrecision(precision == null ? 6 : Number(precision)).replace(/\.0+(e|$)/i, '$1');
    return m;
  });
}
function compileRegex(pattern, flags = '') {
  try { return new RegExp(String(pattern), flags); }
  catch { return null; }
}
function builtinString(name, s, o, env) {
  const left = resolve(s, env), right = resolve(o, env);
  function output(value) { return bindTermResult(o, lit(String(value)), env); }
  const str = (term) => stringValue(resolve(term, env));
  if (name === 'string:concatenation') {
    const vals = allBoundList(s, env); if (!vals) return [];
    return output(vals.map(stringValue).join(''));
  }
  if (name === 'string:format') {
    const vals = allBoundList(s, env); if (!vals || vals.length === 0) return [];
    return output(applyFormat(stringValue(vals[0]), vals.slice(1).map(stringValue)));
  }
  if (name === 'string:length') { const a = str(s); return a === null ? [] : bindTermResult(o, lit(a.length), env); }
  if (name === 'string:charAt') {
    const vals = allBoundList(s, env); if (!vals || vals.length !== 2) return [];
    const a = stringValue(vals[0]); const idx = Math.trunc(toNumber(vals[1]));
    return output(idx < 0 || idx >= a.length ? '' : a.charAt(idx));
  }
  if (name === 'string:setCharAt') {
    const vals = allBoundList(s, env); if (!vals || vals.length !== 3) return [];
    const a = stringValue(vals[0]); const idx = Math.trunc(toNumber(vals[1])); const ch = String(stringValue(vals[2]) || '').charAt(0);
    if (idx < 0 || idx >= a.length) return output(a);
    return output(a.slice(0, idx) + ch + a.slice(idx + 1));
  }
  const a = str(s), b = str(o);
  if (name === 'string:contains') return a === null || b === null ? [] : succeedIf(a.includes(b), env);
  if (name === 'string:containsIgnoringCase') return a === null || b === null ? [] : succeedIf(a.toLowerCase().includes(b.toLowerCase()), env);
  if (name === 'string:startsWith') return a === null || b === null ? [] : succeedIf(a.startsWith(b), env);
  if (name === 'string:endsWith') return a === null || b === null ? [] : succeedIf(a.endsWith(b), env);
  if (name === 'string:equalIgnoringCase') return a === null || b === null ? [] : succeedIf(a.toLowerCase() === b.toLowerCase(), env);
  if (name === 'string:notEqualIgnoringCase') return a === null || b === null ? [] : succeedIf(a.toLowerCase() !== b.toLowerCase(), env);
  if (name === 'string:greaterThan') return a === null || b === null ? [] : succeedIf(a > b, env);
  if (name === 'string:lessThan') return a === null || b === null ? [] : succeedIf(a < b, env);
  if (name === 'string:notGreaterThan') return a === null || b === null ? [] : succeedIf(a <= b, env);
  if (name === 'string:notLessThan') return a === null || b === null ? [] : succeedIf(a >= b, env);
  if (name === 'string:matches' || name === 'string:notMatches') {
    if (a === null || b === null) return [];
    const re = compileRegex(b); if (!re) return [];
    const ok = re.test(a);
    return succeedIf(name === 'string:matches' ? ok : !ok, env);
  }
  if (name === 'string:replace') {
    const vals = allBoundList(s, env); if (!vals || vals.length !== 3) return [];
    const data = stringValue(vals[0]), pattern = stringValue(vals[1]), replacement = stringValue(vals[2]);
    const re = compileRegex(pattern, 'g'); if (!re) return [];
    return output(data.replace(re, replacement));
  }
  if (name === 'string:scrape') {
    const vals = allBoundList(s, env); if (!vals || vals.length !== 2) return [];
    const data = stringValue(vals[0]), pattern = stringValue(vals[1]);
    const re = compileRegex(pattern); if (!re) return [];
    const m = data.match(re); if (!m || m.length < 2) return [];
    return output(m[1]);
  }
  return null;
}
function builtinCrypto(name, s, o, env) {
  const algos = { 'crypto:sha': 'sha1', 'crypto:md5': 'md5', 'crypto:sha256': 'sha256', 'crypto:sha512': 'sha512' };
  if (!Object.hasOwn(algos, name)) return null;
  if (!termIsGround(s, env)) return [];
  const digest = crypto.createHash(algos[name]).update(String(primitive(resolve(s, env))), 'utf8').digest('hex');
  return bindTermResult(o, lit(digest), env);
}
function formulaContains(graph, patternAtoms, env, rules, depth) {
  const localGraph = graph && graph.facts ? graph : makeGraph(graph?.atoms || graph?.facts || []);
  return evalBody(patternAtoms, [env], localGraph, rules, depth + 1).length > 0;
}
function builtinLog(name, s, o, env, graph, rules, depth) {
  if (name === 'log:equalTo') return bindTermResult(s, resolve(o, env), env);
  if (name === 'log:notEqualTo') {
    const out = unify(resolve(s, env), resolve(o, env), env);
    return out ? [] : [env];
  }
  if (name === 'log:conjunction') {
    const vals = allBoundList(s, env); if (!vals) return [];
    const merged = [], seen = new Set();
    for (const part of vals) {
      if (part.kind === 'lit' && part.value === true) continue;
      if (part.kind !== 'formula') return [];
      for (const atom of part.atoms) { const k = factKey(atom); if (!seen.has(k)) { seen.add(k); merged.push(atom); } }
    }
    return bindTermResult(o, { kind: 'formula', atoms: merged }, env);
  }
  if (name === 'log:includes' || name === 'log:notIncludes') {
    const scope = resolve(s, env), pattern = resolve(o, env);
    if (pattern.kind !== 'formula') return [];
    const local = scope.kind === 'formula' ? makeGraph(scope.atoms) : graph;
    const ok = evalBody(pattern.atoms, [env], local, rules, depth + 1).length > 0;
    return succeedIf(name === 'log:includes' ? ok : !ok, env);
  }
  if (name === 'log:rawType') {
    const rt = resolve(s, env);
    if (rt.kind === 'var') return [];
    const ty = rt.kind === 'formula' ? 'log:Formula' : rt.kind === 'lit' ? 'log:Literal' : rt.kind === 'list' ? 'rdf:List' : 'log:Other';
    return bindTermResult(o, { kind: 'iri', value: ty }, env);
  }
  if (name === 'log:dtlit') {
    const l = resolve(s, env), obj = resolve(o, env);
    if (l.kind === 'list' && l.items.length === 2) {
      const lex = stringValue(resolve(l.items[0], env));
      const dt = resolve(l.items[1], env);
      if (lex === null || dt.kind !== 'iri') return [];
      return bindTermResult(o, lit(lex), env);
    }
    if (obj.kind === 'var') return [];
    return stringValue(obj) === null ? [] : [env];
  }
  if (name === 'log:outputString') return [env];
  if (name === 'log:collectAllIn') {
    const l = resolve(s, env); if (l.kind !== 'list' || l.items.length !== 3) return [];
    const [valueTemplate, clause, outList] = l.items;
    const scope = resolve(o, env);
    const local = scope.kind === 'formula' ? makeGraph(scope.atoms) : graph;
    if (clause.kind !== 'formula') return [];
    const sols = evalBody(clause.atoms, [env], local, rules, depth + 1);
    return bindTermResult(outList, list(sols.map((sol) => resolve(valueTemplate, sol))), env);
  }
  if (name === 'log:forAllIn') {
    const l = resolve(s, env); if (l.kind !== 'list' || l.items.length !== 2) return [];
    const [where, then] = l; if (where.kind !== 'formula' || then.kind !== 'formula') return [];
    const scope = resolve(o, env);
    const local = scope.kind === 'formula' ? makeGraph(scope.atoms) : graph;
    const sols = evalBody(where.atoms, [{}], local, rules, depth + 1);
    for (const sol of sols) if (!evalBody(then.atoms, [sol], local, rules, depth + 1).length) return [];
    return [env];
  }
  if (['log:content', 'log:semantics', 'log:semanticsOrError', 'log:parsedAsN3'].includes(name)) {
    throw new Error(name + ' requires dereferencing or parsing at runtime and is intentionally not available in offline specialized SEE output');
  }
  return null;
}
function splitList(items, parts, env, start = 0, idx = 0) {
  if (idx === parts.length) return start === items.length ? [env] : [];
  const outs = [];
  const last = idx === parts.length - 1;
  for (let end = start; end <= items.length; end += 1) {
    if (last && end !== items.length) continue;
    const out = bind(parts[idx], list(items.slice(start, end)), env);
    if (out) outs.push(...splitList(items, parts, out, end, idx + 1));
  }
  return outs;
}
function termSortKey(t) {
  if (t.kind === 'lit') { const n = Number(t.value); return Number.isNaN(n) ? '1:' + String(t.value) : '0:' + n.toString().padStart(20, '0'); }
  if (t.kind === 'iri') return '2:' + t.value;
  if (t.kind === 'list') return '3:' + t.items.map(termSortKey).join('|');
  return '9:' + JSON.stringify(canonical(t));
}
function builtinList(name, s, o, env, graph, rules, depth) {
  const predName = name === 'rdf:first' ? 'list:first' : name === 'rdf:rest' ? 'list:rest' : name;
  const left = resolve(s, env);
  const right = resolve(o, env);
  const listItems = (term) => term.kind === 'list' ? term.items.map((x) => resolve(x, env)) : null;
  if (predName === 'list:first') {
    const xs = listItems(left); if (!xs || !xs.length) return [];
    return bindTermResult(o, xs[0], env);
  }
  if (predName === 'list:rest') {
    const xs = listItems(left); if (!xs || !xs.length) return [];
    return bindTermResult(o, list(xs.slice(1)), env);
  }
  if (predName === 'list:firstRest') {
    const outs = [];
    if (left.kind === 'list' && left.items.length > 0 && !left.items.some((x) => resolve(x, env).kind === 'var')) {
      const items = left.items.map((x) => resolve(x, env));
      const out = bind(o, list([items[0], list(items.slice(1))]), env); if (out) outs.push(out);
    }
    if (right.kind === 'list' && right.items.length === 2) {
      const rest = resolve(right.items[1], env);
      const first = resolve(right.items[0], env);
      if (rest.kind === 'list') { const out = bind(s, list([first, ...rest.items]), env); if (out) outs.push(out); }
    }
    return outs;
  }
  if (predName === 'list:append') {
    if (left.kind !== 'list') return [];
    if (right.kind === 'list') return splitList(right.items, left.items, env);
    const outElems = [];
    for (const part of left.items) { const p = resolve(part, env); if (p.kind !== 'list') return []; outElems.push(...p.items); }
    return bindTermResult(o, list(outElems), env);
  }
  if (predName === 'list:iterate') {
    const xs = listItems(left); if (!xs) return [];
    const outs = [];
    for (let i = 0; i < xs.length; i += 1) { const out = bind(o, list([lit(i), xs[i]]), env); if (out) outs.push(out); }
    return outs;
  }
  if (predName === 'list:last') {
    const xs = listItems(left); if (!xs || !xs.length) return [];
    return bindTermResult(o, xs[xs.length - 1], env);
  }
  if (predName === 'list:memberAt') {
    if (left.kind !== 'list' || left.items.length !== 2) return [];
    const arr = resolve(left.items[0], env), idx = resolve(left.items[1], env);
    if (arr.kind !== 'list') return [];
    const outs = [];
    for (let i = 0; i < arr.items.length; i += 1) {
      let out = idx.kind === 'var' ? bind(left.items[1], lit(i), env) : (Number(idx.value) === i ? env : null);
      if (out) out = bind(o, arr.items[i], out);
      if (out) outs.push(out);
    }
    return outs;
  }
  if (predName === 'list:remove') {
    if (left.kind !== 'list' || left.items.length !== 2) return [];
    const arr = resolve(left.items[0], env), item = resolve(left.items[1], env);
    if (arr.kind !== 'list' || item.kind === 'var') return [];
    return bindTermResult(o, list(arr.items.filter((x) => !deepEqual(resolve(x, env), item))), env);
  }
  if (predName === 'list:member') {
    const xs = listItems(left); if (!xs) return [];
    return xs.map((x) => bind(o, x, env)).filter(Boolean);
  }
  if (predName === 'list:in') {
    const xs = listItems(right); if (!xs) return [];
    return xs.map((x) => bind(s, x, env)).filter(Boolean);
  }
  if (predName === 'list:length') {
    const xs = listItems(left); if (!xs) return [];
    return bindTermResult(o, lit(xs.length), env);
  }
  if (predName === 'list:notMember') {
    const xs = listItems(left); if (!xs) return [];
    return xs.some((x) => unify(o, x, env)) ? [] : [env];
  }
  if (predName === 'list:reverse') {
    if (left.kind === 'list') return bindTermResult(o, list([...left.items].reverse()), env);
    if (right.kind === 'list') return bindTermResult(s, list([...right.items].reverse()), env);
    return [];
  }
  if (predName === 'list:sort') {
    const source = left.kind === 'list' ? left : right.kind === 'list' ? right : null;
    if (!source || source.items.some((x) => resolve(x, env).kind === 'var')) return [];
    const sorted = [...source.items].sort((a, b) => termSortKey(a).localeCompare(termSortKey(b)));
    return left.kind === 'list' ? bindTermResult(o, list(sorted), env) : bindTermResult(s, list(sorted), env);
  }
  if (predName === 'list:map') {
    if (left.kind !== 'list' || left.items.length !== 2) return [];
    const arr = resolve(left.items[0], env), pred = resolve(left.items[1], env);
    if (arr.kind !== 'list' || pred.kind !== 'iri') return [];
    const values = [];
    for (let i = 0; i < arr.items.length; i += 1) {
      const valueVar = { kind: 'var', value: '__map_' + depth + '_' + i };
      const matches = evalAtom({ s: arr.items[i], p: pred, o: valueVar }, env, graph, rules, depth + 1);
      for (const m of matches) { const v = resolve(valueVar, m); if (v.kind !== 'var') values.push(v); }
    }
    return bindTermResult(o, list(values), env);
  }
  return null;
}
function parseDateTimeParts(t) {
  const v = primitive(t);
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})?$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), hour: Number(m[4]), minute: Number(m[5]), second: Number(m[6]), timeZone: m[7] || '' };
}
function builtinTime(name, s, o, env) {
  if (name === 'time:localTime') return bindTermResult(o, lit(new Date().toISOString().replace(/\.000Z$/, 'Z')), env);
  const parts = parseDateTimeParts(resolve(s, env)); if (!parts) return [];
  const key = name.slice('time:'.length);
  if (['year','month','day','hour','minute','second'].includes(key)) return bindTermResult(o, lit(parts[key]), env);
  if (key === 'timeZone') return bindTermResult(o, lit(parts.timeZone || 'Z'), env);
  return null;
}
function evalBuiltin(atom, env, graph, rules, depth) {
  const pred = resolve(atom.p, env);
  if (pred.kind !== 'iri') return null;
  const name = pred.value;
  if (name.startsWith('math:')) return builtinMath(name, atom.s, atom.o, env);
  if (name.startsWith('string:')) return builtinString(name, atom.s, atom.o, env);
  if (name.startsWith('crypto:')) return builtinCrypto(name, atom.s, atom.o, env);
  if (name.startsWith('list:') || name === 'rdf:first' || name === 'rdf:rest') return builtinList(name, atom.s, atom.o, env, graph, rules, depth);
  if (name.startsWith('time:')) return builtinTime(name, atom.s, atom.o, env);
  if (name.startsWith('log:')) return builtinLog(name, atom.s, atom.o, env, graph, rules, depth);
  return null;
}
function renameTerm(term, suffix) {
  if (term.kind === 'var') return { kind: 'var', value: term.value + suffix };
  if (term.kind === 'list') return list(term.items.map((item) => renameTerm(item, suffix)));
  if (term.kind === 'formula') return { kind: 'formula', atoms: term.atoms.map((a) => renameAtom(a, suffix)) };
  return cloneTerm(term);
}
function renameAtom(atom, suffix) {
  return { s: renameTerm(atom.s, suffix), p: renameTerm(atom.p, suffix), o: renameTerm(atom.o, suffix) };
}
let renameCounter = 0;
function evalBackward(atom, env, graph, rules, depth) {
  if (depth > 200) throw new Error('Backward rule recursion limit exceeded');
  const outs = [];
  for (const rule of rules) {
    if (rule.kind !== 'backward') continue;
    for (const headAtom of rule.head) {
      const suffix = '__rule' + rule.id + '_' + depth + '_' + (++renameCounter);
      const renamedHead = renameAtom(headAtom, suffix);
      let out = unify(atom.p, renamedHead.p, env); if (!out) continue;
      out = unify(atom.s, renamedHead.s, out); if (!out) continue;
      out = unify(atom.o, renamedHead.o, out); if (!out) continue;
      const renamedBody = rule.body.map((bodyAtom) => renameAtom(bodyAtom, suffix));
      outs.push(...evalBody(renamedBody, [out], graph, rules, depth + 1));
    }
  }
  return outs;
}
function evalAtom(atom, env, graph, rules, depth = 0) {
  const builtin = evalBuiltin(atom, env, graph, rules, depth);
  if (builtin !== null) return builtin;
  const outs = [];
  for (const fact of candidateFactsForAtom(atom, env, graph)) {
    const out = matchFact(atom, fact, env);
    if (out) outs.push(out);
  }
  outs.push(...evalBackward(atom, env, graph, rules, depth + 1));
  return outs;
}
function evalBody(atoms, envs, graph, rules, depth = 0) {
  let out = envs;
  for (const atom of atoms) {
    const next = [];
    for (const env of out) next.push(...evalAtom(atom, env, graph, rules, depth));
    out = next;
    if (!out.length) break;
  }
  return out;
}
function envSignature(env) {
  return crypto.createHash('sha1').update(JSON.stringify(Object.keys(env).sort().map((k) => [k, canonical(env[k])]))).digest('hex').slice(0, 12);
}
function instantiate(term, env, ruleId) {
  if (term.kind === 'var') {
    if (!Object.hasOwn(env, term.value)) throw new Error('Unbound variable in rule head: ?' + term.value);
    return cloneTerm(resolve(env[term.value], env));
  }
  if (term.kind === 'blank') return blank('_:r' + ruleId + '_' + envSignature(env) + '_' + term.value.replace(/^_/, ''));
  if (term.kind === 'list') return list(term.items.map((item) => instantiate(item, env, ruleId)));
  if (term.kind === 'triple') return { kind: 'triple', s: instantiate(term.s, env, ruleId), p: instantiate(term.p, env, ruleId), o: instantiate(term.o, env, ruleId) };
  if (term.kind === 'formula') return { kind: 'formula', atoms: term.atoms.map((a) => ({ s: instantiate(a.s, env, ruleId), p: instantiate(a.p, env, ruleId), o: instantiate(a.o, env, ruleId) })) };
  return cloneTerm(term);
}
function supportFactsForBody(body, env, graph) {
  const seen = new Set();
  const out = [];
  for (const atom of body || []) {
    const pred = resolve(atom.p, env);
    if (pred.kind === 'iri') {
      const builtin = pred.value.startsWith('math:') || pred.value.startsWith('string:') || pred.value.startsWith('crypto:') ||
        pred.value.startsWith('list:') || pred.value.startsWith('time:') || pred.value.startsWith('log:') ||
        pred.value === 'rdf:first' || pred.value === 'rdf:rest';
      if (builtin) continue;
    }
    for (const fact of candidateFactsForAtom(atom, env, graph)) {
      if (!matchFact(atom, fact, env)) continue;
      const key = factKey(fact);
      if (!seen.has(key)) { seen.add(key); out.push(fact); }
    }
  }
  return out;
}
function makeIndex() { return { p: new Map(), spByP: new Map(), poByP: new Map(), s: null, o: null }; }
function pushIndex(map, key, fact) {
  let bucket = map.get(key);
  if (!bucket) { bucket = []; map.set(key, bucket); }
  bucket.push(fact);
}
function makeGraph(facts) {
  const graph = { facts: [], keys: new Set(), index: makeIndex() };
  for (const fact of facts) addFact(graph, fact);
  return graph;
}
function ensureFlatIndex(graph, kind, termSelector) {
  if (!graph.index[kind]) {
    const map = new Map();
    for (const fact of graph.facts) pushIndex(map, termIndexKey(termSelector(fact)), fact);
    graph.index[kind] = map;
  }
  return graph.index[kind];
}
function ensurePredicateTermIndex(graph, byPredicate, pKey, pFacts, termSelector) {
  let map = graph.index[byPredicate].get(pKey);
  if (!map) {
    map = new Map();
    for (const fact of pFacts) pushIndex(map, termIndexKey(termSelector(fact)), fact);
    graph.index[byPredicate].set(pKey, map);
  }
  return map;
}
function addFact(graph, fact) {
  const key = factKey(fact);
  if (graph.keys.has(key)) return false;
  graph.keys.add(key);
  graph.facts.push(fact);
  const pKey = termIndexKey(fact.p);
  pushIndex(graph.index.p, pKey, fact);
  if (graph.index.s) pushIndex(graph.index.s, termIndexKey(fact.s), fact);
  if (graph.index.o) pushIndex(graph.index.o, termIndexKey(fact.o), fact);
  const sp = graph.index.spByP.get(pKey);
  if (sp) pushIndex(sp, termIndexKey(fact.s), fact);
  const po = graph.index.poByP.get(pKey);
  if (po) pushIndex(po, termIndexKey(fact.o), fact);
  return true;
}
function candidateFactsForAtom(atom, env, graph) {
  if (!graph || !graph.index) return graph && graph.facts ? graph.facts : [];
  const s = resolve(atom.s, env), p = resolve(atom.p, env), o = resolve(atom.o, env);
  const sg = termIsConcrete(s), pg = termIsConcrete(p), og = termIsConcrete(o);
  if (pg) {
    const pKey = termIndexKey(p);
    const pFacts = graph.index.p.get(pKey) || [];
    if (sg) return ensurePredicateTermIndex(graph, 'spByP', pKey, pFacts, (f) => f.s).get(termIndexKey(s)) || [];
    if (og) return ensurePredicateTermIndex(graph, 'poByP', pKey, pFacts, (f) => f.o).get(termIndexKey(o)) || [];
    return pFacts;
  }
  if (sg) return ensureFlatIndex(graph, 's', (f) => f.s).get(termIndexKey(s)) || [];
  if (og) return ensureFlatIndex(graph, 'o', (f) => f.o).get(termIndexKey(o)) || [];
  return graph.facts;
}

function isBuiltinPredicateValue(name) {
  return typeof name === 'string' && (name.startsWith('math:') || name.startsWith('string:') || name.startsWith('crypto:') ||
    name.startsWith('list:') || name.startsWith('time:') || name.startsWith('log:') || name === 'rdf:first' || name === 'rdf:rest');
}
function collectFormulaDependencyKeys(term, keys) {
  if (!term) return true;
  if (term.kind === 'formula') {
    for (const atom of term.atoms || []) {
      if (!collectAtomDependencyKeys(atom, keys)) return false;
    }
    return true;
  }
  if (term.kind === 'list') {
    for (const item of term.items || []) if (!collectFormulaDependencyKeys(item, keys)) return false;
  }
  return true;
}
function collectAtomDependencyKeys(atom, keys) {
  const pred = atom && atom.p;
  if (!pred || pred.kind === 'var') return false;
  if (pred.kind === 'iri') {
    if (!isBuiltinPredicateValue(pred.value)) keys.add(termIndexKey(pred));
    else if (pred.value.startsWith('log:')) {
      if (!collectFormulaDependencyKeys(atom.s, keys)) return false;
      if (!collectFormulaDependencyKeys(atom.o, keys)) return false;
    }
  }
  return true;
}
function ruleDependencyPredicateKeys(rule) {
  const keys = new Set();
  for (const atom of rule.body || []) {
    if (!collectAtomDependencyKeys(atom, keys)) return null;
  }
  return keys;
}
function producedFactsCanAffectRules(producedPredicates, ruleDependencies) {
  if (!producedPredicates || !producedPredicates.size) return false;
  for (const deps of ruleDependencies) {
    if (deps === null) return true;
    for (const key of producedPredicates) if (deps.has(key)) return true;
  }
  return false;
}
function saturate(initialFacts, rules) {
  const graph = makeGraph(initialFacts);
  const trace = [];
  const maxIterations = 10000;
  const activeRules = (rules || []).filter((rule) => rule.kind !== 'backward');
  const ruleDependencies = activeRules.map(ruleDependencyPredicateKeys);
  for (let iter = 0; iter < maxIterations; iter += 1) {
    let changed = false;
    const producedPredicates = new Set();
    for (const rule of activeRules) {
      const matches = evalBody(rule.body, [{}], graph, rules);
      if (rule.kind === 'fuse') {
        if (matches.length) throw new Error('N3 fuse failed in compiled rule #' + rule.id);
        continue;
      }
      for (const env of matches) {
        const supportFacts = supportFactsForBody(rule.body, env, graph);
        const produced = [];
        for (const atom of rule.head) {
          const fact = { s: instantiate(atom.s, env, rule.id), p: instantiate(atom.p, env, rule.id), o: instantiate(atom.o, env, rule.id) };
          if (addFact(graph, fact)) {
            changed = true;
            produced.push(fact);
            producedPredicates.add(termIndexKey(fact.p));
          }
        }
        if (produced.length) {
          trace.push({
            rule: rule.id,
            produced: produced.length,
            producedFacts: produced.map(codeFact).map((x) => x.replace(/ \.$/, '')),
            supportFacts: supportFacts.map(codeFact).map((x) => x.replace(/ \.$/, ''))
          });
        }
      }
    }
    if (!changed) break;
    if (!producedFactsCanAffectRules(producedPredicates, ruleDependencies)) break;
    if (iter === maxIterations - 1) throw new Error('Compiled derivation did not reach a fixpoint');
  }
  return { graph, trace };
}
function queryFacts(graph, queries, rules) {
  const out = [];
  const seen = new Set();
  for (const query of queries || []) {
    const matches = evalBody(query.premise || [], [{}], graph, rules);
    for (const env of matches) {
      for (const atom of query.conclusion || []) {
        const fact = { s: instantiate(atom.s, env, 'q' + query.id), p: instantiate(atom.p, env, 'q' + query.id), o: instantiate(atom.o, env, 'q' + query.id) };
        if (!atomIsGround(fact, {})) throw new Error('Unbound variable in log:query projection');
        const key = factKey(fact);
        if (!seen.has(key)) { seen.add(key); out.push(fact); }
      }
    }
  }
  return out;
}
function outputStrings(graph) {
  return graph.facts
    .filter((f) => isIri(f.p, 'log:outputString'))
    .sort((a, b) => display(a.s).localeCompare(display(b.s)))
    .map((f) => String(primitive(f.o)));
}
function initialKeys(initialFacts) {
  if (!initialFacts) return new Set();
  if (initialFacts.__seeKeySet) return initialFacts.__seeKeySet;
  const keys = new Set((initialFacts || []).map(factKey));
  try { Object.defineProperty(initialFacts, '__seeKeySet', { value: keys, enumerable: false }); } catch (_) {}
  return keys;
}
function derivedFacts(graph, initialFacts) {
  const base = initialKeys(initialFacts);
  return graph.facts.filter((f) => !base.has(factKey(f)));
}
function codeFact(f) { return atomToN3(f) + ' .'; }
function unquoteLiteral(text) {
  const m = String(text || '').match(/^\"([\s\S]*)\"$/);
  if (!m) return String(text || '');
  return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}
function readablePredicateName(term) {
  return String(term || '')
    .replace(/^[:<#]*/, '')
    .replace(/[>#]*$/g, '')
    .replace(/^./, (ch) => ch.toLowerCase());
}
function compactValidationValue(value) {
  return String(value || '').replace(/^OK\s*-\s*/i, '').trim();
}
function compactSupportFactText(fact) {
  const text = String(fact || '')
    .replace(/===\s*Reason\s+Why\s*===/gi, '=== Explanation ===')
    .replace(/===\s*Review\s*===/gi, '=== Explanation ===');
  const report = text.match(/^(.*?\blog:outputString)\s+/);
  if (report) return report[1] + ' "[authored report]"';

  return text.replace(/\s{2,}/g, ' ').trim();
}
function compactRuleComment(comment) {
  return compactSupportFactText(comment);
}
function shortTerm(t) { return termToN3(t); }
function factSentence(f) {
  const s = shortTerm(f.s), p = shortTerm(f.p), o = shortTerm(f.o);
  if (isIri(f.p, 'rdf:type')) return s + ' is a ' + o + '.';
  if (isIri(f.p, 'rdfs:subClassOf')) return s + ' is a subclass of ' + o + '.';
  if (isIri(f.p, ':is') || /(^|:)is$/.test(p)) return s + ' is ' + o + '.';
  return s + ' ' + p + ' ' + o + '.';
}
function previewItems(items, limit = 2) {
  const list = Array.isArray(items) ? items.filter(Boolean).map(compactRuleComment) : [];
  const shown = list.slice(0, limit).join('; ');
  const more = list.length > limit ? '; … +' + (list.length - limit) + ' more' : '';
  return shown + more;
}
function describeRule(rule) {
  if (!rule) return 'compiled rule';
  const body = rule.bodyComment || [];
  const head = rule.headComment || [];
  if (rule.kind === 'fuse') {
    const preview = previewItems(body, 2) || 'forbidden pattern';
    return 'Fuse ' + rule.id + ' guards against ' + preview;
  }
  const bodyCount = body.length;
  const headCount = head.length;
  if (bodyCount <= 2 && headCount <= 2) {
    return 'Rule ' + rule.id + ': ' + (previewItems(body, 2) || 'true') + ' => ' + (previewItems(head, 2) || 'false');
  }
  return 'Rule ' + rule.id + ' (' + bodyCount + ' premise pattern(s) => ' + headCount + ' conclusion pattern(s))';
}
function traceApplications(trace, rules, limit = 6) {
  const byId = new Map((rules || []).map((r) => [r.id, r]));
  const grouped = new Map();
  for (const step of trace || []) {
    const facts = Array.isArray(step.producedFacts) ? step.producedFacts : [];
    if (!facts.length) continue;
    const key = String(step.rule);
    if (!grouped.has(key)) grouped.set(key, { rule: byId.get(step.rule), facts: [], supportFacts: [] });
    const entry = grouped.get(key);
    for (const fact of facts) if (!entry.facts.includes(fact)) entry.facts.push(fact);
    for (const fact of Array.isArray(step.supportFacts) ? step.supportFacts : []) {
      if (!entry.supportFacts.includes(fact)) entry.supportFacts.push(fact);
    }
  }
  return Array.from(grouped.values()).slice(0, limit);
}
function supportIndex(trace) {
  const index = new Map();
  for (const step of trace || []) {
    const facts = Array.isArray(step.producedFacts) ? step.producedFacts : [];
    for (const fact of facts) {
      if (!index.has(fact)) {
        index.set(fact, { rule: step.rule, supportFacts: Array.isArray(step.supportFacts) ? step.supportFacts : [] });
      }
    }
  }
  return index;
}
function supportTreeLines(fact, supportMap, sourceKeys, ruleMap, opts = {}) {
  const lines = [];
  const maxDepth = opts.maxDepth ?? 4;
  const maxChildren = opts.maxChildren ?? 4;
  const maxLines = opts.maxLines ?? 40;
  function walk(item, depth, seen) {
    if (lines.length >= maxLines) return;
    const indent = '  '.repeat(depth);
    if (/\blog:outputString\b/.test(String(item || ''))) {
      const support = supportMap.get(item);
      const rule = support ? ruleMap.get(support.rule) : null;
      const label = support ? (rule ? 'Rule ' + rule.id : 'compiled rule #' + support.rule) : 'no recorded rule support';
      lines.push(indent + '- ' + compactSupportFactText(item) + ' . _(authored report, ' + label + ')_');
      return;
    }
    if (sourceKeys.has(item)) {
      lines.push(indent + '- ' + compactSupportFactText(item) + ' . _(source)_');
      return;
    }
    const support = supportMap.get(item);
    if (!support) {
      lines.push(indent + '- ' + compactSupportFactText(item) + ' . _(no recorded rule support)_');
      return;
    }
    const rule = ruleMap.get(support.rule);
    const label = rule ? 'Rule ' + rule.id : 'compiled rule #' + support.rule;
    lines.push(indent + '- ' + compactSupportFactText(item) + ' . _(derived by ' + label + ')_');
    if (depth >= maxDepth) {
      if (support.supportFacts && support.supportFacts.length) lines.push(indent + '  - support omitted beyond depth ' + maxDepth);
      return;
    }
    const children = (support.supportFacts || []).slice(0, maxChildren);
    const childIndent = indent + '  ';
    if (!children.length) {
      lines.push(childIndent + '- no graph premises; built-ins/constants satisfied the rule.');
      return;
    }
    for (const child of children) {
      if (seen.has(child)) {
        lines.push(childIndent + '- ' + compactSupportFactText(child) + ' . _(already shown)_');
        continue;
      }
      const nextSeen = new Set(seen);
      nextSeen.add(child);
      walk(child, depth + 1, nextSeen);
      if (lines.length >= maxLines) break;
    }
    if ((support.supportFacts || []).length > children.length) {
      lines.push(childIndent + '- ... ' + ((support.supportFacts || []).length - children.length) + ' more premise fact(s)');
    }
  }
  walk(fact, 0, new Set([fact]));
  if (lines.length >= maxLines) lines.push('- … support tree truncated after ' + maxLines + ' line(s)');
  return lines;
}
function conclusionSupportSection(selected, trace, rules, initialFacts, limit = 6) {
  const supportMap = supportIndex(trace);
  const sourceKeys = new Set((initialFacts || []).map((f) => codeFact(f).replace(/ \.$/, '')));
  const ruleMap = new Map((rules || []).map((r) => [r.id, r]));
  const facts = [];
  const seen = new Set();
  for (const f of selected || []) {
    const key = codeFact(f).replace(/ \.$/, '');
    if (!seen.has(key)) { seen.add(key); facts.push(key); }
  }
  const focus = facts.slice(-limit).reverse();
  if (!focus.length) return [];
  const lines = [];
  lines.push('Selected explanation support:');
  for (const fact of focus) {
    lines.push(...supportTreeLines(fact, supportMap, sourceKeys, ruleMap).map((line) => '  ' + line));
  }
  return lines;
}
function evidenceSummaryLine(mode) {
  if (mode === 'query') return 'The query-selected facts are serialized in the Formal TriG Output section.';
  if (mode === 'formula') return 'The formula-valued facts are serialized in the Formal TriG Output section.';
  return 'The selected facts are serialized in the Formal TriG Output section.';
}
function renderStructuredOutput({ title, graph, queries = [], rules = [], initialFacts = [], trace = [], mode = 'derived' }) {
  let selected = [];
  if (mode === 'query') selected = queryFacts(graph, queries, rules);
  else if (mode === 'formula') selected = graph.facts.filter((f) => f.o && f.o.kind === 'formula');
  else selected = derivedFacts(graph, initialFacts);
  if (!selected.length) selected = graph.facts.slice(0, 30);

  const derived = derivedFacts(graph, initialFacts);
  const keyFact = selected[selected.length - 1];
  const lines = [];
  lines.push('# ' + title);
  lines.push('');
  lines.push('## Entailment');
  if (mode === 'query') {
    lines.push('The compiled query selected ' + selected.length + ' fact(s) after the rule closure was computed.');
  } else if (mode === 'formula') {
    lines.push('The derivation produced ' + selected.length + ' formula-valued entailment(s).');
  } else {
    lines.push('The derivation produced ' + derived.length + ' new fact(s) from ' + initialFacts.length + ' stated fact(s).');
  }
  if (keyFact) lines.push('Main entailment: **' + factSentence(keyFact) + '**');
  const bullets = selected.slice(-6).reverse();
  if (bullets.length) {
    lines.push('');
    lines.push('Selected entailments:');
    for (const fact of bullets) lines.push('- ' + codeFact(fact));
  }
  lines.push('');
  lines.push('## Explanation');
  const ordinaryRules = (rules || []).filter((r) => r.kind !== 'fuse').length;
  const fuses = (rules || []).filter((r) => r.kind === 'fuse').length;
  lines.push('Starts with ' + initialFacts.length + ' source fact(s), applies ' + ordinaryRules + ' rule(s), and reaches a fixpoint.');
  if (queries.length) lines.push('The log:query projection then keeps only the matching fact(s) shown above.');
  if (fuses) lines.push('The run also validates ' + fuses + ' fuse(s) for forbidden patterns.');
  const apps = traceApplications(trace, rules);
  if (apps.length) {
    lines.push('');
    lines.push('Derivation steps:');
    const sourceKeys = new Set((initialFacts || []).map((f) => codeFact(f).replace(/ \.$/, '')));
    for (const app of apps) {
      const produced = app.facts.slice(0, 4).map((f) => compactSupportFactText(f) + ' .').join(', ');
      const more = app.facts.length > 4 ? ', … +' + (app.facts.length - 4) + ' more' : '';
      lines.push('- ' + describeRule(app.rule) + ' derives ' + produced + more);
      if (app.supportFacts && app.supportFacts.length) {
        const used = app.supportFacts.slice(0, 4).map((fact) => compactSupportFactText(fact) + ' . ' + (sourceKeys.has(fact) ? '_(source)_' : '_(derived)_')).join('; ');
        const omitted = app.supportFacts.length > 4 ? '; … +' + (app.supportFacts.length - 4) + ' more premise fact(s)' : '';
        lines.push('  - Uses: ' + used + omitted);
      } else {
        lines.push('  - Uses: no graph premises; built-ins/constants satisfied the rule.');
      }
    }
  }
  const supportLines = conclusionSupportSection(selected, trace, rules, initialFacts);
  if (supportLines.length) {
    lines.push('');
    lines.push(...supportLines);
  }
  lines.push('');
  lines.push(evidenceSummaryLine(mode));
  return lines.join('\n') + '\n';
}
function renderRawOutput(graph, queries = [], rules = [], initialFacts = []) {
  const outs = outputStrings(graph);
  if (outs.length) return outs.join('');
  if (queries && queries.length) {
    const selected = queryFacts(graph, queries, rules);
    if (selected.length) return selected.map((f) => codeFact(f)).join('\n') + '\n';
    return '';
  }
  const formulaFacts = graph.facts.filter((f) => f.o && f.o.kind === 'formula');
  if (formulaFacts.length) return formulaFacts.map((f) => codeFact(f)).join('\n') + '\n';
  const derived = derivedFacts(graph, initialFacts);
  const selected = derived.length ? derived : graph.facts.slice(0, 30);
  return selected.map((f) => codeFact(f)).join('\n') + '\n';
}
function dedupeExplanationHeadings(text) {
  let seen = false;
  return String(text || '').replace(/^##\s+Explanation\s*$/gmi, () => {
    if (seen) return '';
    seen = true;
    return '## Explanation';
  });
}
function normalizePublicReport(markdown, title) {
  let text = String(markdown || '').trimEnd();
  if (!/^\s*#\s+/m.test(text)) text = '# ' + title + '\n\n' + text;
  if (!/^##\s+Entailment\s*$/mi.test(text)) {
    text = text.replace(/^(#\s+[^\n]+\n*)/, '$1\n## Entailment\n');
  }
  if (!/^##\s+Explanation\s*$/mi.test(text)) {
    text += '\n\n## Explanation\nNo additional explanation was provided by the generated output.';
  }
  text = text.replace(/^##\s+([^\n]+?)\s*$/gm, (line, heading) => {
    const normalized = heading.trim().toLowerCase();
    if (normalized === 'insight' || normalized === 'conclusion' || normalized === 'entailment' || normalized === 'explanation') return '## ' + (normalized === 'explanation' ? 'Explanation' : 'Entailment');
    return '**' + heading.trim() + '**';
  });
  text = dedupeExplanationHeadings(text);
  return text.trimEnd() + '\n';
}
function markdownize(raw, title) {
  let text = String(raw || '');
  text = text
    .replace(/===\s*Answer\s*===/g, '## Entailment')
    .replace(/===\s*Reason\s+Why\s*===/gi, '## Explanation')
    .replace(/===\s*Explanation\s*===/gi, '## Explanation')
    .replace(/===\s*([^=]+?)\s*===/g, (_, h) => '**' + h.trim() + '**');
  text = text.replace(/^C(\d+)\s+OK\s*-\s*/gm, 'C$1: ');
  text = dedupeExplanationHeadings(text);
  if (!text.trim()) text = '## Entailment\nNo log:outputString facts were derived.\n\n## Explanation\nThe compiled derivation did not produce authored report text.';
  return normalizePublicReport(text, title);
}
function authoredSupportAppendix(graph, queries, rules, initialFacts, trace) {
  const derived = derivedFacts(graph, initialFacts);
  let selected = [];
  if (queries && queries.length) selected = queryFacts(graph, queries, rules);
  else if (graph.facts.some((f) => f.o && f.o.kind === 'formula')) selected = graph.facts.filter((f) => f.o && f.o.kind === 'formula');
  else selected = derived;
  const lines = [];
  const ordinaryRules = (rules || []).filter((r) => r.kind !== 'fuse').length;
  const apps = traceApplications(trace, rules, 6);
  const supportLines = conclusionSupportSection(selected, trace, rules, initialFacts, 4);
  if (!apps.length && !supportLines.length) return '';
  lines.push('**Generated derivation support**');
  lines.push('');
  lines.push('Compiled support: ' + initialFacts.length + ' source fact(s), ' + ordinaryRules + ' rule(s), fixpoint reached before rendering.');
  if (apps.length) {
    lines.push('');
    lines.push('Derivation steps:');
    const sourceKeys = new Set((initialFacts || []).map((f) => codeFact(f).replace(/ \.$/, '')));
    for (const app of apps) {
      const produced = app.facts.slice(0, 4).map((f) => compactSupportFactText(f) + ' .').join(', ');
      const more = app.facts.length > 4 ? ', … +' + (app.facts.length - 4) + ' more' : '';
      lines.push('- ' + describeRule(app.rule) + ' derives ' + produced + more);
      if (app.supportFacts && app.supportFacts.length) {
        const used = app.supportFacts.slice(0, 4).map((fact) => compactSupportFactText(fact) + ' . ' + (sourceKeys.has(fact) ? '_(source)_' : '_(derived)_')).join('; ');
        const omitted = app.supportFacts.length > 4 ? '; … +' + (app.supportFacts.length - 4) + ' more premise fact(s)' : '';
        lines.push('  - Uses: ' + used + omitted);
      } else {
        lines.push('  - Uses: no graph premises; built-ins/constants satisfied the rule.');
      }
    }
  }
  if (supportLines.length) {
    lines.push('');
    lines.push(...supportLines);
  }
  return lines.join('\n');
}
function appendAuthoredExplanation(markdown, graph, queries, rules, initialFacts, trace) {
  const appendix = authoredSupportAppendix(graph, queries, rules, initialFacts, trace);
  if (!appendix) return markdown;
  return markdown.trimEnd() + '\n\n' + appendix + '\n';
}
function renderPresentation(graph, queries, rules, initialFacts, title, trace) {
  const outs = outputStrings(graph);
  if (outs.length) return appendAuthoredExplanation(markdownize(outs.join(''), title), graph, queries, rules, initialFacts, trace);
  if (queries && queries.length) return renderStructuredOutput({ title, graph, queries, rules, initialFacts, trace, mode: 'query' });
  if (graph.facts.some((f) => f.o && f.o.kind === 'formula')) return renderStructuredOutput({ title, graph, queries, rules, initialFacts, trace, mode: 'formula' });
  return renderStructuredOutput({ title, graph, queries, rules, initialFacts, trace, mode: 'derived' });
}

const NAME = "digital_product_passport";
const TITLE = "Digital Product Passport";
const EXPECTED_INPUT_FACTS = 90;
const RULES = [
  {
    "kind": "rule",
    "id": 1,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":ACME_X1000_SN123"
        },
        "p": {
          "kind": "iri",
          "value": ":hasComponent"
        },
        "o": {
          "kind": "var",
          "value": "c"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "c"
        },
        "p": {
          "kind": "iri",
          "value": ":containsMaterial"
        },
        "o": {
          "kind": "var",
          "value": "m"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "m"
        },
        "p": {
          "kind": "iri",
          "value": ":criticalRawMaterial"
        },
        "o": {
          "kind": "lit",
          "value": true
        }
      }
    ],
    "head": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":exposesCriticalMaterial"
        },
        "o": {
          "kind": "var",
          "value": "m"
        }
      }
    ],
    "bodyComment": [
      ":ACME_X1000_SN123 :hasComponent ?c",
      "?c :containsMaterial ?m",
      "?m :criticalRawMaterial true"
    ],
    "headComment": [
      ":passport :exposesCriticalMaterial ?m"
    ]
  },
  {
    "kind": "rule",
    "id": 2,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":ACME_X1000_SN123"
        },
        "p": {
          "kind": "iri",
          "value": ":hasComponent"
        },
        "o": {
          "kind": "var",
          "value": "c"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "c"
        },
        "p": {
          "kind": "iri",
          "value": ":massG"
        },
        "o": {
          "kind": "var",
          "value": "m"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "c"
        },
        "p": {
          "kind": "iri",
          "value": ":recycledMassG"
        },
        "o": {
          "kind": "var",
          "value": "r"
        }
      }
    ],
    "head": [
      {
        "s": {
          "kind": "iri",
          "value": ":MassRollup"
        },
        "p": {
          "kind": "iri",
          "value": ":componentMass"
        },
        "o": {
          "kind": "var",
          "value": "m"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":MassRollup"
        },
        "p": {
          "kind": "iri",
          "value": ":componentRecycledMass"
        },
        "o": {
          "kind": "var",
          "value": "r"
        }
      }
    ],
    "bodyComment": [
      ":ACME_X1000_SN123 :hasComponent ?c",
      "?c :massG ?m",
      "?c :recycledMassG ?r"
    ],
    "headComment": [
      ":MassRollup :componentMass ?m",
      ":MassRollup :componentRecycledMass ?r"
    ]
  },
  {
    "kind": "rule",
    "id": 3,
    "body": [
      {
        "s": {
          "kind": "list",
          "items": [
            {
              "kind": "lit",
              "value": 48
            },
            {
              "kind": "lit",
              "value": 32
            },
            {
              "kind": "lit",
              "value": 25
            }
          ]
        },
        "p": {
          "kind": "iri",
          "value": "math:sum"
        },
        "o": {
          "kind": "var",
          "value": "totalMass"
        }
      },
      {
        "s": {
          "kind": "list",
          "items": [
            {
              "kind": "lit",
              "value": 0
            },
            {
              "kind": "lit",
              "value": 12
            },
            {
              "kind": "lit",
              "value": 2
            }
          ]
        },
        "p": {
          "kind": "iri",
          "value": "math:sum"
        },
        "o": {
          "kind": "var",
          "value": "recycledMass"
        }
      },
      {
        "s": {
          "kind": "list",
          "items": [
            {
              "kind": "var",
              "value": "recycledMass"
            },
            {
              "kind": "lit",
              "value": 100
            }
          ]
        },
        "p": {
          "kind": "iri",
          "value": "math:product"
        },
        "o": {
          "kind": "var",
          "value": "pctNumerator"
        }
      },
      {
        "s": {
          "kind": "list",
          "items": [
            {
              "kind": "var",
              "value": "pctNumerator"
            },
            {
              "kind": "var",
              "value": "totalMass"
            }
          ]
        },
        "p": {
          "kind": "iri",
          "value": "math:integerQuotient"
        },
        "o": {
          "kind": "var",
          "value": "recycledPct"
        }
      }
    ],
    "head": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":totalMassG"
        },
        "o": {
          "kind": "var",
          "value": "totalMass"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":recycledMassG"
        },
        "o": {
          "kind": "var",
          "value": "recycledMass"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":recycledPct"
        },
        "o": {
          "kind": "var",
          "value": "recycledPct"
        }
      }
    ],
    "bodyComment": [
      "(48 32 25) math:sum ?totalMass",
      "(0 12 2) math:sum ?recycledMass",
      "(?recycledMass 100) math:product ?pctNumerator",
      "(?pctNumerator ?totalMass) math:integerQuotient ?recycledPct"
    ],
    "headComment": [
      ":passport :totalMassG ?totalMass",
      ":passport :recycledMassG ?recycledMass",
      ":passport :recycledPct ?recycledPct"
    ]
  },
  {
    "kind": "rule",
    "id": 4,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":Footprint"
        },
        "p": {
          "kind": "iri",
          "value": ":manufacturingGCO2e"
        },
        "o": {
          "kind": "var",
          "value": "mfg"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":Footprint"
        },
        "p": {
          "kind": "iri",
          "value": ":transportGCO2e"
        },
        "o": {
          "kind": "var",
          "value": "transport"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":Footprint"
        },
        "p": {
          "kind": "iri",
          "value": ":usePhaseGCO2e"
        },
        "o": {
          "kind": "var",
          "value": "use"
        }
      },
      {
        "s": {
          "kind": "list",
          "items": [
            {
              "kind": "var",
              "value": "mfg"
            },
            {
              "kind": "var",
              "value": "transport"
            },
            {
              "kind": "var",
              "value": "use"
            }
          ]
        },
        "p": {
          "kind": "iri",
          "value": "math:sum"
        },
        "o": {
          "kind": "var",
          "value": "total"
        }
      }
    ],
    "head": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":lifecycleFootprintGCO2e"
        },
        "o": {
          "kind": "var",
          "value": "total"
        }
      }
    ],
    "bodyComment": [
      ":Footprint :manufacturingGCO2e ?mfg",
      ":Footprint :transportGCO2e ?transport",
      ":Footprint :usePhaseGCO2e ?use",
      "(?mfg ?transport ?use) math:sum ?total"
    ],
    "headComment": [
      ":passport :lifecycleFootprintGCO2e ?total"
    ]
  },
  {
    "kind": "rule",
    "id": 5,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":Policy"
        },
        "p": {
          "kind": "iri",
          "value": ":publicDocType"
        },
        "o": {
          "kind": "var",
          "value": "docType"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "doc"
        },
        "p": {
          "kind": "iri",
          "value": "rdf:type"
        },
        "o": {
          "kind": "iri",
          "value": ":Document"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "doc"
        },
        "p": {
          "kind": "iri",
          "value": ":docType"
        },
        "o": {
          "kind": "var",
          "value": "docType"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "doc"
        },
        "p": {
          "kind": "iri",
          "value": ":section"
        },
        "o": {
          "kind": "lit",
          "value": "public"
        }
      }
    ],
    "head": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":hasRequiredPublicDocType"
        },
        "o": {
          "kind": "var",
          "value": "docType"
        }
      }
    ],
    "bodyComment": [
      ":Policy :publicDocType ?docType",
      "?doc rdf:type :Document",
      "?doc :docType ?docType",
      "?doc :section \"public\""
    ],
    "headComment": [
      ":passport :hasRequiredPublicDocType ?docType"
    ]
  },
  {
    "kind": "rule",
    "id": 6,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":Policy"
        },
        "p": {
          "kind": "iri",
          "value": ":restrictedDocType"
        },
        "o": {
          "kind": "var",
          "value": "docType"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "doc"
        },
        "p": {
          "kind": "iri",
          "value": "rdf:type"
        },
        "o": {
          "kind": "iri",
          "value": ":Document"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "doc"
        },
        "p": {
          "kind": "iri",
          "value": ":docType"
        },
        "o": {
          "kind": "var",
          "value": "docType"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "doc"
        },
        "p": {
          "kind": "iri",
          "value": ":section"
        },
        "o": {
          "kind": "lit",
          "value": "restricted"
        }
      }
    ],
    "head": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":keepsRestrictedDocTypeRestricted"
        },
        "o": {
          "kind": "var",
          "value": "docType"
        }
      }
    ],
    "bodyComment": [
      ":Policy :restrictedDocType ?docType",
      "?doc rdf:type :Document",
      "?doc :docType ?docType",
      "?doc :section \"restricted\""
    ],
    "headComment": [
      ":passport :keepsRestrictedDocTypeRestricted ?docType"
    ]
  },
  {
    "kind": "rule",
    "id": 7,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":ACME_X1000_SN123"
        },
        "p": {
          "kind": "iri",
          "value": ":hasComponent"
        },
        "o": {
          "kind": "var",
          "value": "battery"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "battery"
        },
        "p": {
          "kind": "iri",
          "value": ":type"
        },
        "o": {
          "kind": "iri",
          "value": ":Battery"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "battery"
        },
        "p": {
          "kind": "iri",
          "value": ":replaceable"
        },
        "o": {
          "kind": "lit",
          "value": true
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":Doc_RepairGuide"
        },
        "p": {
          "kind": "iri",
          "value": ":section"
        },
        "o": {
          "kind": "lit",
          "value": "public"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":Doc_RepairGuide"
        },
        "p": {
          "kind": "iri",
          "value": ":declares"
        },
        "o": {
          "kind": "iri",
          "value": ":BatteryReplacementSupported"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":hasRequiredPublicDocType"
        },
        "o": {
          "kind": "iri",
          "value": ":UserManual"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":hasRequiredPublicDocType"
        },
        "o": {
          "kind": "iri",
          "value": ":RepairGuide"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":hasRequiredPublicDocType"
        },
        "o": {
          "kind": "iri",
          "value": ":SparePartsCatalog"
        }
      }
    ],
    "head": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":repairFriendly"
        },
        "o": {
          "kind": "lit",
          "value": true
        }
      }
    ],
    "bodyComment": [
      ":ACME_X1000_SN123 :hasComponent ?battery",
      "?battery :type :Battery",
      "?battery :replaceable true",
      ":Doc_RepairGuide :section \"public\"",
      ":Doc_RepairGuide :declares :BatteryReplacementSupported",
      ":passport :hasRequiredPublicDocType :UserManual",
      ":passport :hasRequiredPublicDocType :RepairGuide",
      ":passport :hasRequiredPublicDocType :SparePartsCatalog"
    ],
    "headComment": [
      ":passport :repairFriendly true"
    ]
  },
  {
    "kind": "rule",
    "id": 8,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":publicEndpoint"
        },
        "o": {
          "kind": "var",
          "value": "endpoint"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":ACME_X1000_SN123"
        },
        "p": {
          "kind": "iri",
          "value": ":digitalLink"
        },
        "o": {
          "kind": "var",
          "value": "endpoint"
        }
      }
    ],
    "head": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":digitalLinkMatchesEndpoint"
        },
        "o": {
          "kind": "lit",
          "value": true
        }
      }
    ],
    "bodyComment": [
      ":passport :publicEndpoint ?endpoint",
      ":ACME_X1000_SN123 :digitalLink ?endpoint"
    ],
    "headComment": [
      ":passport :digitalLinkMatchesEndpoint true"
    ]
  },
  {
    "kind": "rule",
    "id": 9,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":Event_Mfg_01"
        },
        "p": {
          "kind": "iri",
          "value": ":onDate"
        },
        "o": {
          "kind": "var",
          "value": "d1"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":Event_Sale_01"
        },
        "p": {
          "kind": "iri",
          "value": ":onDate"
        },
        "o": {
          "kind": "var",
          "value": "d2"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":Event_Repair_01"
        },
        "p": {
          "kind": "iri",
          "value": ":onDate"
        },
        "o": {
          "kind": "var",
          "value": "d3"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "d1"
        },
        "p": {
          "kind": "iri",
          "value": "string:notGreaterThan"
        },
        "o": {
          "kind": "var",
          "value": "d2"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "d2"
        },
        "p": {
          "kind": "iri",
          "value": "string:notGreaterThan"
        },
        "o": {
          "kind": "var",
          "value": "d3"
        }
      }
    ],
    "head": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":lifecycleChronological"
        },
        "o": {
          "kind": "lit",
          "value": true
        }
      }
    ],
    "bodyComment": [
      ":Event_Mfg_01 :onDate ?d1",
      ":Event_Sale_01 :onDate ?d2",
      ":Event_Repair_01 :onDate ?d3",
      "?d1 string:notGreaterThan ?d2",
      "?d2 string:notGreaterThan ?d3"
    ],
    "headComment": [
      ":passport :lifecycleChronological true"
    ]
  },
  {
    "kind": "rule",
    "id": 10,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":totalMassG"
        },
        "o": {
          "kind": "var",
          "value": "totalMass"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":recycledMassG"
        },
        "o": {
          "kind": "var",
          "value": "recycledMass"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "totalMass"
        },
        "p": {
          "kind": "iri",
          "value": "math:greaterThan"
        },
        "o": {
          "kind": "lit",
          "value": 0
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "recycledMass"
        },
        "p": {
          "kind": "iri",
          "value": "math:notGreaterThan"
        },
        "o": {
          "kind": "var",
          "value": "totalMass"
        }
      }
    ],
    "head": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":massBalanced"
        },
        "o": {
          "kind": "lit",
          "value": true
        }
      }
    ],
    "bodyComment": [
      ":passport :totalMassG ?totalMass",
      ":passport :recycledMassG ?recycledMass",
      "?totalMass math:greaterThan 0",
      "?recycledMass math:notGreaterThan ?totalMass"
    ],
    "headComment": [
      ":passport :massBalanced true"
    ]
  },
  {
    "kind": "rule",
    "id": 11,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":massBalanced"
        },
        "o": {
          "kind": "lit",
          "value": true
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":recycledPct"
        },
        "o": {
          "kind": "var",
          "value": "pct"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":lifecycleFootprintGCO2e"
        },
        "o": {
          "kind": "var",
          "value": "footprint"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":exposesCriticalMaterial"
        },
        "o": {
          "kind": "iri",
          "value": ":Lithium"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":exposesCriticalMaterial"
        },
        "o": {
          "kind": "iri",
          "value": ":Cobalt"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":repairFriendly"
        },
        "o": {
          "kind": "lit",
          "value": true
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":hasRequiredPublicDocType"
        },
        "o": {
          "kind": "iri",
          "value": ":UserManual"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":hasRequiredPublicDocType"
        },
        "o": {
          "kind": "iri",
          "value": ":RepairGuide"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":hasRequiredPublicDocType"
        },
        "o": {
          "kind": "iri",
          "value": ":SparePartsCatalog"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":keepsRestrictedDocTypeRestricted"
        },
        "o": {
          "kind": "iri",
          "value": ":DeclarationOfConformity"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":keepsRestrictedDocTypeRestricted"
        },
        "o": {
          "kind": "iri",
          "value": ":SubstanceDeclaration"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":digitalLinkMatchesEndpoint"
        },
        "o": {
          "kind": "lit",
          "value": true
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":lifecycleChronological"
        },
        "o": {
          "kind": "lit",
          "value": true
        }
      }
    ],
    "head": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":decision"
        },
        "o": {
          "kind": "lit",
          "value": "PASS"
        }
      }
    ],
    "bodyComment": [
      ":passport :massBalanced true",
      ":passport :recycledPct ?pct",
      ":passport :lifecycleFootprintGCO2e ?footprint",
      ":passport :exposesCriticalMaterial :Lithium",
      ":passport :exposesCriticalMaterial :Cobalt",
      ":passport :repairFriendly true",
      ":passport :hasRequiredPublicDocType :UserManual",
      ":passport :hasRequiredPublicDocType :RepairGuide",
      ":passport :hasRequiredPublicDocType :SparePartsCatalog",
      ":passport :keepsRestrictedDocTypeRestricted :DeclarationOfConformity",
      ":passport :keepsRestrictedDocTypeRestricted :SubstanceDeclaration",
      ":passport :digitalLinkMatchesEndpoint true",
      ":passport :lifecycleChronological true"
    ],
    "headComment": [
      ":passport :decision \"PASS\""
    ]
  },
  {
    "kind": "fuse",
    "id": 12,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":decision"
        },
        "o": {
          "kind": "var",
          "value": "decision"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "decision"
        },
        "p": {
          "kind": "iri",
          "value": "log:notEqualTo"
        },
        "o": {
          "kind": "lit",
          "value": "PASS"
        }
      }
    ],
    "bodyComment": [
      ":passport :decision ?decision",
      "?decision log:notEqualTo \"PASS\""
    ],
    "headComment": []
  },
  {
    "kind": "fuse",
    "id": 13,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":recycledMassG"
        },
        "o": {
          "kind": "var",
          "value": "r"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":totalMassG"
        },
        "o": {
          "kind": "var",
          "value": "t"
        }
      },
      {
        "s": {
          "kind": "var",
          "value": "r"
        },
        "p": {
          "kind": "iri",
          "value": "math:greaterThan"
        },
        "o": {
          "kind": "var",
          "value": "t"
        }
      }
    ],
    "bodyComment": [
      ":passport :recycledMassG ?r",
      ":passport :totalMassG ?t",
      "?r math:greaterThan ?t"
    ],
    "headComment": []
  },
  {
    "kind": "rule",
    "id": 14,
    "body": [
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":decision"
        },
        "o": {
          "kind": "lit",
          "value": "PASS"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":totalMassG"
        },
        "o": {
          "kind": "var",
          "value": "mass"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":recycledPct"
        },
        "o": {
          "kind": "var",
          "value": "pct"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":lifecycleFootprintGCO2e"
        },
        "o": {
          "kind": "var",
          "value": "footprint"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":passport"
        },
        "p": {
          "kind": "iri",
          "value": ":publicEndpoint"
        },
        "o": {
          "kind": "var",
          "value": "endpoint"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":ACME_X1000_SN123"
        },
        "p": {
          "kind": "iri",
          "value": ":model"
        },
        "o": {
          "kind": "var",
          "value": "model"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":ACME_X1000_SN123"
        },
        "p": {
          "kind": "iri",
          "value": ":serialNumber"
        },
        "o": {
          "kind": "var",
          "value": "serial"
        }
      },
      {
        "s": {
          "kind": "list",
          "items": [
            {
              "kind": "lit",
              "value": "=== Answer ===\nPassport decision : PASS for %s %s.\nrecycled content : %d%%\nlifecycle footprint : %d gCO2e\ntotal component mass : %d g\ncritical raw materials : Lithium, Cobalt\ncircularity hint : repairFriendly\npublic endpoint : %s\n\n=== Explanation ===\nThe passport folds the explicit component list to derive total mass and recycled mass, then computes an integer recycled-content percentage. Lifecycle footprint is derived by summing manufacturing, transport, and use-phase emissions. The product is repair-friendly because the battery is replaceable and the public passport section exposes repair, spare-parts, and manual documentation. Restricted declarations remain in the restricted section.\n\nComponent roll-up:\nBatteryPack-01 Battery mass=48g recycled=0g materials=Lithium, Cobalt, Nickel replaceable=yes\nChassis-01 Housing mass=32g recycled=12g materials=Aluminium replaceable=no\nMainboard-01 Electronics mass=25g recycled=2g materials=Copper, GoldTrace replaceable=no\nPublic documents:\nDoc-UserManual UserManual https://example.org/manuals/acme-x1000\nDoc-RepairGuide RepairGuide https://example.org/repair/acme-x1000\nDoc-SpareParts SparePartsCatalog https://example.org/spares/acme-x1000"
            },
            {
              "kind": "var",
              "value": "model"
            },
            {
              "kind": "var",
              "value": "serial"
            },
            {
              "kind": "var",
              "value": "pct"
            },
            {
              "kind": "var",
              "value": "footprint"
            },
            {
              "kind": "var",
              "value": "mass"
            },
            {
              "kind": "var",
              "value": "endpoint"
            }
          ]
        },
        "p": {
          "kind": "iri",
          "value": "string:format"
        },
        "o": {
          "kind": "var",
          "value": "Block"
        }
      }
    ],
    "head": [
      {
        "s": {
          "kind": "iri",
          "value": ":digitalProductPassport"
        },
        "p": {
          "kind": "iri",
          "value": "log:outputString"
        },
        "o": {
          "kind": "var",
          "value": "Block"
        }
      },
      {
        "s": {
          "kind": "iri",
          "value": ":digitalProductPassport"
        },
        "p": {
          "kind": "iri",
          "value": ":decision"
        },
        "o": {
          "kind": "lit",
          "value": "PASS"
        }
      }
    ],
    "bodyComment": [
      ":passport :decision \"PASS\"",
      ":passport :totalMassG ?mass",
      ":passport :recycledPct ?pct",
      ":passport :lifecycleFootprintGCO2e ?footprint",
      ":passport :publicEndpoint ?endpoint",
      ":ACME_X1000_SN123 :model ?model",
      ":ACME_X1000_SN123 :serialNumber ?serial",
      "(\"=== Answer ===\\nPassport decision : PASS for %s %s.\\nrecycled content : %d%%\\nlifecycle footprint : %d gCO2e\\ntotal component mass : %d g\\ncritical raw materials : Lithium, Cobalt\\ncircularity hint : repairFriendly\\npublic endpoint : %s\\n\\n=== Explanation ===\\nThe passport folds the explicit component list to derive total mass and recycled mass, then computes an integer recycled-content percentage. Lifecycle footprint is derived by summing manufacturing, transport, and use-phase emissions. The product is repair-friendly because the battery is replaceable and the public passport section exposes repair, spare-parts, and manual documentation. Restricted declarations remain in the restricted section.\\n\\nComponent roll-up:\\nBatteryPack-01 Battery mass=48g recycled=0g materials=Lithium, Cobalt, Nickel replaceable=yes\\nChassis-01 Housing mass=32g recycled=12g materials=Aluminium replaceable=no\\nMainboard-01 Electronics mass=25g recycled=2g materials=Copper, GoldTrace replaceable=no\\nPublic documents:\\nDoc-UserManual UserManual https://example.org/manuals/acme-x1000\\nDoc-RepairGuide RepairGuide https://example.org/repair/acme-x1000\\nDoc-SpareParts SparePartsCatalog https://example.org/spares/acme-x1000\" ?model ?serial ?pct ?footprint ?mass ?endpoint) string:format ?Block"
    ],
    "headComment": [
      ":digitalProductPassport log:outputString ?Block",
      ":digitalProductPassport :decision \"PASS\""
    ]
  }
];
const QUERIES = [
  {
    "id": 1,
    "premise": [
      {
        "s": {
          "kind": "iri",
          "value": ":digitalProductPassport"
        },
        "p": {
          "kind": "iri",
          "value": ":decision"
        },
        "o": {
          "kind": "var",
          "value": "Decision"
        }
      }
    ],
    "conclusion": [
      {
        "s": {
          "kind": "iri",
          "value": ":digitalProductPassport"
        },
        "p": {
          "kind": "iri",
          "value": ":decision"
        },
        "o": {
          "kind": "var",
          "value": "Decision"
        }
      }
    ],
    "premiseComment": [
      ":digitalProductPassport :decision ?Decision"
    ],
    "conclusionComment": [
      ":digitalProductPassport :decision ?Decision"
    ]
  }
];
const DOC_MARKDOWN = "# Digital Product Passport\n\nGenerated by `see.js` from a Notation3 source file.\n\nN3-compiled version of the smartphone Digital Product Passport example. The\nrules fold component mass, recycled content, critical raw materials, public\ndocuments, lifecycle footprint, and access-policy validations into a public PASS.\n\n## Compilation summary\n\n- Example name: `digital_product_passport`\n- Input facts emitted: 90\n- Forward rules compiled: 12\n- Backward predicate rules compiled: 0\n- Fuses compiled: 2\n- Predicate count: 53\n\n## Built-ins used\n\n- `log:notEqualTo`\n- `log:outputString`\n- `math:greaterThan`\n- `math:integerQuotient`\n- `math:notGreaterThan`\n- `math:product`\n- `math:sum`\n- `string:format`\n- `string:notGreaterThan`\n\n## Runtime model\n\nThe generated `examples/digital_product_passport.js` is a specialized JavaScript derivation program. For ordinary sources, `see.js` emits the source facts as `examples/input/digital_product_passport.trig`. For rules-only sources, generation can reuse an existing external evidence file such as `examples/input/digital-product-passport.trig` or `examples/input/digital_product_passport.trig`. The runner reads that TriG evidence directly and performs a local fixpoint derivation; it does not parse the program source or call an external reasoner.\n\n## Output model\n\nRunning `node examples/digital_product_passport.js` produces a SEE-style Markdown report with an **Entailment** section, an **Explanation** section, and a **Formal TriG Output** section containing the selected derived/query facts.\n";
function seeMetadata(data) { return (data && data.__see) || {}; }
function trustedDerivation(data) { const meta = seeMetadata(data); const facts = data && Array.isArray(data.facts) ? data.facts : []; const expectedFacts = EXPECTED_INPUT_FACTS || Number(meta.InputFacts || 0); if (meta.SourceSHA256 && meta.SourceSHA256 !== "502e99d8e51a930eba50cb2411263cb6db5d98d63fe3dd48254612d993a9ab95") throw new Error('input evidence does not match the N3 source compiled into this example'); const result = saturate(facts, RULES); const rawOutput = renderRawOutput(result.graph, QUERIES, RULES, facts); fail('Compiled N3 derivation failed', { 'input evidence metadata is present and matches compiled source': meta.SourceSHA256 === "502e99d8e51a930eba50cb2411263cb6db5d98d63fe3dd48254612d993a9ab95", 'input evidence facts were loaded': expectedFacts > 0 ? facts.length === expectedFacts : facts.length >= 0, 'compiled rules were loaded': RULES.length === 14, 'compiled query directives were loaded': QUERIES.length === 1, 'a derivation fixpoint was reached': result.graph.facts.length >= facts.length, 'query or output facts were produced': rawOutput.length > 0 }); return { ...result, rawOutput, inputFacts: facts }; }
function snapshotMarkdown(markdown) { return markdown.split(/\n/).map((line) => line ? line + '  \n' : '\n').join(''); }
function prefixLinesFromTrig(trig) {
  const out = [];
  const seen = new Set();
  for (const rawLine of String(trig || '').split(String.fromCharCode(10))) {
    const trimmed = rawLine.replace(String.fromCharCode(13), '').trim();
    if (!trimmed.toLowerCase().startsWith('@prefix ')) continue;
    if (!seen.has(trimmed)) { seen.add(trimmed); out.push(trimmed); }
  }
  if (!out.some((line) => line.toLowerCase().startsWith('@prefix rdf:'))) out.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
  return out;
}
function formalOutputFacts(graph, queries, rules, initialFacts) {
  const base = initialKeys(initialFacts);
  const out = [];
  const seen = new Set();
  const add = (fact) => {
    if (!fact) return;
    const key = factKey(fact);
    if (!seen.has(key)) { seen.add(key); out.push(fact); }
  };
  if (queries && queries.length) {
    for (const fact of queryFacts(graph, queries, rules)) add(fact);
    return out;
  }
  for (const fact of derivedFacts(graph, initialFacts)) add(fact);
  if (!out.length) {
    for (const fact of graph.facts) if (fact.o && fact.o.kind === 'formula' && !base.has(factKey(fact))) add(fact);
  }
  return out;
}
function termHasTripleTerm(term) {
  if (!term) return false;
  if (term.kind === 'triple') return true;
  if (term.kind === 'list') return term.items.some(termHasTripleTerm);
  if (term.kind === 'formula') return term.atoms.some(atomHasTripleTerm);
  return false;
}
function atomHasTripleTerm(atom) { return termHasTripleTerm(atom.s) || termHasTripleTerm(atom.p) || termHasTripleTerm(atom.o); }
function factsHaveTripleTerms(facts) { return (facts || []).some(atomHasTripleTerm); }
function trigHasVersion12(trig) { return /^s*(?:@version|VERSION)s+["']1.2["']/mi.test(String(trig || '')); }
function trigGraphBlock(label, atoms) {
  const lines = [label + ' {'];
  for (const atom of atoms || []) lines.push('  ' + atomToN3(atom) + ' .');
  lines.push('}');
  return lines;
}
function formalFactToTrigLines(fact, state) {
  if (fact.o && fact.o.kind === 'formula') {
    if (isIri(fact.p, 'log:nameOf')) return trigGraphBlock(termToN3(fact.s), fact.o.atoms);
    state.formulaCounter += 1;
    state.needOutPrefix = true;
    const label = 'out:formula' + state.formulaCounter;
    return [termToN3(fact.s) + ' ' + termToN3(fact.p) + ' ' + label + ' .', '', ...trigGraphBlock(label, fact.o.atoms)];
  }
  return [codeFact(fact)];
}
function trigMetadataBlock(trig) {
  const lines = String(trig || '').split(String.fromCharCode(10));
  const out = [];
  let depth = 0;
  let active = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!active && !trimmed.startsWith('in:metadata')) continue;
    active = true;
    out.push(line.replace(String.fromCharCode(13), ''));
    depth += (line.match(/{/g) || []).length;
    depth -= (line.match(/}/g) || []).length;
    if (active && depth <= 0) break;
  }
  return out.length ? out.join(String.fromCharCode(10)).trimEnd() : '';
}
function formalOutputToTrig(facts, trig) {
  const state = { formulaCounter: 0, needOutPrefix: false };
  const body = [];
  for (const fact of facts || []) {
    body.push(...formalFactToTrigLines(fact, state));
  }
  const metadata = trigMetadataBlock(trig);
  if (metadata) {
    if (body.length) body.push('');
    body.push(metadata);
  }
  if (!body.length) return '';
  const prefixes = prefixLinesFromTrig(trig);
  if (state.needOutPrefix && !prefixes.some((line) => line.toLowerCase().startsWith('@prefix out:'))) prefixes.push('@prefix out: <https://example.org/see/output#> .');
  const nl = String.fromCharCode(10);
  const version = factsHaveTripleTerms(facts) ? 'VERSION "1.2"' + nl + nl : '';
  return version + prefixes.join(nl) + nl + nl + body.join(nl);
}
function appendFormalTrigOutput(markdown, graph, queries, rules, initialFacts, data) {
  const trig = formalOutputToTrig(formalOutputFacts(graph, queries, rules, initialFacts), data && data.trig);
  if (!trig) return markdown;
  const nl = String.fromCharCode(10);
  const fence = String.fromCharCode(96).repeat(3);
  const fenced = trig.trimEnd().replace(new RegExp(fence, 'g'), '` ` `');
  return markdown.trimEnd() + nl + nl + '## Formal TriG Output' + nl + nl + fence + 'trig' + nl + fenced + nl + fence + nl;
}
function outputMarkdown() { const data = loadInput(NAME); const result = trustedDerivation(data); const markdown = renderPresentation(result.graph, QUERIES, RULES, result.inputFacts, TITLE, result.trace); return snapshotMarkdown(appendFormalTrigOutput(markdown, result.graph, QUERIES, RULES, result.inputFacts, data)); }
function documentationMarkdown() { return DOC_MARKDOWN; }
function writeArtefacts() { const outputDir = path.join(__dirname, 'output'); const docDir = path.join(__dirname, 'doc'); fs.mkdirSync(outputDir, { recursive: true }); fs.mkdirSync(docDir, { recursive: true }); fs.writeFileSync(path.join(outputDir, NAME + '.md'), outputMarkdown(), 'utf8'); fs.writeFileSync(path.join(docDir, NAME + '.md'), documentationMarkdown(), 'utf8'); }
function main(argv = process.argv.slice(2)) { if (argv.includes('--write') || argv.includes('--write-files') || argv.includes('--snapshot')) { writeArtefacts(); return; } if (argv.includes('--doc')) { process.stdout.write(documentationMarkdown()); return; } process.stdout.write(outputMarkdown()); }
if (require.main === module) main();
module.exports = { trustedDerivation, outputMarkdown, documentationMarkdown, writeArtefacts };
