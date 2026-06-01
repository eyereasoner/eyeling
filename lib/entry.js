/**
 * Eyeling Reasoner — entry
 *
 * Package entry module used by the bundler and runtime entrypoints.
 * Keeps exports wiring separate from the core engine implementation.
 */

'use strict';

// Entry point for the bundled eyeling.js.
// We intentionally re-export a small set of internals so playground.html (worker)
// can call into the reasoner like the original monolithic build did.

const engine = require('./engine');
const { dataFactory } = require('./rdfjs');

module.exports = {
  // public
  reasonStream: engine.reasonStream,
  reasonRdfJs: engine.reasonRdfJs,
  rdfjs: dataFactory,
  main: engine.main,
  version: engine.version,
  INFERENCE_FUSE_EXIT_CODE: engine.INFERENCE_FUSE_EXIT_CODE,

  // internals for playground.html
  lex: engine.lex,
  Parser: engine.Parser,
  forwardChain: engine.forwardChain,
  collectLogQueryConclusions: engine.collectLogQueryConclusions,
  forwardChainAndCollectLogQueryConclusions: engine.forwardChainAndCollectLogQueryConclusions,
  materializeRdfLists: engine.materializeRdfLists,
  isGroundTriple: engine.isGroundTriple,
  printExplanation: engine.printExplanation,
  renderProofDocument: engine.renderProofDocument,
  tripleToN3: engine.tripleToN3,
  collectOutputStringsFromFacts: engine.collectOutputStringsFromFacts,
  prettyPrintQueryTriples: engine.prettyPrintQueryTriples,
  registerBuiltin: engine.registerBuiltin,
  unregisterBuiltin: engine.unregisterBuiltin,
  registerBuiltinModule: engine.registerBuiltinModule,
  loadBuiltinModule: engine.loadBuiltinModule,
  listBuiltinIris: engine.listBuiltinIris,
  getEnforceHttpsEnabled: engine.getEnforceHttpsEnabled,
  setEnforceHttpsEnabled: engine.setEnforceHttpsEnabled,
  getProofCommentsEnabled: engine.getProofCommentsEnabled,
  setProofCommentsEnabled: engine.setProofCommentsEnabled,
  getTracePrefixes: engine.getTracePrefixes,
  setTracePrefixes: engine.setTracePrefixes,
};
