// Path-opening bridge for library(pio).
//
// Scryer represents file paths as character lists, while EyeProlog's strict
// ISO open/3-4 source_sink is atom-oriented. Keep the compatibility conversion
// private to library(pio) instead of changing the core stream contract.

import { ATOM, atom, compound, deref } from './term.js';
import { characterListText } from './host-utils.js';

function openCharsBuiltin({ solver, goal, env }) {
  const source = deref(goal.args[0], env);
  const path = source.type === ATOM ? source.name : characterListText(goal.args[0], env);
  const invoked = compound('open', [atom(path), goal.args[1], goal.args[2], goal.args[3]]);
  invoked.module = goal.module ?? 'user';
  const child = solver.cloneForInnerGoal();
  const iterator = (function* () {
    try {
      yield* child.solve([invoked], env, 0);
    } finally {
      solver.absorbStatsFrom(child);
    }
  })();
  return iterator;
}

export const pioHostBuiltins = {
  register(registry) {
    registry.add('eyeprolog__pio_open_chars', 4, openCharsBuiltin, { eyePrologLibrary: true });
  },
};
