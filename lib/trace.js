/**
 * Eyeling Reasoner — trace
 *
 * Debugging/tracing utilities used to record and inspect reasoning steps.
 */

/* eslint-disable no-console */
'use strict';

// Small module for debug/trace printing (log:trace) and its run-level state.
// Kept separate from engine.js so browser demo + CLI can share behavior.

let tracePrefixes = null;

function getTracePrefixes() {
  return tracePrefixes;
}

function setTracePrefixes(v) {
  tracePrefixes = v;
}

function writeTraceLine(line) {
  // Prefer stderr in Node, fall back to console.error elsewhere.
  try {
    // eslint-disable-next-line no-undef
    if (typeof process !== 'undefined' && process.stderr && typeof process.stderr.write === 'function') {
      process.stderr.write(String(line) + '\n');
      return;
    }
  } catch (_) {}
  try {
    if (typeof console !== 'undefined' && typeof console.error === 'function') console.error(line);
  } catch (_) {}
}

module.exports = {
  getTracePrefixes,
  setTracePrefixes,
  writeTraceLine,
};
