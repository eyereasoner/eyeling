// String builtins.
// They mostly project from already-ground terms to avoid guessing string domains.
import { compound, lexicalValue, stringTerm, unify } from '../term.js';

export const stringBuiltins = {
  register(registry) {
    registry.add('str_concat', 3, concat, { deterministic: true });
    for (const name of ['contains', 'matches', 'not_matches']) registry.add(name, 2, contains(name), { deterministic: true });
    registry.add('matches', 3, matchCaptures, { deterministic: true });
  }
};


function* concat({ goal, env }) {
  const left = lexicalValue(goal.args[0], env);
  const right = lexicalValue(goal.args[1], env);
  if (left == null || right == null) return;
  const next = env.clone();
  if (unify(goal.args[2], stringTerm(left + right), next)) yield next;
}

function contains(name) {
  return function* ({ goal, env }) {
    const haystack = lexicalValue(goal.args[0], env);
    const needle = lexicalValue(goal.args[1], env);
    if (haystack == null || needle == null) return;
    const has = haystack.includes(needle);
    const matches = simpleAlternationMatch(haystack, needle);
    const pass = (name === 'contains' && has) ||
      (name === 'matches' && matches) ||
      (name === 'not_matches' && !matches);
    if (pass) yield env;
  };
}

function* matchCaptures({ goal, env }) {
  const text = lexicalValue(goal.args[0], env);
  const pattern = lexicalValue(goal.args[1], env);
  if (text == null || pattern == null) return;

  let match;
  try {
    match = new RegExp(pattern).exec(text);
  } catch (_) {
    return;
  }
  if (!match?.groups) return;

  const context = contextFromGroups(match.groups);
  if (context == null) return;

  const next = env.clone();
  if (unify(goal.args[2], context, next)) yield next;
}

function contextFromGroups(groups) {
  const terms = [];
  for (const [name, value] of Object.entries(groups)) {
    if (value !== undefined) terms.push(compound(name, [stringTerm(value)]));
  }
  if (terms.length === 0) return null;

  let context = terms[terms.length - 1];
  for (let i = terms.length - 2; i >= 0; i--) context = compound(',', [terms[i], context]);
  return context;
}

function simpleAlternationMatch(haystack, pattern) {
  return pattern.split('|').some((part) => part === '' || haystack.includes(part));
}
