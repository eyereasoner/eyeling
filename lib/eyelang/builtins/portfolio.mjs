// Reusable bounded-subset optimizer for finite knapsack-style examples.
// Items are p(Name, Value, Cost, Risk) terms; the builtin enumerates every
// subset whose total cost/risk stays within the supplied caps.
import { deref, listFromItems, numberTerm, properListItems, unify } from '../term.mjs';

export const portfolioBuiltins = {
  register(registry) {
    registry.add('bounded_subset', 7, boundedSubset, {
      fallbackWhenNotReady: true,
      ready: boundedSubsetReady,
    });
  }
};

function boundedSubsetReady(goal, env) {
  return parseItems(goal.args[0], env) !== null && intArg(goal.args[1], env) !== null && intArg(goal.args[2], env) !== null;
}

function* boundedSubset({ goal, env }) {
  const items = parseItems(goal.args[0], env);
  const budget = intArg(goal.args[1], env);
  const riskCap = intArg(goal.args[2], env);
  if (!items || budget == null || riskCap == null) return;
  for (const answer of enumerate(items, 0, budget, riskCap)) {
    const next = env.clone();
    if (unify(goal.args[3], listFromItems(answer.names), next) &&
        unify(goal.args[4], numberTerm(answer.value), next) &&
        unify(goal.args[5], numberTerm(answer.cost), next) &&
        unify(goal.args[6], numberTerm(answer.risk), next)) {
      yield next;
    }
  }
}

function* enumerate(items, index, budget, riskLeft) {
  if (index >= items.length) {
    yield { names: [], value: 0, cost: 0, risk: 0 };
    return;
  }
  const item = items[index];
  if (item.cost <= budget && item.risk <= riskLeft) {
    for (const rest of enumerate(items, index + 1, budget - item.cost, riskLeft - item.risk)) {
      yield {
        names: [item.name, ...rest.names],
        value: item.value + rest.value,
        cost: item.cost + rest.cost,
        risk: item.risk + rest.risk,
      };
    }
  }
  yield* enumerate(items, index + 1, budget, riskLeft);
}

function parseItems(term, env) {
  const list = properListItems(term, env);
  if (!list) return null;
  const items = [];
  for (const itemTerm of list) {
    const item = deref(itemTerm, env);
    if (item.type !== 'compound' || item.name !== 'p' || item.arity !== 4) return null;
    const value = intArg(item.args[1], env), cost = intArg(item.args[2], env), risk = intArg(item.args[3], env);
    if (value == null || cost == null || risk == null) return null;
    items.push({ name: item.args[0], value, cost, risk });
  }
  return items;
}

function intArg(term, env) {
  const value = deref(term, env);
  if (value.type !== 'number' || !/^-?\d+$/.test(value.name)) return null;
  const n = Number(value.name);
  return Number.isSafeInteger(n) ? n : null;
}
