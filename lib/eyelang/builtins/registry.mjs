// Registry for builtins and their execution metadata.
// The solver uses the metadata to know when a builtin is deterministic, mode-ready, or should fall back to user clauses.
import { arithmeticBuiltins } from './arithmetic.mjs';
import { coreBuiltins } from './core.mjs';
import { stringBuiltins } from './strings.mjs';
import { listBuiltins } from './lists.mjs';
import { aggregationBuiltins } from './aggregation.mjs';
import { formulaBuiltins } from './formula.mjs';
import { controlBuiltins } from './control.mjs';
import { sudokuBuiltins } from './sudoku.mjs';
import { portfolioBuiltins } from './portfolio.mjs';
import { searchBuiltins } from './search.mjs';
import { numberTheoryBuiltins } from './number-theory.mjs';
import { matrixBuiltins } from './matrix.mjs';
import { alphameticBuiltins } from './alphametic.mjs';
import { n3Builtins } from './n3.mjs';

export class BuiltinRegistry {
  constructor() {
    this.defs = new Map();
  }
  add(name, arity, handler, options = {}) {
    // ready() describes the argument mode in which the builtin is safe to run;
    // fallbackWhenNotReady keeps user-defined clauses visible outside that mode.
    this.defs.set(`${name}/${arity}`, {
      name,
      arity,
      handler,
      deterministic: options.deterministic ?? false,
      ready: options.ready ?? null,
      fallbackWhenNotReady: options.fallbackWhenNotReady ?? false,
      shouldUse: options.shouldUse ?? null,
    });
    return this;
  }
  get(name, arity) {
    return this.defs.get(`${name}/${arity}`) ?? null;
  }
}

export function createDefaultRegistry() {
  const registry = new BuiltinRegistry();
  for (const mod of [coreBuiltins, arithmeticBuiltins, stringBuiltins, listBuiltins, aggregationBuiltins, formulaBuiltins, controlBuiltins, sudokuBuiltins, portfolioBuiltins, searchBuiltins, numberTheoryBuiltins, matrixBuiltins, alphameticBuiltins, n3Builtins]) {
    mod.register(registry);
  }
  return registry;
}

let defaultRegistry = null;

export function getDefaultRegistry() {
  if (defaultRegistry == null) defaultRegistry = createDefaultRegistry();
  return defaultRegistry;
}
