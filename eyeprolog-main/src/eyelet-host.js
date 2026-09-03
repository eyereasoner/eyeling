// Runtime integration hooks for library(eyelet). The :+ fixed-point semantics
// themselves live entirely in src/lib/eyelet.pl.

import { ATOM, COMPOUND, NUMBER, VAR, copyResolved, deref } from './term.js';
import { PrologError } from './errors.js';
import { modulePredicateKey, rebuildGroupIndexes } from './program-indexing.js';

const NON_PROCEDURE_CONTROL = new Set([',/2', ';/2', '->/2', ':/2', '!/0', 'true/0', 'false/0', 'fail/0']);

function dynifyIndicator(term, env) {
  const indicator = deref(term, env);
  if (indicator.type === VAR) throw new PrologError('instantiation_error');
  if (indicator.type !== COMPOUND || indicator.name !== '/' || indicator.arity !== 2) {
    throw new PrologError('type_error(predicate_indicator)', indicator);
  }
  const name = deref(indicator.args[0], env);
  const arity = deref(indicator.args[1], env);
  if (name.type === VAR || arity.type === VAR) throw new PrologError('instantiation_error');
  if (name.type !== ATOM || arity.type !== NUMBER || !/^\d+$/.test(arity.name)) {
    throw new PrologError('type_error(predicate_indicator)', indicator);
  }
  const value = BigInt(arity.name);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new PrologError('representation_error(max_arity)');
  return { name: name.name, arity: Number(value), indicator };
}

function* dynifyBuiltin({ solver, goal, env }) {
  const target = dynifyIndicator(goal.args[0], env);
  const module = goal.module ?? 'user';
  const indicatorKey = `${target.name}/${target.arity}`;
  if (NON_PROCEDURE_CONTROL.has(indicatorKey)) { yield env; return; }

  const directKey = modulePredicateKey(module, target.name, target.arity);
  let group = solver.program.groups.get(directKey) ?? null;
  if (group != null) {
    if (!group.dynamic) {
      group.dynamic = true;
      solver.program.dynamicPredicates.add(directKey);
      solver.program.mutable = true;
      rebuildGroupIndexes(group);
      solver.program.noteMutation(group.clauses.some((clause) => (clause.body?.length ?? 0) > 0));
    }
    yield env;
    return;
  }

  if (solver.registry.get(target.name, target.arity) != null ||
      solver.program.moduleImports.get(module)?.has(indicatorKey) === true) {
    yield env;
    return;
  }

  group = solver.program.ensureDynamicGroup(target.name, target.arity, module);
  group.dynamic = true;
  yield env;
}

function* eyeletEmitBuiltin({ solver, goal, env }) {
  const kind = deref(goal.args[0], env);
  if (kind.type === VAR) throw new PrologError('instantiation_error');
  if (kind.type !== ATOM) throw new PrologError('type_error(atom)', kind);
  solver.eyeletEventHandler?.(kind.name, copyResolved(goal.args[1], env));
  yield env;
}

export const eyeletHostBuiltins = {
  register(registry) {
    registry.add('eyeprolog__dynify', 1, dynifyBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__eyelet_emit', 2, eyeletEmitBuiltin, { deterministic: true, eyePrologLibrary: true });
  },
};
