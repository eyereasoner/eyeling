/**
 * Eyeling Reasoner — entry
 *
 * Package entry module used by the bundler and runtime entrypoints.
 * Keeps exports wiring separate from the core engine implementation.
 */

'use strict';

// Entry point for the bundled eyeling.js.
// We intentionally re-export a small set of internals so demo.html (worker)
// can call into the reasoner like the original monolithic build did.

const engine = require('./engine');

module.exports = {
  // public
  reasonStream: engine.reasonStream,
  main: engine.main,
  version: engine.version,

  // internals for demo.html
  lex: engine.lex,
  Parser: engine.Parser,
  forwardChain: engine.forwardChain,
  materializeRdfLists: engine.materializeRdfLists,
  isGroundTriple: engine.isGroundTriple,
  printExplanation: engine.printExplanation,
  tripleToN3: engine.tripleToN3,
  getEnforceHttpsEnabled: engine.getEnforceHttpsEnabled,
  setEnforceHttpsEnabled: engine.setEnforceHttpsEnabled,
  getProofCommentsEnabled: engine.getProofCommentsEnabled,
  setProofCommentsEnabled: engine.setProofCommentsEnabled,
  getTracePrefixes: engine.getTracePrefixes,
  setTracePrefixes: engine.setTracePrefixes,
};
