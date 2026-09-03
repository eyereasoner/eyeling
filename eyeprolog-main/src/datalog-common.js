// Shared plumbing for the finite positive-Datalog and WFS evaluators.
//
// Keep evaluator-specific relation storage and fixpoint algorithms in their
// own modules; this file only contains representation/traversal helpers whose
// semantics are common to both execution paths.

import { ATOM, COMPOUND, VAR } from './term.js';

export const EMPTY_ARRAY = Object.freeze([]);

export function predicateKey(module, name, arity) {
  return `${module ?? 'user'}:${name}/${arity}`;
}

export function directLiteral(goal, module) {
  if (goal?.type !== COMPOUND && goal?.type !== ATOM) return null;
  return {
    key: predicateKey(goal.module ?? module, goal.name, goal.arity),
    name: goal.name,
    arity: goal.arity,
    module: goal.module ?? module,
    args: goal.args ?? EMPTY_ARRAY,
  };
}

export function dependencyCone(program, rootGroup, literalForGoal = directLiteral) {
  const groups = [];
  const seen = new Set();
  const stack = [rootGroup];
  while (stack.length > 0) {
    const group = stack.pop();
    const key = predicateKey(group.module, group.name, group.arity);
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(group);
    for (const clause of group.clauses) {
      for (const goal of clause.body) {
        const literal = literalForGoal(goal, group.module);
        if (!literal) continue;
        const target = program.findGroup(literal.name, literal.arity, literal.module);
        if (target) stack.push(target);
      }
    }
  }
  return groups;
}

export function resolvePatternTerm(term, bindings) {
  if (term.type === VAR) return bindings.get(term.name) ?? null;
  return term;
}

export function estimateLiteral(literal, relation, bindings) {
  const candidates = relation.candidateIndexes(literal.args, bindings);
  return candidates == null ? relation.rows.length : candidates.length;
}
