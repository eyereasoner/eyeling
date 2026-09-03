// Runtime services for library(iso_ext): blackboard state and bounded meta-call.
// Portable wrappers and list/string fallbacks remain in src/lib/iso_ext.pl.

import { ATOM, COMPOUND, NUMBER, STRING, VAR, atom, compound, copyResolved, deref, freshTerm, listFromItems, numberTerm, unify, variable } from './term.js';
import { PrologError } from './errors.js';
import { callNthBuiltin, countAllBuiltin, timeBuiltin } from './iso.js';
import { registerCleanupBuiltins } from './cleanup.js';

function blackboardKey(term, env) {
  const value = deref(term, env);
  if (value.type === ATOM) return `a:${value.name}`;
  if (value.type === NUMBER) return `n:${value.name}`;
  if (value.type === STRING) return `s:${value.name}`;
  if (value.type === VAR) throw new PrologError('instantiation_error');
  throw new PrologError('type_error(atomic)', value);
}

function* bbGetBuiltin({ goal, env }) {
  const key = blackboardKey(goal.args[0], env);
  const stored = env.getBacktrackableBlackboard(key);
  if (stored === undefined) return;
  const next = env.clone();
  if (unify(goal.args[1], stored, next)) yield next;
}

function* bbPutBuiltin({ goal, env }) {
  const next = env.clone();
  const key = blackboardKey(goal.args[0], next);
  next.putBacktrackableBlackboard(key, deref(goal.args[1], next));
  yield next;
}

function* bbGlobalGetBuiltin({ solver, goal, env }) {
  const key = blackboardKey(goal.args[0], env);
  const stored = solver.nonBacktrackableBlackboard.get(key);
  if (stored === undefined) return;
  const next = env.clone();
  if (unify(goal.args[1], stored, next)) yield next;
}

function* bbGlobalPutBuiltin({ solver, goal, env }) {
  const key = blackboardKey(goal.args[0], env);
  solver.nonBacktrackableBlackboard.set(key, deref(goal.args[1], env));
  yield env;
}

function callableTerm(term, env) {
  const value = deref(term, env);
  if (value.type === VAR) throw new PrologError('instantiation_error');
  if (value.type !== ATOM && value.type !== COMPOUND) throw new PrologError('type_error(callable)', value);
  return value;
}

function callWithInferenceLimitBuiltin(context) {
  const { solver, goal, env } = context;
  const limitTerm = deref(goal.args[1], env);
  if (limitTerm.type === VAR) throw new PrologError('instantiation_error');
  if (limitTerm.type !== NUMBER || !/^-?\d+$/.test(limitTerm.name)) {
    throw new PrologError('type_error(integer)', copyResolved(limitTerm, env));
  }
  const limitBig = BigInt(limitTerm.name);
  if (limitBig < 0n) throw new PrologError('domain_error(not_less_than_zero)', copyResolved(limitTerm, env));
  if (limitBig > BigInt(Number.MAX_SAFE_INTEGER)) throw new PrologError('representation_error(max_integer)');
  const limit = Number(limitBig);
  const invoked = callableTerm(goal.args[0], env);
  if (invoked.module == null) invoked.module = goal.module ?? 'user';
  const child = solver.cloneForInnerGoal();
  child.maxInferences = limit;
  child.inferences = 0;
  child.inferenceLimitExceeded = false;
  let pending = true;

  const iterator = (function* limitedSolutions() {
    try {
      for (const answerEnv of child.solve([invoked], env, 0)) {
        const result = child.hasPendingAlternatives() ? atom('true') : atom('!');
        const next = answerEnv.clone();
        pending = child.hasPendingAlternatives();
        if (unify(goal.args[2], result, next)) yield next;
        child.inferences = 0;
        child.inferenceLimitExceeded = false;
        if (!pending) return;
      }
      if (child.inferenceLimitExceeded) {
        const next = env.clone();
        pending = false;
        if (unify(goal.args[2], atom('inference_limit_exceeded'), next)) yield next;
      }
    } finally {
      // Bounded exhaustion is the result of this predicate, not a limit on the
      // enclosing solver. Preserve statistics without poisoning the parent.
      const limited = child.inferenceLimitExceeded;
      child.inferenceLimitExceeded = false;
      solver.absorbStatsFrom(child);
      child.inferenceLimitExceeded = limited;
      pending = false;
    }
  })();
  iterator.hasPendingAlternatives = () => pending;
  return iterator;
}


let copyTerm3Id = 0;

function collectVisibleVariables(term, env) {
  const result = [];
  const seen = new Set();
  const pending = [term];
  while (pending.length > 0) {
    const current = deref(pending.pop(), env);
    if (current.type === VAR) {
      if (!seen.has(current.name)) {
        seen.add(current.name);
        result.push(current);
      }
      continue;
    }
    if (current.type === COMPOUND) {
      for (let index = current.arity - 1; index >= 0; index--) pending.push(current.args[index]);
    }
  }
  return result;
}

function residualGoalsForTerm(solver, term, env) {
  const roots = collectVisibleVariables(term, env);
  const visibleNames = new Set(roots.map((item) => deref(item, env).name));
  const goals = [];

  // EyeProlog-native delayed constraints (currently dif/2) have an explicit
  // residualGoal projection. Include a constraint when it is attached to at
  // least one variable reachable from Term.
  for (const constraint of env.variableConstraints()) {
    const names = constraint.variables?.(env);
    if (names == null || ![...names].some((name) => visibleNames.has(deref(variable(name), env).name))) continue;
    const projected = constraint.residualGoal?.(env);
    if (projected != null) goals.push(copyResolved(projected, env));
  }

  // Prolog-defined attributes use each owning module's attribute_goals/3 hook,
  // matching the projection used by the top level.
  for (const root of roots) {
    const resolved = deref(root, env);
    if (resolved.type !== VAR || !env.hasPrologAttributes(resolved.name)) continue;
    goals.push(...solver.attributeResidualGoals(resolved, env));
  }
  return goals;
}

function* copyTerm3Builtin({ solver, goal, env }) {
  const residuals = residualGoalsForTerm(solver, goal.args[0], env);
  // Copy Term and its projected goals in one bundle so variable sharing between
  // the copied term and residual goals is preserved, while no attributes are
  // copied onto the fresh variables themselves.
  const bundle = compound('$copy_term_3', [
    copyResolved(goal.args[0], env),
    listFromItems(residuals),
  ]);
  const copied = freshTerm(bundle, `iso_ext_copy_${++copyTerm3Id}`);
  const next = env.clone();
  if (!unify(goal.args[1], copied.args[0], next)) return;
  if (unify(goal.args[2], copied.args[1], next)) yield next;
}

export const isoExtHostBuiltins = {
  register(registry) {
    registerCleanupBuiltins(registry);
    registry.add('eyeprolog__call_nth', 2, callNthBuiltin, { eyePrologLibrary: true });
    registry.add('eyeprolog__countall', 2, countAllBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('time', 1, timeBuiltin, { eyePrologLibrary: true });
    registry.add('eyeprolog__time', 1, timeBuiltin, { eyePrologLibrary: true });
    registry.add('eyeprolog__bb_get', 2, bbGetBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__bb_b_put', 2, bbPutBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__bb_global_get', 2, bbGlobalGetBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__bb_global_put', 2, bbGlobalPutBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__call_with_inference_limit', 3, callWithInferenceLimitBuiltin, { eyePrologLibrary: true });
    registry.add('eyeprolog__copy_term_3', 3, copyTerm3Builtin, { deterministic: true, eyePrologLibrary: true });
  },
};
