// Mutable PRNG state adapter for library(random). The explicit-state generator
// remains portable Prolog in src/lib/random.pl.

import { deref, numberTerm, numberTextFromDouble, unify } from './term.js';

function* randomValueBuiltin({ solver, goal, env }) {
  const key = 'a:$random_seed';
  const stored = solver.nonBacktrackableBlackboard.get(key);
  let seed = stored == null ? 1 : Number(deref(stored, env).name);
  if (!Number.isSafeInteger(seed)) seed = 1;
  seed %= 2147483647;
  if (seed < 0) seed += 2147483647;
  if (seed === 0) seed = 1;
  const high = Math.floor(seed / 44488);
  const low = seed % 44488;
  let nextSeed = 48271 * low - 3399 * high;
  if (nextSeed <= 0) nextSeed += 2147483647;
  const value = (nextSeed - 1) / 2147483646;
  const next = env.clone();
  if (!unify(goal.args[0], numberTerm(numberTextFromDouble(value)), next)) return;
  solver.nonBacktrackableBlackboard.set(key, numberTerm(nextSeed));
  yield next;
}

export const randomHostBuiltins = {
  register(registry) {
    registry.add('eyeprolog__random_value', 1, randomValueBuiltin, { deterministic: true, eyePrologLibrary: true });
  },
};
