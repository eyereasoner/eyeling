#!/usr/bin/env node
// Conformance test runner.
// It executes cases in-process so the conformance corpus measures engine behavior instead of Node process startup.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Program, run } from '../../lib/eyelang/index.mjs';
import { fileURLToPath } from 'node:url';
import { TestReporter, isMainModule } from './test-style.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const profileArg = process.argv[2] ?? 'conformance';

export function runConformance(reporter = new TestReporter(), requestedProfiles = null) {
  const profiles = requestedProfiles ?? (profileArg === 'conformance' ? ['core', 'extension'] : [profileArg]);
  for (const profile of profiles) runProfile(reporter, profile);
}

function runProfile(reporter, profile) {
  const casesDir = path.join(root, 'conformance', 'cases', profile);
  const expectedDir = path.join(root, 'conformance', 'expected', profile);

  reporter.section(`Conformance ${profile}`);

  const files = fs.readdirSync(casesDir)
    .filter((name) => name.endsWith('.pl'))
    .sort();

  for (const file of files) {
    const name = file.slice(0, -3);
    const label = `${profile}/${name}`;
    reporter.test(label, () => runCase(profile, name, file, casesDir, expectedDir));
  }

  reporter.sectionTotal(`conformance ${profile}`);
}

function runCase(profile, name, file, casesDir, expectedDir) {
  const programFile = path.join(casesDir, file);
  const expected = path.join(expectedDir, `${name}.out`);
  const text = fs.readFileSync(programFile, 'utf8');
  const program = Program.parseSources([{ text, filename: file }], { sourceMetadata: false, markRecursive: false });
  const actual = run(program).stdout;

  if (!fs.existsSync(expected)) {
    throw new Error(`missing expected file: ${path.relative(root, expected)}`);
  }

  const expectedText = fs.readFileSync(expected, 'utf8');
  if (expectedText !== actual) {
    throw new Error(`output mismatch for ${profile}/${name}
${diffText(expected, actual)}`.trimEnd());
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
