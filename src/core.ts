// @ts-nocheck
/* eslint-disable */

// Node globals (not present in DOM typings)
declare var require: any;
declare var module: any;
declare var process: any;
'use strict';

/*
 * eyeling.js — A Notation3 (N3) reasoner in JavaScript
 *
 * High-level pipeline:
 *  1) Read an N3 file from disk.
 *  2) Lex it into Tokens.
 *  3) Parse tokens into:
 *     - ground triples (facts)
 *     - forward rules {premise} => {conclusion}.
 *     - backward rules {head} <= {body}.
 *  4) Run forward chaining to fixpoint.
 *     - premises are proven using backward rules + builtins.
 *  5) Print only newly derived forward facts with explanations.
 */

// -----------------------------------------------------------------------------
// Browser/Worker-safe version + crypto wiring
// -----------------------------------------------------------------------------
let version = 'dev';
try {
  // Node: keep package.json version if available
  if (typeof require === 'function') version = require('./package.json').version || version;
} catch (_) {}

let nodeCrypto = null;
try {
  // Node: crypto available
  if (typeof require === 'function') nodeCrypto = require('crypto');
} catch (_) {}

// ===========================================================================
// Namespace constants
// ===========================================================================

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';
const CRYPTO_NS = 'http://www.w3.org/2000/10/swap/crypto#';
const MATH_NS = 'http://www.w3.org/2000/10/swap/math#';
const TIME_NS = 'http://www.w3.org/2000/10/swap/time#';
const LIST_NS = 'http://www.w3.org/2000/10/swap/list#';
const LOG_NS = 'http://www.w3.org/2000/10/swap/log#';
const STRING_NS = 'http://www.w3.org/2000/10/swap/string#';
const SKOLEM_NS = 'https://eyereasoner.github.io/.well-known/genid/';
const RDF_JSON_DT = RDF_NS + 'JSON';

function resolveIriRef(ref, base) {
  if (!base) return ref;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) return ref; // already absolute
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}

function isRdfJsonDatatype(dt) {
  // dt comes from literalParts() and may be expanded or prefixed depending on parsing/printing.
  return dt === null || dt === RDF_JSON_DT || dt === 'rdf:JSON';
}

function termToJsonText(t) {
  if (!(t instanceof Literal)) return null;
  const [lex, dt] = literalParts(t.value);
  if (!isRdfJsonDatatype(dt)) return null;
  // decode escapes for short literals; long literals are taken verbatim
  return termToJsStringDecoded(t);
}

function makeRdfJsonLiteral(jsonText) {
  // Prefer a readable long literal when safe; fall back to short if needed.
  if (!jsonText.includes('"""')) {
    return internLiteral('"""' + jsonText + '"""^^<' + RDF_JSON_DT + '>');
  }
  return internLiteral(JSON.stringify(jsonText) + '^^<' + RDF_JSON_DT + '>');
}

// For a single reasoning run, this maps a canonical representation
// of the subject term in log:skolem to a Skolem IRI.
const skolemCache = new Map();

// -----------------------------------------------------------------------------
// Hot caches
// -----------------------------------------------------------------------------
const __literalPartsCache = new Map(); // lit string -> [lex, dt]
const __parseNumCache = new Map(); // lit string -> number|null
const __parseIntCache = new Map(); // lit string -> bigint|null
const __parseNumericInfoCache = new Map(); // lit string -> info|null

// Cache for string:jsonPointer: jsonText -> { parsed: any|null, ptrCache: Map<string, Term|null> }
const jsonPointerCache = new Map();

// -----------------------------------------------------------------------------
// log:content / log:semantics support (basic, synchronous)
// -----------------------------------------------------------------------------
// Cache dereferenced resources within a single run.
// Key is the dereferenced document IRI *without* fragment.
const __logContentCache = new Map(); // iri -> string | null (null means fetch/read failed)
const __logSemanticsCache = new Map(); // iri -> GraphTerm | null (null means parse failed)
const __logSemanticsOrErrorCache = new Map(); // iri -> Term (GraphTerm | Literal) for log:semanticsOrError
const __logConclusionCache = new WeakMap(); // GraphTerm -> GraphTerm (deductive closure)

// When enabled, force http:// IRIs to be dereferenced as https://
// (CLI: --enforce-https, API: reasonStream({ enforceHttps: true })).
let enforceHttpsEnabled = false;

function __maybeEnforceHttps(iri) {
  if (!enforceHttpsEnabled) return iri;
  return typeof iri === 'string' && iri.startsWith('http://') ? 'https://' + iri.slice('http://'.length) : iri;
}

// Environment detection (Node vs Browser/Worker).
// Eyeling is primarily synchronous, so we use sync XHR in browsers for log:content/log:semantics.
// Note: Browser fetches are subject to CORS; use CORS-enabled resources or a proxy.
const __IS_NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node);

function __hasXmlHttpRequest() {
  return typeof XMLHttpRequest !== 'undefined';
}

function __resolveBrowserUrl(ref) {
  if (!ref) return ref;
  // If already absolute, keep as-is.
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) return ref;
  const base =
    (typeof document !== 'undefined' && document.baseURI) || (typeof location !== 'undefined' && location.href) || '';
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}

function __fetchHttpTextSyncBrowser(url) {
  if (!__hasXmlHttpRequest()) return null;
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false); // synchronous
    try {
      xhr.setRequestHeader(
        'Accept',
        'text/n3, text/turtle, application/n-triples, application/n-quads, text/plain;q=0.1, */*;q=0.01',
      );
    } catch {
      // Some environments restrict setting headers (ignore).
    }
    xhr.send(null);
    const sc = xhr.status || 0;
    if (sc < 200 || sc >= 300) return null;
    return xhr.responseText;
  } catch {
    return null;
  }
}

function __normalizeDerefIri(iriNoFrag) {
  // In Node, treat non-http as local path; leave as-is.
  if (__IS_NODE) return __maybeEnforceHttps(iriNoFrag);
  // In browsers/workers, resolve relative references against the page URL.
  return __maybeEnforceHttps(__resolveBrowserUrl(iriNoFrag));
}

function __stripFragment(iri) {
  const i = iri.indexOf('#');
  return i >= 0 ? iri.slice(0, i) : iri;
}

function __isHttpIri(iri) {
  return typeof iri === 'string' && (iri.startsWith('http://') || iri.startsWith('https://'));
}

function __isFileIri(iri) {
  return typeof iri === 'string' && iri.startsWith('file://');
}

function __fileIriToPath(fileIri) {
  // Basic file:// URI decoding. Handles file:///abs/path and file://localhost/abs/path.
  try {
    const u = new URL(fileIri);
    return decodeURIComponent(u.pathname);
  } catch {
    return decodeURIComponent(fileIri.replace(/^file:\/\//, ''));
  }
}

function __readFileText(pathOrFileIri) {
  if (!__IS_NODE) return null;
  const fs = require('fs');
  let path = pathOrFileIri;
  if (__isFileIri(pathOrFileIri)) path = __fileIriToPath(pathOrFileIri);
  try {
    return fs.readFileSync(path, { encoding: 'utf8' });
  } catch {
    return null;
  }
}

function __fetchHttpTextViaSubprocess(url) {
  if (!__IS_NODE) return null;
  const cp = require('child_process');
  // Use a subprocess so this code remains synchronous without rewriting the whole reasoner to async.
  const script = `
    const enforceHttps = ${enforceHttpsEnabled ? 'true' : 'false'};
    const url = process.argv[1];
    const maxRedirects = 10;
    function norm(u) {
      if (enforceHttps && typeof u === 'string' && u.startsWith('http://')) {
        return 'https://' + u.slice('http://'.length);
      }
      return u;
    }
    function get(u, n) {
      u = norm(u);
      if (n > maxRedirects) { console.error('Too many redirects'); process.exit(3); }
      let mod;
      if (u.startsWith('https://')) mod = require('https');
      else if (u.startsWith('http://')) mod = require('http');
      else { console.error('Not http(s)'); process.exit(2); }

      const { URL } = require('url');
      const uu = new URL(u);
      const opts = {
        protocol: uu.protocol,
        hostname: uu.hostname,
        port: uu.port || undefined,
        path: uu.pathname + uu.search,
        headers: {
          'accept': 'text/n3, text/turtle, application/n-triples, application/n-quads, text/plain;q=0.1, */*;q=0.01',
          'user-agent': 'eyeling-log-builtins'
        }
      };
      const req = mod.request(opts, (res) => {
        const sc = res.statusCode || 0;
        if (sc >= 300 && sc < 400 && res.headers && res.headers.location) {
          let next = new URL(res.headers.location, u).toString();
          next = norm(next);
          res.resume();
          return get(next, n + 1);
        }
        if (sc < 200 || sc >= 300) {
          res.resume();
          console.error('HTTP status ' + sc);
          process.exit(4);
        }
        res.setEncoding('utf8');
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => { process.stdout.write(data); });
      });
      req.on('error', (e) => { console.error(e && e.message ? e.message : String(e)); process.exit(5); });
      req.end();
    }
    get(url, 0);
  `;
  const r = cp.spawnSync(process.execPath, ['-e', script, url], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) return null;
  return r.stdout;
}

function __derefTextSync(iriNoFrag) {
  const norm = __normalizeDerefIri(iriNoFrag);
  const key = typeof norm === 'string' && norm ? norm : iriNoFrag;

  if (__logContentCache.has(key)) return __logContentCache.get(key);

  let text = null;

  if (__IS_NODE) {
    if (__isHttpIri(key)) {
      text = __fetchHttpTextViaSubprocess(key);
    } else {
      // Treat any non-http(s) IRI as a local path (including file://), for basic usability.
      text = __readFileText(key);
    }
  } else {
    // Browser / Worker: we can only dereference over HTTP(S), and it must pass CORS.
    const url = typeof norm === 'string' && norm ? norm : key;
    if (__isHttpIri(url)) text = __fetchHttpTextSyncBrowser(url);
  }

  __logContentCache.set(key, text);
  return text;
}

function __parseSemanticsToFormula(text, baseIri) {
  const toks = lex(text);
  const parser = new Parser(toks);
  if (typeof baseIri === 'string' && baseIri) parser.prefixes.setBase(baseIri);

  const [_prefixes, triples, frules, brules] = parser.parseDocument();

  const all = triples.slice();
  const impliesPred = internIri(LOG_NS + 'implies');
  const impliedByPred = internIri(LOG_NS + 'impliedBy');

  // Represent top-level => / <= rules as triples between formula terms,
  // so the returned formula can include them.
  for (const r of frules) {
    all.push(new Triple(new GraphTerm(r.premise), impliesPred, new GraphTerm(r.conclusion)));
  }
  for (const r of brules) {
    all.push(new Triple(new GraphTerm(r.conclusion), impliedByPred, new GraphTerm(r.premise)));
  }

  return new GraphTerm(all);
}

function __derefSemanticsSync(iriNoFrag) {
  const norm = __normalizeDerefIri(iriNoFrag);
  const key = typeof norm === 'string' && norm ? norm : iriNoFrag;
  if (__logSemanticsCache.has(key)) return __logSemanticsCache.get(key);

  const text = __derefTextSync(iriNoFrag);
  if (typeof text !== 'string') {
    __logSemanticsCache.set(key, null);
    return null;
  }
  try {
    const baseIri = typeof key === 'string' && key ? key : iriNoFrag;
    const formula = __parseSemanticsToFormula(text, baseIri);
    __logSemanticsCache.set(key, formula);
    return formula;
  } catch {
    __logSemanticsCache.set(key, null);
    return null;
  }
}
function __makeRuleFromTerms(left, right, isForward) {
  // Mirror Parser.makeRule, but usable at runtime (e.g., log:conclusion).
  let premiseTerm, conclTerm;

  if (isForward) {
    premiseTerm = left;
    conclTerm = right;
  } else {
    premiseTerm = right;
    conclTerm = left;
  }

  let isFuse = false;
  if (isForward) {
    if (conclTerm instanceof Literal && conclTerm.value === 'false') {
      isFuse = true;
    }
  }

  let rawPremise;
  if (premiseTerm instanceof GraphTerm) {
    rawPremise = premiseTerm.triples;
  } else if (premiseTerm instanceof Literal && premiseTerm.value === 'true') {
    rawPremise = [];
  } else {
    rawPremise = [];
  }

  let rawConclusion;
  if (conclTerm instanceof GraphTerm) {
    rawConclusion = conclTerm.triples;
  } else if (conclTerm instanceof Literal && conclTerm.value === 'false') {
    rawConclusion = [];
  } else {
    rawConclusion = [];
  }

  const headBlankLabels = collectBlankLabelsInTriples(rawConclusion);
  const [premise0, conclusion] = liftBlankRuleVars(rawPremise, rawConclusion);
  const premise = isForward ? reorderPremiseForConstraints(premise0) : premise0;
  return new Rule(premise, conclusion, isForward, isFuse, headBlankLabels);
}

function __computeConclusionFromFormula(formula) {
  if (!(formula instanceof GraphTerm)) return null;

  const cached = __logConclusionCache.get(formula);
  if (cached) return cached;

  // Facts start as *all* triples in the formula, including rule triples.
  const facts2 = formula.triples.slice();

  // Extract rules from rule-triples present inside the formula.
  const fw = [];
  const bw = [];

  for (const tr of formula.triples) {
    // Treat {A} => {B} as a forward rule.
    if (isLogImplies(tr.p)) {
      fw.push(__makeRuleFromTerms(tr.s, tr.o, true));
      continue;
    }

    // Treat {A} <= {B} as the same rule in the other direction, i.e., {B} => {A},
    // so it participates in deductive closure even if only <= is used.
    if (isLogImpliedBy(tr.p)) {
      fw.push(__makeRuleFromTerms(tr.o, tr.s, true));
      // Also index it as a backward rule for completeness (helps proveGoals in some cases).
      bw.push(__makeRuleFromTerms(tr.s, tr.o, false));
      continue;
    }
  }

  // Saturate within this local formula only.
  forwardChain(facts2, fw, bw);

  const out = new GraphTerm(facts2.slice());
  __logConclusionCache.set(formula, out);
  return out;
}

// Controls whether human-readable proof comments are printed.
let proofCommentsEnabled = false;
// Super restricted mode: disable *all* builtins except => / <= (log:implies / log:impliedBy)
let superRestrictedMode = false;

// Debug/trace printing support (log:trace)
let __tracePrefixes = null;

function __traceWriteLine(line) {
  // Prefer stderr in Node, fall back to console.error elsewhere.
  try {
    if (__IS_NODE && typeof process !== 'undefined' && process.stderr && typeof process.stderr.write === 'function') {
      process.stderr.write(String(line) + '\n');
      return;
    }
  } catch (_) {}
  try {
    if (typeof console !== 'undefined' && typeof console.error === 'function') console.error(line);
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// Deterministic time support
// ----------------------------------------------------------------------------
// If set, overrides time:localTime across the whole run (and across runs if you
// pass the same value). Store as xsd:dateTime *lexical* string (no quotes).
let fixedNowLex = null;

// If not fixed, we still memoize one value per run to avoid re-firing rules.
let runNowLex = null;

// ===========================================================================
// Run-level time helpers
// ===========================================================================

function localIsoDateTimeString(d) {
  function pad(n, width = 2) {
    return String(n).padStart(width, '0');
  }
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const min = d.getMinutes();
  const sec = d.getSeconds();
  const ms = d.getMilliseconds();
  const offsetMin = -d.getTimezoneOffset(); // minutes east of UTC
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const oh = Math.floor(abs / 60);
  const om = abs % 60;
  const msPart = ms ? '.' + String(ms).padStart(3, '0') : '';
  return (
    pad(year, 4) +
    '-' +
    pad(month) +
    '-' +
    pad(day) +
    'T' +
    pad(hour) +
    ':' +
    pad(min) +
    ':' +
    pad(sec) +
    msPart +
    sign +
    pad(oh) +
    ':' +
    pad(om)
  );
}

function utcIsoDateTimeStringFromEpochSeconds(sec) {
  const ms = sec * 1000;
  const d = new Date(ms);
  function pad(n, w = 2) {
    return String(n).padStart(w, '0');
  }
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours();
  const min = d.getUTCMinutes();
  const s2 = d.getUTCSeconds();
  const ms2 = d.getUTCMilliseconds();
  const msPart = ms2 ? '.' + String(ms2).padStart(3, '0') : '';
  return (
    pad(year, 4) +
    '-' +
    pad(month) +
    '-' +
    pad(day) +
    'T' +
    pad(hour) +
    ':' +
    pad(min) +
    ':' +
    pad(s2) +
    msPart +
    '+00:00'
  );
}

function getNowLex() {
  if (fixedNowLex) return fixedNowLex;
  if (runNowLex) return runNowLex;
  runNowLex = localIsoDateTimeString(new Date());
  return runNowLex;
}

// Deterministic pseudo-UUID from a string key (for log:skolem).
// Not cryptographically strong, but stable and platform-independent.
function deterministicSkolemIdFromKey(key) {
  // Four 32-bit FNV-1a style accumulators with slight variation
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  let h3 = 0x811c9dc5;
  let h4 = 0x811c9dc5;

  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);

    h1 ^= c;
    h1 = (h1 * 0x01000193) >>> 0;

    h2 ^= c + 1;
    h2 = (h2 * 0x01000193) >>> 0;

    h3 ^= c + 2;
    h3 = (h3 * 0x01000193) >>> 0;

    h4 ^= c + 3;
    h4 = (h4 * 0x01000193) >>> 0;
  }

  const hex = [h1, h2, h3, h4].map((h) => h.toString(16).padStart(8, '0')).join(''); // 32 hex chars

  // Format like a UUID: 8-4-4-4-12
  return (
    hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20)
  );
}

let runLocalTimeCache = null;

// ===========================================================================
// AST (Abstract Syntax Tree)
// ===========================================================================

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
    this.value = value; // raw lexical form, e.g. "foo", 12, true, or "\"1944-08-21\"^^..."
  }
}

class Var extends Term {
  constructor(name) {
    super();
    this.name = name; // without leading '?'
  }
}

// ===========================================================================
// Term interning
// ===========================================================================

// Intern IRIs and literals by their raw lexical string.
// This reduces allocations when the same terms repeat and can improve performance.
//
// NOTE: Terms are treated as immutable. Do NOT mutate .value on interned objects.
const __iriIntern = new Map();
const __literalIntern = new Map();

/** @param {string} value */
function internIri(value) {
  let t = __iriIntern.get(value);
  if (!t) {
    t = new Iri(value);
    __iriIntern.set(value, t);
  }
  return t;
}

/** @param {string} value */
function internLiteral(value) {
  let t = __literalIntern.get(value);
  if (!t) {
    t = new Literal(value);
    __literalIntern.set(value, t);
  }
  return t;
}

class Blank extends Term {
  constructor(label) {
    super();
    this.label = label; // _:b1, etc.
  }
}

class ListTerm extends Term {
  constructor(elems) {
    super();
    this.elems = elems; // Term[]
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

class Rule {
  constructor(premise, conclusion, isForward, isFuse, headBlankLabels) {
    this.premise = premise; // Triple[]
    this.conclusion = conclusion; // Triple[]
    this.isForward = isForward; // boolean
    this.isFuse = isFuse; // boolean
    // Set<string> of blank-node labels that occur explicitly in the rule head
    this.headBlankLabels = headBlankLabels || new Set();
  }
}

class DerivedFact {
  constructor(fact, rule, premises, subst) {
    this.fact = fact; // Triple
    this.rule = rule; // Rule
    this.premises = premises; // Triple[]
    this.subst = subst; // { varName: Term }
  }
}

// ===========================================================================
// Blank-node lifting and Skolemization
// ===========================================================================

function liftBlankRuleVars(premise, conclusion) {
  function convertTerm(t, mapping, counter) {
    if (t instanceof Blank) {
      const label = t.label;
      if (!mapping.hasOwnProperty(label)) {
        counter[0] += 1;
        mapping[label] = `_b${counter[0]}`;
      }
      return new Var(mapping[label]);
    }
    if (t instanceof ListTerm) {
      return new ListTerm(t.elems.map((e) => convertTerm(e, mapping, counter)));
    }
    if (t instanceof OpenListTerm) {
      return new OpenListTerm(
        t.prefix.map((e) => convertTerm(e, mapping, counter)),
        t.tailVar,
      );
    }
    if (t instanceof GraphTerm) {
      const triples = t.triples.map(
        (tr) =>
          new Triple(
            convertTerm(tr.s, mapping, counter),
            convertTerm(tr.p, mapping, counter),
            convertTerm(tr.o, mapping, counter),
          ),
      );
      return new GraphTerm(triples);
    }
    return t;
  }

  function convertTriple(tr, mapping, counter) {
    return new Triple(
      convertTerm(tr.s, mapping, counter),
      convertTerm(tr.p, mapping, counter),
      convertTerm(tr.o, mapping, counter),
    );
  }

  const mapping = {};
  const counter = [0];
  const newPremise = premise.map((tr) => convertTriple(tr, mapping, counter));
  return [newPremise, conclusion];
}

// Skolemization for blank nodes that occur explicitly in a rule head.
//
// IMPORTANT: we must be *stable per rule firing*, otherwise a rule whose
// premises stay true would keep generating fresh _:sk_N blank nodes on every
// outer fixpoint iteration (non-termination once we do strict duplicate checks).
//
// We achieve this by optionally keying head-blank allocations by a "firingKey"
// (usually derived from the instantiated premises and rule index) and caching
// them in a run-global map.
function skolemizeTermForHeadBlanks(t, headBlankLabels, mapping, skCounter, firingKey, globalMap) {
  if (t instanceof Blank) {
    const label = t.label;
    // Only skolemize blanks that occur explicitly in the rule head
    if (!headBlankLabels || !headBlankLabels.has(label)) {
      return t; // this is a data blank (e.g. bound via ?X), keep it
    }

    if (!mapping.hasOwnProperty(label)) {
      // If we have a global cache keyed by firingKey, use it to ensure
      // deterministic blank IDs for the same rule+substitution instance.
      if (globalMap && firingKey) {
        const gk = `${firingKey}|${label}`;
        let sk = globalMap.get(gk);
        if (!sk) {
          const idx = skCounter[0];
          skCounter[0] += 1;
          sk = `_:sk_${idx}`;
          globalMap.set(gk, sk);
        }
        mapping[label] = sk;
      } else {
        const idx = skCounter[0];
        skCounter[0] += 1;
        mapping[label] = `_:sk_${idx}`;
      }
    }
    return new Blank(mapping[label]);
  }

  if (t instanceof ListTerm) {
    return new ListTerm(
      t.elems.map((e) => skolemizeTermForHeadBlanks(e, headBlankLabels, mapping, skCounter, firingKey, globalMap)),
    );
  }

  if (t instanceof OpenListTerm) {
    return new OpenListTerm(
      t.prefix.map((e) => skolemizeTermForHeadBlanks(e, headBlankLabels, mapping, skCounter, firingKey, globalMap)),
      t.tailVar,
    );
  }

  if (t instanceof GraphTerm) {
    return new GraphTerm(
      t.triples.map((tr) =>
        skolemizeTripleForHeadBlanks(tr, headBlankLabels, mapping, skCounter, firingKey, globalMap),
      ),
    );
  }

  return t;
}

function skolemizeTripleForHeadBlanks(tr, headBlankLabels, mapping, skCounter, firingKey, globalMap) {
  return new Triple(
    skolemizeTermForHeadBlanks(tr.s, headBlankLabels, mapping, skCounter, firingKey, globalMap),
    skolemizeTermForHeadBlanks(tr.p, headBlankLabels, mapping, skCounter, firingKey, globalMap),
    skolemizeTermForHeadBlanks(tr.o, headBlankLabels, mapping, skCounter, firingKey, globalMap),
  );
}

// ===========================================================================
// Alpha equivalence helpers
// ===========================================================================

function termsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.constructor !== b.constructor) return false;

  if (a instanceof Iri) return a.value === b.value;

  if (a instanceof Literal) {
    if (a.value === b.value) return true;

    // Plain "abc" == "abc"^^xsd:string (but not language-tagged strings)
    if (literalsEquivalentAsXsdString(a.value, b.value)) return true;

    // Keep in sync with unifyTerm(): numeric-value equality, datatype-aware.
    const ai = parseNumericLiteralInfo(a);
    const bi = parseNumericLiteralInfo(b);

    if (ai && bi) {
      // Same datatype => compare values
      if (ai.dt === bi.dt) {
        if (ai.kind === 'bigint' && bi.kind === 'bigint') return ai.value === bi.value;

        const an = ai.kind === 'bigint' ? Number(ai.value) : ai.value;
        const bn = bi.kind === 'bigint' ? Number(bi.value) : bi.value;
        return !Number.isNaN(an) && !Number.isNaN(bn) && an === bn;
      }
    }

    return false;
  }

  if (a instanceof Var) return a.name === b.name;
  if (a instanceof Blank) return a.label === b.label;

  if (a instanceof ListTerm) {
    if (a.elems.length !== b.elems.length) return false;
    for (let i = 0; i < a.elems.length; i++) {
      if (!termsEqual(a.elems[i], b.elems[i])) return false;
    }
    return true;
  }

  if (a instanceof OpenListTerm) {
    if (a.tailVar !== b.tailVar) return false;
    if (a.prefix.length !== b.prefix.length) return false;
    for (let i = 0; i < a.prefix.length; i++) {
      if (!termsEqual(a.prefix[i], b.prefix[i])) return false;
    }
    return true;
  }

  if (a instanceof GraphTerm) {
    return alphaEqGraphTriples(a.triples, b.triples);
  }

  return false;
}

function termsEqualNoIntDecimal(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.constructor !== b.constructor) return false;

  if (a instanceof Iri) return a.value === b.value;

  if (a instanceof Literal) {
    if (a.value === b.value) return true;

    // Plain "abc" == "abc"^^xsd:string (but not language-tagged)
    if (literalsEquivalentAsXsdString(a.value, b.value)) return true;

    // Numeric equality ONLY when datatypes agree (no integer<->decimal here)
    const ai = parseNumericLiteralInfo(a);
    const bi = parseNumericLiteralInfo(b);
    if (ai && bi && ai.dt === bi.dt) {
      // integer: exact bigint
      if (ai.kind === 'bigint' && bi.kind === 'bigint') return ai.value === bi.value;

      // decimal: compare exactly via num/scale if possible
      if (ai.dt === XSD_NS + 'decimal') {
        const da = parseXsdDecimalToBigIntScale(ai.lexStr);
        const db = parseXsdDecimalToBigIntScale(bi.lexStr);
        if (da && db) {
          const scale = Math.max(da.scale, db.scale);
          const na = da.num * pow10n(scale - da.scale);
          const nb = db.num * pow10n(scale - db.scale);
          return na === nb;
        }
      }

      // double/float-ish: JS number (same as your normal same-dt path)
      const an = ai.kind === 'bigint' ? Number(ai.value) : ai.value;
      const bn = bi.kind === 'bigint' ? Number(bi.value) : bi.value;
      return !Number.isNaN(an) && !Number.isNaN(bn) && an === bn;
    }

    return false;
  }

  if (a instanceof Var) return a.name === b.name;
  if (a instanceof Blank) return a.label === b.label;

  if (a instanceof ListTerm) {
    if (a.elems.length !== b.elems.length) return false;
    for (let i = 0; i < a.elems.length; i++) {
      if (!termsEqualNoIntDecimal(a.elems[i], b.elems[i])) return false;
    }
    return true;
  }

  if (a instanceof OpenListTerm) {
    if (a.tailVar !== b.tailVar) return false;
    if (a.prefix.length !== b.prefix.length) return false;
    for (let i = 0; i < a.prefix.length; i++) {
      if (!termsEqualNoIntDecimal(a.prefix[i], b.prefix[i])) return false;
    }
    return true;
  }

  if (a instanceof GraphTerm) {
    return alphaEqGraphTriples(a.triples, b.triples);
  }

  return false;
}

function triplesEqual(a, b) {
  return termsEqual(a.s, b.s) && termsEqual(a.p, b.p) && termsEqual(a.o, b.o);
}

function triplesListEqual(xs, ys) {
  if (xs.length !== ys.length) return false;
  for (let i = 0; i < xs.length; i++) {
    if (!triplesEqual(xs[i], ys[i])) return false;
  }
  return true;
}

// Alpha-equivalence for quoted formulas, up to *variable* and blank-node renaming.
// Treats a formula as an unordered set of triples (order-insensitive match).
function alphaEqVarName(x, y, vmap) {
  if (vmap.hasOwnProperty(x)) return vmap[x] === y;
  vmap[x] = y;
  return true;
}

function alphaEqTermInGraph(a, b, vmap, bmap) {
  // Blank nodes: renamable
  if (a instanceof Blank && b instanceof Blank) {
    const x = a.label;
    const y = b.label;
    if (bmap.hasOwnProperty(x)) return bmap[x] === y;
    bmap[x] = y;
    return true;
  }

  // Variables: renamable (ONLY inside quoted formulas)
  if (a instanceof Var && b instanceof Var) {
    return alphaEqVarName(a.name, b.name, vmap);
  }

  if (a instanceof Iri && b instanceof Iri) return a.value === b.value;
  if (a instanceof Literal && b instanceof Literal) return a.value === b.value;

  if (a instanceof ListTerm && b instanceof ListTerm) {
    if (a.elems.length !== b.elems.length) return false;
    for (let i = 0; i < a.elems.length; i++) {
      if (!alphaEqTermInGraph(a.elems[i], b.elems[i], vmap, bmap)) return false;
    }
    return true;
  }

  if (a instanceof OpenListTerm && b instanceof OpenListTerm) {
    if (a.prefix.length !== b.prefix.length) return false;
    for (let i = 0; i < a.prefix.length; i++) {
      if (!alphaEqTermInGraph(a.prefix[i], b.prefix[i], vmap, bmap)) return false;
    }
    // tailVar is a var-name string, so treat it as renamable too
    return alphaEqVarName(a.tailVar, b.tailVar, vmap);
  }

  // Nested formulas: compare with fresh maps (separate scope)
  if (a instanceof GraphTerm && b instanceof GraphTerm) {
    return alphaEqGraphTriples(a.triples, b.triples);
  }

  return false;
}

function alphaEqTripleInGraph(a, b, vmap, bmap) {
  return (
    alphaEqTermInGraph(a.s, b.s, vmap, bmap) &&
    alphaEqTermInGraph(a.p, b.p, vmap, bmap) &&
    alphaEqTermInGraph(a.o, b.o, vmap, bmap)
  );
}

function alphaEqGraphTriples(xs, ys) {
  if (xs.length !== ys.length) return false;
  // Fast path: exact same sequence.
  if (triplesListEqual(xs, ys)) return true;

  // Order-insensitive backtracking match, threading var/blank mappings.
  const used = new Array(ys.length).fill(false);

  function step(i, vmap, bmap) {
    if (i >= xs.length) return true;
    const x = xs[i];
    for (let j = 0; j < ys.length; j++) {
      if (used[j]) continue;
      const y = ys[j];
      // Cheap pruning when both predicates are IRIs.
      if (x.p instanceof Iri && y.p instanceof Iri && x.p.value !== y.p.value) continue;

      const v2 = { ...vmap };
      const b2 = { ...bmap };
      if (!alphaEqTripleInGraph(x, y, v2, b2)) continue;

      used[j] = true;
      if (step(i + 1, v2, b2)) return true;
      used[j] = false;
    }
    return false;
  }

  return step(0, {}, {});
}

function alphaEqTerm(a, b, bmap) {
  if (a instanceof Blank && b instanceof Blank) {
    const x = a.label;
    const y = b.label;
    if (bmap.hasOwnProperty(x)) {
      return bmap[x] === y;
    } else {
      bmap[x] = y;
      return true;
    }
  }
  if (a instanceof Iri && b instanceof Iri) return a.value === b.value;
  if (a instanceof Literal && b instanceof Literal) return a.value === b.value;
  if (a instanceof Var && b instanceof Var) return a.name === b.name;
  if (a instanceof ListTerm && b instanceof ListTerm) {
    if (a.elems.length !== b.elems.length) return false;
    for (let i = 0; i < a.elems.length; i++) {
      if (!alphaEqTerm(a.elems[i], b.elems[i], bmap)) return false;
    }
    return true;
  }
  if (a instanceof OpenListTerm && b instanceof OpenListTerm) {
    if (a.tailVar !== b.tailVar || a.prefix.length !== b.prefix.length) return false;
    for (let i = 0; i < a.prefix.length; i++) {
      if (!alphaEqTerm(a.prefix[i], b.prefix[i], bmap)) return false;
    }
    return true;
  }
  if (a instanceof GraphTerm && b instanceof GraphTerm) {
    // formulas are alpha-equivalent up to var/blank renaming
    return alphaEqGraphTriples(a.triples, b.triples);
  }
  return false;
}

function alphaEqTriple(a, b) {
  const bmap = {};
  return alphaEqTerm(a.s, b.s, bmap) && alphaEqTerm(a.p, b.p, bmap) && alphaEqTerm(a.o, b.o, bmap);
}

// ===========================================================================
// Indexes (facts + backward rules)
// ===========================================================================
//
// Facts:
//   - __byPred: Map<predicateIRI, Triple[]>
//   - __byPO:   Map<predicateIRI, Map<objectKey, Triple[]>>
//   - __keySet: Set<"S\tP\tO"> for IRI/Literal-only triples (fast dup check)
//
// Backward rules:
//   - __byHeadPred:   Map<headPredicateIRI, Rule[]>
//   - __wildHeadPred: Rule[] (non-IRI head predicate)

function termFastKey(t) {
  if (t instanceof Iri) return 'I:' + t.value;
  if (t instanceof Literal) return 'L:' + normalizeLiteralForFastKey(t.value);
  return null;
}

function tripleFastKey(tr) {
  const ks = termFastKey(tr.s);
  const kp = termFastKey(tr.p);
  const ko = termFastKey(tr.o);
  if (ks === null || kp === null || ko === null) return null;
  return ks + '\t' + kp + '\t' + ko;
}

function ensureFactIndexes(facts) {
  if (facts.__byPred && facts.__byPS && facts.__byPO && facts.__keySet) return;

  Object.defineProperty(facts, '__byPred', {
    value: new Map(),
    enumerable: false,
    writable: true,
  });
  Object.defineProperty(facts, '__byPS', {
    value: new Map(),
    enumerable: false,
    writable: true,
  });
  Object.defineProperty(facts, '__byPO', {
    value: new Map(),
    enumerable: false,
    writable: true,
  });
  Object.defineProperty(facts, '__keySet', {
    value: new Set(),
    enumerable: false,
    writable: true,
  });

  for (const f of facts) indexFact(facts, f);
}

function indexFact(facts, tr) {
  if (tr.p instanceof Iri) {
    const pk = tr.p.value;

    let pb = facts.__byPred.get(pk);
    if (!pb) {
      pb = [];
      facts.__byPred.set(pk, pb);
    }
    pb.push(tr);

    const sk = termFastKey(tr.s);
    if (sk !== null) {
      let ps = facts.__byPS.get(pk);
      if (!ps) {
        ps = new Map();
        facts.__byPS.set(pk, ps);
      }
      let psb = ps.get(sk);
      if (!psb) {
        psb = [];
        ps.set(sk, psb);
      }
      psb.push(tr);
    }

    const ok = termFastKey(tr.o);
    if (ok !== null) {
      let po = facts.__byPO.get(pk);
      if (!po) {
        po = new Map();
        facts.__byPO.set(pk, po);
      }
      let pob = po.get(ok);
      if (!pob) {
        pob = [];
        po.set(ok, pob);
      }
      pob.push(tr);
    }
  }

  const key = tripleFastKey(tr);
  if (key !== null) facts.__keySet.add(key);
}

function candidateFacts(facts, goal) {
  ensureFactIndexes(facts);

  if (goal.p instanceof Iri) {
    const pk = goal.p.value;

    const sk = termFastKey(goal.s);
    const ok = termFastKey(goal.o);

    /** @type {Triple[] | null} */
    let byPS = null;
    if (sk !== null) {
      const ps = facts.__byPS.get(pk);
      if (ps) byPS = ps.get(sk) || null;
    }

    /** @type {Triple[] | null} */
    let byPO = null;
    if (ok !== null) {
      const po = facts.__byPO.get(pk);
      if (po) byPO = po.get(ok) || null;
    }

    if (byPS && byPO) return byPS.length <= byPO.length ? byPS : byPO;
    if (byPS) return byPS;
    if (byPO) return byPO;

    return facts.__byPred.get(pk) || [];
  }

  return facts;
}

function hasFactIndexed(facts, tr) {
  ensureFactIndexes(facts);

  const key = tripleFastKey(tr);
  if (key !== null) return facts.__keySet.has(key);

  if (tr.p instanceof Iri) {
    const pk = tr.p.value;

    const ok = termFastKey(tr.o);
    if (ok !== null) {
      const po = facts.__byPO.get(pk);
      if (po) {
        const pob = po.get(ok) || [];
        // Facts are all in the same graph. Different blank node labels represent
        // different existentials unless explicitly connected. Do NOT treat
        // triples as duplicates modulo blank renaming, or you'll incorrectly
        // drop facts like: _:sk_0 :x 8.0  (because _:b8 :x 8.0 exists).
        return pob.some((t) => triplesEqual(t, tr));
      }
    }

    const pb = facts.__byPred.get(pk) || [];
    return pb.some((t) => triplesEqual(t, tr));
  }

  // Non-IRI predicate: fall back to strict triple equality.
  return facts.some((t) => triplesEqual(t, tr));
}

function pushFactIndexed(facts, tr) {
  ensureFactIndexes(facts);
  facts.push(tr);
  indexFact(facts, tr);
}

function ensureBackRuleIndexes(backRules) {
  if (backRules.__byHeadPred && backRules.__wildHeadPred) return;

  Object.defineProperty(backRules, '__byHeadPred', {
    value: new Map(),
    enumerable: false,
    writable: true,
  });
  Object.defineProperty(backRules, '__wildHeadPred', {
    value: [],
    enumerable: false,
    writable: true,
  });

  for (const r of backRules) indexBackRule(backRules, r);
}

function indexBackRule(backRules, r) {
  if (!r || !r.conclusion || r.conclusion.length !== 1) return;
  const head = r.conclusion[0];
  if (head && head.p instanceof Iri) {
    const k = head.p.value;
    let bucket = backRules.__byHeadPred.get(k);
    if (!bucket) {
      bucket = [];
      backRules.__byHeadPred.set(k, bucket);
    }
    bucket.push(r);
  } else {
    backRules.__wildHeadPred.push(r);
  }
}

// ===========================================================================
// Special predicate helpers
// ===========================================================================

function isRdfTypePred(p) {
  return p instanceof Iri && p.value === RDF_NS + 'type';
}

function isOwlSameAsPred(t) {
  return t instanceof Iri && t.value === OWL_NS + 'sameAs';
}

function isLogImplies(p) {
  return p instanceof Iri && p.value === LOG_NS + 'implies';
}

function isLogImpliedBy(p) {
  return p instanceof Iri && p.value === LOG_NS + 'impliedBy';
}

// ===========================================================================
// Constraint / "test" builtins
// ===========================================================================

function isConstraintBuiltin(tr) {
  if (!(tr.p instanceof Iri)) return false;
  const v = tr.p.value;

  // math: numeric comparisons (no new bindings, just tests)
  if (
    v === MATH_NS + 'equalTo' ||
    v === MATH_NS + 'greaterThan' ||
    v === MATH_NS + 'lessThan' ||
    v === MATH_NS + 'notEqualTo' ||
    v === MATH_NS + 'notGreaterThan' ||
    v === MATH_NS + 'notLessThan'
  ) {
    return true;
  }

  // list: membership test with no bindings
  if (v === LIST_NS + 'notMember') {
    return true;
  }

  // log: tests that are purely constraints (no new bindings)
  if (
    v === LOG_NS + 'forAllIn' ||
    v === LOG_NS + 'notEqualTo' ||
    v === LOG_NS + 'notIncludes' ||
    v === LOG_NS + 'outputString'
  ) {
    return true;
  }

  // string: relational / membership style tests (no bindings)
  if (
    v === STRING_NS + 'contains' ||
    v === STRING_NS + 'containsIgnoringCase' ||
    v === STRING_NS + 'endsWith' ||
    v === STRING_NS + 'equalIgnoringCase' ||
    v === STRING_NS + 'greaterThan' ||
    v === STRING_NS + 'lessThan' ||
    v === STRING_NS + 'matches' ||
    v === STRING_NS + 'notEqualIgnoringCase' ||
    v === STRING_NS + 'notGreaterThan' ||
    v === STRING_NS + 'notLessThan' ||
    v === STRING_NS + 'notMatches' ||
    v === STRING_NS + 'startsWith'
  ) {
    return true;
  }

  return false;
}

// Move constraint builtins to the end of the rule premise.
// This is a simple "delaying" strategy similar in spirit to Prolog's when/2:
// - normal goals first (can bind variables),
// - pure test / constraint builtins last (checked once bindings are in place).
function reorderPremiseForConstraints(premise) {
  if (!premise || premise.length === 0) return premise;

  const normal = [];
  const delayed = [];

  for (const tr of premise) {
    if (isConstraintBuiltin(tr)) delayed.push(tr);
    else normal.push(tr);
  }
  return normal.concat(delayed);
}

