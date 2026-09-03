// Runtime control and ISO processor error types shared across subsystems.
// Keep these independent of the ISO builtin registry so syntax, DCG, program,
// and solver layers can report Prolog errors without importing the whole ISO
// implementation (and without creating semantic-layer import cycles).
import { termToString } from './term.js';

export class PrologError extends Error {
  constructor(formal, culprit = null) {
    const detail = culprit == null ? formal : `${formal}, ${termToString(culprit)}`;
    super(`error(${detail})`);
    this.name = 'PrologError';
    this.formal = formal;
    this.culprit = culprit;
  }
}

export class HaltSignal extends Error {
  constructor(code = 0) {
    super(`halt(${code})`);
    this.name = 'HaltSignal';
    this.code = code;
  }
}
