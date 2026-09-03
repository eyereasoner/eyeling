// Runtime term rendering used by library(format).

import { ATOM, NUMBER, STRING, deref, unify } from './term.js';
import { PrologError } from './errors.js';
import { formatTermForWrite } from './write.js';
import { chars } from './host-utils.js';

function* termCharsBuiltin({ solver, goal, env }) {
  const mode = deref(goal.args[0], env);
  if (mode.type !== ATOM || !['a', 'd', 'q', 'w'].includes(mode.name)) {
    throw new PrologError('domain_error(format_control)', mode);
  }
  const value = deref(goal.args[1], env);
  if (mode.name === 'd' && value.type !== NUMBER) throw new PrologError('type_error(integer)', value);
  if (mode.name === 'a' && ![ATOM, NUMBER, STRING].includes(value.type)) {
    throw new PrologError('type_error(atomic)', value);
  }
  const text = formatTermForWrite(goal.args[1], env, {
    quoted: mode.name === 'q',
    numbervars: true,
    compact: true,
    minimalOperatorSpacing: true,
    operatorAtomsAsArgs: true,
    generateVariableNames: true,
    variableNameState: solver.writeVariableState,
    operators: solver.program.operators.values(),
  });
  const next = env.clone();
  if (unify(goal.args[2], chars(text), next)) yield next;
}

function* portrayClauseBuiltin({ solver, goal, env }) {
  const text = formatTermForWrite(goal.args[0], env, {
    quoted: true,
    numbervars: true,
    compact: true,
    minimalOperatorSpacing: true,
    operatorAtomsAsArgs: true,
    generateVariableNames: true,
    variableNameState: solver.writeVariableState,
    operators: solver.program.operators.values(),
  });
  solver.io.writeUnit(solver.io.resolve(solver.io.currentOutput), `${text}.\n`);
  yield env;
}

export const formatHostBuiltins = {
  register(registry) {
    registry.add('eyeprolog__term_chars', 3, termCharsBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('portray_clause', 1, portrayClauseBuiltin, { deterministic: true, eyePrologLibrary: true });
  },
};
