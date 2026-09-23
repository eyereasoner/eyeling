#!/usr/bin/env node
'use strict';

/**
 * Checks every packaged proof against the program it was produced from.
 *
 * This is the suite that says what a proof is worth. It is not a golden
 * comparison: a proof that matched its golden byte for byte could still be
 * nonsense, so each document is re-checked here -- every recorded inference
 * re-performed against the source rule, every use resolved, the derivation
 * graph tested for cycles, and every claim accounted for.
 *
 * It also confirms the checker rejects a tampered document, because a
 * checker that accepts everything would pass the first half silently.
 */

const fs = require('node:fs');
const path = require('node:path');

const { C, detail, failResult, info, pass } = require('./report');
const { parseN3Text } = require('../lib/multisource');
const { checkProofDocument, verdict } = require('../lib/check-proof');

const root = path.resolve(__dirname, '..');
const examplesDir = path.join(root, 'examples');
const proofDir = path.join(examplesDir, 'proof');

function programFor(name) {
  const text = fs.readFileSync(path.join(examplesDir, name), 'utf8');
  // Source locations are what `pe:rule N` cites, so the checker must read
  // the program the way the writer did.
  return parseN3Text(text, { label: name, sourceLocations: true });
}

function main() {
  const names = fs.readdirSync(proofDir).filter((f) => f.endsWith('.n3')).sort();
  let failed = 0;
  let steps = 0;
  let verified = 0;
  let trusted = 0;

  info(`Checking ${names.length} packaged proofs`);
  for (const name of names) {
    const proof = fs.readFileSync(path.join(proofDir, name), 'utf8');
    let report;
    try {
      report = checkProofDocument(programFor(name), proof, { label: name });
    } catch (error) {
      failed++;
      failResult(name, `could not be read: ${error.message}`);
      continue;
    }
    steps += report.steps;
    verified += report.verified;
    trusted += report.trusted.length;
    if (report.valid) {
      pass(name, verdict(report));
    } else {
      failed++;
      failResult(name, verdict(report));
      for (const failure of report.failures.slice(0, 3)) {
        detail(`  [${failure.condition}] ${failure.conclusion} -- ${failure.detail}`);
      }
    }
  }

  // A checker that accepts anything would pass everything above.
  const socrates = programFor('socrates.n3');
  const good = fs.readFileSync(path.join(proofDir, 'socrates.n3'), 'utf8');
  const tampered = [
    ['a changed conclusion', good.replace(':Socrates a :Mortal', ':Plato a :Mortal')],
    ['a changed binding', good.replace('pe:value :Socrates', 'pe:value :Plato')],
    ['a changed rule citation', good.replace('pe:rule 1', 'pe:rule 2')],
    ['a changed use', good.replace('{ :Socrates a :Human . }', '{ :Plato a :Human . }')],
  ];
  for (const [what, text] of tampered) {
    const report = checkProofDocument(socrates, text, { label: 'tampered' });
    if (report.valid) {
      failed++;
      failResult(`rejects ${what}`, 'the checker accepted it');
    } else {
      pass(`rejects ${what}`, report.failures[0].condition);
    }
  }

  info(`${names.length} proofs, ${steps} steps, ${verified} verified, ${trusted} trusted`);
  if (failed) {
    console.error(`${C.r}${failed} check(s) failed${C.n}`);
    process.exit(1);
  }
}

main();
