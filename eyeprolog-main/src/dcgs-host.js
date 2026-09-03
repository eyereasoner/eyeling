// Finite-list hot paths for library(dcgs). The declarative/generative DCG
// relations remain in src/lib/dcgs.pl; these adapters only avoid recursive
// host control for long, already constructed lists.

import { ATOM, COMPOUND, deref, unify } from './term.js';

function isEmptyList(term) {
  return term.type === ATOM && term.name === '[]';
}

function isCons(term) {
  return term.type === COMPOUND && term.name === '.' && term.arity === 2;
}

function* properListBuiltin({ goal, env }) {
  let cursor = deref(goal.args[0], env);
  while (isCons(cursor)) cursor = deref(cursor.args[1], env);
  if (isEmptyList(cursor)) yield env;
}

function* anySuffixBuiltin({ goal, env }) {
  let cursor = deref(goal.args[0], env);
  while (true) {
    const next = env.clone();
    if (unify(goal.args[1], cursor, next)) yield next;
    if (isEmptyList(cursor)) return;
    if (!isCons(cursor)) return;
    cursor = deref(cursor.args[1], env);
  }
}

export const dcgsHostBuiltins = {
  register(registry) {
    registry.add('eyeprolog__dcg_proper_list', 1, properListBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__dcg_any_suffix', 2, anySuffixBuiltin, { eyePrologLibrary: true });
  },
};
