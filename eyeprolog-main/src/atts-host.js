// Generic attributed-variable bridge for Prolog libraries.
//
// The storage is owned by Env so attributes backtrack with substitutions. This
// module exposes the small atts interface used by Scryer libraries. Attribute
// verification itself is scheduled by term.js and executed by Solver before a
// binding is committed; goals returned by verify_attributes/3 run immediately
// after the binding.

import {
  ATOM, COMPOUND, VAR, atom, compound, deref, listFromItems,
  properListItems, unify, variable,
} from './term.js';
import { PrologError } from './errors.js';
import { callResidueVarsBuiltin } from './iso.js';

function callerModule(goal) {
  return goal.module ?? 'user';
}

function attributeSignature(term) {
  if (term.type === ATOM) return { name: term.name, arity: 0 };
  if (term.type === COMPOUND) return { name: term.name, arity: term.arity };
  return null;
}

function normalizedAttribute(term, env) {
  let resolved = deref(term, env);
  let mode = 'put';
  if (resolved.type === COMPOUND && resolved.arity === 1 && (resolved.name === '+' || resolved.name === '-')) {
    mode = resolved.name === '-' ? 'delete' : 'put';
    resolved = deref(resolved.args[0], env);
  }
  if (resolved.type === VAR) throw new PrologError('instantiation_error');
  const signature = attributeSignature(resolved);
  if (signature == null) throw new PrologError('type_error(callable)', resolved);
  return { mode, attribute: resolved, ...signature };
}

function putOne(next, variableTerm, owner, attributeTerm) {
  const variableValue = deref(variableTerm, next);
  if (variableValue.type !== VAR) throw new PrologError('uninstantiation_error', variableValue);
  const normalized = normalizedAttribute(attributeTerm, next);
  if (normalized.mode === 'delete') {
    next.deletePrologAttribute(variableValue.name, owner, normalized.name, normalized.arity);
    return;
  }
  next.putPrologAttribute(variableValue.name, owner, normalized.attribute);
}

function* putAttsBuiltin({ goal, env }) {
  const next = env.clone();
  const owner = callerModule(goal);
  const variableTerm = deref(goal.args[0], next);
  if (variableTerm.type !== VAR) throw new PrologError('uninstantiation_error', variableTerm);
  const list = properListItems(goal.args[1], next);
  if (list != null) {
    for (const attribute of list) putOne(next, variableTerm, owner, attribute);
  } else {
    putOne(next, variableTerm, owner, goal.args[1]);
  }
  yield next;
}

function* getAttsBuiltin({ goal, env }) {
  const variableTerm = deref(goal.args[0], env);
  if (variableTerm.type !== VAR) throw new PrologError('uninstantiation_error', variableTerm);
  const owner = callerModule(goal);
  const pattern = deref(goal.args[1], env);
  const attributes = env.prologAttributes(variableTerm.name, owner);
  if (pattern.type === VAR) {
    if (attributes.length === 0) return;
    const next = env.clone();
    if (unify(goal.args[1], listFromItems(attributes), next,
      { knownNonoccurringVariables: goal._firstUseVariables })) yield next;
    return;
  }

  let mode = 'present';
  let inner = pattern;
  if (pattern.type === COMPOUND && pattern.arity === 1 && (pattern.name === '+' || pattern.name === '-')) {
    mode = pattern.name === '-' ? 'absent' : 'present';
    inner = deref(pattern.args[0], env);
  }
  if (inner.type === VAR) throw new PrologError('instantiation_error');
  const signature = attributeSignature(inner);
  if (signature == null) throw new PrologError('type_error(callable)', inner);
  const stored = env.getPrologAttribute(variableTerm.name, owner, signature.name, signature.arity);
  if (mode === 'absent') {
    if (stored == null) yield env.clone();
    return;
  }
  if (stored == null) return;
  const next = env.clone();
  if (unify(inner, stored, next, {
    skipVariableConstraints: true,
    knownNonoccurringVariables: goal._firstUseVariables,
  })) yield next;
}

function attributeName(term, env) {
  const resolved = deref(term, env);
  if (resolved.type === VAR) throw new PrologError('instantiation_error');
  if (resolved.type !== ATOM) throw new PrologError('type_error(atom)', resolved);
  return resolved.name;
}

function* putAttrBuiltin({ goal, env }) {
  const next = env.clone();
  const owner = callerModule(goal);
  const variableTerm = deref(goal.args[0], next);
  if (variableTerm.type !== VAR) throw new PrologError('uninstantiation_error', variableTerm);
  const name = attributeName(goal.args[1], next);
  next.putPrologAttribute(variableTerm.name, owner, compound(name, [goal.args[2]]));
  yield next;
}

function* getAttrBuiltin({ goal, env }) {
  const variableTerm = deref(goal.args[0], env);
  if (variableTerm.type !== VAR) return;
  const owner = callerModule(goal);
  const name = attributeName(goal.args[1], env);
  const stored = env.getPrologAttribute(variableTerm.name, owner, name, 1);
  if (stored == null) return;
  const next = env.clone();
  if (unify(goal.args[2], stored.args[0], next, {
    skipVariableConstraints: true,
    knownNonoccurringVariables: goal._firstUseVariables,
  })) yield next;
}

function* delAttrBuiltin({ goal, env }) {
  const next = env.clone();
  const variableTerm = deref(goal.args[0], next);
  if (variableTerm.type !== VAR) { yield next; return; }
  const owner = callerModule(goal);
  const name = attributeName(goal.args[1], next);
  next.deletePrologAttribute(variableTerm.name, owner, name, null);
  yield next;
}

function collectTermVariables(term, env) {
  const result = [];
  const seen = new Set();
  const stack = [term];
  while (stack.length) {
    const current = deref(stack.pop(), env);
    if (current.type === VAR) {
      if (!seen.has(current.name)) {
        seen.add(current.name);
        result.push(current);
      }
      continue;
    }
    if (current.type === COMPOUND) {
      for (let i = current.arity - 1; i >= 0; i--) stack.push(current.args[i]);
    }
  }
  return result;
}

function* termAttributedVariablesBuiltin({ goal, env }) {
  const variables = collectTermVariables(goal.args[0], env).filter((term) => env.hasPrologAttributes(term.name));
  const next = env.clone();
  if (unify(goal.args[1], listFromItems(variables), next)) yield next;
}

function* getAttrListBuiltin({ goal, env }) {
  const variableTerm = deref(goal.args[0], env);
  if (variableTerm.type !== VAR) return;
  const entries = env.prologAttributes(variableTerm.name);
  if (entries.length === 0) return;
  const encoded = entries.map(({ module, attribute }) => compound(':', [atom(module), attribute]));
  const next = env.clone();
  if (unify(goal.args[1], listFromItems(encoded), next,
    { knownNonoccurringVariables: goal._firstUseVariables })) yield next;
}

function* getFromAttrListBuiltin({ goal, env }) {
  const variableTerm = deref(goal.args[0], env);
  if (variableTerm.type !== VAR) return;
  const moduleTerm = deref(goal.args[1], env);
  if (moduleTerm.type === VAR) throw new PrologError('instantiation_error');
  if (moduleTerm.type !== ATOM) throw new PrologError('type_error(atom)', moduleTerm);
  const pattern = deref(goal.args[2], env);
  if (pattern.type === VAR) throw new PrologError('instantiation_error');
  const signature = attributeSignature(pattern);
  if (signature == null) throw new PrologError('type_error(callable)', pattern);
  const stored = env.getPrologAttribute(variableTerm.name, moduleTerm.name, signature.name, signature.arity);
  if (stored == null) return;
  const next = env.clone();
  if (unify(pattern, stored, next, {
    skipVariableConstraints: true,
    knownNonoccurringVariables: goal._firstUseVariables,
  })) yield next;
}

function* putToAttrListBuiltin({ goal, env }) {
  const next = env.clone();
  const variableTerm = deref(goal.args[0], next);
  if (variableTerm.type !== VAR) throw new PrologError('uninstantiation_error', variableTerm);
  const moduleTerm = deref(goal.args[1], next);
  if (moduleTerm.type === VAR) throw new PrologError('instantiation_error');
  if (moduleTerm.type !== ATOM) throw new PrologError('type_error(atom)', moduleTerm);
  const normalized = normalizedAttribute(goal.args[2], next);
  next.putPrologAttribute(variableTerm.name, moduleTerm.name, normalized.attribute);
  yield next;
}

function* delFromAttrListBuiltin({ goal, env }) {
  const next = env.clone();
  const variableTerm = deref(goal.args[0], next);
  if (variableTerm.type !== VAR) { yield next; return; }
  const moduleTerm = deref(goal.args[1], next);
  if (moduleTerm.type === VAR) throw new PrologError('instantiation_error');
  if (moduleTerm.type !== ATOM) throw new PrologError('type_error(atom)', moduleTerm);
  const normalized = normalizedAttribute(goal.args[2], next);
  next.deletePrologAttribute(variableTerm.name, moduleTerm.name, normalized.name, normalized.arity);
  yield next;
}

export const attsHostBuiltins = {
  register(registry) {
    registry.add('eyeprolog__call_residue_vars', 2, callResidueVarsBuiltin, { eyePrologLibrary: true });
    registry.add('put_atts', 2, putAttsBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('get_atts', 2, getAttsBuiltin, { deterministic: true, eyePrologLibrary: true });
    // Scryer's CLP(Z) sources use these through goal expansion. EyeProlog
    // provides them directly so the source does not depend on goal_expansion/2.
    registry.add('put_attr', 3, putAttrBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('get_attr', 3, getAttrBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('del_attr', 2, delAttrBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('$term_attributed_variables', 2, termAttributedVariablesBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('$get_attr_list', 2, getAttrListBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('$get_from_attr_list', 3, getFromAttrListBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('$put_to_attr_list', 3, putToAttrListBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('$del_from_attr_list', 3, delFromAttrListBuiltin, { deterministic: true, eyePrologLibrary: true });
  },
};
