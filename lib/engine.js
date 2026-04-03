/**
 * Eyeling Reasoner — engine
 *
 * Core inference engine: unification, forward/backward chaining, builtin evaluation,
 * and proof/explanation bookkeeping. This module intentionally stays cohesive.
 */

'use strict';

const {
  RDF_NS,
  XSD_NS,
  MATH_NS,
  LOG_NS,
  SKOLEM_NS,
  MAX_LITERAL_TID_LEN,
  normalizeLiteralForTid,
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
  collectBlankLabelsInTriples,
} = require('./prelude');

// In N3/Turtle, rdf:nil is the canonical IRI for the empty RDF list.
// Eyeling represents list literals with ListTerm; ensure rdf:nil unifies with ().
const RDF_NIL_IRI = RDF_NS + 'nil';
const EMPTY_LIST_TERM = new ListTerm([]);

const { lex, N3SyntaxError } = require('./lexer');
const { Parser } = require('./parser');
const { liftBlankRuleVars } = require('./rules');

const {
  makeBuiltins,
  registerBuiltin,
  unregisterBuiltin,
  registerBuiltinModule,
  loadBuiltinModule,
  listBuiltinIris,
  // helpers used by engine core
  parseBooleanLiteralInfo,
  parseNumericLiteralInfo,
  // numeric helpers used by engine unification / equality
  parseXsdDecimalToBigIntScale,
  pow10n,
  literalsEquivalentAsXsdString,
  materializeRdfLists,
  // used by backward chaining
  standardizeRule,
} = require('./builtins');

const { makeExplain } = require('./explain');

const { termToN3, tripleToN3, prettyPrintQueryTriples } = require('./printing');
const {
  getDataFactory,
  internalTripleToRdfJsQuad,
  normalizeParsedReasonerInputSync,
  normalizeReasonerInputSync,
  normalizeReasonerInputAsync,
} = require('./rdfjs');

const trace = require('./trace');
const { deterministicSkolemIdFromKey } = require('./skolem');

const deref = require('./deref');

const hasOwn = Object.prototype.hasOwnProperty;

let version = 'dev';
try {
  // Node: keep package.json version if available
  if (typeof require === 'function') version = require('./package.json').version || version;
} catch {}

let nodeCrypto = null;
try {
  // Node: crypto available
  if (typeof require === 'function') nodeCrypto = require('crypto');
} catch {}
// For a single reasoning run, this maps a canonical representation
// of the subject term in log:skolem to a Skolem IRI.
const skolemCache = new Map();

// log:skolem run salt and mode.
//
// Desired behavior:
//   - Within one reasoning run: same subject -> same Skolem IRI.
//   - Across reasoning runs (default): same subject -> different Skolem IRI.
//   - Optional legacy mode: stable across runs (CLI: --deterministic-skolem).
let deterministicSkolemAcrossRuns = false;
let skolemRunDepth = 0;
let skolemRunSalt = null;

function makeSkolemRunSalt() {
  // Prefer WebCrypto if present (browser/worker)
  try {
    const g = typeof globalThis !== 'undefined' ? globalThis : null;
    if (g && g.crypto) {
      if (typeof g.crypto.randomUUID === 'function') return g.crypto.randomUUID();
      if (typeof g.crypto.getRandomValues === 'function') {
        const a = new Uint8Array(16);
        g.crypto.getRandomValues(a);
        return Array.from(a)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }
    }
  } catch {}

  // Node.js crypto
  try {
    if (nodeCrypto) {
      if (typeof nodeCrypto.randomUUID === 'function') return nodeCrypto.randomUUID();
      if (typeof nodeCrypto.randomBytes === 'function') return nodeCrypto.randomBytes(16).toString('hex');
    }
  } catch {}

  // Last-resort fallback (not cryptographically strong)
  return (
    Date.now().toString(16) + '-' + Math.random().toString(16).slice(2) + '-' + Math.random().toString(16).slice(2)
  );
}

function enterReasoningRun() {
  skolemRunDepth += 1;
  if (skolemRunDepth === 1) {
    skolemCache.clear();
    skolemRunSalt = deterministicSkolemAcrossRuns ? '' : makeSkolemRunSalt();
  }
}

function exitReasoningRun() {
  if (skolemRunDepth > 0) skolemRunDepth -= 1;
  if (skolemRunDepth === 0) {
    // Clear the salt so a future top-level run gets a fresh one (default mode).
    skolemRunSalt = null;
  }
}

function skolemIdForKey(key) {
  if (deterministicSkolemAcrossRuns) return deterministicSkolemIdFromKey(key);
  // Ensure we have a run salt even if log:skolem is invoked outside forwardChain().
  if (skolemRunSalt === null) {
    skolemCache.clear();
    skolemRunSalt = makeSkolemRunSalt();
  }
  return deterministicSkolemIdFromKey(skolemRunSalt + '|' + key);
}

function getDeterministicSkolemEnabled() {
  return deterministicSkolemAcrossRuns;
}

function setDeterministicSkolemEnabled(v) {
  deterministicSkolemAcrossRuns = !!v;
  // Reset per-run state so the new mode takes effect immediately for the next run.
  if (skolemRunDepth === 0) {
    skolemRunSalt = null;
    skolemCache.clear();
  }
}

// -----------------------------------------------------------------------------
// Structural checks
// -----------------------------------------------------------------------------
// "Strict ground" means the term contains no variables *anywhere*, even inside
// quoted formulas. This can be used to cache rule properties safely.
function __isStrictGroundTerm(t) {
  if (t instanceof Var) return false;
  if (t instanceof Blank) return false;
  if (t instanceof OpenListTerm) return false;

  if (t instanceof ListTerm) {
    for (const e of t.elems) if (!__isStrictGroundTerm(e)) return false;
    return true;
  }
  if (t instanceof GraphTerm) {
    for (const tr of t.triples) if (!__isStrictGroundTriple(tr)) return false;
    return true;
  }
  return true; // Iri/Literal and any other atomic terms
}

function __isStrictGroundTriple(tr) {
  return __isStrictGroundTerm(tr.s) && __isStrictGroundTerm(tr.p) && __isStrictGroundTerm(tr.o);
}

// -----------------------------------------------------------------------------
// Rule identity / firing keys
// -----------------------------------------------------------------------------
// Used to maintain O(1) membership sets for dynamically promoted rules, and to
// memoize per-firing head-blank skolemization.
function __ruleKey(isForward, isFuse, premise, conclusion, dynamicConclusionTerm /* optional */) {
  let out = (isForward ? 'F' : 'B') + (isFuse ? '!' : '') + '|P|';
  for (let i = 0; i < premise.length; i++) {
    const tr = premise[i];
    if (i) out += '\n';
    out += skolemKeyFromTerm(tr.s) + '\t' + skolemKeyFromTerm(tr.p) + '\t' + skolemKeyFromTerm(tr.o);
  }
  out += '|C|';
  for (let i = 0; i < conclusion.length; i++) {
    const tr = conclusion[i];
    if (i) out += '\n';
    out += skolemKeyFromTerm(tr.s) + '\t' + skolemKeyFromTerm(tr.p) + '\t' + skolemKeyFromTerm(tr.o);
  }
  if (dynamicConclusionTerm) {
    out += '|T|' + skolemKeyFromTerm(dynamicConclusionTerm);
  }
  return out;
}

function __firingKey(ruleIndex, instantiatedPremises) {
  // Deterministic key derived from the instantiated body (ground per substitution).
  let out = `R${ruleIndex}|`;
  for (let i = 0; i < instantiatedPremises.length; i++) {
    const tr = instantiatedPremises[i];
    if (i) out += '\n';
    out += skolemKeyFromTerm(tr.s) + '\t' + skolemKeyFromTerm(tr.p) + '\t' + skolemKeyFromTerm(tr.o);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Rule metadata helpers
// -----------------------------------------------------------------------------
function __ensureRuleKeySet(rules) {
  if (!hasOwn.call(rules, '__ruleKeySet')) {
    Object.defineProperty(rules, '__ruleKeySet', {
      value: new Set(
        rules.map((r) => __ruleKey(r.isForward, r.isFuse, r.premise, r.conclusion, r.__dynamicConclusionTerm || null)),
      ),
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }
  return rules.__ruleKeySet;
}

function __computeHeadIsStrictGround(r) {
  if (r.isFuse) return false;
  // Dynamic heads depend on runtime bindings; treat as non-ground.
  if (r.__dynamicConclusionTerm) return false;
  if (r.__fromRulePromotion) return false;
  if (r.headBlankLabels && r.headBlankLabels.size) return false;
  for (const tr of r.conclusion) if (!__isStrictGroundTriple(tr)) return false;
  return true;
}

function __prepareForwardRule(r) {
  if (!hasOwn.call(r, '__scopedSkipInfo')) {
    const info = __computeForwardRuleScopedSkipInfo(r);
    Object.defineProperty(r, '__scopedSkipInfo', {
      value: info,
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }
  if (!hasOwn.call(r, '__headIsStrictGround')) {
    Object.defineProperty(r, '__headIsStrictGround', {
      value: __computeHeadIsStrictGround(r),
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }
}

function __graphTriplesOrTrue(term) {
  if (term instanceof GraphTerm) return term.triples;
  if (term instanceof Literal && term.value === 'true') return [];
  return null;
}

// -----------------------------------------------------------------------------
// Scoped-closure helpers (log:* builtins)
// -----------------------------------------------------------------------------
// Parse a 'naturalPriority' used by log:* scoped-closure builtins (e.g., log:collectAllIn).
// Accept non-negative integral numeric literals; return null if not parseable.
function __logNaturalPriorityFromTerm(t) {
  if (!(t instanceof Literal)) return null;
  const info = parseNumericLiteralInfo(t);
  if (!info) return null;

  if (info.kind === 'integer') {
    const bi = info.value; // BigInt
    if (bi < 0n) return null;
    // clamp to MAX_SAFE_INTEGER (priorities are expected to be small)
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    return Number(bi > max ? max : bi);
  }

  if (info.kind === 'decimal') {
    const n = info.value; // number
    if (!Number.isFinite(n)) return null;
    if (Math.floor(n) !== n) return null;
    if (n < 0) return null;
    return n;
  }

  return null;
}

function __computeMaxScopedClosurePriorityNeeded(forwardRules, backRules) {
  let maxP = 0;

  function scanTriple(tr) {
    if (!(tr && tr.p instanceof Iri)) return;
    const pv = tr.p.value;

    // log:collectAllIn / log:forAllIn use the object position for the priority.
    if (pv === LOG_NS + 'collectAllIn' || pv === LOG_NS + 'forAllIn') {
      // Explicit scope graphs are immediate and do not require a closure.
      if (tr.o instanceof GraphTerm) return;
      // Variable or non-numeric object => default priority 1 (if used).
      if (tr.o instanceof Var) {
        if (maxP < 1) maxP = 1;
        return;
      }
      const p0 = __logNaturalPriorityFromTerm(tr.o);
      if (p0 !== null) {
        if (p0 > maxP) maxP = p0;
      } else {
        if (maxP < 1) maxP = 1;
      }
      return;
    }

    // log:includes / log:notIncludes use the subject position for the priority.
    if (pv === LOG_NS + 'includes' || pv === LOG_NS + 'notIncludes') {
      // Explicit scope graphs are immediate and do not require a closure.
      if (tr.s instanceof GraphTerm) return;
      // Variable or non-numeric subject => default priority 1 (if used).
      if (tr.s instanceof Var) {
        if (maxP < 1) maxP = 1;
        return;
      }
      const p0 = __logNaturalPriorityFromTerm(tr.s);
      if (p0 !== null) {
        if (p0 > maxP) maxP = p0;
      } else {
        if (maxP < 1) maxP = 1;
      }
    }
  }

  for (const r of forwardRules) {
    for (const tr of r.premise) scanTriple(tr);
  }
  for (const r of backRules) {
    for (const tr of r.premise) scanTriple(tr);
  }
  return maxP;
}

function __termContainsVarName(t, name) {
  if (t instanceof Var) return t.name === name;
  if (t instanceof ListTerm) return t.elems.some((e) => __termContainsVarName(e, name));
  if (t instanceof OpenListTerm) return t.tailVar === name || t.prefix.some((e) => __termContainsVarName(e, name));
  if (t instanceof GraphTerm)
    return t.triples.some(
      (tr) =>
        __termContainsVarName(tr.s, name) || __termContainsVarName(tr.p, name) || __termContainsVarName(tr.o, name),
    );
  return false;
}

function __varOccursElsewhereInPremise(premise, name, idx, field) {
  for (let i = 0; i < premise.length; i++) {
    const tr = premise[i];
    if (!(tr && tr.s && tr.p && tr.o)) continue;

    // Skip the specific scope/priority occurrence we are analyzing.
    if (!(i === idx && field === 's') && __termContainsVarName(tr.s, name)) return true;
    if (!(i === idx && field === 'p') && __termContainsVarName(tr.p, name)) return true;
    if (!(i === idx && field === 'o') && __termContainsVarName(tr.o, name)) return true;
  }
  return false;
}

function __computeForwardRuleScopedSkipInfo(rule) {
  let needsSnap = false;
  let requiredLevel = 0;

  for (let i = 0; i < rule.premise.length; i++) {
    const tr = rule.premise[i];
    if (!(tr && tr.p instanceof Iri)) continue;
    const pv = tr.p.value;

    if (pv === LOG_NS + 'collectAllIn' || pv === LOG_NS + 'forAllIn') {
      if (tr.o instanceof GraphTerm) continue; // explicit scope
      // If scope term is a Var that appears elsewhere, it might be bound to a GraphTerm.
      // Be conservative and do not skip in that case.
      if (tr.o instanceof Var) {
        if (__varOccursElsewhereInPremise(rule.premise, tr.o.name, i, 'o')) return null;
        needsSnap = true;
        requiredLevel = Math.max(requiredLevel, 1);
      } else {
        needsSnap = true;
        let prio = 1;
        const p0 = __logNaturalPriorityFromTerm(tr.o);
        if (p0 !== null) prio = p0;
        requiredLevel = Math.max(requiredLevel, prio);
      }
      continue;
    }

    if (pv === LOG_NS + 'includes' || pv === LOG_NS + 'notIncludes') {
      if (tr.s instanceof GraphTerm) continue; // explicit scope
      if (tr.s instanceof Var) {
        if (__varOccursElsewhereInPremise(rule.premise, tr.s.name, i, 's')) return null;
        needsSnap = true;
        requiredLevel = Math.max(requiredLevel, 1);
      } else {
        needsSnap = true;
        let prio = 1;
        const p0 = __logNaturalPriorityFromTerm(tr.s);
        if (p0 !== null) prio = p0;
        requiredLevel = Math.max(requiredLevel, prio);
      }
    }
  }

  if (!needsSnap) return { needsSnap: false, requiredLevel: 0 };
  return { needsSnap: true, requiredLevel };
}

// -----------------------------------------------------------------------------
// log:conclusion cache
// -----------------------------------------------------------------------------
// Cache deductive closure for log:conclusion
const __logConclusionCache = new WeakMap(); // GraphTerm -> GraphTerm (deductive closure)

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

  // Premise/conclusion terms must be formulas ({ ... }) to contribute triples.
  // true/false in either position simply means “no triples”.
  const rawPremise = premiseTerm instanceof GraphTerm ? premiseTerm.triples : [];
  const rawConclusion = conclTerm instanceof GraphTerm ? conclTerm.triples : [];

  const headBlankLabels = collectBlankLabelsInTriples(rawConclusion);
  const [premise, conclusion] = liftBlankRuleVars(rawPremise, rawConclusion);
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

// Initialize builtin evaluation (implemented in lib/builtins.js).
const { evalBuiltin, isBuiltinPred } = makeBuiltins({
  applySubstTerm,
  applySubstTriple,
  unifyTerm,
  unifyTermListAppend,
  termsEqual,
  proveGoals,
  isGroundTerm,
  iriValue,
  skolemIriFromGroundTerm,
  computeConclusionFromFormula: __computeConclusionFromFormula,
  getSuperRestrictedMode: () => superRestrictedMode,
  termFastKey,
  ensureFactIndexes,
  termsEqualNoIntDecimal,
});

try {
  registerBuiltinModule(require('./builtin-sudoku'), './builtin-sudoku');
} catch (_) {}

// Initialize proof/output helpers (implemented in lib/explain.js).
const { printExplanation, collectOutputStringsFromFacts } = makeExplain({
  applySubstTerm,
  skolemKeyFromTerm,
});

function skolemizeTermForHeadBlanks(t, headBlankLabels, mapping, skCounter, firingKey, globalMap) {
  if (t instanceof Blank) {
    const label = t.label;
    // Only skolemize blanks that occur explicitly in the rule head
    if (!headBlankLabels || !headBlankLabels.has(label)) {
      return t; // this is a data blank (e.g. bound via ?X), keep it
    }

    if (!Object.prototype.hasOwnProperty.call(mapping, label)) {
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
  if (a.__tid && b.__tid && a.__tid === b.__tid) return true;

  // rdf:nil is equivalent to the empty list ()
  if (a instanceof Iri && a.value === RDF_NIL_IRI && b instanceof ListTerm && b.elems.length === 0) return true;
  if (b instanceof Iri && b.value === RDF_NIL_IRI && a instanceof ListTerm && a.elems.length === 0) return true;
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
  if (a.__tid && b.__tid && a.__tid === b.__tid) return true;

  // rdf:nil is equivalent to the empty list ()
  if (a instanceof Iri && a.value === RDF_NIL_IRI && b instanceof ListTerm && b.elems.length === 0) return true;
  if (b instanceof Iri && b.value === RDF_NIL_IRI && a instanceof ListTerm && a.elems.length === 0) return true;
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

function collectProtectedNamesInTerm(t, protectedVars, protectedBlanks) {
  if (t instanceof Var) {
    protectedVars.add(t.name);
    return;
  }
  if (t instanceof Blank) {
    protectedBlanks.add(t.label);
    return;
  }
  if (t instanceof ListTerm) {
    for (const e of t.elems) collectProtectedNamesInTerm(e, protectedVars, protectedBlanks);
    return;
  }
  if (t instanceof OpenListTerm) {
    for (const e of t.prefix) collectProtectedNamesInTerm(e, protectedVars, protectedBlanks);
    protectedVars.add(t.tailVar);
    return;
  }
  if (t instanceof GraphTerm) {
    for (const tr of t.triples) {
      collectProtectedNamesInTerm(tr.s, protectedVars, protectedBlanks);
      collectProtectedNamesInTerm(tr.p, protectedVars, protectedBlanks);
      collectProtectedNamesInTerm(tr.o, protectedVars, protectedBlanks);
    }
  }
}

function collectProtectedNamesFromSubst(subst) {
  const protectedVars = new Set();
  const protectedBlanks = new Set();
  if (!subst) return { protectedVars, protectedBlanks };
  for (const k in subst) {
    if (!Object.prototype.hasOwnProperty.call(subst, k)) continue;
    collectProtectedNamesInTerm(subst[k], protectedVars, protectedBlanks);
  }
  return { protectedVars, protectedBlanks };
}

// Alpha-equivalence for quoted formulas, up to *local* variable and blank-node renaming.
// Terms that originate from the surrounding substitution are treated as fixed and are
// therefore not alpha-renamable inside the quoted formula.
// Treats a formula as an unordered set of triples (order-insensitive match).
function alphaEqVarName(x, y, vmap, protectedVarsA, protectedVarsB) {
  const xProtected = protectedVarsA && protectedVarsA.has(x);
  const yProtected = protectedVarsB && protectedVarsB.has(y);
  if (xProtected || yProtected) return xProtected && yProtected && x === y;
  if (Object.prototype.hasOwnProperty.call(vmap, x)) return vmap[x] === y;
  vmap[x] = y;
  return true;
}

function alphaEqBlankLabel(x, y, bmap, protectedBlanksA, protectedBlanksB) {
  const xProtected = protectedBlanksA && protectedBlanksA.has(x);
  const yProtected = protectedBlanksB && protectedBlanksB.has(y);
  if (xProtected || yProtected) return xProtected && yProtected && x === y;
  if (Object.prototype.hasOwnProperty.call(bmap, x)) return bmap[x] === y;
  bmap[x] = y;
  return true;
}

function alphaEqTermInGraph(a, b, vmap, bmap, opts) {
  const protectedVarsA = opts && opts.protectedVarsA;
  const protectedVarsB = opts && opts.protectedVarsB;
  const protectedBlanksA = opts && opts.protectedBlanksA;
  const protectedBlanksB = opts && opts.protectedBlanksB;

  // Blank nodes: renamable only when they are local to the formula.
  if (a instanceof Blank && b instanceof Blank) {
    return alphaEqBlankLabel(a.label, b.label, bmap, protectedBlanksA, protectedBlanksB);
  }

  // Variables: renamable only when they are local to the formula.
  if (a instanceof Var && b instanceof Var) {
    return alphaEqVarName(a.name, b.name, vmap, protectedVarsA, protectedVarsB);
  }

  if (a instanceof Iri && b instanceof Iri) return a.value === b.value;
  if (a instanceof Literal && b instanceof Literal) return a.value === b.value;

  if (a instanceof ListTerm && b instanceof ListTerm) {
    if (a.elems.length !== b.elems.length) return false;
    for (let i = 0; i < a.elems.length; i++) {
      if (!alphaEqTermInGraph(a.elems[i], b.elems[i], vmap, bmap, opts)) return false;
    }
    return true;
  }

  if (a instanceof OpenListTerm && b instanceof OpenListTerm) {
    if (a.prefix.length !== b.prefix.length) return false;
    for (let i = 0; i < a.prefix.length; i++) {
      if (!alphaEqTermInGraph(a.prefix[i], b.prefix[i], vmap, bmap, opts)) return false;
    }
    // tailVar is a var-name string, so treat it as renamable too when local.
    return alphaEqVarName(a.tailVar, b.tailVar, vmap, protectedVarsA, protectedVarsB);
  }

  // Nested formulas: compare with fresh maps (separate scope), but keep the same
  // protected outer names so already-substituted terms stay fixed everywhere.
  if (a instanceof GraphTerm && b instanceof GraphTerm) {
    return alphaEqGraphTriples(a.triples, b.triples, opts);
  }

  return false;
}

function alphaEqTripleInGraph(a, b, vmap, bmap, opts) {
  return (
    alphaEqTermInGraph(a.s, b.s, vmap, bmap, opts) &&
    alphaEqTermInGraph(a.p, b.p, vmap, bmap, opts) &&
    alphaEqTermInGraph(a.o, b.o, vmap, bmap, opts)
  );
}

function alphaEqGraphTriples(xs, ys, opts) {
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
      if (!alphaEqTripleInGraph(x, y, v2, b2, opts)) continue;

      used[j] = true;
      if (step(i + 1, v2, b2)) return true;
      used[j] = false;
    }
    return false;
  }

  return step(0, {}, {});
}

// ===========================================================================
// Indexes (facts + backward rules)
// ===========================================================================
//
// Facts:
//   - __byPred: Map<predicateId, number[]>   (indices into facts array)
//   - __byPS:   Map<predicateId, Map<subjectId, number[]>>
//   - __byPO:   Map<predicateId, Map<objectId, number[]>>
//   - __keySet: Set<"S\tP\tO"> for Iri/Literal/Blank-only triples (fast dup check)
//
// Backward rules:
//   - __byHeadPred:   Map<headPredicateId, Rule[]>
//   - __wildHeadPred: Rule[] (non-IRI head predicate)

// Compound-term fast-key interning.
// Used to index strict-ground list literals without relying on object identity.
//
// This is a major performance win for N3 programs that use compound terms
// (especially lists) as subjects/objects, e.g. tabling-style encodings.
const __compoundKeyToTid = new Map();
// Use a negative id space so we never collide with __tid (which is positive).
let __nextCompoundTid = -1;

function __internCompoundTid(key) {
  const hit = __compoundKeyToTid.get(key);
  if (hit !== undefined) return hit;
  const id = __nextCompoundTid--;
  __compoundKeyToTid.set(key, id);
  return id;
}

function termFastKey(t) {
  // Atomic terms that already have a stable id.
  if (t instanceof Iri || t instanceof Blank) return t.__tid;

  if (t instanceof Literal) {
    // Very large literals intentionally skip global interning in prelude.js to
    // avoid retaining huge strings forever. Their per-object __tid is therefore
    // not value-stable, so using it here breaks duplicate detection for facts
    // such as long log:outputString blocks that are re-derived during forward
    // chaining. Fall back to a value-based key in that case.
    const norm = normalizeLiteralForTid(t.value);
    if (typeof norm === 'string' && norm.length > MAX_LITERAL_TID_LEN) return 'L:' + norm;
    return t.__tid;
  }

  // Structural fast key for strict-ground list terms.
  // We only index when every element has a fast key; otherwise return null.
  if (t instanceof ListTerm) {
    const cached = t.__ftid;
    if (cached !== undefined) return cached;

    const xs = t.elems;
    const parts = new Array(xs.length);
    for (let i = 0; i < xs.length; i++) {
      const k = termFastKey(xs[i]);
      if (k === null) return null;
      parts[i] = k;
    }

    // Use a compact separator; include length to avoid edge-case collisions.
    const key = 'L' + xs.length + '\u0001' + parts.join('\u0001');
    const id = __internCompoundTid(key);

    // Cache on the list object itself (lists are immutable in Eyeling).
    Object.defineProperty(t, '__ftid', { value: id, enumerable: false });
    return id;
  }

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
  if (
    facts.__byPred &&
    facts.__byPS &&
    facts.__byPO &&
    facts.__wildPred &&
    facts.__wildPS &&
    facts.__wildPO &&
    facts.__keySet
  )
    return;

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
  Object.defineProperty(facts, '__wildPred', {
    value: [],
    enumerable: false,
    writable: true,
  });
  Object.defineProperty(facts, '__wildPS', {
    value: new Map(),
    enumerable: false,
    writable: true,
  });
  Object.defineProperty(facts, '__wildPO', {
    value: new Map(),
    enumerable: false,
    writable: true,
  });
  Object.defineProperty(facts, '__keySet', {
    value: new Set(),
    enumerable: false,
    writable: true,
  });

  for (let i = 0; i < facts.length; i++) indexFact(facts, facts[i], i);
}

function indexFact(facts, tr, idx) {
  const sk = termFastKey(tr.s);
  const ok = termFastKey(tr.o);

  if (tr.p instanceof Iri) {
    // Use predicate term id as the primary key to avoid hashing long IRI strings.
    const pk = tr.p.__tid;

    let pb = facts.__byPred.get(pk);
    if (!pb) {
      pb = [];
      facts.__byPred.set(pk, pb);
    }
    pb.push(idx);

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
      psb.push(idx);
    }

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
      pob.push(idx);
    }
  } else {
    facts.__wildPred.push(idx);

    if (sk !== null) {
      let psb = facts.__wildPS.get(sk);
      if (!psb) {
        psb = [];
        facts.__wildPS.set(sk, psb);
      }
      psb.push(idx);
    }

    if (ok !== null) {
      let pob = facts.__wildPO.get(ok);
      if (!pob) {
        pob = [];
        facts.__wildPO.set(ok, pob);
      }
      pob.push(idx);
    }
  }

  const key = tripleFastKey(tr);
  if (key !== null) facts.__keySet.add(key);
}

function candidateFacts(facts, goal) {
  ensureFactIndexes(facts);

  if (goal.p instanceof Iri) {
    const pk = goal.p.__tid;

    const sk = termFastKey(goal.s);
    const ok = termFastKey(goal.o);

    /** @type {number[] | null} */
    let byPS = null;
    if (sk !== null) {
      const ps = facts.__byPS.get(pk);
      if (ps) byPS = ps.get(sk) || null;
    }

    /** @type {number[] | null} */
    let byPO = null;
    if (ok !== null) {
      const po = facts.__byPO.get(pk);
      if (po) byPO = po.get(ok) || null;
    }

    let exact = null;
    if (byPS && byPO) exact = byPS.length <= byPO.length ? byPS : byPO;
    else if (byPS) exact = byPS;
    else if (byPO) exact = byPO;
    else exact = facts.__byPred.get(pk) || null;

    /** @type {number[] | null} */
    let wildPS = null;
    if (sk !== null) wildPS = facts.__wildPS.get(sk) || null;

    /** @type {number[] | null} */
    let wildPO = null;
    if (ok !== null) wildPO = facts.__wildPO.get(ok) || null;

    let wild = null;
    if (wildPS && wildPO) wild = wildPS.length <= wildPO.length ? wildPS : wildPO;
    else if (wildPS) wild = wildPS;
    else if (wildPO) wild = wildPO;
    else wild = facts.__wildPred.length ? facts.__wildPred : null;

    return {
      exact: exact || null,
      wild: wild || null,
      exactLen: exact ? exact.length : 0,
      wildLen: wild ? wild.length : 0,
      totalLen: (exact ? exact.length : 0) + (wild ? wild.length : 0),
    };
  }

  return null;
}

function hasFactIndexed(facts, tr) {
  ensureFactIndexes(facts);

  const key = tripleFastKey(tr);
  if (key !== null) return facts.__keySet.has(key);

  if (tr.p instanceof Iri) {
    const pk = tr.p.__tid;

    const ok = termFastKey(tr.o);
    if (ok !== null) {
      const po = facts.__byPO.get(pk);
      if (po) {
        const pob = po.get(ok) || [];
        // Facts are all in the same graph. Different blank node labels represent
        // different existentials unless explicitly connected. Do NOT treat
        // triples as duplicates modulo blank renaming, or you'll incorrectly
        // drop facts like: _:sk_0 :x 8.0  (because _:b8 :x 8.0 exists).
        return pob.some((i) => triplesEqual(facts[i], tr));
      }
    }

    const pb = facts.__byPred.get(pk) || [];
    return pb.some((i) => triplesEqual(facts[i], tr));
  }

  // Non-IRI predicate: fall back to strict triple equality.
  return facts.some((t) => triplesEqual(t, tr));
}

function pushFactIndexed(facts, tr) {
  ensureFactIndexes(facts);
  const idx = facts.length;
  facts.push(tr);
  indexFact(facts, tr, idx);
}

function makeDerivedRecord(fact, rule, premises, subst, captureExplanations) {
  if (captureExplanations === false) return { fact };
  return new DerivedFact(fact, rule, premises.slice(), { ...subst });
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
    const k = head.p.__tid;
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

function isSinglePremiseAgendaRuleSafe(r, backRules) {
  if (!r || r.isFuse || !Array.isArray(r.premise) || r.premise.length !== 1) return false;

  // Keep agenda firing restricted to rules whose observable output order is
  // already stable in the legacy engine. Dynamic heads and head-blank
  // skolemization are deliberately left on the old path so example outputs keep
  // the same derived blank labels and rule-promotion behavior.
  if (r.__dynamicConclusionTerm) return false;
  if (r.__fromRulePromotion) return false;
  if (r.headBlankLabels && r.headBlankLabels.size) return false;

  const goal = r.premise[0];

  // Builtin-only bodies need the normal proveGoals path because they can
  // succeed without matching an extensional fact and may depend on scoped state.
  if (isBuiltinPred(goal.p)) return false;

  // Safe only when the sole premise cannot be satisfied via backward rules.
  // Otherwise matching just against newly-seen facts would be incomplete.
  ensureBackRuleIndexes(backRules);
  if (goal.p instanceof Iri) {
    if ((backRules.__byHeadPred.get(goal.p.__tid) || []).length) return false;
    if (backRules.__wildHeadPred.length) return false;
    return true;
  }

  return backRules.__wildHeadPred.length === 0;
}

function mergeSinglePremiseAgendaBuckets() {
  let out = null;
  let seen = null;

  for (let i = 0; i < arguments.length; i++) {
    const bucket = arguments[i];
    if (!bucket || bucket.length === 0) continue;

    if (out === null) {
      out = bucket.length === 1 ? [bucket[0]] : bucket.slice();
      if (bucket.length > 1) seen = new Set(out);
      continue;
    }

    if (!seen) seen = new Set(out);
    for (let j = 0; j < bucket.length; j++) {
      const entry = bucket[j];
      if (seen.has(entry)) continue;
      seen.add(entry);
      out.push(entry);
    }
  }

  return out;
}

function makeSinglePremiseAgendaIndex(forwardRules, backRules) {
  const index = {
    byPred: new Map(),
    byPS: new Map(),
    byPO: new Map(),
    wildPred: [],
    wildPS: new Map(),
    wildPO: new Map(),
    indexed: new Set(),
    size: 0,
  };

  function addToMapArray(m, k, v) {
    let bucket = m.get(k);
    if (!bucket) {
      bucket = [];
      m.set(k, bucket);
    }
    bucket.push(v);
  }

  for (let i = 0; i < forwardRules.length; i++) {
    const r = forwardRules[i];
    if (!isSinglePremiseAgendaRuleSafe(r, backRules)) continue;

    const goal = r.premise[0];
    const entry = {
      rule: r,
      ruleIndex: i,
      goal,
      goalPredTid: goal.p instanceof Iri ? goal.p.__tid : null,
      goalSKey: termFastKey(goal.s),
      goalOKey: termFastKey(goal.o),
    };

    index.indexed.add(r);
    index.size += 1;

    if (entry.goalPredTid !== null) {
      if (entry.goalSKey === null && entry.goalOKey === null) addToMapArray(index.byPred, entry.goalPredTid, entry);
      if (entry.goalSKey !== null) {
        let ps = index.byPS.get(entry.goalPredTid);
        if (!ps) {
          ps = new Map();
          index.byPS.set(entry.goalPredTid, ps);
        }
        addToMapArray(ps, entry.goalSKey, entry);
      }
      if (entry.goalOKey !== null) {
        let po = index.byPO.get(entry.goalPredTid);
        if (!po) {
          po = new Map();
          index.byPO.set(entry.goalPredTid, po);
        }
        addToMapArray(po, entry.goalOKey, entry);
      }
    } else {
      if (entry.goalSKey === null && entry.goalOKey === null) index.wildPred.push(entry);
      if (entry.goalSKey !== null) addToMapArray(index.wildPS, entry.goalSKey, entry);
      if (entry.goalOKey !== null) addToMapArray(index.wildPO, entry.goalOKey, entry);
    }
  }

  return index;
}

function getSinglePremiseAgendaCandidates(index, fact) {
  if (!index || index.size === 0) return null;

  const sk = termFastKey(fact.s);
  const ok = termFastKey(fact.o);

  let exact = null;
  if (fact.p instanceof Iri) {
    const pk = fact.p.__tid;
    const byPred = index.byPred.get(pk) || null;
    let byPS = null;
    if (sk !== null) {
      const ps = index.byPS.get(pk);
      if (ps) byPS = ps.get(sk) || null;
    }
    let byPO = null;
    if (ok !== null) {
      const po = index.byPO.get(pk);
      if (po) byPO = po.get(ok) || null;
    }

    exact = mergeSinglePremiseAgendaBuckets(byPred, byPS, byPO);
  }

  const wildPred = index.wildPred.length ? index.wildPred : null;
  let wildPS = null;
  if (sk !== null) wildPS = index.wildPS.get(sk) || null;

  let wildPO = null;
  if (ok !== null) wildPO = index.wildPO.get(ok) || null;

  const wild = mergeSinglePremiseAgendaBuckets(wildPred, wildPS, wildPO);

  if (!exact && !wild) return null;
  return { exact, wild, exactLen: exact ? exact.length : 0, wildLen: wild ? wild.length : 0 };
}

// ===========================================================================
// Special predicate helpers
// ===========================================================================

function isLogImplies(p) {
  return p instanceof Iri && p.value === LOG_NS + 'implies';
}

function isLogImpliedBy(p) {
  return p instanceof Iri && p.value === LOG_NS + 'impliedBy';
}

// ===========================================================================
// Completed-goal answer tables (minimal tabling)
// ===========================================================================
//
// This is intentionally conservative:
//   - only *completed* answer sets are cached
//   - pending goals are never exposed
//   - cache entries are invalidated whenever facts, backward rules, or the
//     scoped-snapshot context change
//
// So this improves reuse across repeated backward proofs without changing the
// semantics of recursive goals.

function goalTableScopeVersion(facts, backRules) {
  const factCount = Array.isArray(facts) ? facts.length : 0;
  const backRuleCount = Array.isArray(backRules) ? backRules.length : 0;
  const scopedLevel = facts && typeof facts.__scopedClosureLevel === 'number' ? facts.__scopedClosureLevel : 0;
  const hasScopedSnapshot = facts && facts.__scopedSnapshot ? 1 : 0;
  return `${factCount}|${backRuleCount}|${scopedLevel}|${hasScopedSnapshot}`;
}

function __makeGoalTable() {
  return {
    scopeVersion: null,
    entries: new Map(),
  };
}

function __attachGoalTable(scopeCarrier, goalTable) {
  if (!scopeCarrier) return goalTable;
  if (!hasOwn.call(scopeCarrier, 'goalTable')) {
    Object.defineProperty(scopeCarrier, 'goalTable', {
      value: goalTable,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  } else {
    scopeCarrier.goalTable = goalTable;
  }
  return goalTable;
}

function __ensureGoalTable(facts, backRules) {
  let table = (facts && facts.goalTable) || (backRules && backRules.goalTable) || null;
  if (!table) table = __makeGoalTable();
  __attachGoalTable(facts, table);
  __attachGoalTable(backRules, table);

  const version = goalTableScopeVersion(facts, backRules);
  if (table.scopeVersion !== version) {
    table.scopeVersion = version;
    table.entries.clear();
  }
  return table;
}

function __goalMemoTripleKey(tr) {
  return skolemKeyFromTerm(tr.s) + '\t' + skolemKeyFromTerm(tr.p) + '\t' + skolemKeyFromTerm(tr.o);
}

function __goalMemoKey(goals, subst, facts, opts) {
  const parts = new Array(goals.length);
  for (let i = 0; i < goals.length; i++) parts[i] = __goalMemoTripleKey(applySubstTriple(goals[i], subst || {}));
  const mode = opts && opts.deferBuiltins ? 'D1' : 'D0';
  const scopedLevel = facts && typeof facts.__scopedClosureLevel === 'number' ? facts.__scopedClosureLevel : 0;
  const scopedTag = facts && facts.__scopedSnapshot ? 'S' : 'N';
  let keepVarsTag = '';
  if (opts && opts.keepVars) {
    const keepVars = Array.isArray(opts.keepVars) ? opts.keepVars.slice() : Array.from(opts.keepVars);
    keepVars.sort();
    keepVarsTag = `|K:${keepVars.join(',')}`;
  }
  return `${mode}|${scopedTag}|${scopedLevel}${keepVarsTag}|${parts.join('\n')}`;
}

function __cloneGoalSolutions(solutions) {
  const out = new Array(solutions.length);
  for (let i = 0; i < solutions.length; i++) out[i] = { ...solutions[i] };
  return out;
}

function __canLookupGoalMemo(visited) {
  return !visited || visited.length === 0;
}

function __canStoreGoalMemo(visited, maxResults) {
  return (!visited || visited.length === 0) && !(typeof maxResults === 'number' && maxResults > 0);
}

// ===========================================================================
// Unification + substitution
// ===========================================================================

function containsVarTerm(t, v) {
  if (t instanceof Iri || t instanceof Literal || t instanceof Blank) return false;
  if (t instanceof Var) return t.name === v;
  if (t instanceof ListTerm) return t.elems.some((e) => containsVarTerm(e, v));
  if (t instanceof OpenListTerm) return t.prefix.some((e) => containsVarTerm(e, v)) || t.tailVar === v;
  if (t instanceof GraphTerm)
    return t.triples.some((tr) => containsVarTerm(tr.s, v) || containsVarTerm(tr.p, v) || containsVarTerm(tr.o, v));
  return false;
}

function isGroundTermInGraph(t) {
  // variables inside graph terms are treated as local placeholders,
  // so they don't make the *surrounding triple* non-ground.
  if (t instanceof OpenListTerm) return false;
  if (t instanceof ListTerm) return t.elems.every((e) => isGroundTermInGraph(e));
  if (t instanceof GraphTerm) return t.triples.every((tr) => isGroundTripleInGraph(tr));
  // Iri/Literal/Blank/Var are all OK inside formulas
  return true;
}

function isGroundTripleInGraph(tr) {
  return isGroundTermInGraph(tr.s) && isGroundTermInGraph(tr.p) && isGroundTermInGraph(tr.o);
}

function isGroundTerm(t) {
  if (t instanceof Iri || t instanceof Literal || t instanceof Blank) return true;
  if (t instanceof Var) return false;
  if (t instanceof ListTerm) return t.elems.every((e) => isGroundTerm(e));
  if (t instanceof OpenListTerm) return false;
  if (t instanceof GraphTerm) return t.triples.every((tr) => isGroundTripleInGraph(tr));
  return true;
}

function isGroundTriple(tr) {
  return isGroundTerm(tr.s) && isGroundTerm(tr.p) && isGroundTerm(tr.o);
}

// Canonical JSON-ish encoding for use as a Skolem cache key.
// We only *call* this on ground terms in log:skolem, but it is
// robust to seeing vars/open lists anyway.
function skolemKeyFromTerm(t) {
  function enc(u) {
    if (u instanceof Iri) return ['I', u.value];
    if (u instanceof Literal) return ['L', u.value];
    if (u instanceof Blank) return ['B', u.label];
    if (u instanceof Var) return ['V', u.name];
    if (u instanceof ListTerm) return ['List', u.elems.map(enc)];
    if (u instanceof OpenListTerm) return ['OpenList', u.prefix.map(enc), u.tailVar];
    if (u instanceof GraphTerm) return ['Graph', u.triples.map((tr) => [enc(tr.s), enc(tr.p), enc(tr.o)])];
    return ['Other', String(u)];
  }
  return JSON.stringify(enc(t));
}

function skolemIriFromGroundTerm(t) {
  // t must be ground (checked by caller).
  const key = skolemKeyFromTerm(t);
  let iri = skolemCache.get(key);
  if (!iri) {
    const id = skolemIdForKey(key);
    iri = internIri(SKOLEM_NS + id);
    skolemCache.set(key, iri);
  }
  return iri;
}

function applySubstTerm(t, s) {
  // Hot fast path: most terms are already-ground atomic terms.
  if (t instanceof Iri || t instanceof Literal || t instanceof Blank) return t;

  // Common case: variable
  if (t instanceof Var) {
    const first = s[t.name];
    if (first === undefined) return t;

    // Follow chains X -> Y -> ... until we hit a non-var or a cycle.
    // Avoid allocating a Set in the common case (short chains).
    let cur = first;
    const seen0 = t.name;
    let seen1 = null;
    let seen2 = null;
    let seenSet = null;
    let steps = 0;

    while (cur instanceof Var) {
      const name = cur.name;

      // Cycle check
      if (name === seen0 || name === seen1 || name === seen2 || (seenSet && seenSet.has(name))) {
        return cur;
      }

      if (steps == 0) {
        seen1 = name;
      } else if (steps == 1) {
        seen2 = name;
      } else if (steps == 2) {
        seenSet = new Set([seen0, seen1, seen2]);
        seenSet.add(name);
      } else if (seenSet) {
        seenSet.add(name);
      }

      const nxt = s[name];
      if (nxt === undefined) break;
      cur = nxt;

      steps += 1;
      // Safety guard against pathological substitutions
      if (steps > 1024) break;
    }

    if (cur instanceof Var) return cur;
    // Bound to a non-var term: apply substitution recursively in case it contains variables inside.
    return applySubstTerm(cur, s);
  }

  // Non-variable terms
  if (t instanceof ListTerm) {
    const xs = t.elems;
    let out = null;
    for (let i = 0; i < xs.length; i++) {
      const v = applySubstTerm(xs[i], s);
      if (out) {
        out.push(v);
      } else if (v !== xs[i]) {
        out = xs.slice(0, i);
        out.push(v);
      }
    }
    return out ? new ListTerm(out) : t;
  }

  if (t instanceof OpenListTerm) {
    const xs = t.prefix;
    let newPrefix = null;
    for (let i = 0; i < xs.length; i++) {
      const v = applySubstTerm(xs[i], s);
      if (newPrefix) {
        newPrefix.push(v);
      } else if (v !== xs[i]) {
        newPrefix = xs.slice(0, i);
        newPrefix.push(v);
      }
    }
    const prefixApplied = newPrefix || xs;

    const tailTerm = s[t.tailVar];
    if (tailTerm === undefined) {
      return prefixApplied === xs ? t : new OpenListTerm(prefixApplied, t.tailVar);
    }

    const tailApplied = applySubstTerm(tailTerm, s);
    if (tailApplied instanceof ListTerm) {
      if (prefixApplied.length === 0) return tailApplied;
      return new ListTerm(prefixApplied.concat(tailApplied.elems));
    } else if (tailApplied instanceof OpenListTerm) {
      if (prefixApplied.length === 0) return tailApplied;
      return new OpenListTerm(prefixApplied.concat(tailApplied.prefix), tailApplied.tailVar);
    } else {
      // Non-list tail binding: keep as open list (matches existing behavior).
      return prefixApplied === xs ? t : new OpenListTerm(prefixApplied, t.tailVar);
    }
  }

  if (t instanceof GraphTerm) {
    const xs = t.triples;
    let out = null;
    for (let i = 0; i < xs.length; i++) {
      const v = applySubstTriple(xs[i], s);
      if (out) {
        out.push(v);
      } else if (v !== xs[i]) {
        out = xs.slice(0, i);
        out.push(v);
      }
    }
    return out ? new GraphTerm(out) : t;
  }

  return t;
}

function applySubstTriple(tr, s) {
  const s2 = applySubstTerm(tr.s, s);
  const p2 = applySubstTerm(tr.p, s);
  const o2 = applySubstTerm(tr.o, s);
  if (s2 === tr.s && p2 === tr.p && o2 === tr.o) return tr;
  return new Triple(s2, p2, o2);
}

function iriValue(t) {
  return t instanceof Iri ? t.value : null;
}

function unifyOpenWithList(prefix, tailv, ys, subst) {
  if (ys.length < prefix.length) return null;
  let s2 = subst;
  for (let i = 0; i < prefix.length; i++) {
    s2 = unifyTerm(prefix[i], ys[i], s2);
    if (s2 === null) return null;
  }
  const rest = new ListTerm(ys.slice(prefix.length));
  s2 = unifyTerm(new Var(tailv), rest, s2);
  if (s2 === null) return null;
  return s2;
}

function unifyGraphTriples(xs, ys, subst) {
  if (xs.length !== ys.length) return null;

  // Fast path: exact same sequence.
  if (triplesListEqual(xs, ys)) return subst;

  // Backtracking match (order-insensitive), *threading* the substitution through.
  const used = new Array(ys.length).fill(false);

  function step(i, s) {
    if (i >= xs.length) return s;
    const x = xs[i];

    for (let j = 0; j < ys.length; j++) {
      if (used[j]) continue;
      const y = ys[j];

      // Cheap pruning when both predicates are IRIs.
      if (x.p instanceof Iri && y.p instanceof Iri && x.p.value !== y.p.value) continue;

      const s2 = unifyTriple(x, y, s); // IMPORTANT: use `s`, not {}
      if (s2 === null) continue;

      used[j] = true;
      const s3 = step(i + 1, s2);
      if (s3 !== null) return s3;
      used[j] = false;
    }
    return null;
  }

  return step(0, subst); // IMPORTANT: start from the incoming subst
}

function unifyTerm(a, b, subst) {
  return unifyTermWithOptions(a, b, subst, {
    boolValueEq: true,
    intDecimalEq: false,
  });
}

function unifyTermListAppend(a, b, subst) {
  // Keep list:append behavior: allow integer<->decimal exact equality,
  // but do NOT add boolean-value equivalence (preserves current semantics).
  return unifyTermWithOptions(a, b, subst, {
    boolValueEq: false,
    intDecimalEq: true,
  });
}

function unifyTermWithOptions(a, b, subst, opts) {
  a = applySubstTerm(a, subst);
  b = applySubstTerm(b, subst);

  // Normalize rdf:nil IRI to the empty list term, so it unifies with () and
  // list builtins treat it consistently.
  if (a instanceof Iri && a.value === RDF_NIL_IRI) a = EMPTY_LIST_TERM;
  if (b instanceof Iri && b.value === RDF_NIL_IRI) b = EMPTY_LIST_TERM;

  // Variable binding
  if (a instanceof Var) {
    const v = a.name;
    const t = b;
    if (t instanceof Var && t.name === v) return subst;
    if (containsVarTerm(t, v)) return null;
    const s2 = { ...subst };
    s2[v] = t;
    return s2;
  }
  if (b instanceof Var) {
    return unifyTermWithOptions(b, a, subst, opts);
  }

  // Fast path: identical atomic term ids (covers IRI, blank, and string/xsd:string equivalence)
  if (a.__tid && b.__tid && a.__tid === b.__tid) return subst;

  // Exact matches
  if (a instanceof Iri && b instanceof Iri && a.value === b.value) return subst;
  if (a instanceof Literal && b instanceof Literal && a.value === b.value) return subst;
  if (a instanceof Blank && b instanceof Blank && a.label === b.label) return subst;

  // Plain string vs xsd:string equivalence
  if (a instanceof Literal && b instanceof Literal) {
    if (literalsEquivalentAsXsdString(a.value, b.value)) return subst;
  }

  // Boolean-value equivalence (ONLY for normal unifyTerm)
  if (opts.boolValueEq && a instanceof Literal && b instanceof Literal) {
    const ai = parseBooleanLiteralInfo(a);
    const bi = parseBooleanLiteralInfo(b);
    if (ai && bi && ai.value === bi.value) return subst;
  }

  // Numeric-value match:
  // - always allow equality when datatype matches (existing behavior)
  // - optionally allow integer<->decimal exact equality (list:append only)
  if (a instanceof Literal && b instanceof Literal) {
    const ai = parseNumericLiteralInfo(a);
    const bi = parseNumericLiteralInfo(b);
    if (ai && bi) {
      if (ai.dt === bi.dt) {
        if (ai.kind === 'bigint' && bi.kind === 'bigint') {
          if (ai.value === bi.value) return subst;
        } else {
          const an = ai.kind === 'bigint' ? Number(ai.value) : ai.value;
          const bn = bi.kind === 'bigint' ? Number(bi.value) : bi.value;
          if (!Number.isNaN(an) && !Number.isNaN(bn) && an === bn) return subst;
        }
      }

      if (opts.intDecimalEq) {
        const intDt = XSD_NS + 'integer';
        const decDt = XSD_NS + 'decimal';
        if ((ai.dt === intDt && bi.dt === decDt) || (ai.dt === decDt && bi.dt === intDt)) {
          const intInfo = ai.dt === intDt ? ai : bi; // bigint
          const decInfo = ai.dt === decDt ? ai : bi; // number + lexStr
          const dec = parseXsdDecimalToBigIntScale(decInfo.lexStr);
          if (dec) {
            const scaledInt = intInfo.value * pow10n(dec.scale);
            if (scaledInt === dec.num) return subst;
          }
        }
      }
    }
  }

  // Open list vs concrete list
  if (a instanceof OpenListTerm && b instanceof ListTerm) {
    return unifyOpenWithList(a.prefix, a.tailVar, b.elems, subst);
  }
  if (a instanceof ListTerm && b instanceof OpenListTerm) {
    return unifyOpenWithList(b.prefix, b.tailVar, a.elems, subst);
  }

  // Open list vs open list
  if (a instanceof OpenListTerm && b instanceof OpenListTerm) {
    if (a.tailVar !== b.tailVar || a.prefix.length !== b.prefix.length) return null;
    let s2 = subst;
    for (let i = 0; i < a.prefix.length; i++) {
      s2 = unifyTermWithOptions(a.prefix[i], b.prefix[i], s2, opts);
      if (s2 === null) return null;
    }
    return s2;
  }

  // List terms
  if (a instanceof ListTerm && b instanceof ListTerm) {
    if (a.elems.length !== b.elems.length) return null;
    let s2 = subst;
    for (let i = 0; i < a.elems.length; i++) {
      s2 = unifyTermWithOptions(a.elems[i], b.elems[i], s2, opts);
      if (s2 === null) return null;
    }
    return s2;
  }

  // Graphs
  if (a instanceof GraphTerm && b instanceof GraphTerm) {
    const protectedNames = collectProtectedNamesFromSubst(subst);
    if (
      alphaEqGraphTriples(a.triples, b.triples, {
        protectedVarsA: protectedNames.protectedVars,
        protectedVarsB: protectedNames.protectedVars,
        protectedBlanksA: protectedNames.protectedBlanks,
        protectedBlanksB: protectedNames.protectedBlanks,
      })
    ) {
      return subst;
    }
    return unifyGraphTriples(a.triples, b.triples, subst);
  }

  return null;
}

function unifyTriple(pat, fact, subst) {
  // Predicates are usually the cheapest and most selective
  const s1 = unifyTerm(pat.p, fact.p, subst);
  if (s1 === null) return null;

  const s2 = unifyTerm(pat.s, fact.s, s1);
  if (s2 === null) return null;

  const s3 = unifyTerm(pat.o, fact.o, s2);
  return s3;
}

// Strategy: when the substitution is "large" or search depth is high,
// keep only bindings that are still relevant to:
//   - variables appearing in the remaining goals
//   - variables from the original goals (answer vars)
// plus the transitive closure of variables that appear inside kept bindings.
//
// This is semantics-preserving for the ongoing proof state.

function gcCollectVarsInTerm(t, out) {
  if (t instanceof Var) {
    out.add(t.name);
    return;
  }
  if (t instanceof ListTerm) {
    for (const e of t.elems) gcCollectVarsInTerm(e, out);
    return;
  }
  if (t instanceof OpenListTerm) {
    for (const e of t.prefix) gcCollectVarsInTerm(e, out);
    out.add(t.tailVar);
    return;
  }
  if (t instanceof GraphTerm) {
    for (const tr of t.triples) gcCollectVarsInTriple(tr, out);
    return;
  }
}

function gcCollectVarsInTriple(tr, out) {
  gcCollectVarsInTerm(tr.s, out);
  gcCollectVarsInTerm(tr.p, out);
  gcCollectVarsInTerm(tr.o, out);
}

function gcCollectVarsInGoals(goals, out) {
  for (const g of goals) gcCollectVarsInTriple(g, out);
}

function gcCompactForGoals(subst, goals, answerVars) {
  const keep = new Set(answerVars);
  gcCollectVarsInGoals(goals, keep);

  const expanded = new Set();
  const queue = Array.from(keep);

  while (queue.length) {
    const v = queue.pop();
    if (expanded.has(v)) continue;
    expanded.add(v);

    const bound = subst[v];
    if (bound === undefined) continue;

    const before = keep.size;
    gcCollectVarsInTerm(bound, keep);
    if (keep.size !== before) {
      for (const nv of keep) {
        if (!expanded.has(nv)) queue.push(nv);
      }
    }
  }

  const out = {};
  for (const k of Object.keys(subst)) {
    if (keep.has(k)) out[k] = subst[k];
  }
  return out;
}

// Helpers used by proveGoals() when deferring builtins.
// Pure checks are kept at module scope to avoid per-call allocations.
function __termHasVarOrBlank(t) {
  if (t instanceof Var || t instanceof Blank) return true;
  if (t instanceof ListTerm) return t.elems.some(__termHasVarOrBlank);
  if (t instanceof OpenListTerm) return true;
  if (t instanceof GraphTerm) return t.triples.some(__tripleHasVarOrBlank);
  return false;
}

function __tripleHasVarOrBlank(tr) {
  return __termHasVarOrBlank(tr.s) || __termHasVarOrBlank(tr.p) || __termHasVarOrBlank(tr.o);
}

function __builtinIsSatisfiableWhenFullyUnbound(pIriVal) {
  return (
    pIriVal === MATH_NS + 'sin' ||
    pIriVal === MATH_NS + 'cos' ||
    pIriVal === MATH_NS + 'tan' ||
    pIriVal === MATH_NS + 'asin' ||
    pIriVal === MATH_NS + 'acos' ||
    pIriVal === MATH_NS + 'atan' ||
    pIriVal === MATH_NS + 'sinh' ||
    pIriVal === MATH_NS + 'cosh' ||
    pIriVal === MATH_NS + 'tanh' ||
    pIriVal === MATH_NS + 'degrees' ||
    pIriVal === MATH_NS + 'negation'
  );
}

function proveGoals(goals, subst, facts, backRules, depth, visited, varGen, maxResults, opts) {
  const goalTable = __canLookupGoalMemo(visited) ? __ensureGoalTable(facts, backRules) : null;
  const goalMemoKeyNow = goalTable ? __goalMemoKey(goals, subst, facts, opts) : null;
  if (goalTable && goalTable.entries.has(goalMemoKeyNow)) {
    const cached = goalTable.entries.get(goalMemoKeyNow) || [];
    const cloned = __cloneGoalSolutions(cached);
    if (typeof maxResults === 'number' && maxResults > 0 && cloned.length > maxResults)
      return cloned.slice(0, maxResults);
    return cloned;
  }

  // Depth-first search with a single mutable substitution and a trail.
  // This avoids cloning the whole substitution object at each unification step
  // (Prolog-style: bind + trail, then undo on backtrack).
  //
  // IMPORTANT: This implementation is fully iterative (no JS recursion), so
  // extremely deep backward proofs (e.g. examples/ackermann.n3) do not overflow
  // the JavaScript call stack.
  const results = [];
  const max = typeof maxResults === 'number' && maxResults > 0 ? maxResults : Infinity;

  // IMPORTANT: Goal reordering / deferral is only enabled when explicitly
  // requested by the caller (used for forward rules).
  const allowDeferredBuiltins = !!(opts && opts.deferBuiltins);

  const initialGoals = Array.isArray(goals) ? goals.slice() : [];
  const substMut = subst ? { ...subst } : {};
  const initialVisited = visited ? visited.slice() : [];

  // Variables from the original goal list (needed by the caller to instantiate conclusions)
  const answerVars = new Set();
  gcCollectVarsInGoals(initialGoals, answerVars);
  if (opts && opts.keepVars) {
    for (const v of opts.keepVars) answerVars.add(v);
  }

  if (!initialGoals.length) {
    results.push(gcCompactForGoals(substMut, [], answerVars));
    if (goalTable && __canStoreGoalMemo(visited, maxResults)) {
      goalTable.entries.set(goalMemoKeyNow, __cloneGoalSolutions(results));
    }
    return results;
  }

  // Trail of variable names that were newly bound in substMut.
  const trail = [];

  function applyDeltaToSubst(delta) {
    for (const k in delta) {
      if (!Object.prototype.hasOwnProperty.call(delta, k)) continue;
      const v = delta[k];

      if (Object.prototype.hasOwnProperty.call(substMut, k)) {
        if (!termsEqual(substMut[k], v)) return false;
      } else {
        substMut[k] = v;
        trail.push(k);
      }
    }
    return true;
  }

  function undoTo(mark) {
    for (let i = trail.length - 1; i >= mark; i--) {
      delete substMut[trail[i]];
    }
    trail.length = mark;
  }

  // ---------------------------------------------------------------------------
  // Visited set (loop check) implemented as a trail-backed multiset
  // ---------------------------------------------------------------------------
  // The previous implementation used an array + concat at each step:
  //   visitedForRules = visitedNow.concat([goal0]);
  // which becomes O(n^2) for very deep proofs. Here we use a Map-backed multiset
  // with backtracking support (like the substitution trail).
  const visitedCounts = new Map(); // key -> count
  const visitedTrail = []; // stack of keys in insertion order

  const termKeyCache = typeof WeakMap === 'function' ? new WeakMap() : null;

  function termKeyForVisited(t) {
    if (t instanceof Iri && t.value === RDF_NIL_IRI) return '()';
    if (t instanceof ListTerm && t.elems.length === 0) return '()';

    if (termKeyCache && t && typeof t === 'object') {
      const cached = termKeyCache.get(t);
      if (cached) return cached;
    }

    let out;
    if (t instanceof Var) {
      out = 'V:' + t.name;
    } else if (t instanceof Literal) {
      // Match termsEqual() semantics for booleans and numerics where possible.
      const bi = parseBooleanLiteralInfo(t);
      if (bi) {
        out = 'LB:' + (bi.value ? '1' : '0');
      } else {
        const ni = parseNumericLiteralInfo(t);
        if (ni) {
          if (ni.kind === 'bigint') {
            out = 'LN:' + ni.dt + ':' + ni.value.toString();
          } else if (typeof ni.value === 'number' && Number.isNaN(ni.value)) {
            // NaN is never equal to NaN under termsEqual numeric comparison.
            out = 'L#' + (t.__tid || String(t.value));
          } else {
            out = 'LN:' + ni.dt + ':' + String(ni.value);
          }
        } else {
          out = 'L#' + (t.__tid || String(t.value));
        }
      }
    } else if (t && t.__tid) {
      // Iri / Blank and other atomic interned terms
      out = 'T' + t.__tid;
    } else if (t instanceof ListTerm) {
      out = '[' + t.elems.map(termKeyForVisited).join(',') + ']';
    } else if (t instanceof OpenListTerm) {
      out = '[open:' + t.prefix.map(termKeyForVisited).join(',') + '|tail:' + t.tailVar + ']';
    } else if (t instanceof GraphTerm) {
      out =
        '{' +
        t.triples
          .map((tr) => termKeyForVisited(tr.s) + ' ' + termKeyForVisited(tr.p) + ' ' + termKeyForVisited(tr.o))
          .join(';') +
        '}';
    } else {
      // Fallback (rare)
      out = skolemKeyFromTerm(t);
    }

    if (termKeyCache && t && typeof t === 'object') termKeyCache.set(t, out);
    return out;
  }

  function tripleKeyForVisited(tr) {
    return termKeyForVisited(tr.s) + '\t' + termKeyForVisited(tr.p) + '\t' + termKeyForVisited(tr.o);
  }

  function pushVisitedKey(key) {
    visitedTrail.push(key);
    visitedCounts.set(key, (visitedCounts.get(key) || 0) + 1);
  }

  function undoVisitedKeysTo(mark) {
    for (let i = visitedTrail.length - 1; i >= mark; i--) {
      const k = visitedTrail[i];
      const c = visitedCounts.get(k);
      if (c === 1) visitedCounts.delete(k);
      else visitedCounts.set(k, c - 1);
    }
    visitedTrail.length = mark;
  }

  for (const tr of initialVisited) pushVisitedKey(tripleKeyForVisited(tr));

  // ---------------------------------------------------------------------------
  // In-place unification into the mutable substitution + trail.
  // ---------------------------------------------------------------------------
  function bindVarTrail(varName, t) {
    // t is assumed already substitution-applied (or at least safe to bind).
    if (Object.prototype.hasOwnProperty.call(substMut, varName)) {
      return unifyTermTrail(substMut[varName], t);
    }
    if (t instanceof Var && t.name === varName) return true;
    if (containsVarTerm(t, varName)) return false;
    substMut[varName] = t;
    trail.push(varName);
    return true;
  }

  function unifyOpenWithListTrail(prefix, tailVar, elems) {
    if (prefix.length > elems.length) return false;
    for (let i = 0; i < prefix.length; i++) {
      if (!unifyTermTrail(prefix[i], elems[i])) return false;
    }
    const rest = new ListTerm(elems.slice(prefix.length));
    return bindVarTrail(tailVar, rest);
  }

  function unifyTermTrail(a, b) {
    a = applySubstTerm(a, substMut);
    b = applySubstTerm(b, substMut);

    // Normalize rdf:nil IRI to the empty list term, so it unifies with () and
    // list builtins treat it consistently.
    if (a instanceof Iri && a.value === RDF_NIL_IRI) a = EMPTY_LIST_TERM;
    if (b instanceof Iri && b.value === RDF_NIL_IRI) b = EMPTY_LIST_TERM;

    if (a === b) return true;

    // Variable binding
    if (a instanceof Var) return bindVarTrail(a.name, b);
    if (b instanceof Var) return bindVarTrail(b.name, a);

    // Fast path: identical atomic term ids (covers IRI, blank, and string/xsd:string equivalence)
    if (a.__tid && b.__tid && a.__tid === b.__tid) return true;

    // Exact matches
    if (a instanceof Iri && b instanceof Iri && a.value === b.value) return true;
    if (a instanceof Literal && b instanceof Literal && a.value === b.value) return true;
    if (a instanceof Blank && b instanceof Blank && a.label === b.label) return true;

    // Plain string vs xsd:string equivalence
    if (a instanceof Literal && b instanceof Literal) {
      if (literalsEquivalentAsXsdString(a.value, b.value)) return true;
    }

    // Boolean-value equivalence (matches unifyTerm semantics)
    if (a instanceof Literal && b instanceof Literal) {
      const ai = parseBooleanLiteralInfo(a);
      const bi = parseBooleanLiteralInfo(b);
      if (ai && bi && ai.value === bi.value) return true;
    }

    // Numeric-value match (datatype must match; no int<->decimal equivalence here)
    if (a instanceof Literal && b instanceof Literal) {
      const ai = parseNumericLiteralInfo(a);
      const bi = parseNumericLiteralInfo(b);
      if (ai && bi && ai.dt === bi.dt) {
        if (ai.kind === 'bigint' && bi.kind === 'bigint') {
          if (ai.value === bi.value) return true;
        } else {
          const an = ai.kind === 'bigint' ? Number(ai.value) : ai.value;
          const bn = bi.kind === 'bigint' ? Number(bi.value) : bi.value;
          if (!Number.isNaN(an) && !Number.isNaN(bn) && an === bn) return true;
        }
      }
    }

    // Open list vs concrete list
    if (a instanceof OpenListTerm && b instanceof ListTerm) {
      return unifyOpenWithListTrail(a.prefix, a.tailVar, b.elems);
    }
    if (a instanceof ListTerm && b instanceof OpenListTerm) {
      return unifyOpenWithListTrail(b.prefix, b.tailVar, a.elems);
    }

    // Open list vs open list
    if (a instanceof OpenListTerm && b instanceof OpenListTerm) {
      if (a.tailVar !== b.tailVar || a.prefix.length !== b.prefix.length) return false;
      for (let i = 0; i < a.prefix.length; i++) {
        if (!unifyTermTrail(a.prefix[i], b.prefix[i])) return false;
      }
      return true;
    }

    // List terms
    if (a instanceof ListTerm && b instanceof ListTerm) {
      if (a.elems.length !== b.elems.length) return false;
      for (let i = 0; i < a.elems.length; i++) {
        if (!unifyTermTrail(a.elems[i], b.elems[i])) return false;
      }
      return true;
    }

    // Graphs
    if (a instanceof GraphTerm && b instanceof GraphTerm) {
      const protectedNames = collectProtectedNamesFromSubst(substMut);
      if (
        alphaEqGraphTriples(a.triples, b.triples, {
          protectedVarsA: protectedNames.protectedVars,
          protectedVarsB: protectedNames.protectedVars,
          protectedBlanksA: protectedNames.protectedBlanks,
          protectedBlanksB: protectedNames.protectedBlanks,
        })
      ) {
        return true;
      }
      // Fallback: reuse allocation-heavy graph unifier rarely hit in typical workloads.
      const delta = unifyGraphTriples(a.triples, b.triples, {});
      if (delta === null) return false;
      const mark = trail.length;
      for (const k in delta) {
        if (!Object.prototype.hasOwnProperty.call(delta, k)) continue;
        if (!bindVarTrail(k, delta[k])) {
          undoTo(mark);
          return false;
        }
      }
      return true;
    }

    return false;
  }

  function unifyTripleTrail(pat, fact) {
    // Predicates are usually the cheapest and most selective
    if (!unifyTermTrail(pat.p, fact.p)) return false;
    if (!unifyTermTrail(pat.s, fact.s)) return false;
    if (!unifyTermTrail(pat.o, fact.o)) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Iterative DFS execution
  // ---------------------------------------------------------------------------
  // Frame kinds:
  //  - node: process a goal list
  //  - undo: backtrack to a prior (subst trail mark, visited mark)
  //  - ruleIter: iterate candidate backward rules for one goal
  //  - factIter: iterate candidate facts for one goal
  //  - deltaIter: iterate builtin deltas for one goal
  const stack = [];
  stack.push({
    kind: 'node',
    goalsNow: initialGoals,
    curDepth: depth || 0,
    canDeferBuiltins: allowDeferredBuiltins,
    deferCount: 0,
  });

  while (stack.length && results.length < max) {
    const frame = stack.pop();

    if (frame.kind === 'undo') {
      undoTo(frame.substMark);
      undoVisitedKeysTo(frame.visitedMark);
      continue;
    }

    if (frame.kind === 'deltaIter') {
      const deltas = frame.deltas;
      while (frame.idx < deltas.length && results.length < max) {
        const delta = deltas[frame.idx++];
        const mark = trail.length;
        if (!applyDeltaToSubst(delta)) {
          undoTo(mark);
          continue;
        }

        if (!frame.restGoals.length) {
          results.push(gcCompactForGoals(substMut, [], answerVars));
          undoTo(mark);
          if (results.length >= max) return results;
          continue;
        }

        // Continue with remaining goals under this delta, then backtrack, then resume delta iteration.
        stack.push(frame);
        stack.push({ kind: 'undo', substMark: mark, visitedMark: visitedTrail.length });
        stack.push({
          kind: 'node',
          goalsNow: frame.restGoals,
          curDepth: frame.curDepth + 1,
          canDeferBuiltins: frame.canDeferBuiltins,
          deferCount: 0,
        });
        break;
      }
      continue;
    }

    if (frame.kind === 'ruleIter') {
      const rules = frame.rules;
      while (frame.idx < rules.length && results.length < max) {
        const r = rules[frame.idx++];
        if (r.conclusion.length !== 1) continue;
        const rawHead = r.conclusion[0];
        if (rawHead.p instanceof Iri && rawHead.p.__tid !== frame.goalPtid) continue;

        const rStd = standardizeRule(r, varGen);
        const head = rStd.conclusion[0];

        const mark = trail.length;
        if (!unifyTripleTrail(head, frame.goal0)) {
          undoTo(mark);
          continue;
        }

        // If this goal is already on the ancestor chain, avoid picking rules
        // whose premises would immediately re-enter any already-visited goal.
        // This cheap guard restores completeness for cases like issue #9 while
        // still preventing trivial non-termination in mutually recursive rule
        // cycles.
        if (frame.goalWasVisited && rStd.premise && rStd.premise.length) {
          let hasCycle = false;
          for (let i = 0; i < rStd.premise.length; i++) {
            const premKey = tripleKeyForVisited(applySubstTriple(rStd.premise[i], substMut));
            if (visitedCounts.has(premKey)) {
              hasCycle = true;
              break;
            }
          }
          if (hasCycle) {
            undoTo(mark);
            continue;
          }
        }

        const newGoals = rStd.premise.concat(frame.restGoals);

        const vMark = visitedTrail.length;
        pushVisitedKey(frame.goalKey);

        // Explore the rule body; then undo; then resume trying further rules.
        stack.push(frame);
        stack.push({ kind: 'undo', substMark: mark, visitedMark: vMark });
        stack.push({
          kind: 'node',
          goalsNow: newGoals,
          curDepth: frame.curDepth + 1,
          canDeferBuiltins: false,
          deferCount: 0,
        });
        break;
      }
      continue;
    }

    if (frame.kind === 'factIter') {
      const factsList = frame.factsList;
      const candidates = frame.candidates;
      const isIndexed = !!candidates;

      while (frame.idx < (isIndexed ? candidates.totalLen : factsList.length) && results.length < max) {
        let f;
        if (isIndexed) {
          const idxNow = frame.idx++;
          if (idxNow < candidates.exactLen) f = factsList[candidates.exact[idxNow]];
          else f = factsList[candidates.wild[idxNow - candidates.exactLen]];
        } else {
          f = factsList[frame.idx++];
        }

        const mark = trail.length;
        if (!unifyTripleTrail(frame.goal0, f)) {
          undoTo(mark);
          continue;
        }

        if (!frame.restGoals.length) {
          results.push(gcCompactForGoals(substMut, [], answerVars));
          undoTo(mark);
          if (results.length >= max) return results;
          continue;
        }

        // Explore remaining goals; then undo; then resume trying further facts.
        stack.push(frame);
        stack.push({ kind: 'undo', substMark: mark, visitedMark: visitedTrail.length });
        stack.push({
          kind: 'node',
          goalsNow: frame.restGoals,
          curDepth: frame.curDepth + 1,
          canDeferBuiltins: frame.canDeferBuiltins,
          deferCount: 0,
        });
        break;
      }

      continue;
    }

    // frame.kind === 'node'
    const goalsNow = frame.goalsNow;
    if (!goalsNow.length) {
      results.push(gcCompactForGoals(substMut, [], answerVars));
      continue;
    }

    const rawGoal = goalsNow[0];
    const restGoals = goalsNow.length > 1 ? goalsNow.slice(1) : [];
    const goal0 = applySubstTriple(rawGoal, substMut);

    // 1) Builtins
    const goalPredicateIri = goal0.p instanceof Iri ? goal0.p.value : null;
    const isRdfFirstOrRest = goalPredicateIri === RDF_NS + 'first' || goalPredicateIri === RDF_NS + 'rest';
    const shouldTreatAsBuiltin =
      isBuiltinPred(goal0.p) &&
      !(isRdfFirstOrRest && !(goal0.s instanceof ListTerm || goal0.s instanceof OpenListTerm));

    if (shouldTreatAsBuiltin) {
      const remaining = max - results.length;
      if (remaining <= 0) continue;
      const builtinMax = Number.isFinite(remaining) && !restGoals.length ? remaining : undefined;

      let deltas = evalBuiltin(goal0, {}, facts, backRules, frame.curDepth, varGen, builtinMax);

      const dc = typeof frame.deferCount === 'number' ? frame.deferCount : 0;
      const builtinDeltasAreVacuous = deltas.length > 0 && deltas.every((d) => Object.keys(d).length === 0);

      if (
        frame.canDeferBuiltins &&
        (!deltas.length || builtinDeltasAreVacuous) &&
        restGoals.length &&
        __tripleHasVarOrBlank(goal0) &&
        dc < goalsNow.length
      ) {
        // Rotate this goal to the end and try others first.
        stack.push({
          kind: 'node',
          goalsNow: restGoals.concat([rawGoal]),
          curDepth: frame.curDepth,
          canDeferBuiltins: frame.canDeferBuiltins,
          deferCount: dc + 1,
        });
        continue;
      }

      const subjectAndObjectAreFullyUnbound =
        (goal0.s instanceof Var || goal0.s instanceof Blank) && (goal0.o instanceof Var || goal0.o instanceof Blank);

      if (
        frame.canDeferBuiltins &&
        !deltas.length &&
        __builtinIsSatisfiableWhenFullyUnbound(goalPredicateIri) &&
        subjectAndObjectAreFullyUnbound &&
        (!restGoals.length || dc >= goalsNow.length)
      ) {
        deltas = [{}];
      }

      if (deltas.length) {
        stack.push({
          kind: 'deltaIter',
          deltas,
          idx: 0,
          restGoals,
          curDepth: frame.curDepth,
          canDeferBuiltins: frame.canDeferBuiltins,
        });
      }
      continue;
    }

    // 2) Loop check for backward reasoning
    //
    // A strict ancestor loop check ("if visited then fail") is fast but
    // incomplete. It breaks common Horn patterns where a goal appears again in
    // a sibling branch and can still succeed via a different (non-cyclic) rule.
    //
    // Example (issue #9):
    //   Human <= Woman.
    //   Animal <= Human.
    //   label <= Human, Animal.
    // While proving Animal we need to re-prove Human, even though Human is an
    // ancestor goal. EYE succeeds; a strict loop check prunes it.
    //
    // We therefore *allow* re-entering a visited goal, but when a goal is
    // already visited we avoid applying backward rules whose premises would
    // immediately re-enter any visited goal again (a cheap cycle guard).
    const goalKey = tripleKeyForVisited(goal0);
    const goalWasVisited = visitedCounts.has(goalKey);

    // 3) Backward rules (indexed by head predicate) — explored first
    if (goal0.p instanceof Iri) {
      ensureBackRuleIndexes(backRules);
      const candRules = (backRules.__byHeadPred.get(goal0.p.__tid) || []).concat(backRules.__wildHeadPred);

      // facts should be tried *after* rules; push fact iterator first (below rules on the stack)
      const candidates = candidateFacts(facts, goal0);
      stack.push({
        kind: 'factIter',
        factsList: facts,
        candidates,
        idx: 0,
        goal0,
        restGoals,
        curDepth: frame.curDepth,
        canDeferBuiltins: frame.canDeferBuiltins,
      });

      // Then push rule iterator
      if (candRules.length) {
        stack.push({
          kind: 'ruleIter',
          rules: candRules,
          idx: 0,
          goal0,
          restGoals,
          curDepth: frame.curDepth,
          goalKey,
          goalPtid: goal0.p.__tid,
          goalWasVisited,
        });
      }
    } else {
      // No IRI predicate: rule indexing doesn't apply; only try all facts.
      stack.push({
        kind: 'factIter',
        factsList: facts,
        candidates: null,
        idx: 0,
        goal0,
        restGoals,
        curDepth: frame.curDepth,
        canDeferBuiltins: frame.canDeferBuiltins,
      });
    }
  }

  if (goalTable && __canStoreGoalMemo(visited, maxResults)) {
    goalTable.entries.set(goalMemoKeyNow, __cloneGoalSolutions(results));
  }

  return results;
}

// ===========================================================================
// Forward chaining to fixpoint
// ===========================================================================

function __defaultFusePrefixEnv() {
  return {
    shrinkIri() {
      return null;
    },
  };
}

function __serializeFuseFormulaTriples(triples, prefixes) {
  if (!Array.isArray(triples) || triples.length === 0) return '{ }';
  return `{
${triples.map((tr) => `  ${tripleToN3(tr, prefixes)}`).join('\n')}
}`;
}

function __serializeFuseRule(rule, prefixes, subst /* optional */) {
  const pref = prefixes && typeof prefixes.shrinkIri === 'function' ? prefixes : __defaultFusePrefixEnv();
  const premise = Array.isArray(rule.premise)
    ? subst
      ? rule.premise.map((tr) => applySubstTriple(tr, subst))
      : rule.premise
    : [];

  const premiseText = premise.length ? __serializeFuseFormulaTriples(premise, pref) : 'true';

  let headText = 'true';
  if (rule.isFuse) {
    headText = 'false';
  } else if (rule.__dynamicConclusionTerm) {
    const dyn = subst ? applySubstTerm(rule.__dynamicConclusionTerm, subst) : rule.__dynamicConclusionTerm;
    headText = termToN3(dyn, pref);
  } else {
    const conclusion = Array.isArray(rule.conclusion)
      ? subst
        ? rule.conclusion.map((tr) => applySubstTriple(tr, subst))
        : rule.conclusion
      : [];
    headText = conclusion.length ? __serializeFuseFormulaTriples(conclusion, pref) : 'true';
  }

  const arrow = rule.isForward === false ? '<=' : '=>';
  return `${premiseText} ${arrow} ${headText} .`;
}

function __printTriggeredFuse(rule, prefixes, subst /* optional */, extraNote /* optional */) {
  console.log('# Inference fuse triggered.');
  if (extraNote) console.log(`# ${extraNote}`);

  const schematic = __serializeFuseRule(rule, prefixes, null);
  console.log('# Fired rule:');
  for (const line of schematic.split(/\r?\n/)) console.log('#   ' + line);

  if (subst) {
    const instantiated = __serializeFuseRule(rule, prefixes, subst);
    if (instantiated !== schematic) {
      console.log('# Matched instance:');
      for (const line of instantiated.split(/\r?\n/)) console.log('#   ' + line);
    }
  }
}

function forwardChain(facts, forwardRules, backRules, onDerived /* optional */, opts = {}) {
  enterReasoningRun();
  try {
    ensureFactIndexes(facts);
    ensureBackRuleIndexes(backRules);

    const goalTable = __makeGoalTable();
    __attachGoalTable(facts, goalTable);
    __attachGoalTable(backRules, goalTable);

    const captureExplanations = !(opts && opts.captureExplanations === false);
    const derivedForward = [];
    const varGen = [0];
    const skCounter = [0];

    // Speed up dynamic rule promotion by maintaining O(1) membership sets.
    // (Some workloads derive many rule-producing triples.)

    __ensureRuleKeySet(forwardRules);
    __ensureRuleKeySet(backRules);

    // Cache head blank-node skolemization per (rule firing, head blank label).
    // This prevents repeatedly generating fresh _:sk_N blanks for the *same*
    // rule+substitution instance across outer fixpoint iterations.
    const headSkolemCache = new Map();

    // Pre-compute per-rule metadata once (new forward rules are prepared on insertion).
    for (let i = 0; i < forwardRules.length; i++) __prepareForwardRule(forwardRules[i]);

    // Make rules visible to introspection builtins
    backRules.__allForwardRules = forwardRules;
    backRules.__allBackwardRules = backRules;

    // Closure level counter used by log:collectAllIn/log:forAllIn priority gating.
    // Level 0 means "no frozen snapshot" (during Phase A of each outer iteration).
    let scopedClosureLevel = 0;

    // Scan known rules for the maximum requested closure priority in scoped log:* goals.
    let maxScopedClosurePriorityNeeded = __computeMaxScopedClosurePriorityNeeded(forwardRules, backRules);

    // Conservative fast-skip for forward rules that cannot possibly succeed
    // until a scoped snapshot exists (or a given closure level is reached).
    // Helper functions are module-scoped: __computeForwardRuleScopedSkipInfo, etc.
    function setScopedSnapshot(snap, level) {
      if (!hasOwn.call(facts, '__scopedSnapshot')) {
        Object.defineProperty(facts, '__scopedSnapshot', {
          value: snap,
          enumerable: false,
          writable: true,
          configurable: true,
        });
      } else {
        facts.__scopedSnapshot = snap;
      }

      if (!hasOwn.call(facts, '__scopedClosureLevel')) {
        Object.defineProperty(facts, '__scopedClosureLevel', {
          value: level,
          enumerable: false,
          writable: true,
          configurable: true,
        });
      } else {
        facts.__scopedClosureLevel = level;
      }
    }

    function makeScopedSnapshot() {
      const snap = facts.slice();
      ensureFactIndexes(snap);
      Object.defineProperty(snap, '__scopedSnapshot', {
        value: snap,
        enumerable: false,
        writable: true,
        configurable: true,
      });
      // Propagate closure level so nested scoped builtins can see it.
      Object.defineProperty(snap, '__scopedClosureLevel', {
        value: scopedClosureLevel,
        enumerable: false,
        writable: true,
        configurable: true,
      });
      return snap;
    }

    function __skipForwardRuleNow(r) {
      // Skip forward rules that are guaranteed to "delay" due to scoped
      // builtins (log:collectAllIn / log:forAllIn / log:includes / log:notIncludes)
      // until a snapshot exists (and a certain closure level is reached).
      // This prevents expensive proofs that will definitely fail in Phase A
      // and in early closure levels.
      const info = r.__scopedSkipInfo;
      if (info && info.needsSnap) {
        const snapHere = facts.__scopedSnapshot || null;
        const lvlHere = (facts && typeof facts.__scopedClosureLevel === 'number' && facts.__scopedClosureLevel) || 0;
        if (!snapHere) return true;
        if (lvlHere < info.requiredLevel) return true;
      }

      // Optimization: if the rule head is **structurally ground** (no vars anywhere, even inside
      // quoted formulas) and has no head blanks, then the head does not depend on which body
      // solution we pick. In that case, we only need *one* proof of the body, and once all head
      // triples are already known we can skip proving the body entirely.
      const headIsStrictGround = r.__headIsStrictGround;
      if (headIsStrictGround) {
        let allKnown = true;
        for (const tr of r.conclusion) {
          if (!hasFactIndexed(facts, tr)) {
            allKnown = false;
            break;
          }
        }
        if (allKnown) return true;
      }

      return false;
    }

    function __emitForwardRuleSolution(r, ruleIndex, s) {
      let changedHere = false;
      let rulesChanged = false;

      // IMPORTANT: one skolem map per *rule firing*
      const skMap = {};
      const instantiatedPremises = r.premise.map((b) => applySubstTriple(b, s));
      const fireKey = __firingKey(ruleIndex, instantiatedPremises);

      // Support "dynamic" rule heads where the consequent is a term that
      // (after substitution) evaluates to a quoted formula.
      // Example: { :a :b ?C } => ?C.
      let dynamicHeadTriples = null;
      let headBlankLabelsHere = r.headBlankLabels;
      if (r.__dynamicConclusionTerm) {
        const dynTerm = applySubstTerm(r.__dynamicConclusionTerm, s);

        // Allow dynamic fuses: ... => ?X. where ?X becomes false
        if (dynTerm instanceof Literal && dynTerm.value === 'false') {
          __printTriggeredFuse(r, opts && opts.prefixes, s, 'Dynamic head resolved to false.');
          process.exit(2);
        }

        const dynTriples = __graphTriplesOrTrue(dynTerm);
        dynamicHeadTriples = dynTriples !== null ? dynTriples : [];

        // If the dynamic head contains explicit blank nodes, treat them as
        // head blanks for skolemization.
        const dynHeadBlankLabels =
          dynamicHeadTriples && dynamicHeadTriples.length ? collectBlankLabelsInTriples(dynamicHeadTriples) : null;
        if (dynHeadBlankLabels && dynHeadBlankLabels.size) {
          headBlankLabelsHere = new Set([...headBlankLabelsHere, ...dynHeadBlankLabels]);
        }
      }

      const headPatterns =
        dynamicHeadTriples && dynamicHeadTriples.length ? r.conclusion.concat(dynamicHeadTriples) : r.conclusion;

      for (const cpat of headPatterns) {
        const instantiated = applySubstTriple(cpat, s);

        const subj = instantiated.s;
        const obj = instantiated.o;

        const subjIsGraph = subj instanceof GraphTerm;
        const objIsGraph = obj instanceof GraphTerm;
        const subjIsTrue = subj instanceof Literal && subj.value === 'true';
        const objIsTrue = obj instanceof Literal && obj.value === 'true';

        const isFwRuleTriple =
          isLogImplies(instantiated.p) &&
          ((subjIsGraph && objIsGraph) || (subjIsTrue && objIsGraph) || (subjIsGraph && objIsTrue));

        const isBwRuleTriple =
          isLogImpliedBy(instantiated.p) &&
          ((subjIsGraph && objIsGraph) || (subjIsGraph && objIsTrue) || (subjIsTrue && objIsGraph));

        if (isFwRuleTriple || isBwRuleTriple) {
          if (!hasFactIndexed(facts, instantiated)) {
            pushFactIndexed(facts, instantiated);
            const df = makeDerivedRecord(instantiated, r, instantiatedPremises, s, captureExplanations);
            derivedForward.push(df);
            if (typeof onDerived === 'function') onDerived(df);
            changedHere = true;
          }

          // Promote rule-producing triples to live rules, treating literal true as {}.
          const left = __graphTriplesOrTrue(subj);
          const right = __graphTriplesOrTrue(obj);

          if (left !== null && right !== null) {
            if (isFwRuleTriple) {
              const [premise, conclusion] = liftBlankRuleVars(left, right);
              const headBlankLabels = collectBlankLabelsInTriples(conclusion);
              const newRule = new Rule(premise, conclusion, true, false, headBlankLabels);
              __prepareForwardRule(newRule);

              const key = __ruleKey(
                newRule.isForward,
                newRule.isFuse,
                newRule.premise,
                newRule.conclusion,
                newRule.__dynamicConclusionTerm || null,
              );
              if (!forwardRules.__ruleKeySet.has(key)) {
                forwardRules.__ruleKeySet.add(key);
                forwardRules.push(newRule);
                rulesChanged = true;
              }
            } else if (isBwRuleTriple) {
              const [premise, conclusion] = liftBlankRuleVars(right, left);
              const headBlankLabels = collectBlankLabelsInTriples(conclusion);
              const newRule = new Rule(premise, conclusion, false, false, headBlankLabels);

              const key = __ruleKey(
                newRule.isForward,
                newRule.isFuse,
                newRule.premise,
                newRule.conclusion,
                newRule.__dynamicConclusionTerm || null,
              );
              if (!backRules.__ruleKeySet.has(key)) {
                backRules.__ruleKeySet.add(key);
                backRules.push(newRule);
                indexBackRule(backRules, newRule);
                rulesChanged = true;
              }
            }
          }

          continue; // skip normal fact handling
        }

        // Only skolemize blank nodes that occur explicitly in the rule head
        const inst = skolemizeTripleForHeadBlanks(
          instantiated,
          headBlankLabelsHere,
          skMap,
          skCounter,
          fireKey,
          headSkolemCache,
        );

        if (!isGroundTriple(inst)) continue;
        if (hasFactIndexed(facts, inst)) continue;

        pushFactIndexed(facts, inst);
        const df = makeDerivedRecord(inst, r, instantiatedPremises, s, captureExplanations);
        derivedForward.push(df);
        if (typeof onDerived === 'function') onDerived(df);

        changedHere = true;
      }

      return { changedHere, rulesChanged };
    }

    function runFixpoint() {
      let anyChange = false;
      let agendaIndex = makeSinglePremiseAgendaIndex(forwardRules, backRules);
      let agendaCursor = 0;

      while (true) {
        let changed = false;

        while (agendaCursor < facts.length && agendaIndex.size) {
          const fact = facts[agendaCursor++];
          const candidates = getSinglePremiseAgendaCandidates(agendaIndex, fact);
          if (!candidates) continue;

          const total = candidates.exactLen + candidates.wildLen;
          for (let ci = 0; ci < total; ci++) {
            const entry = ci < candidates.exactLen ? candidates.exact[ci] : candidates.wild[ci - candidates.exactLen];
            const r = entry.rule;
            if (__skipForwardRuleNow(r)) continue;

            const s = unifyTriple(entry.goal, fact, {});
            if (s === null) continue;

            const outcome = __emitForwardRuleSolution(r, entry.ruleIndex, s);
            if (outcome.rulesChanged) {
              agendaIndex = makeSinglePremiseAgendaIndex(forwardRules, backRules);
              agendaCursor = 0;
            }
            if (outcome.changedHere) {
              changed = true;
              anyChange = true;
            }
          }
        }

        for (let i = 0; i < forwardRules.length; i++) {
          const r = forwardRules[i];
          if (agendaIndex.indexed.has(r)) continue;
          if (__skipForwardRuleNow(r)) continue;

          const headIsStrictGround = r.__headIsStrictGround;
          const maxSols = r.isFuse || headIsStrictGround ? 1 : undefined;
          // Enable builtin deferral / goal reordering for forward rules only.
          // This keeps forward-chaining conjunctions order-insensitive while
          // preserving left-to-right evaluation inside backward rules (<=),
          // which is important for termination on some programs (e.g., dijkstra).
          const sols = proveGoals(r.premise, null, facts, backRules, 0, null, varGen, maxSols, {
            deferBuiltins: true,
          });

          // Inference fuse
          if (r.isFuse && sols.length) {
            __printTriggeredFuse(r, opts && opts.prefixes, sols[0]);
            process.exit(2);
          }

          for (const s of sols) {
            const outcome = __emitForwardRuleSolution(r, i, s);
            if (outcome.rulesChanged) {
              agendaIndex = makeSinglePremiseAgendaIndex(forwardRules, backRules);
              agendaCursor = 0;
            }
            if (outcome.changedHere) {
              changed = true;
              anyChange = true;
            }
          }
        }

        if (!changed) {
          if (agendaCursor < facts.length && agendaIndex.size) continue;
          break;
        }
      }

      return anyChange;
    }

    while (true) {
      // Phase A: scoped builtins disabled => they “delay” (fail) during saturation
      setScopedSnapshot(null, 0);
      const changedA = runFixpoint();

      // Rules may have been added dynamically (rule-producing triples), possibly
      // introducing scoped builtins and/or higher closure priorities.
      maxScopedClosurePriorityNeeded = Math.max(
        maxScopedClosurePriorityNeeded,
        __computeMaxScopedClosurePriorityNeeded(forwardRules, backRules),
      );

      // If there are no scoped builtins in the entire program, Phase B is pure
      // overhead: it would just re-run the forward fixpoint and can double the
      // cost of expensive "query-like" forward rules.
      if (maxScopedClosurePriorityNeeded === 0) break;

      // Freeze saturated scope
      scopedClosureLevel += 1;
      const snap = makeScopedSnapshot();

      // Phase B: scoped builtins enabled, but they query only `snap`
      setScopedSnapshot(snap, scopedClosureLevel);
      const changedB = runFixpoint();

      // Phase B can also derive rule-producing triples.
      maxScopedClosurePriorityNeeded = Math.max(
        maxScopedClosurePriorityNeeded,
        __computeMaxScopedClosurePriorityNeeded(forwardRules, backRules),
      );

      if (!changedA && !changedB && scopedClosureLevel >= maxScopedClosurePriorityNeeded) break;
    }

    setScopedSnapshot(null, 0);

    return derivedForward;
  } finally {
    exitReasoningRun();
  }
}

// ---------------------------------------------------------------------------
// log:query output selection
// ---------------------------------------------------------------------------
// A top-level directive of the form:
//   { premise } log:query { conclusion }.
// does not add facts to the closure. Instead, when one or more such directives
// are present in the input, eyeling outputs only the **unique instantiated**
// conclusion triples for each solution of the premise (similar to a forward
// rule head projection).

function __tripleKeyForOutput(tr) {
  // Use a canonical structural encoding (covers lists and quoted graphs).
  // Note: this is used only for de-duplication of output triples.
  return skolemKeyFromTerm(tr.s) + '\t' + skolemKeyFromTerm(tr.p) + '\t' + skolemKeyFromTerm(tr.o);
}

function __withScopedSnapshotForQueries(facts, fn) {
  // Some scoped log:* builtins "delay" unless a frozen snapshot exists.
  // After forwardChain completes, we create a snapshot of the saturated
  // closure so query premises can use scoped builtins reliably.
  const oldSnap = hasOwn.call(facts, '__scopedSnapshot') ? facts.__scopedSnapshot : undefined;
  const oldLvl = hasOwn.call(facts, '__scopedClosureLevel') ? facts.__scopedClosureLevel : undefined;

  // Create a frozen snapshot of the saturated closure.
  const snap = facts.slice();
  ensureFactIndexes(snap);
  Object.defineProperty(snap, '__scopedSnapshot', {
    value: snap,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(snap, '__scopedClosureLevel', {
    value: Number.MAX_SAFE_INTEGER,
    enumerable: false,
    writable: true,
    configurable: true,
  });

  // Ensure the live facts array exposes the snapshot/level for builtins.
  if (!hasOwn.call(facts, '__scopedSnapshot')) {
    Object.defineProperty(facts, '__scopedSnapshot', {
      value: null,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }
  if (!hasOwn.call(facts, '__scopedClosureLevel')) {
    Object.defineProperty(facts, '__scopedClosureLevel', {
      value: 0,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }

  facts.__scopedSnapshot = snap;
  facts.__scopedClosureLevel = Number.MAX_SAFE_INTEGER;

  try {
    return fn();
  } finally {
    facts.__scopedSnapshot = oldSnap === undefined ? null : oldSnap;
    facts.__scopedClosureLevel = oldLvl === undefined ? 0 : oldLvl;
  }
}

function collectLogQueryConclusions(logQueryRules, facts, backRules, opts = {}) {
  const queryTriples = [];
  const queryDerived = [];
  const seen = new Set();

  if (!Array.isArray(logQueryRules) || logQueryRules.length === 0) {
    return { queryTriples, queryDerived };
  }

  ensureFactIndexes(facts);
  ensureBackRuleIndexes(backRules);

  const goalTable = __makeGoalTable();
  __attachGoalTable(facts, goalTable);
  __attachGoalTable(backRules, goalTable);

  const captureExplanations = !(opts && opts.captureExplanations === false);

  // Shared state across all query firings (mirrors forwardChain()).
  const varGen = [0];
  const skCounter = [0];
  const headSkolemCache = new Map();

  return __withScopedSnapshotForQueries(facts, () => {
    for (let qi = 0; qi < logQueryRules.length; qi++) {
      const r = logQueryRules[qi];
      if (!r || !Array.isArray(r.premise) || !Array.isArray(r.conclusion)) continue;

      const sols = proveGoals(r.premise, null, facts, backRules, 0, null, varGen, undefined, {
        deferBuiltins: true,
      });

      for (const s of sols) {
        const skMap = {};
        const instantiatedPremises = r.premise.map((b) => applySubstTriple(b, s));
        const fireKey = __firingKey(1000000 + qi, instantiatedPremises);

        // Support dynamic heads (same semantics as forwardChain).
        let dynamicHeadTriples = null;
        let headBlankLabelsHere = r.headBlankLabels;
        if (r.__dynamicConclusionTerm) {
          const dynTerm = applySubstTerm(r.__dynamicConclusionTerm, s);
          const dynTriples = __graphTriplesOrTrue(dynTerm);
          dynamicHeadTriples = dynTriples !== null ? dynTriples : [];
          const dynHeadBlankLabels =
            dynamicHeadTriples && dynamicHeadTriples.length ? collectBlankLabelsInTriples(dynamicHeadTriples) : null;
          if (dynHeadBlankLabels && dynHeadBlankLabels.size) {
            headBlankLabelsHere = new Set([...headBlankLabelsHere, ...dynHeadBlankLabels]);
          }
        }

        const headPatterns =
          dynamicHeadTriples && dynamicHeadTriples.length ? r.conclusion.concat(dynamicHeadTriples) : r.conclusion;

        for (const cpat of headPatterns) {
          const instantiated = applySubstTriple(cpat, s);
          const inst = skolemizeTripleForHeadBlanks(
            instantiated,
            headBlankLabelsHere,
            skMap,
            skCounter,
            fireKey,
            headSkolemCache,
          );
          if (!isGroundTriple(inst)) continue;
          const k = __tripleKeyForOutput(inst);
          if (seen.has(k)) continue;
          seen.add(k);
          queryTriples.push(inst);
          queryDerived.push(makeDerivedRecord(inst, r, instantiatedPremises, s, captureExplanations));
        }
      }
    }

    return { queryTriples, queryDerived };
  });
}

function forwardChainAndCollectLogQueryConclusions(
  facts,
  forwardRules,
  backRules,
  logQueryRules,
  onDerived,
  opts = {},
) {
  enterReasoningRun();
  try {
    // Forward chain first (saturates `facts`).
    const derived = forwardChain(facts, forwardRules, backRules, onDerived, opts);
    // Then collect query conclusions against the saturated closure.
    const { queryTriples, queryDerived } = collectLogQueryConclusions(logQueryRules, facts, backRules, opts);
    return { derived, queryTriples, queryDerived };
  } finally {
    exitReasoningRun();
  }
}

// (proof printing + log:outputString moved to lib/explain.js)

function reasonStream(input, opts = {}) {
  const {
    baseIri = null,
    proof = false,
    onDerived = null,
    includeInputFactsInClosure = true,
    enforceHttps = false,
    rdfjs = false,
    dataFactory = null,
    builtinModules = null,
  } = opts;

  const parsedInput = normalizeParsedReasonerInputSync(input);
  const rdfFactory = rdfjs ? getDataFactory(dataFactory) : null;

  const __oldEnforceHttps = deref.getEnforceHttpsEnabled();
  deref.setEnforceHttpsEnabled(!!enforceHttps);
  proofCommentsEnabled = !!proof;

  if (Array.isArray(builtinModules)) {
    for (const spec of builtinModules) loadBuiltinModule(spec);
  } else if (typeof builtinModules === 'string' && builtinModules) {
    loadBuiltinModule(builtinModules);
  }

  let prefixes, triples, frules, brules, logQueryRules;

  if (parsedInput) {
    prefixes = parsedInput.prefixes;
    triples = parsedInput.triples;
    frules = parsedInput.frules;
    brules = parsedInput.brules;
    logQueryRules = parsedInput.logQueryRules;
    if (baseIri) prefixes.setBase(baseIri);
  } else {
    const n3Text = normalizeReasonerInputSync(input);
    const toks = lex(n3Text);
    const parser = new Parser(toks);
    if (baseIri) parser.prefixes.setBase(baseIri);

    [prefixes, triples, frules, brules, logQueryRules] = parser.parseDocument();
  }
  // Make the parsed prefixes available to log:trace output
  trace.setTracePrefixes(prefixes);

  // Materialize anonymous rdf:first/rdf:rest collections into list terms.
  // Named list nodes keep identity; list:* builtins can traverse them.
  materializeRdfLists(triples, frules.concat(logQueryRules || []), brules);

  // facts becomes the saturated closure because pushFactIndexed(...) appends into it
  // Keep non-ground top-level facts (e.g., universally-quantified N3 variables)
  // so they can participate in rule matching. Derived/output facts remain ground-gated elsewhere.
  const facts = triples.slice();

  let derived = [];
  let queryTriples = [];
  let queryDerived = [];

  if (Array.isArray(logQueryRules) && logQueryRules.length) {
    // Query-selection mode: derive full closure, then output only the unique
    // instantiated conclusion triples of the log:query directives.
    const res = forwardChainAndCollectLogQueryConclusions(facts, frules, brules, logQueryRules, { prefixes });
    derived = res.derived;
    queryTriples = res.queryTriples;
    queryDerived = res.queryDerived;

    // For compatibility with the streaming callback signature, we emit the
    // query-selected triples (not all derived facts).
    if (typeof onDerived === 'function') {
      for (const qdf of queryDerived) {
        const payload = { triple: tripleToN3(qdf.fact, prefixes), df: qdf };
        if (rdfFactory) payload.quad = internalTripleToRdfJsQuad(qdf.fact, rdfFactory);
        onDerived(payload);
      }
    }
  } else {
    // Default mode: output only newly derived forward facts.
    derived = forwardChain(
      facts,
      frules,
      brules,
      (df) => {
        if (typeof onDerived === 'function') {
          const payload = {
            triple: tripleToN3(df.fact, prefixes),
            df,
          };
          if (rdfFactory) payload.quad = internalTripleToRdfJsQuad(df.fact, rdfFactory);
          onDerived(payload);
        }
      },
      { prefixes },
    );
  }

  const closureTriples =
    Array.isArray(logQueryRules) && logQueryRules.length
      ? queryTriples
      : includeInputFactsInClosure
        ? facts
        : derived.map((d) => d.fact);

  const closureN3 =
    Array.isArray(logQueryRules) && logQueryRules.length && !proof
      ? prettyPrintQueryTriples(closureTriples, prefixes)
      : closureTriples.map((t) => tripleToN3(t, prefixes)).join('\n');

  const __out = {
    prefixes,
    facts, // saturated closure (Triple[])
    derived, // DerivedFact[]
    queryMode: Array.isArray(logQueryRules) && logQueryRules.length ? true : false,
    queryTriples,
    queryDerived,
    closureN3,
  };

  if (rdfFactory) {
    __out.closureQuads = closureTriples.map((t) => internalTripleToRdfJsQuad(t, rdfFactory));
    __out.queryQuads = queryTriples.map((t) => internalTripleToRdfJsQuad(t, rdfFactory));
  }
  deref.setEnforceHttpsEnabled(__oldEnforceHttps);
  return __out;
}

function reasonRdfJs(input, opts = {}) {
  const { dataFactory = null, ...restOpts } = opts || {};
  const rdfFactory = getDataFactory(dataFactory);

  const queue = [];
  const waiters = [];
  let done = false;
  let failure = null;

  const flush = () => {
    while (waiters.length && (queue.length || done)) {
      const resolve = waiters.shift();
      if (queue.length) resolve({ value: queue.shift(), done: false });
      else if (failure) resolve(Promise.reject(failure));
      else resolve({ value: undefined, done: true });
    }
  };

  Promise.resolve().then(async () => {
    try {
      const normalizedInput = await normalizeReasonerInputAsync(input);
      reasonStream(normalizedInput, {
        ...restOpts,
        rdfjs: false,
        onDerived: ({ df }) => {
          queue.push(internalTripleToRdfJsQuad(df.fact, rdfFactory));
          flush();
        },
      });
    } catch (e) {
      failure = e;
    } finally {
      done = true;
      flush();
    }
  });

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next() {
      if (queue.length) return Promise.resolve({ value: queue.shift(), done: false });
      if (failure) return Promise.reject(failure);
      if (done) return Promise.resolve({ value: undefined, done: true });
      return new Promise((resolve) => waiters.push(resolve));
    },
  };
}

// Minimal export surface for Node + browser/worker
function main() {
  // Lazily require to avoid hard cycles in the module graph.
  return require('./cli').main();
}

// ---------------------------------------------------------------------------
// Internals (exposed for demo.html)
// ---------------------------------------------------------------------------
// The original monolithic eyeling.js exposed many internal functions and flags
// as globals. demo.html (web worker) still relies on a subset of these.

function getEnforceHttpsEnabled() {
  return deref.getEnforceHttpsEnabled();
}

function setEnforceHttpsEnabled(v) {
  deref.setEnforceHttpsEnabled(!!v);
}

function getProofCommentsEnabled() {
  return proofCommentsEnabled;
}

function setProofCommentsEnabled(v) {
  proofCommentsEnabled = !!v;
}

function getSuperRestrictedMode() {
  return superRestrictedMode;
}

function setSuperRestrictedMode(v) {
  superRestrictedMode = !!v;
}

function getTracePrefixes() {
  return trace.getTracePrefixes();
}

function setTracePrefixes(v) {
  trace.setTracePrefixes(v);
}

module.exports = {
  reasonStream,
  reasonRdfJs,
  collectLogQueryConclusions,
  forwardChainAndCollectLogQueryConclusions,
  collectOutputStringsFromFacts,
  main,
  version,
  N3SyntaxError,
  Parser,
  lex,
  // demo internals
  forwardChain,
  materializeRdfLists,
  isGroundTriple,
  printExplanation,
  // used by demo worker to stringify derived triples with prefixes
  tripleToN3,
  // pretty log:query output (when proof comments are disabled)
  prettyPrintQueryTriples,
  getEnforceHttpsEnabled,
  setEnforceHttpsEnabled,
  getProofCommentsEnabled,
  setProofCommentsEnabled,
  getSuperRestrictedMode,
  setSuperRestrictedMode,
  getTracePrefixes,
  setTracePrefixes,
  getDeterministicSkolemEnabled,
  setDeterministicSkolemEnabled,
  registerBuiltin,
  unregisterBuiltin,
  registerBuiltinModule,
  loadBuiltinModule,
  listBuiltinIris,
};
