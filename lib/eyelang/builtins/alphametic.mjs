// Reusable alphametic addition solver.
// It evaluates column constraints right-to-left, so examples such as
// SEND+MORE=MONEY and DONALD+GERALD=ROBERT do not need to express digit search
// with many relational select/3 and arithmetic goals.
import { atom, deref, listFromItems, numberTerm, properListItems, unify } from '../term.mjs';

export const alphameticBuiltins = {
  register(registry) {
    registry.add('alphametic_sum', 5, alphameticSum, {
      fallbackWhenNotReady: true,
      ready: alphameticReady,
    });
  }
};

function alphameticReady(goal, env) {
  return atomList(goal.args[0], env) !== null && wordList(goal.args[1], env) !== null && atomList(goal.args[2], env) !== null;
}

function* alphameticSum({ goal, env }) {
  const letters = atomList(goal.args[0], env);
  const addends = wordList(goal.args[1], env);
  const result = atomList(goal.args[2], env);
  if (!letters || !addends || !result || letters.length > 10 || addends.length === 0) return;

  const letterSet = new Set(letters);
  for (const word of [...addends, result]) for (const letter of word) if (!letterSet.has(letter)) return;

  const leading = new Set();
  for (const word of [...addends, result]) if (word.length > 1) leading.add(word[0]);
  const maxLen = Math.max(result.length, ...addends.map((word) => word.length));
  const assignment = new Map();
  const used = Array(10).fill(false);

  function canUse(letter, digit) {
    return !used[digit] && !(digit === 0 && leading.has(letter));
  }

  function assignDigit(letter, digit) {
    assignment.set(letter, digit);
    used[digit] = true;
  }

  function unassignDigit(letter, digit) {
    assignment.delete(letter);
    used[digit] = false;
  }

  function* assignAddends(column, carry, index, sum) {
    if (index >= addends.length) {
      yield* finishColumn(column, sum);
      return;
    }
    const word = addends[index];
    const letter = word[word.length - 1 - column];
    if (letter === undefined) {
      yield* assignAddends(column, carry, index + 1, sum);
      return;
    }
    const assigned = assignment.get(letter);
    if (assigned !== undefined) {
      yield* assignAddends(column, carry, index + 1, sum + assigned);
      return;
    }
    for (let digit = 0; digit <= 9; digit++) {
      if (!canUse(letter, digit)) continue;
      assignDigit(letter, digit);
      yield* assignAddends(column, carry, index + 1, sum + digit);
      unassignDigit(letter, digit);
    }
  }

  function* finishColumn(column, sum) {
    const resultLetter = result[result.length - 1 - column];
    const digit = sum % 10;
    const nextCarry = Math.floor(sum / 10);
    if (resultLetter === undefined) {
      if (digit === 0) yield* solveColumn(column + 1, nextCarry);
      return;
    }
    const assigned = assignment.get(resultLetter);
    if (assigned !== undefined) {
      if (assigned === digit) yield* solveColumn(column + 1, nextCarry);
      return;
    }
    if (!canUse(resultLetter, digit)) return;
    assignDigit(resultLetter, digit);
    yield* solveColumn(column + 1, nextCarry);
    unassignDigit(resultLetter, digit);
  }

  function* solveColumn(column, carry) {
    if (column >= maxLen) {
      if (carry !== 0) return;
      if (assignment.size !== letters.length) return;
      yield new Map(assignment);
      return;
    }
    yield* assignAddends(column, carry, 0, carry);
  }

  for (const solution of solveColumn(0, 0)) {
    const digitTerms = letters.map((letter) => numberTerm(String(solution.get(letter))));
    const values = [...addends, result].map((word) => wordValue(word, solution));
    const valueTerms = values.map((value) => numberTerm(String(value)));
    const next = env.clone();
    if (unify(goal.args[3], listFromItems(digitTerms), next) && unify(goal.args[4], listFromItems(valueTerms), next)) yield next;
  }
}

function wordValue(word, assignment) {
  let value = 0;
  for (const letter of word) value = value * 10 + assignment.get(letter);
  return value;
}

function atomList(term, env) {
  const items = properListItems(term, env);
  if (!items) return null;
  const out = [];
  for (const item of items) {
    const text = atomKey(deref(item, env));
    if (text == null) return null;
    out.push(text);
  }
  return out;
}

function wordList(term, env) {
  const items = properListItems(term, env);
  if (!items) return null;
  const out = [];
  for (const item of items) {
    const word = atomList(item, env);
    if (!word) return null;
    out.push(word);
  }
  return out;
}

function atomKey(term) {
  if (term.type === 'atom' || term.type === 'string' || term.type === 'number') return term.name;
  return null;
}
