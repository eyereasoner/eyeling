// Native declarative disequality backend for library(dif).
import { difBuiltin } from './iso.js';

export const difHostBuiltins = {
  register(registry) {
    registry.add('dif', 2, difBuiltin, { deterministic: true, eyePrologLibrary: true });
  },
};
