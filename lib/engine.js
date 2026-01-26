/**
 * Eyeling Reasoner — engine
 *
 * Core inference engine: unification, forward/backward chaining, builtin evaluation,
 * and proof/explanation bookkeeping. This module intentionally stays cohesive.
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
  RDF_JSON_DT,
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
  varsInRule,
  collectBlankLabelsInTriples,
  literalParts,
} = require('./prelude');

const { lex, N3SyntaxError, decodeN3StringEscapes } = require('./lexer');
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
  normalizeLiteralForFastKey,
  literalsEquivalentAsXsdString,
  termToJsString,
  termToJsStringDecoded,
  materializeRdfLists,
  // used by backward chaining
  standardizeRule,
  listHasTriple,
} = require('./builtins');

const { makeExplain } = require('./explain');

const { termToN3, tripleToN3 } = require('./printing');

const trace = require('./trace');
const time = require('./time');
const { deterministicSkolemIdFromKey } = require('./skolem');

const deref = require('./deref');

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
        return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
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
    Date.now().toString(16) +
    '-' +
    Math.random().toString(16).slice(2) +
    '-' +
    Math.random().toString(16).slice(2)
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
  if (t instanceof Blank) return 'B:' + t.label;
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
    // Fast path: unbound variable → no change
    const first = s[t.name];
    if (first === undefined) {
      return t;
    }

    // Follow chains X -> Y -> ... until we hit a non-var or a cycle.
    let cur = first;
    const seen = new Set([t.name]);
    while (cur instanceof Var) {
      const name = cur.name;
      if (seen.has(name)) break; // cycle
      seen.add(name);
      const nxt = s[name];
      if (!nxt) break;
      cur = nxt;
    }

    if (cur instanceof Var) {
      // Still a var: keep it as is (no need to clone)
      return cur;
    }
    // Bound to a non-var term: apply substitution recursively in case it
    // contains variables inside.
    return applySubstTerm(cur, s);
  }

  // Non-variable terms
  if (t instanceof ListTerm) {
    return new ListTerm(t.elems.map((e) => applySubstTerm(e, s)));
  }

  if (t instanceof OpenListTerm) {
    const newPrefix = t.prefix.map((e) => applySubstTerm(e, s));
    const tailTerm = s[t.tailVar];
    if (tailTerm !== undefined) {
      const tailApplied = applySubstTerm(tailTerm, s);
      if (tailApplied instanceof ListTerm) {
        return new ListTerm(newPrefix.concat(tailApplied.elems));
      } else if (tailApplied instanceof OpenListTerm) {
        return new OpenListTerm(newPrefix.concat(tailApplied.prefix), tailApplied.tailVar);
      } else {
        return new OpenListTerm(newPrefix, t.tailVar);
      }
    } else {
      return new OpenListTerm(newPrefix, t.tailVar);
    }
  }

  if (t instanceof GraphTerm) {
    return new GraphTerm(t.triples.map((tr) => applySubstTriple(tr, s)));
  }

  return t;
}

function applySubstTriple(tr, s) {
  return new Triple(applySubstTerm(tr.s, s), applySubstTerm(tr.p, s), applySubstTerm(tr.o, s));
}

function iriValue(t) {
  return t instanceof Iri ? t.value : null;
}

function unifyOpenWithList(prefix, tailv, ys, subst) {
  if (ys.length < prefix.length) return null;
  let s2 = { ...subst };
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
  if (triplesListEqual(xs, ys)) return { ...subst };

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

  return step(0, { ...subst }); // IMPORTANT: start from the incoming subst
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

  // Variable binding
  if (a instanceof Var) {
    const v = a.name;
    const t = b;
    if (t instanceof Var && t.name === v) return { ...subst };
    if (containsVarTerm(t, v)) return null;
    const s2 = { ...subst };
    s2[v] = t;
    return s2;
  }
  if (b instanceof Var) {
    return unifyTermWithOptions(b, a, subst, opts);
  }

  // Exact matches
  if (a instanceof Iri && b instanceof Iri && a.value === b.value) return { ...subst };
  if (a instanceof Literal && b instanceof Literal && a.value === b.value) return { ...subst };
  if (a instanceof Blank && b instanceof Blank && a.label === b.label) return { ...subst };

  // Plain string vs xsd:string equivalence
  if (a instanceof Literal && b instanceof Literal) {
    if (literalsEquivalentAsXsdString(a.value, b.value)) return { ...subst };
  }

  // Boolean-value equivalence (ONLY for normal unifyTerm)
  if (opts.boolValueEq && a instanceof Literal && b instanceof Literal) {
    const ai = parseBooleanLiteralInfo(a);
    const bi = parseBooleanLiteralInfo(b);
    if (ai && bi && ai.value === bi.value) return { ...subst };
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
          if (ai.value === bi.value) return { ...subst };
        } else {
          const an = ai.kind === 'bigint' ? Number(ai.value) : ai.value;
          const bn = bi.kind === 'bigint' ? Number(bi.value) : bi.value;
          if (!Number.isNaN(an) && !Number.isNaN(bn) && an === bn) return { ...subst };
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
            if (scaledInt === dec.num) return { ...subst };
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
    let s2 = { ...subst };
    for (let i = 0; i < a.prefix.length; i++) {
      s2 = unifyTermWithOptions(a.prefix[i], b.prefix[i], s2, opts);
      if (s2 === null) return null;
    }
    return s2;
  }

  // List terms
  if (a instanceof ListTerm && b instanceof ListTerm) {
    if (a.elems.length !== b.elems.length) return null;
    let s2 = { ...subst };
    for (let i = 0; i < a.elems.length; i++) {
      s2 = unifyTermWithOptions(a.elems[i], b.elems[i], s2, opts);
      if (s2 === null) return null;
    }
    return s2;
  }

  // Graphs
  if (a instanceof GraphTerm && b instanceof GraphTerm) {
    if (alphaEqGraphTriples(a.triples, b.triples)) return { ...subst };
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

function composeSubst(outer, delta) {
  if (!delta || Object.keys(delta).length === 0) {
    return { ...outer };
  }
  const out = { ...outer };
  for (const [k, v] of Object.entries(delta)) {
    if (out.hasOwnProperty(k)) {
      if (!termsEqual(out[k], v)) return null;
    } else {
      out[k] = v;
    }
  }
  return out;
}


// (builtins moved to lib/builtins.js)

// ===========================================================================
//
// Why: backward chaining with standardizeRule introduces fresh variables at
// each step. composeSubst frequently copies a growing substitution object.
// For deep linear recursions this becomes quadratic.
//
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

function substSizeOver(subst, limit) {
  let c = 0;
  for (const _k in subst) {
    if (++c > limit) return true;
  }
  return false;
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

function maybeCompactSubst(subst, goals, answerVars, depth) {
  // Keep the fast path fast.
  // Only compact when the substitution is clearly getting large, or
  // we are in a deep chain (where the quadratic behavior shows up).
  if (depth < 128 && !substSizeOver(subst, 256)) return subst;
  return gcCompactForGoals(subst, goals, answerVars);
}

function proveGoals(goals, subst, facts, backRules, depth, visited, varGen, maxResults, opts) {
  // Iterative DFS over proof states using an explicit stack.
  // Each state carries its own substitution and remaining goals.
  const results = [];
  const max = typeof maxResults === 'number' && maxResults > 0 ? maxResults : Infinity;

  // IMPORTANT: Goal reordering / deferral is only enabled when explicitly
  // requested by the caller (used for forward rules).
  const __allowDeferBuiltins = !!(opts && opts.deferBuiltins);

  // Some builtins (notably forward-only arithmetic ones like math:sum) can
  // only be evaluated once certain variables are bound by other goals in the
  // same conjunction. N3 conjunctions are order-insensitive, so when a builtin
  // goal currently yields no solutions but still contains unbound variables,
  // we treat it as *deferred* and try other goals first. A small cycle guard
  // prevents infinite rotation when no goal can make progress.

  function termHasVarOrBlank(t) {
    if (t instanceof Var || t instanceof Blank) return true;
    if (t instanceof ListTerm) return t.elems.some(termHasVarOrBlank);
    if (t instanceof OpenListTerm) return true; // tail var counts as unbound
    if (t instanceof GraphTerm) return t.triples.some(tripleHasVarOrBlank);
    return false;
  }

  function tripleHasVarOrBlank(tr) {
    return termHasVarOrBlank(tr.s) || termHasVarOrBlank(tr.p) || termHasVarOrBlank(tr.o);
  }

  // Some functional math relations (sin/cos/...) can be used as a pure
  // satisfiability check. When *both* sides are unbound we avoid infinite
  // enumeration by producing no bindings, but we still want the conjunction
  // to succeed once it has been fully deferred to the end.
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
  const initialSubst = subst ? { ...subst } : {};
  const initialVisited = visited ? visited.slice() : [];

  // Variables from the original goal list (needed by the caller to instantiate conclusions)
  const answerVars = new Set();
  gcCollectVarsInGoals(initialGoals, answerVars);
  if (!initialGoals.length) {
    results.push(gcCompactForGoals(initialSubst, [], answerVars));

    if (results.length >= max) return results;
    return results;
  }

  const stack = [
    {
      goals: initialGoals,
      subst: initialSubst,
      depth: depth || 0,
      visited: initialVisited,
      canDeferBuiltins: __allowDeferBuiltins,
      deferCount: 0,
    },
  ];

  while (stack.length) {
    const state = stack.pop();

    if (!state.goals.length) {
      results.push(gcCompactForGoals(state.subst, [], answerVars));

      if (results.length >= max) return results;
      continue;
    }

    const rawGoal = state.goals[0];
    const restGoals = state.goals.slice(1);
    const goal0 = applySubstTriple(rawGoal, state.subst);

    // 1) Builtins
    const __pv0 = goal0.p instanceof Iri ? goal0.p.value : null;
    const __rdfFirstOrRest = __pv0 === RDF_NS + 'first' || __pv0 === RDF_NS + 'rest';
    const __treatBuiltin =
      isBuiltinPred(goal0.p) && !(__rdfFirstOrRest && !(goal0.s instanceof ListTerm || goal0.s instanceof OpenListTerm));

    if (__treatBuiltin) {
      const remaining = max - results.length;
      if (remaining <= 0) return results;
      const builtinMax = Number.isFinite(remaining) && !restGoals.length ? remaining : undefined;
      let deltas = evalBuiltin(goal0, {}, facts, backRules, state.depth, varGen, builtinMax);

      // If the builtin currently yields no solutions but still contains
      // unbound variables, try other goals first (defer). This fixes
      // order-sensitivity for forward-only builtins like math:sum.
      const dc = typeof state.deferCount === 'number' ? state.deferCount : 0;
      if (
        state.canDeferBuiltins &&
        !deltas.length &&
        restGoals.length &&
        tripleHasVarOrBlank(goal0) &&
        dc < state.goals.length
      ) {
        stack.push({
          goals: restGoals.concat([rawGoal]),
          subst: state.subst,
          depth: state.depth,
          visited: state.visited,
          canDeferBuiltins: state.canDeferBuiltins,
          deferCount: dc + 1,
        });
        continue;
      }

      // If we've rotated through the whole conjunction without being able to
      // make progress, and this is a functional math relation with *both* sides
      // unbound, treat it as satisfiable once (no bindings) rather than failing
      // the whole conjunction.
      const __fullyUnboundSO =
        (goal0.s instanceof Var || goal0.s instanceof Blank) &&
        (goal0.o instanceof Var || goal0.o instanceof Blank);
      if (
        state.canDeferBuiltins &&
        !deltas.length &&
        isSatisfiableWhenFullyUnbound(__pv0) &&
        __fullyUnboundSO &&
        (!restGoals.length || dc >= state.goals.length)
      ) {
        deltas = [{}];
      }

      const nextStates = [];
      for (const delta of deltas) {
        const composed = composeSubst(state.subst, delta);
        if (composed === null) continue;
        if (!restGoals.length) {
          results.push(gcCompactForGoals(composed, [], answerVars));

          if (results.length >= max) return results;
        } else {
          const nextSubst = maybeCompactSubst(composed, restGoals, answerVars, state.depth + 1);
          nextStates.push({
            goals: restGoals,
            subst: nextSubst,
            depth: state.depth + 1,
            visited: state.visited,
            canDeferBuiltins: state.canDeferBuiltins,
            deferCount: 0,
          });
        }
      }
      // Push in reverse so the *first* generated alternative is explored first (LIFO stack).
      for (let i = nextStates.length - 1; i >= 0; i--) stack.push(nextStates[i]);
      continue;
    }

    // 2) Loop check for backward reasoning
    if (listHasTriple(state.visited, goal0)) continue;
    const visitedForRules = state.visited.concat([goal0]);

    // 3) Try to satisfy the goal from known facts (NOW indexed by (p,o) when possible)
    if (goal0.p instanceof Iri) {
      const candidates = candidateFacts(facts, goal0);
      const nextStates = [];
      for (const f of candidates) {
        const delta = unifyTriple(goal0, f, {});
        if (delta === null) continue;
        const composed = composeSubst(state.subst, delta);
        if (composed === null) continue;
        if (!restGoals.length) {
          results.push(gcCompactForGoals(composed, [], answerVars));

          if (results.length >= max) return results;
        } else {
          const nextSubst = maybeCompactSubst(composed, restGoals, answerVars, state.depth + 1);
          nextStates.push({
            goals: restGoals,
            subst: nextSubst,
            depth: state.depth + 1,
            visited: state.visited,
            canDeferBuiltins: state.canDeferBuiltins,
            deferCount: 0,
          });
        }
      }
      for (let i = nextStates.length - 1; i >= 0; i--) stack.push(nextStates[i]);
    } else {
      // Non-IRI predicate → must try all facts.
      const nextStates = [];
      for (const f of facts) {
        const delta = unifyTriple(goal0, f, {});
        if (delta === null) continue;
        const composed = composeSubst(state.subst, delta);
        if (composed === null) continue;
        if (!restGoals.length) {
          results.push(gcCompactForGoals(composed, [], answerVars));

          if (results.length >= max) return results;
        } else {
          const nextSubst = maybeCompactSubst(composed, restGoals, answerVars, state.depth + 1);
          nextStates.push({
            goals: restGoals,
            subst: nextSubst,
            depth: state.depth + 1,
            visited: state.visited,
            canDeferBuiltins: state.canDeferBuiltins,
            deferCount: 0,
          });
        }
      }
      for (let i = nextStates.length - 1; i >= 0; i--) stack.push(nextStates[i]);
    }

    // 4) Backward rules (indexed by head predicate)
    if (goal0.p instanceof Iri) {
      ensureBackRuleIndexes(backRules);
      const candRules = (backRules.__byHeadPred.get(goal0.p.value) || []).concat(backRules.__wildHeadPred);

      const nextStates = [];
      for (const r of candRules) {
        if (r.conclusion.length !== 1) continue;
        const rawHead = r.conclusion[0];
        if (rawHead.p instanceof Iri && rawHead.p.value !== goal0.p.value) continue;
        const rStd = standardizeRule(r, varGen);
        const head = rStd.conclusion[0];
        const deltaHead = unifyTriple(head, goal0, {});
        if (deltaHead === null) continue;
        const body = rStd.premise.map((b) => applySubstTriple(b, deltaHead));
        const composed = composeSubst(state.subst, deltaHead);
        if (composed === null) continue;
        const newGoals = body.concat(restGoals);
        const nextSubst = maybeCompactSubst(composed, newGoals, answerVars, state.depth + 1);
        nextStates.push({
          goals: newGoals,
          subst: nextSubst,
          depth: state.depth + 1,
          visited: visitedForRules,
          // When we enter a backward rule body, preserve the original
          // (left-to-right) evaluation order to avoid non-termination.
          canDeferBuiltins: false,
          deferCount: 0,
        });
      }
      for (let i = nextStates.length - 1; i >= 0; i--) stack.push(nextStates[i]);
    }
  }

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

  // Cache head blank-node skolemization per (rule firing, head blank label).
  // This prevents repeatedly generating fresh _:sk_N blanks for the *same*
  // rule+substitution instance across outer fixpoint iterations.
  const headSkolemCache = new Map();

  function firingKey(ruleIndex, instantiatedPremises) {
    // Deterministic key derived from the instantiated body (ground per substitution).
    const parts = [];
    for (const tr of instantiatedPremises) {
      parts.push(JSON.stringify([skolemKeyFromTerm(tr.s), skolemKeyFromTerm(tr.p), skolemKeyFromTerm(tr.o)]));
    }
    return `R${ruleIndex}|` + parts.join('\\n');
  }

  // Make rules visible to introspection builtins
  backRules.__allForwardRules = forwardRules;
  backRules.__allBackwardRules = backRules;

  // Closure level counter used by log:collectAllIn/log:forAllIn priority gating.
  // Level 0 means "no frozen snapshot" (during Phase A of each outer iteration).
  let scopedClosureLevel = 0;

  // Scan known rules for the maximum requested closure priority in
  // log:collectAllIn / log:forAllIn goals.
  function __logNaturalPriorityFromTerm(t) {
  // Parse a 'naturalPriority' used by log:* scoped-closure builtins (e.g., log:collectAllIn).
  // Accept non-negative integral numeric literals; return null if not parseable.
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

function computeMaxScopedClosurePriorityNeeded() {
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

  let maxScopedClosurePriorityNeeded = computeMaxScopedClosurePriorityNeeded();

  function setScopedSnapshot(snap, level) {
    if (!Object.prototype.hasOwnProperty.call(facts, '__scopedSnapshot')) {
      Object.defineProperty(facts, '__scopedSnapshot', {
        value: snap,
        enumerable: false,
        writable: true,
        configurable: true,
      });
    } else {
      facts.__scopedSnapshot = snap;
    }

    if (!Object.prototype.hasOwnProperty.call(facts, '__scopedClosureLevel')) {
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
        const empty = {};
        const visited = [];
        // Optimization: if the rule head is **structurally ground** (no vars anywhere, even inside
        // quoted formulas) and has no head blanks, then the head does not depend on which body
        // solution we pick. In that case, we only need *one* proof of the body, and once all head
        // triples are already known we can skip proving the body entirely.
        function isStrictGroundTerm(t) {
          if (t instanceof Var) return false;
          if (t instanceof Blank) return false;
          if (t instanceof OpenListTerm) return false;
          if (t instanceof ListTerm) return t.elems.every(isStrictGroundTerm);
          if (t instanceof GraphTerm) return t.triples.every(isStrictGroundTriple);
          return true; // Iri/Literal and any other atomic terms
        }
        function isStrictGroundTriple(tr) {
          return isStrictGroundTerm(tr.s) && isStrictGroundTerm(tr.p) && isStrictGroundTerm(tr.o);
        }

        const headIsStrictGround =
          !r.isFuse && (!r.headBlankLabels || r.headBlankLabels.size === 0) && r.conclusion.every(isStrictGroundTriple);

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
          const fireKey = firingKey(i, instantiatedPremises);

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

                  const already = forwardRules.some(
                    (rr) =>
                      rr.isForward === newRule.isForward &&
                      rr.isFuse === newRule.isFuse &&
                      triplesListEqual(rr.premise, newRule.premise) &&
                      triplesListEqual(rr.conclusion, newRule.conclusion),
                  );
                  if (!already) forwardRules.push(newRule);
                } else if (isBwRuleTriple) {
                  const [premise, conclusion] = liftBlankRuleVars(right, left);
                  const headBlankLabels = collectBlankLabelsInTriples(conclusion);
                  const newRule = new Rule(premise, conclusion, false, false, headBlankLabels);

                  const already = backRules.some(
                    (rr) =>
                      rr.isForward === newRule.isForward &&
                      rr.isFuse === newRule.isFuse &&
                      triplesListEqual(rr.premise, newRule.premise) &&
                      triplesListEqual(rr.conclusion, newRule.conclusion),
                  );
                  if (!already) {
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

    // Freeze saturated scope
    scopedClosureLevel += 1;
    const snap = makeScopedSnapshot();

    // Phase B: scoped builtins enabled, but they query only `snap`
    setScopedSnapshot(snap, scopedClosureLevel);
    const changedB = runFixpoint();

    // Rules may have been added dynamically (rule-producing triples), possibly
    // introducing higher closure priorities. Keep iterating until we have
    // reached the maximum requested priority and no further changes occur.
    maxScopedClosurePriorityNeeded = Math.max(maxScopedClosurePriorityNeeded, computeMaxScopedClosurePriorityNeeded());

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

  let prefixes, triples, frules, brules;
  [prefixes, triples, frules, brules] = parser.parseDocument();
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
