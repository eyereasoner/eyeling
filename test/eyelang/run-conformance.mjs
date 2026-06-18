#!/usr/bin/env node
// Conformance test runner.
// It executes cases in-process so the conformance corpus measures engine behavior instead of Node process startup.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Program, run } from '../../lib/eyelang/index.js';
import { fileURLToPath } from 'node:url';
import { TestReporter, isMainModule } from './test-style.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const filterArg = process.argv[2] ?? null;

export function runConformance(reporter = new TestReporter(), requestedFilter = null) {
  const filter = requestedFilter ?? filterArg;
  const label = filter == null ? 'eyelang' : `eyelang ${filter}`;
  reporter.section(`Conformance ${label}`);
  for (const file of listCaseFiles(filter)) runCaseFile(reporter, file);
  reporter.sectionTotal(`conformance ${label}`);
}

function listCaseFiles(filter = null) {
  const casesDir = path.join(root, 'conformance', 'cases');
  return fs.readdirSync(casesDir)
    .filter((name) => name.endsWith('.pl'))
    .filter((name) => filter == null || name.includes(filter) || name.slice(0, -3) === filter)
    .sort();
}

function runCaseFile(reporter, file) {
  const name = file.slice(0, -3);
  reporter.test(name, () => runCase(name, file));
}

function runCase(name, file) {
  const casesDir = path.join(root, 'conformance', 'cases');
  const expectedDir = path.join(root, 'conformance', 'expected');
  const programFile = path.join(casesDir, file);
  const expected = path.join(expectedDir, `${name}.pl`);
  const text = fs.readFileSync(programFile, 'utf8');
  const program = Program.parseSources([{ text, filename: file }], { sourceMetadata: false, markRecursive: false });
  const actual = run(program).stdout;

  if (!fs.existsSync(expected)) {
    throw new Error(`missing expected file: ${path.relative(root, expected)}`);
  }

  const expectedText = fs.readFileSync(expected, 'utf8');
  if (expectedText !== actual) {
    throw new Error(`output mismatch for ${name}\n${diffText(expected, actual)}`.trimEnd());
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
    runConformance(reporter);
    reporter.totalLine();
  } catch (_) {
    process.exit(1);
  }
}
