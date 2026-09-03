// Runtime clock/sleep services for library(time).

import { NUMBER, VAR, copyResolved, deref, unify } from './term.js';
import { PrologError } from './errors.js';
import { dateTimeTerm } from './host-utils.js';

function* sleepBuiltin({ goal, env }) {
  const value = deref(goal.args[0], env);
  if (value.type === VAR) throw new PrologError('instantiation_error');
  if (value.type !== NUMBER) throw new PrologError('type_error(number)', copyResolved(value, env));
  const seconds = Number(value.name);
  if (!Number.isFinite(seconds)) throw new PrologError('type_error(number)', copyResolved(value, env));
  if (seconds < 0) throw new PrologError('domain_error(not_less_than_zero)', copyResolved(value, env));
  const milliseconds = Math.ceil(seconds * 1000);
  if (milliseconds > 0) {
    if (typeof SharedArrayBuffer === 'function' && typeof Atomics?.wait === 'function') {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
    } else {
      const end = Date.now() + milliseconds;
      while (Date.now() < end) {} // Last-resort worker-compatible fallback.
    }
  }
  yield env;
}

function* currentTimeBuiltin({ goal, env }) {
  const next = env.clone();
  if (unify(goal.args[0], dateTimeTerm(new Date()), next)) yield next;
}

export const timeHostBuiltins = {
  register(registry) {
    registry.add('eyeprolog__sleep', 1, sleepBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__current_time', 1, currentTimeBuiltin, { deterministic: true, eyePrologLibrary: true });
  },
};
