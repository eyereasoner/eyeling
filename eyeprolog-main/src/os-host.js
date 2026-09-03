// Runtime operating-system services for library(os).

import { isNode } from './platform.js';
import { copyResolved, deref, numberTerm, unify } from './term.js';
import { PrologError } from './errors.js';
import { characterListText, chars, listOfChars } from './host-utils.js';

let spawnSync = null;
if (isNode) ({ spawnSync } = await import('node:child_process'));

function requireNode(resource = 'operating_system') {
  if (!isNode) throw new PrologError(`resource_error(${resource})`);
}

function environmentKey(term, env) {
  requireNode();
  const key = characterListText(term, env);
  if (!key || key.includes('=') || key.includes('\0')) {
    throw new PrologError('domain_error(env_var)', copyResolved(term, env));
  }
  return key;
}

function* getenvBuiltin({ goal, env }) {
  const key = environmentKey(goal.args[0], env);
  const value = process.env[key];
  if (value == null) return;
  const next = env.clone();
  if (unify(goal.args[1], chars(value), next)) yield next;
}

function* setenvBuiltin({ goal, env }) {
  const key = environmentKey(goal.args[0], env);
  const value = characterListText(goal.args[1], env);
  if (value.includes('\0')) throw new PrologError('domain_error(env_var_value)', copyResolved(goal.args[1], env));
  process.env[key] = value;
  yield env;
}

function* unsetenvBuiltin({ goal, env }) {
  const key = environmentKey(goal.args[0], env);
  delete process.env[key];
  yield env;
}

function* shellBuiltin({ solver, goal, env }) {
  requireNode('process');
  if (spawnSync == null) throw new PrologError('resource_error(process)');
  const command = characterListText(goal.args[0], env);
  const result = spawnSync(command, { shell: true, encoding: 'utf8' });
  if (result.error) throw new PrologError('resource_error(process)');
  if (result.stdout) solver.io.writeUnit(solver.io.resolve(solver.io.currentOutput), result.stdout);
  if (result.stderr) solver.io.writeUnit(solver.io.resolve('user_error'), result.stderr);
  const status = Number.isInteger(result.status) ? result.status : 1;
  const next = env.clone();
  if (unify(goal.args[1], numberTerm(status), next)) yield next;
}

function* pidBuiltin({ goal, env }) {
  requireNode();
  const next = env.clone();
  if (unify(goal.args[0], numberTerm(process.pid), next)) yield next;
}

function processArguments() {
  requireNode();
  return process.argv.map(String);
}

function* rawArgvBuiltin({ goal, env }) {
  const next = env.clone();
  if (unify(goal.args[0], listOfChars(processArguments()), next)) yield next;
}

function* argvBuiltin({ goal, env }) {
  const raw = processArguments();
  const separator = raw.indexOf('--');
  const args = separator < 0 ? [] : raw.slice(separator + 1);
  const next = env.clone();
  if (unify(goal.args[0], listOfChars(args), next)) yield next;
}

export const osHostBuiltins = {
  register(registry) {
    registry.add('eyeprolog__getenv', 2, getenvBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__setenv', 2, setenvBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__unsetenv', 1, unsetenvBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__shell', 2, shellBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__pid', 1, pidBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__raw_argv', 1, rawArgvBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__argv', 1, argvBuiltin, { deterministic: true, eyePrologLibrary: true });
  },
};
