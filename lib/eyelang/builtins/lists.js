// List builtins for proper lists, selection, membership, sorting, and indexing.
// Several predicates support both checking and generation, so the argument modes are handled explicitly.
import { compareTerms, copyResolved, deref, isCons, lexicalValue, listFromItems, numberTerm, properListItems, unify } from '../term.js';

export const listBuiltins = {
  register(registry) {
    registry.add('append', 3, append);
    registry.add('nth0', 3, nth0);
    registry.add('set_nth0', 4, setNth0, { deterministic: true });
    registry.add('rest', 2, rest, { deterministic: true });
    registry.add('member', 2, member);
    registry.add('select', 3, select);
    registry.add('not_member', 2, notMember, { deterministic: true });
    registry.add('reverse', 2, reverse, { deterministic: true });
    registry.add('length', 2, lengthBuiltin, { deterministic: true });
    registry.add('sort', 2, sortBuiltin, { deterministic: true });
  }
};


function listFromItemsExcept(items, skip) {
  const copy = new Array(items.length - 1);
  for (let i = 0, j = 0; i < items.length; i++) if (i !== skip) copy[j++] = items[i];
  return listFromItems(copy);
}

function* append({ goal, env }) {
  let items = properListItems(goal.args[0], env);
  if (items) {
    const result = listFromItems(items, 0, items.length, deref(goal.args[1], env));
    const next = env.clone();
    if (unify(goal.args[2], result, next)) yield next;
    return;
  }
  items = properListItems(goal.args[2], env);
  if (!items) return;
  for (let split = 0; split <= items.length; split++) {
    const prefix = listFromItems(items, 0, split);
    const suffix = listFromItems(items, split, items.length);
    const next = env.clone();
    if (unify(goal.args[0], prefix, next) && unify(goal.args[1], suffix, next)) yield next;
  }
}

function* nth0({ goal, env }) {
  const items = properListItems(goal.args[1], env);
  if (!items) return;
  const indexText = lexicalValue(goal.args[0], env);
  if (/^-?\d+$/.test(indexText ?? '')) {
    const index = Number(indexText);
    if (Number.isSafeInteger(index) && index >= 0 && index < items.length) {
      const next = env.clone();
      if (unify(goal.args[2], items[index], next)) yield next;
    }
    return;
  }
  if (deref(goal.args[0], env).type !== 'var') return;
  for (let i = 0; i < items.length; i++) {
    const next = env.clone();
    if (unify(goal.args[0], numberTerm(i), next) && unify(goal.args[2], items[i], next)) yield next;
  }
}

function* setNth0({ goal, env }) {
  const indexText = lexicalValue(goal.args[0], env);
  if (!/^-?\d+$/.test(indexText ?? '')) return;
  const index = Number(indexText);
  if (!Number.isSafeInteger(index) || index < 0) return;
  const items = properListItems(goal.args[1], env);
  if (!items || index >= items.length) return;
  const out = items.slice();
  out[index] = goal.args[2];
  const next = env.clone();
  if (unify(goal.args[3], listFromItems(out), next)) yield next;
}

function* rest({ goal, env }) {
  const list = deref(goal.args[0], env);
  if (!isCons(list)) return;
  const next = env.clone();
  if (unify(goal.args[1], list.args[1], next)) yield next;
}

function* member({ goal, env }) {
  const items = properListItems(goal.args[1], env);
  if (!items) return;
  for (const item of items) {
    const next = env.clone();
    if (unify(goal.args[0], item, next)) yield next;
  }
}

function* select({ goal, env }) {
  const items = properListItems(goal.args[1], env);
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    const next = env.clone();
    if (unify(goal.args[0], items[i], next) && unify(goal.args[2], listFromItemsExcept(items, i), next)) yield next;
  }
}

function* notMember({ goal, env }) {
  const items = properListItems(goal.args[1], env);
  if (!items) return;
  const value = deref(goal.args[0], env);
  if (value.type === 'number' || value.type === 'atom' || value.type === 'string') {
    for (const item of items) {
      const resolved = deref(item, env);
      if (resolved.type === value.type && resolved.name === value.name) return;
    }
    yield env;
    return;
  }
  for (const item of items) {
    const attempt = env.clone();
    if (unify(goal.args[0], item, attempt)) return;
  }
  yield env;
}

function* reverse({ goal, env }) {
  const items = properListItems(goal.args[0], env);
  if (!items) return;
  const next = env.clone();
  if (unify(goal.args[1], listFromItems([...items].reverse()), next)) yield next;
}

function* lengthBuiltin({ goal, env }) {
  const items = properListItems(goal.args[0], env);
  if (!items) return;
  const next = env.clone();
  if (unify(goal.args[1], numberTerm(items.length), next)) yield next;
}


function* sortBuiltin({ goal, env }) {
  const items = properListItems(goal.args[0], env);
  if (!items) return;
  const sorted = items.map((item) => copyResolved(item, env)).sort(compareTerms);
  const unique = [];
  for (const item of sorted) if (unique.length === 0 || compareTerms(unique[unique.length - 1], item) !== 0) unique.push(item);
  const next = env.clone();
  if (unify(goal.args[1], listFromItems(unique), next)) yield next;
}
