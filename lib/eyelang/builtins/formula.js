// Formula builtins that treat conjunctions as first-class data terms.
// These are used by examples that construct or inspect rule bodies programmatically.
import { atom, deref, isConjunction, unify } from '../term.js';

export const formulaBuiltins = {
  register(registry) {
    registry.add('formula_binary', 4, formulaBinary);
  }
};


function* emitFormulaBinary(formula, subject, predicate, object, env) {
  formula = deref(formula, env);
  if (isConjunction(formula)) {
    yield* emitFormulaBinary(formula.args[0], subject, predicate, object, env);
    yield* emitFormulaBinary(formula.args[1], subject, predicate, object, env);
    return;
  }
  if (formula.type !== 'compound' || formula.arity !== 2) return;
  const next = env.clone();
  if (unify(subject, formula.args[0], next) && unify(predicate, atom(formula.name), next) && unify(object, formula.args[1], next)) yield next;
}

function* formulaBinary({ goal, env }) {
  yield* emitFormulaBinary(goal.args[0], goal.args[1], goal.args[2], goal.args[3], env);
}
