// High-arity meta-call support for library(lists). EyeProlog's ISO call/N
// registry intentionally stops at call/8; Scryer's maplist/9 needs one more
// closure argument, kept private to this module instead of widening ISO mode.

import { ATOM, COMPOUND, VAR, compound, deref } from './term.js';
import { PrologError } from './errors.js';

function* callEightArgumentsBuiltin({ solver, goal, env }) {
  const closure = deref(goal.args[0], env);
  if (closure.type === VAR) throw new PrologError('instantiation_error');
  if (closure.type !== ATOM && closure.type !== COMPOUND) {
    throw new PrologError('type_error(callable)', closure);
  }
  const existing = closure.type === COMPOUND ? closure.args : [];
  const invoked = compound(closure.name, [...existing, ...goal.args.slice(1)]);
  invoked.module = closure.module ?? goal.module ?? 'user';
  const child = solver.cloneForInnerGoal();
  try {
    yield* child.solve([invoked], env, 0);
  } finally {
    solver.absorbStatsFrom(child);
  }
}

export const listsHostBuiltins = {
  register(registry) {
    registry.add('eyeprolog__call8', 9, callEightArgumentsBuiltin, { eyePrologLibrary: true });
  },
};
