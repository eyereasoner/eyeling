#!/usr/bin/env node
// Example-output test runner.
// It compares examples byte-for-byte against golden output so answer and proof changes cannot silently alter results.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Program, run } from '../../lib/eyelang/index.mjs';
import { fileURLToPath } from 'node:url';
import { TestReporter, isMainModule } from './test-style.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const packageRoot = path.resolve(root, '..', '..');
const examplesDir = path.join(packageRoot, 'examples', 'eyelang');
const expectedDir = path.join(examplesDir, 'output');
const expectedProofDir = path.join(examplesDir, 'proof');
const fixedExampleDate = '2026-05-30';

const proofExamples = [
  'age.pl',
  'aliases-and-namespaces.pl',
  'ancestor.pl',
  'animal.pl',
  'annotation.pl',
  'backward.pl',
  'cat-koko.pl',
  'data-negotiation.pl',
  'derived-rule.pl',
  'dog.pl',
  'electrical-rc-filter.pl',
  'existential-rule.pl',
  'floating-point.pl',
  'good-cobbler.pl',
  'group-inverse-uniqueness.pl',
  'list-collection.pl',
  'proof-contrapositive.pl',
  'socket-age.pl',
  'socket-family.pl',
  'socrates.pl',
];

export function runExamples(reporter = new TestReporter()) {
  const files = fs.readdirSync(examplesDir)
    .filter((name) => exampleIsRunnable(name))
    .sort();

  reporter.section('Examples');
  for (const name of files) reporter.test(name, () => runExample(name));
  reporter.sectionTotal('examples');

  reporter.section('Proof examples');
  for (const name of proofExamples) reporter.test(name, () => runProofExample(name));
  reporter.sectionTotal('proof examples');
}


function exampleIsRunnable(name) {
  return name.endsWith('.pl') || name.endsWith('.n3') || name.endsWith('.ttl') || name.endsWith('.nt');
}

function runExample(name) {
  const programFile = path.join(examplesDir, name);
  const expected = path.join(expectedDir, name);
  const actual = runProgramExample(programFile, name, { proof: false });
  compareOutput(name, expected, actual, 'output');
}

function runProofExample(name) {
  const programFile = path.join(examplesDir, name);
  const expected = path.join(expectedProofDir, name);
  const actual = runProgramExample(programFile, name, { proof: true });
  compareOutput(name, expected, actual, 'proof output');
}

function runProgramExample(programFile, filename, options) {
  const oldLocalTime = process.env.EYELANG_LOCAL_TIME;
  process.env.EYELANG_LOCAL_TIME = fixedExampleDate;
  try {
    const text = fs.readFileSync(programFile, 'utf8');
    const program = Program.parseSources([{ text, filename }], {
      sourceMetadata: options.proof,
      markRecursive: options.proof,
      inputFormat: 'auto',
    });
    return run(program, options).stdout;
  } finally {
    if (oldLocalTime == null) delete process.env.EYELANG_LOCAL_TIME;
    else process.env.EYELANG_LOCAL_TIME = oldLocalTime;
  }
}

function compareOutput(name, expected, actual, label) {
  if (!fs.existsSync(expected)) {
    throw new Error(`missing expected ${label} file: ${path.relative(root, expected)}`);
  }

  const expectedText = fs.readFileSync(expected, 'utf8');
  if (expectedText !== actual) {
    throw new Error(`${label} mismatch for ${name}\n${diffText(expected, actual)}`.trimEnd());
  }
}

function diffText(expected, actualText) {
  const diff = spawnSync('diff', ['-u', expected, '-'], { input: actualText, encoding: 'utf8' });
  if (diff.stdout) return diff.stdout;

  const expectedText = fs.readFileSync(expected, 'utf8').split('\n');
  const actualLines = actualText.split('\n');
  const limit = Math.max(expectedText.length, actualLines.length);
  for (let i = 0; i < limit; i++) {
    if (expectedText[i] !== actualLines[i]) {
      return `first difference at line ${i + 1}\nexpected: ${expectedText[i] ?? '<missing>'}\nactual:   ${actualLines[i] ?? '<missing>'}`;
    }
  }

  return 'outputs differ';
}

if (isMainModule(import.meta.url)) {
  const reporter = new TestReporter();
  try {
    runExamples(reporter);
    reporter.totalLine();
  } catch (_) {
    process.exit(1);
  }
}
