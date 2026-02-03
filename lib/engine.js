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
const __EMPTY_LIST = new ListTerm([]);

const { lex, N3SyntaxError } = require('./lexer');
const { Parser } = require('./parser');
const { liftBlankRuleVars } = require('./rules');

const {
  makeBuiltins,
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
  listHasTriple,
} = require('./builtins');

const { makeExplain } = require('./explain');

const { tripleToN3 } = require('./printing');

const trace = require('./trace');
const { deterministicSkolemIdFromKey } = require('./skolem');

const deref = require('./deref');

const hasOwn = Object.prototype.hasOwnProperty;

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
let __skolemRunDepth = 0;
let __skolemRunSalt = null;

function __makeSkolemRunSalt() {
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
  } catch (_) {}

  // Node.js crypto
  try {
    if (nodeCrypto) {
      if (typeof nodeCrypto.randomUUID === 'function') return nodeCrypto.randomUUID();
      if (typeof nodeCrypto.randomBytes === 'function') return nodeCrypto.randomBytes(16).toString('hex');
    }
  } catch (_) {}

  // Last-resort fallback (not cryptographically strong)
  return (
    Date.now().toString(16) + '-' + Math.random().toString(16).slice(2) + '-' + Math.random().toString(16).slice(2)
  );
}

function __enterReasoningRun() {
  __skolemRunDepth += 1;
  if (__skolemRunDepth === 1) {
    skolemCache.clear();
    __skolemRunSalt = deterministicSkolemAcrossRuns ? '' : __makeSkolemRunSalt();
  }
}

function __exitReasoningRun() {
  if (__skolemRunDepth > 0) __skolemRunDepth -= 1;
  if (__skolemRunDepth === 0) {
    // Clear the salt so a future top-level run gets a fresh one (default mode).
    __skolemRunSalt = null;
  }
}

function __skolemIdForKey(key) {
  if (deterministicSkolemAcrossRuns) return deterministicSkolemIdFromKey(key);
  // Ensure we have a run salt even if log:skolem is invoked outside forwardChain().
  if (__skolemRunSalt === null) {
    skolemCache.clear();
    __skolemRunSalt = __makeSkolemRunSalt();
  }
  return deterministicSkolemIdFromKey(__skolemRunSalt + '|' + key);
}

function getDeterministicSkolemEnabled() {
  return deterministicSkolemAcrossRuns;
}

function setDeterministicSkolemEnabled(v) {
  deterministicSkolemAcrossRuns = !!v;
  // Reset per-run state so the new mode takes effect immediately for the next run.
  if (__skolemRunDepth === 0) {
    __skolemRunSalt = null;
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
function __ruleKey(isForward, isFuse, premise, conclusion) {
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

// Initialize proof/output helpers (implemented in lib/explain.js).
const { printExplanation, collectOutputStringsFromFacts } = makeExplain({
  applySubstTerm,
  skolemKeyFromTerm,
});

// ===========================================================================
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

// Alpha-equivalence for quoted formulas, up to *variable* and blank-node renaming.
// Treats a formula as an unordered set of triples (order-insensitive match).
function alphaEqVarName(x, y, vmap) {
  if (Object.prototype.hasOwnProperty.call(vmap, x)) return vmap[x] === y;
  vmap[x] = y;
  return true;
}

function alphaEqTermInGraph(a, b, vmap, bmap) {
  // Blank nodes: renamable
  if (a instanceof Blank && b instanceof Blank) {
    const x = a.label;
    const y = b.label;
    if (Object.prototype.hasOwnProperty.call(bmap, x)) return bmap[x] === y;
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

function termFastKey(t) {
  if (t instanceof Iri || t instanceof Blank || t instanceof Literal) return t.__tid;
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

  for (let i = 0; i < facts.length; i++) indexFact(facts, facts[i], i);
}

function indexFact(facts, tr, idx) {
  if (tr.p instanceof Iri) {
    // Use predicate term id as the primary key to avoid hashing long IRI strings.
    const pk = tr.p.__tid;

    let pb = facts.__byPred.get(pk);
    if (!pb) {
      pb = [];
      facts.__byPred.set(pk, pb);
    }
    pb.push(idx);

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
      psb.push(idx);
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

    if (byPS && byPO) return byPS.length <= byPO.length ? byPS : byPO;
    if (byPS) return byPS;
    if (byPO) return byPO;

    return facts.__byPred.get(pk) || [];
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
// Unification + substitution
// ===========================================================================

function containsVarTerm(t, v) {
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
    const id = __skolemIdForKey(key);
    iri = internIri(SKOLEM_NS + id);
    skolemCache.set(key, iri);
  }
  return iri;
}

function applySubstTerm(t, s) {
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
  if (a instanceof Iri && a.value === RDF_NIL_IRI) a = __EMPTY_LIST;
  if (b instanceof Iri && b.value === RDF_NIL_IRI) b = __EMPTY_LIST;

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
    if (alphaEqGraphTriples(a.triples, b.triples)) return subst;
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

function proveGoals(goals, subst, facts, backRules, depth, visited, varGen, maxResults, opts) {
  // Depth-first search with a single mutable substitution and a trail.
  // This avoids cloning the whole substitution object at each unification step
  // (Prolog-style: bind + trail, then undo on backtrack).
  const results = [];
  const max = typeof maxResults === 'number' && maxResults > 0 ? maxResults : Infinity;

  // IMPORTANT: Goal reordering / deferral is only enabled when explicitly
  // requested by the caller (used for forward rules).
  const __allowDeferBuiltins = !!(opts && opts.deferBuiltins);

  function termHasVarOrBlank(t) {
    if (t instanceof Var || t instanceof Blank) return true;
    if (t instanceof ListTerm) return t.elems.some(termHasVarOrBlank);
    if (t instanceof OpenListTerm) return true;
    if (t instanceof GraphTerm) return t.triples.some(tripleHasVarOrBlank);
    return false;
  }

  function tripleHasVarOrBlank(tr) {
    return termHasVarOrBlank(tr.s) || termHasVarOrBlank(tr.p) || termHasVarOrBlank(tr.o);
  }

  function isSatisfiableWhenFullyUnbound(pIriVal) {
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

  const initialGoals = Array.isArray(goals) ? goals.slice() : [];
  const substMut = subst ? { ...subst } : {};
  const initialVisited = visited ? visited.slice() : [];

  // Variables from the original goal list (needed by the caller to instantiate conclusions)
  const answerVars = new Set();
  gcCollectVarsInGoals(initialGoals, answerVars);

  if (!initialGoals.length) {
    results.push(gcCompactForGoals(substMut, [], answerVars));
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

  // In-place unification into the mutable substitution + trail.
  // This avoids allocating short-lived "delta" substitution objects on the hot path
  // (facts and backward-rule head matching).
  //
  // Semantics: identical to unifyTriple/unifyTerm (bool-value equivalence enabled,
  // integer<->decimal exact equivalence disabled).
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
    if (a instanceof Iri && a.value === RDF_NIL_IRI) a = __EMPTY_LIST;
    if (b instanceof Iri && b.value === RDF_NIL_IRI) b = __EMPTY_LIST;

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
      if (alphaEqGraphTriples(a.triples, b.triples)) return true;
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

  function dfs(goalsNow, curDepth, visitedNow, canDeferBuiltins, deferCount) {
    if (results.length >= max) return;
    if (!goalsNow.length) {
      results.push(gcCompactForGoals(substMut, [], answerVars));
      return;
    }

    const rawGoal = goalsNow[0];
    const restGoals = goalsNow.length > 1 ? goalsNow.slice(1) : [];
    const goal0 = applySubstTriple(rawGoal, substMut);

    // 1) Builtins
    const __pv0 = goal0.p instanceof Iri ? goal0.p.value : null;
    const __rdfFirstOrRest = __pv0 === RDF_NS + 'first' || __pv0 === RDF_NS + 'rest';
    const __treatBuiltin =
      isBuiltinPred(goal0.p) &&
      !(__rdfFirstOrRest && !(goal0.s instanceof ListTerm || goal0.s instanceof OpenListTerm));

    if (__treatBuiltin) {
      const remaining = max - results.length;
      if (remaining <= 0) return;
      const builtinMax = Number.isFinite(remaining) && !restGoals.length ? remaining : undefined;

      let deltas = evalBuiltin(goal0, {}, facts, backRules, curDepth, varGen, builtinMax);

      const dc = typeof deferCount === 'number' ? deferCount : 0;
      const __vacuous = deltas.length > 0 && deltas.every((d) => Object.keys(d).length === 0);

      if (
        canDeferBuiltins &&
        (!deltas.length || __vacuous) &&
        restGoals.length &&
        tripleHasVarOrBlank(goal0) &&
        dc < goalsNow.length
      ) {
        // Rotate this goal to the end and try others first.
        dfs(restGoals.concat([rawGoal]), curDepth, visitedNow, canDeferBuiltins, dc + 1);
        return;
      }

      const __fullyUnboundSO =
        (goal0.s instanceof Var || goal0.s instanceof Blank) && (goal0.o instanceof Var || goal0.o instanceof Blank);
      if (
        canDeferBuiltins &&
        !deltas.length &&
        isSatisfiableWhenFullyUnbound(__pv0) &&
        __fullyUnboundSO &&
        (!restGoals.length || dc >= goalsNow.length)
      ) {
        deltas = [{}];
      }

      for (const delta of deltas) {
        const mark = trail.length;
        if (!applyDeltaToSubst(delta)) {
          undoTo(mark);
          continue;
        }

        if (!restGoals.length) {
          results.push(gcCompactForGoals(substMut, [], answerVars));
          undoTo(mark);
          if (results.length >= max) return;
        } else {
          dfs(restGoals, curDepth + 1, visitedNow, canDeferBuiltins, 0);
          undoTo(mark);
          if (results.length >= max) return;
        }
      }
      return;
    }

    // 2) Loop check for backward reasoning
    if (listHasTriple(visitedNow, goal0)) return;
    const visitedForRules = visitedNow.concat([goal0]);

    // 3) Backward rules (indexed by head predicate) — explored first
    if (goal0.p instanceof Iri) {
      ensureBackRuleIndexes(backRules);
      const candRules = (backRules.__byHeadPred.get(goal0.p.__tid) || []).concat(backRules.__wildHeadPred);

      for (const r of candRules) {
        if (r.conclusion.length !== 1) continue;
        const rawHead = r.conclusion[0];
        if (rawHead.p instanceof Iri && rawHead.p.__tid !== goal0.p.__tid) continue;

        const rStd = standardizeRule(r, varGen);
        const head = rStd.conclusion[0];
        const mark = trail.length;
        if (!unifyTripleTrail(head, goal0)) {
          undoTo(mark);
          continue;
        }

        // No need to eagerly apply the head unifier to the body: dfs() will apply
        // the current substMut to each goal as it is selected.
        const newGoals = rStd.premise.concat(restGoals);

        // When we enter a backward rule body, preserve the original
        // (left-to-right) evaluation order to avoid non-termination.
        dfs(newGoals, curDepth + 1, visitedForRules, false, 0);

        undoTo(mark);
        if (results.length >= max) return;
      }
    }

    // 4) Try to satisfy the goal from known facts
    if (goal0.p instanceof Iri) {
      const candidates = candidateFacts(facts, goal0);
      for (const idx of candidates) {
        const f = facts[idx];
        const mark = trail.length;
        if (!unifyTripleTrail(goal0, f)) {
          undoTo(mark);
          continue;
        }

        if (!restGoals.length) {
          results.push(gcCompactForGoals(substMut, [], answerVars));
          undoTo(mark);
          if (results.length >= max) return;
        } else {
          dfs(restGoals, curDepth + 1, visitedNow, canDeferBuiltins, 0);
          undoTo(mark);
          if (results.length >= max) return;
        }
      }
    } else {
      for (const f of facts) {
        const mark = trail.length;
        if (!unifyTripleTrail(goal0, f)) {
          undoTo(mark);
          continue;
        }

        if (!restGoals.length) {
          results.push(gcCompactForGoals(substMut, [], answerVars));
          undoTo(mark);
          if (results.length >= max) return;
        } else {
          dfs(restGoals, curDepth + 1, visitedNow, canDeferBuiltins, 0);
          undoTo(mark);
          if (results.length >= max) return;
        }
      }
    }
  }

  dfs(initialGoals, depth || 0, initialVisited, __allowDeferBuiltins, 0);
  return results;
}

// ===========================================================================
// Forward chaining to fixpoint
// ===========================================================================

function forwardChain(facts, forwardRules, backRules, onDerived /* optional */) {
  __enterReasoningRun();
  try {
    ensureFactIndexes(facts);
    ensureBackRuleIndexes(backRules);

    const factList = facts.slice();
    const derivedForward = [];
    const varGen = [0];
    const skCounter = [0];

    // Speed up dynamic rule promotion by maintaining O(1) membership sets.
    // (Some workloads derive many rule-producing triples.)

    if (!hasOwn.call(forwardRules, '__ruleKeySet')) {
      Object.defineProperty(forwardRules, '__ruleKeySet', {
        value: new Set(forwardRules.map((r) => __ruleKey(r.isForward, r.isFuse, r.premise, r.conclusion))),
        enumerable: false,
        writable: false,
        configurable: true,
      });
    }
    if (!hasOwn.call(backRules, '__ruleKeySet')) {
      Object.defineProperty(backRules, '__ruleKeySet', {
        value: new Set(backRules.map((r) => __ruleKey(r.isForward, r.isFuse, r.premise, r.conclusion))),
        enumerable: false,
        writable: false,
        configurable: true,
      });
    }

    // Cache head blank-node skolemization per (rule firing, head blank label).
    // This prevents repeatedly generating fresh _:sk_N blanks for the *same*
    // rule+substitution instance across outer fixpoint iterations.
    const headSkolemCache = new Map();

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

    function runFixpoint() {
      let anyChange = false;

      while (true) {
        let changed = false;

        for (let i = 0; i < forwardRules.length; i++) {
          const r = forwardRules[i];

          // Skip forward rules that are guaranteed to "delay" due to scoped
          // builtins (log:collectAllIn / log:forAllIn / log:includes / log:notIncludes)
          // until a snapshot exists (and a certain closure level is reached).
          // This prevents expensive proofs that will definitely fail in Phase A
          // and in early closure levels.
          if (!hasOwn.call(r, '__scopedSkipInfo')) {
            const info = __computeForwardRuleScopedSkipInfo(r);
            Object.defineProperty(r, '__scopedSkipInfo', {
              value: info,
              enumerable: false,
              writable: false,
              configurable: true,
            });
          }
          const info = r.__scopedSkipInfo;
          if (info && info.needsSnap) {
            const snapHere = facts.__scopedSnapshot || null;
            const lvlHere =
              (facts && typeof facts.__scopedClosureLevel === 'number' && facts.__scopedClosureLevel) || 0;
            if (!snapHere) continue;
            if (lvlHere < info.requiredLevel) continue;
          }

          const empty = {};
          const visited = [];
          // Optimization: if the rule head is **structurally ground** (no vars anywhere, even inside
          // quoted formulas) and has no head blanks, then the head does not depend on which body
          // solution we pick. In that case, we only need *one* proof of the body, and once all head
          // triples are already known we can skip proving the body entirely.
          if (!hasOwn.call(r, '__headIsStrictGround')) {
            let strict = true;
            if (r.isFuse) strict = false;
            else if (r.headBlankLabels && r.headBlankLabels.size) strict = false;
            else {
              for (const tr of r.conclusion) {
                if (!__isStrictGroundTriple(tr)) {
                  strict = false;
                  break;
                }
              }
            }

            Object.defineProperty(r, '__headIsStrictGround', {
              value: strict,
              enumerable: false,
              writable: false,
              configurable: true,
            });
          }

          const headIsStrictGround = r.__headIsStrictGround;

          if (headIsStrictGround) {
            let allKnown = true;
            for (const tr of r.conclusion) {
              if (!hasFactIndexed(facts, tr)) {
                allKnown = false;
                break;
              }
            }
            if (allKnown) continue;
          }

          const maxSols = r.isFuse || headIsStrictGround ? 1 : undefined;
          // Enable builtin deferral / goal reordering for forward rules only.
          // This keeps forward-chaining conjunctions order-insensitive while
          // preserving left-to-right evaluation inside backward rules (<=),
          // which is important for termination on some programs (e.g., dijkstra).
          const sols = proveGoals(r.premise.slice(), empty, facts, backRules, 0, visited, varGen, maxSols, {
            deferBuiltins: true,
          });

          // Inference fuse
          if (r.isFuse && sols.length) {
            console.log('# Inference fuse triggered: a { ... } => false. rule fired.');
            process.exit(2);
          }

          for (const s of sols) {
            // IMPORTANT: one skolem map per *rule firing*
            const skMap = {};
            const instantiatedPremises = r.premise.map((b) => applySubstTriple(b, s));
            const fireKey = __firingKey(i, instantiatedPremises);

            for (const cpat of r.conclusion) {
              const instantiated = applySubstTriple(cpat, s);

              const isFwRuleTriple =
                isLogImplies(instantiated.p) &&
                ((instantiated.s instanceof GraphTerm && instantiated.o instanceof GraphTerm) ||
                  (instantiated.s instanceof Literal &&
                    instantiated.s.value === 'true' &&
                    instantiated.o instanceof GraphTerm) ||
                  (instantiated.s instanceof GraphTerm &&
                    instantiated.o instanceof Literal &&
                    instantiated.o.value === 'true'));

              const isBwRuleTriple =
                isLogImpliedBy(instantiated.p) &&
                ((instantiated.s instanceof GraphTerm && instantiated.o instanceof GraphTerm) ||
                  (instantiated.s instanceof GraphTerm &&
                    instantiated.o instanceof Literal &&
                    instantiated.o.value === 'true') ||
                  (instantiated.s instanceof Literal &&
                    instantiated.s.value === 'true' &&
                    instantiated.o instanceof GraphTerm));

              if (isFwRuleTriple || isBwRuleTriple) {
                if (!hasFactIndexed(facts, instantiated)) {
                  factList.push(instantiated);
                  pushFactIndexed(facts, instantiated);
                  const df = new DerivedFact(instantiated, r, instantiatedPremises.slice(), { ...s });
                  derivedForward.push(df);
                  if (typeof onDerived === 'function') onDerived(df);

                  changed = true;
                }

                // Promote rule-producing triples to live rules, treating literal true as {}.
                const left =
                  instantiated.s instanceof GraphTerm
                    ? instantiated.s.triples
                    : instantiated.s instanceof Literal && instantiated.s.value === 'true'
                      ? []
                      : null;

                const right =
                  instantiated.o instanceof GraphTerm
                    ? instantiated.o.triples
                    : instantiated.o instanceof Literal && instantiated.o.value === 'true'
                      ? []
                      : null;

                if (left !== null && right !== null) {
                  if (isFwRuleTriple) {
                    const [premise, conclusion] = liftBlankRuleVars(left, right);
                    const headBlankLabels = collectBlankLabelsInTriples(conclusion);
                    const newRule = new Rule(premise, conclusion, true, false, headBlankLabels);

                    const key = __ruleKey(newRule.isForward, newRule.isFuse, newRule.premise, newRule.conclusion);
                    if (!forwardRules.__ruleKeySet.has(key)) {
                      forwardRules.__ruleKeySet.add(key);
                      forwardRules.push(newRule);
                    }
                  } else if (isBwRuleTriple) {
                    const [premise, conclusion] = liftBlankRuleVars(right, left);
                    const headBlankLabels = collectBlankLabelsInTriples(conclusion);
                    const newRule = new Rule(premise, conclusion, false, false, headBlankLabels);

                    const key = __ruleKey(newRule.isForward, newRule.isFuse, newRule.premise, newRule.conclusion);
                    if (!backRules.__ruleKeySet.has(key)) {
                      backRules.__ruleKeySet.add(key);
                      backRules.push(newRule);
                      indexBackRule(backRules, newRule);
                    }
                  }
                }

                continue; // skip normal fact handling
              }

              // Only skolemize blank nodes that occur explicitly in the rule head
              const inst = skolemizeTripleForHeadBlanks(
                instantiated,
                r.headBlankLabels,
                skMap,
                skCounter,
                fireKey,
                headSkolemCache,
              );

              if (!isGroundTriple(inst)) continue;
              if (hasFactIndexed(facts, inst)) continue;

              factList.push(inst);
              pushFactIndexed(facts, inst);
              const df = new DerivedFact(inst, r, instantiatedPremises.slice(), {
                ...s,
              });
              derivedForward.push(df);
              if (typeof onDerived === 'function') onDerived(df);

              changed = true;
            }
          }
        }

        if (!changed) break;
        anyChange = true;
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
    __exitReasoningRun();
  }
}

// (proof printing + log:outputString moved to lib/explain.js)

function reasonStream(n3Text, opts = {}) {
  const {
    baseIri = null,
    proof = false,
    onDerived = null,
    includeInputFactsInClosure = true,
    enforceHttps = false,
  } = opts;

  const __oldEnforceHttps = deref.getEnforceHttpsEnabled();
  deref.setEnforceHttpsEnabled(!!enforceHttps);
  proofCommentsEnabled = !!proof;

  const toks = lex(n3Text);
  const parser = new Parser(toks);
  if (baseIri) parser.prefixes.setBase(baseIri);

  const [prefixes, triples, frules, brules] = parser.parseDocument();
  // Make the parsed prefixes available to log:trace output
  trace.setTracePrefixes(prefixes);

  // Materialize anonymous rdf:first/rdf:rest collections into list terms.
  // Named list nodes keep identity; list:* builtins can traverse them.
  materializeRdfLists(triples, frules, brules);

  // facts becomes the saturated closure because pushFactIndexed(...) appends into it
  const facts = triples.filter((tr) => isGroundTriple(tr));

  const derived = forwardChain(facts, frules, brules, (df) => {
    if (typeof onDerived === 'function') {
      onDerived({
        triple: tripleToN3(df.fact, prefixes),
        df,
      });
    }
  });

  const closureTriples = includeInputFactsInClosure ? facts : derived.map((d) => d.fact);

  const __out = {
    prefixes,
    facts, // saturated closure (Triple[])
    derived, // DerivedFact[]
    closureN3: closureTriples.map((t) => tripleToN3(t, prefixes)).join('\n'),
  };
  deref.setEnforceHttpsEnabled(__oldEnforceHttps);
  return __out;
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
};
