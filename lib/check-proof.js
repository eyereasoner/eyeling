// Proof checking for Notation3 proof documents.
//
// A proof document says what was concluded and why. Checking it means
// re-performing every inference it records against the program it claims to
// come from. The specification is eyeron's `docs/proof-checking.md`, and
// this is its Notation3 reading; eyeron's `src/proof/` is the reference
// implementation the same document specifies.
//
// A checker does not reason. It never searches for a derivation the writer
// failed to record, and it never runs the reasoner; it only verifies what
// is written. Four conditions decide validity:
//
//   C1 Resolution     -- every use resolves to a step's conclusion, of
//                        which it is an instance, or to a statement the
//                        source gives.
//   C2 Well-founded   -- no conclusion is used by its own derivation.
//   C3 Justification  -- every step carries exactly one known justification,
//                        and a checked one re-performs.
//   C4 Coverage       -- every claim has a step or is given.
//
// `builtin` steps whose value is not a function of their own triple are
// *trusted*, not checked: re-deciding them would mean consulting the clock,
// the network or the rest of the fact set, which is what a checker must not
// do. They are reported so a reader knows what the check rests on.
'use strict';

const { Blank, GraphTerm, Iri, ListTerm, PrefixEnv, Var } = require('./prelude');
const { termToN3 } = require('./printing');
const { parseN3Text } = require('./multisource');

const PE = 'https://eyereasoner.github.io/pe#';

// Built-ins whose value is not a function of the triple they appear in, so
// re-evaluating them cannot confirm anything. Each reads something outside
// the proof: the clock, the process, the network, or the fact set.
const IMPURE_BUILTINS = new Set([
  'http://www.w3.org/2000/10/swap/time#localTime',
  'http://www.w3.org/2000/10/swap/time#currentTime',
  'http://www.w3.org/2000/10/swap/time#gmTime',
  'http://www.w3.org/2000/10/swap/log#content',
  'http://www.w3.org/2000/10/swap/log#semantics',
  'http://www.w3.org/2000/10/swap/log#semanticsOrError',
  'http://www.w3.org/2000/10/swap/math#random',
  'http://www.w3.org/2000/10/swap/log#collectAllIn',
  'http://www.w3.org/2000/10/swap/log#forAllIn',
  'http://www.w3.org/2000/10/swap/log#includes',
  'http://www.w3.org/2000/10/swap/log#notIncludes',
  'http://www.w3.org/2000/10/swap/log#conclusion',
  'http://www.w3.org/2000/10/swap/log#conjunction',
  'http://www.w3.org/2000/10/swap/list#map',
]);

const CHECKED_KINDS = new Set(['rule', 'fact', 'builtin']);
const TRUSTED_KINDS = new Set(['absent', 'collected']);

const BARE = new PrefixEnv();

function key(term) {
  return termToN3(term, BARE);
}

function tripleKey(t) {
  return `${key(t.s)}\t${key(t.p)}\t${key(t.o)}`;
}

// A `pe:var` name is a plain string literal; its lexical form carries the
// quotes, which are not part of the variable's name.
function plainString(term) {
  const raw = term && typeof term.value === 'string' ? term.value : String(term);
  const quoted = /^"((?:[^"\\]|\\.)*)"(?:\^\^.*|@.*)?$/.exec(raw);
  return quoted ? quoted[1] : raw;
}

function peLocalName(term) {
  return term instanceof Iri && term.value.startsWith(PE) ? term.value.slice(PE.length) : null;
}

// One-way matching of a rule's pattern against a recorded statement. Only
// the pattern's variables bind: the step may not instantiate itself to meet
// the rule halfway. A blank node in a rule head is an existential, which the
// engine skolemizes, so it binds too -- under a name that cannot collide
// with a variable's.
function matchTerm(pattern, target, bindings) {
  let name = null;
  if (pattern instanceof Var) name = pattern.name;
  else if (pattern instanceof Blank) name = `_:${pattern.label}`;
  if (name != null) {
    if (Object.prototype.hasOwnProperty.call(bindings, name)) return key(bindings[name]) === key(target);
    bindings[name] = target;
    return true;
  }
  if (pattern instanceof ListTerm && target instanceof ListTerm) {
    return pattern.elems.length === target.elems.length
      && pattern.elems.every((item, index) => matchTerm(item, target.elems[index], bindings));
  }
  if (pattern instanceof GraphTerm && target instanceof GraphTerm) {
    return pattern.triples.length === target.triples.length
      && pattern.triples.every((t, index) => matchTriple(t, target.triples[index], bindings));
  }
  return key(pattern) === key(target);
}

function matchTriple(pattern, target, bindings) {
  return matchTerm(pattern.s, target.s, bindings)
    && matchTerm(pattern.p, target.p, bindings)
    && matchTerm(pattern.o, target.o, bindings);
}

// The document, read as the abstract model: the claims its plain triples
// make, and the steps its quoted-formula subjects record.
//
// A step is a top-level triple whose subject is a quoted conclusion and
// whose predicate is proof vocabulary. Everything else at the top level is
// a claim -- which is the same division the SPARQL-RL and Prolog documents
// make, in their own syntaxes.
function readProofDocument(proofText, label = '<proof>') {
  const doc = parseN3Text(proofText, { label, sourceLocations: false });
  const byConclusion = new Map();
  const steps = [];
  const claims = [];

  for (const triple of doc.triples) {
    const local = peLocalName(triple.p);
    if (local == null) {
      if (!(triple.s instanceof GraphTerm)) claims.push(triple);
      continue;
    }
    if (!(triple.s instanceof GraphTerm) || triple.s.triples.length !== 1) continue;
    const conclusion = triple.s.triples[0];
    const id = tripleKey(conclusion);
    let step = byConclusion.get(id);
    if (!step) {
      step = { conclusion, kind: null, rule: null, carried: null, bindings: [], uses: [], detail: null };
      byConclusion.set(id, step);
      steps.push(step);
    }
    if (local === 'binding') {
      const item = doc.triples.filter((t) => key(t.s) === key(triple.o));
      const name = item.find((t) => peLocalName(t.p) === 'var');
      const value = item.find((t) => peLocalName(t.p) === 'value');
      if (name && value) step.bindings.push({ name: plainString(name.o), value: value.o });
      continue;
    }
    if (local === 'uses') {
      if (triple.o instanceof GraphTerm && triple.o.triples.length === 1) step.uses.push(triple.o.triples[0]);
      continue;
    }
    // Anything else in the proof namespace is the step's one justification.
    if (step.kind != null) {
      step.detail = `carries more than one justification: ${step.kind} and ${local}`;
      continue;
    }
    step.kind = local;
    if (local === 'rule') {
      const carried = carriedRule(triple.o);
      if (carried) step.carried = carried;
      else step.rule = Number(triple.o.value ?? triple.o);
    }
    if (local === 'builtin') step.builtin = triple.o;
    if (local === 'fact') step.source = triple.o;
  }

  // A `pe:binding` blank node's own triples are bookkeeping, not claims.
  const bindingNodes = new Set();
  for (const triple of doc.triples) {
    if (peLocalName(triple.p) === 'binding') bindingNodes.add(key(triple.o));
  }
  return {
    steps,
    byConclusion,
    claims: claims.filter((t) => !bindingNodes.has(key(t.s))),
  };
}

// A rule the engine generated while reasoning is in no document, so the
// step carries the rule itself rather than a number into a list the reader
// cannot reproduce.
function carriedRule(term) {
  if (!(term instanceof GraphTerm) || term.triples.length !== 1) return null;
  const statement = term.triples[0];
  const implies = statement.p instanceof Iri && statement.p.value === 'http://www.w3.org/2000/10/swap/log#implies';
  const impliedBy = statement.p instanceof Iri && statement.p.value === 'http://www.w3.org/2000/10/swap/log#impliedBy';
  if (!implies && !impliedBy) return null;
  const left = statement.s instanceof GraphTerm ? statement.s.triples : null;
  const right = statement.o instanceof GraphTerm ? statement.o.triples : null;
  if (!left || !right) return null;
  return implies
    ? { premise: left, conclusion: right, statement }
    : { premise: right, conclusion: left, statement };
}

// The program's rules, numbered the way a proof cites them: the same order
// `renderProofDocument` numbers them in, so `pe:rule N` means the same rule
// to the writer and to the reader.
function numberedRules(source) {
  const rules = (source.frules || []).concat(source.logQueryRules || [], source.brules || []);
  const ordered = rules.filter(Boolean).map((rule, index) => ({ rule, index }));
  ordered.sort((a, b) => {
    const ao = Number.isInteger(a.rule.__sourceOffset) ? a.rule.__sourceOffset : Infinity;
    const bo = Number.isInteger(b.rule.__sourceOffset) ? b.rule.__sourceOffset : Infinity;
    return ao - bo || a.index - b.index;
  });
  return ordered.map(({ rule }) => rule);
}

// C1 for a rule step: instantiate the cited rule under the bindings the step
// recorded and require it to yield exactly this conclusion from exactly
// these uses. The rule comes from the *source*, never from the document -- a
// proof cannot be made valid by restating the rule it used.
function checkRuleStep(step, rules) {
  let premise;
  let conclusion;
  let names;
  let cited;
  if (step.carried) {
    premise = step.carried.premise;
    conclusion = step.carried.conclusion;
    names = null;
    cited = 'the generated rule it carries';
  } else {
    if (!Number.isInteger(step.rule)) return 'cites no rule';
    const rule = rules[step.rule - 1];
    if (!rule) return `cites rule ${step.rule}, which the source does not have`;
    premise = rule.premise;
    conclusion = rule.conclusion;
    names = rule.__proofVarSourceNames || null;
    cited = `rule ${step.rule}`;
  }

  // The proof records a variable by its source name; the rule may know it by
  // an internal one.
  const internalOf = new Map();
  if (names) for (const [internal, sourceName] of Object.entries(names)) internalOf.set(sourceName, internal);

  // One environment across every premise and the conclusion, so a variable
  // the bindings did not mention is still forced to take one consistent
  // value.
  const bindings = {};
  for (const binding of step.bindings) bindings[internalOf.get(binding.name) ?? binding.name] = binding.value;

  if (premise.length !== step.uses.length) {
    return `uses ${step.uses.length} premise(s), but ${cited} has ${premise.length}`;
  }
  for (let i = 0; i < premise.length; i++) {
    if (!matchTriple(premise[i], step.uses[i], bindings)) {
      return `premise ${i + 1} is not what ${cited} requires`;
    }
  }
  const concluded = conclusion.some((candidate) => matchTriple(candidate, step.conclusion, { ...bindings }));
  if (!concluded) return `does not follow from ${cited}: it concludes none of what this step claims`;
  return null;
}

// C2: following what a step used never leads back to it. A proof that rested
// on itself would prove anything.
function checkWellFounded(steps, byConclusion, failures) {
  const OPEN = 1;
  const DONE = 2;
  const state = new Map();
  const edgesOf = (step) => step.uses.map((use) => byConclusion.get(tripleKey(use))).filter(Boolean);

  for (const start of steps) {
    if (state.get(start)) continue;
    state.set(start, OPEN);
    const stack = [{ step: start, edges: null, index: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (frame.edges == null) frame.edges = edgesOf(frame.step);
      if (frame.index >= frame.edges.length) {
        state.set(frame.step, DONE);
        stack.pop();
        continue;
      }
      const next = frame.edges[frame.index++];
      if (state.get(next) === DONE) continue;
      if (state.get(next) === OPEN) {
        failures.push({
          condition: 'C2',
          conclusion: tripleKey(next.conclusion),
          detail: 'is used, directly or indirectly, by its own derivation',
        });
        state.set(next, DONE);
        continue;
      }
      state.set(next, OPEN);
      stack.push({ step: next, edges: null, index: 0 });
    }
  }
}

// Check `proofText` against the program it claims to come from.
//
// `source` is the parsed program, read with `sourceLocations: true` so its
// rules carry the positions the proof's `pe:rule N` cites.
function checkProofDocument(source, proofText, options = {}) {
  const { steps, byConclusion, claims } = readProofDocument(proofText, options.label || '<proof>');
  const rules = numberedRules(source);
  const failures = [];
  const trusted = [];
  const counts = {};
  let verified = 0;

  const given = new Set((source.triples || []).map(tripleKey));
  // N3 reads a rule as data, so a rule written in the source is a statement
  // the document gives like any other.
  const givenRules = rules.filter((rule) => rule.__source);

  const resolves = (statement) => {
    if (byConclusion.has(tripleKey(statement))) return true;
    if (given.has(tripleKey(statement))) return true;
    // A given statement may carry variables, which N3 reads as universally
    // quantified: it gives every instance of itself.
    for (const triple of source.triples || []) {
      if (matchTriple(triple, statement, {})) return true;
    }
    return givenRules.some((rule) => matchTriple(ruleStatement(rule), statement, {}));
  };

  // C1: every use resolves.
  for (const step of steps) {
    for (const use of step.uses) {
      if (!resolves(use)) {
        failures.push({
          condition: 'C1',
          conclusion: tripleKey(step.conclusion),
          detail: `uses ${tripleKey(use)}, which is neither an instance of a step's conclusion nor given by the source`,
        });
      }
    }
  }

  // C2.
  checkWellFounded(steps, byConclusion, failures);

  // C3: every step carries exactly one known justification, and a checked
  // one re-performs.
  for (const step of steps) {
    counts[step.kind ?? '<none>'] = (counts[step.kind ?? '<none>'] ?? 0) + 1;
    if (step.detail) {
      failures.push({ condition: 'C3', conclusion: tripleKey(step.conclusion), detail: step.detail });
      continue;
    }
    if (step.kind == null) {
      failures.push({ condition: 'C3', conclusion: tripleKey(step.conclusion), detail: 'carries no justification' });
      continue;
    }
    if (step.kind === 'unproven') {
      failures.push({
        condition: 'C3',
        conclusion: tripleKey(step.conclusion),
        detail: 'is recorded as unproven: the engine could not justify it',
      });
      continue;
    }
    if (TRUSTED_KINDS.has(step.kind)) {
      trusted.push({ kind: step.kind, conclusion: tripleKey(step.conclusion) });
      continue;
    }
    if (!CHECKED_KINDS.has(step.kind)) {
      failures.push({ condition: 'C3', conclusion: tripleKey(step.conclusion), detail: `unknown justification pe:${step.kind}` });
      continue;
    }
    const outcome = checkStep(step, rules, given, givenRules, byConclusion);
    if (outcome.detail) failures.push({ condition: 'C3', conclusion: tripleKey(step.conclusion), detail: outcome.detail });
    else if (outcome.trusted) trusted.push({ kind: outcome.trusted, conclusion: tripleKey(step.conclusion) });
    else verified++;
  }

  // C4: every claim is accounted for.
  for (const claim of claims) {
    if (!resolves(claim)) {
      failures.push({
        condition: 'C4',
        conclusion: tripleKey(claim),
        detail: 'claimed, but no step concludes it and the source does not give it',
      });
    }
  }

  return { steps: steps.length, verified, trusted, failures, claims: claims.length, counts, valid: failures.length === 0 };
}

// The triple a rule *is*, which N3 can match like any other statement.
function ruleStatement(rule) {
  const LOG = 'http://www.w3.org/2000/10/swap/log#';
  const premise = new GraphTerm(rule.premise);
  const conclusion = new GraphTerm(rule.conclusion);
  return rule.isForward === false
    ? { s: conclusion, p: new Iri(`${LOG}impliedBy`), o: premise }
    : { s: premise, p: new Iri(`${LOG}implies`), o: conclusion };
}

function checkStep(step, rules, given, givenRules, byConclusion) {
  if (step.kind === 'rule') {
    // A carried rule has to be justified too, or a step could invent any
    // rule it liked: the proof must contain a step deriving it.
    if (step.carried && !derivesRule(step.carried.statement, byConclusion)) {
      return { detail: 'carries a generated rule that nothing in the proof derives' };
    }
    return { detail: checkRuleStep(step, rules) };
  }
  if (step.kind === 'fact') {
    if (given.has(tripleKey(step.conclusion))) return {};
    for (const rule of givenRules) {
      if (matchTriple(ruleStatement(rule), step.conclusion, {})) return {};
    }
    return { detail: 'is justified as a fact, but the source does not give it' };
  }
  // Every built-in here is recorded rather than re-decided: eyeling's
  // built-ins are evaluated by the reasoner, and re-running one would mean
  // running the reasoner, which is what a checker must not do.
  const name = step.builtin instanceof Iri ? step.builtin.value : null;
  if (name == null) return { detail: 'names no built-in' };
  return { trusted: IMPURE_BUILTINS.has(name) ? 'impure built-in' : 'builtin' };
}

// An empty rule side is written either way: `<= true` where the document
// says so, `<= {}` where the rule itself is printed. N3 reads both as the
// empty premise, so a comparison of rule statements has to as well.
function normalizeRuleSide(term) {
  const isTrue = term && term.constructor && term.constructor.name === 'Literal'
    && String(term.value) === 'true';
  return isTrue ? new GraphTerm([]) : term;
}

function normalizeRuleStatement(statement) {
  return { s: normalizeRuleSide(statement.s), p: statement.p, o: normalizeRuleSide(statement.o) };
}

// Is the rule a step carries itself something the proof derived? The rule is
// a statement like any other, so some step must conclude it.
function derivesRule(statement, byConclusion) {
  const wanted = normalizeRuleStatement(statement);
  if (byConclusion.has(tripleKey(wanted))) return true;
  for (const step of byConclusion.values()) {
    const candidate = normalizeRuleStatement(step.conclusion);
    if (candidate.p == null || key(candidate.p) !== key(wanted.p)) continue;
    if (matchTriple(candidate, wanted, {}) || matchTriple(wanted, candidate, {})) return true;
  }
  return false;
}

// The verdict line the specification requires.
function verdict(report) {
  if (!report.valid) return `invalid: ${report.failures.length} failure(s)`;
  if (report.trusted.length) return `checked with obligations: ${report.steps} steps, ${report.trusted.length} trusted`;
  return `checked: ${report.steps} steps`;
}

module.exports = { checkProofDocument, readProofDocument, matchTerm, matchTriple, verdict, IMPURE_BUILTINS };
