// String and atom conversion builtins.
// They mostly project from already-ground terms to avoid guessing string domains.
import { atom, lexicalValue, stringTerm, unify } from '../term.js';

export const stringBuiltins = {
  register(registry) {
    for (const name of ['atom_concat', 'str_concat']) registry.add(name, 3, concat(name), { deterministic: true });
    for (const name of ['contains', 'not_contains', 'matches', 'not_matches']) registry.add(name, 2, contains(name), { deterministic: true });
  }
};


function concat(name) {
  return function* ({ goal, env }) {
    const left = lexicalValue(goal.args[0], env);
    const right = lexicalValue(goal.args[1], env);
    if (left == null || right == null) return;
    const result = name === 'str_concat' ? stringTerm(left + right) : atom(left + right);
    const next = env.clone();
    if (unify(goal.args[2], result, next)) yield next;
  };
}

function contains(name) {
  return function* ({ goal, env }) {
    const haystack = lexicalValue(goal.args[0], env);
    const needle = lexicalValue(goal.args[1], env);
    if (haystack == null || needle == null) return;
    const has = haystack.includes(needle);
    const matches = simpleAlternationMatch(haystack, needle);
    const pass = (name === 'contains' && has) ||
      (name === 'not_contains' && !has) ||
      (name === 'matches' && matches) ||
      (name === 'not_matches' && !matches);
    if (pass) yield env;
  };
}

function simpleAlternationMatch(haystack, pattern) {
  return pattern.split('|').some((part) => part === '' || haystack.includes(part));
}
