#!/usr/bin/env node
'use strict';

/**
 * End-to-end integration test against the external Notation3 test suite.
 *
 * What it does (roughly):
 *   cd /tmp
 *   git clone https://codeberg.org/phochste/notation3tests
 *   cd notation3tests
 *   npm ci
 *   (install *this* eyeling working tree)
 *   npm run test:eyeling
 *
 * It streams progress to stdout/stderr and prints a compact final summary.
 *
 * In CI, this test is skipped unless EYELING_RUN_NOTATION3TESTS=1 is set,
 * because it depends on network availability and takes longer than unit tests.
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

const { C, failResult, pass, warn } = require('./report');

function run(cmd, args, opts = {}) {
  const t0 = Date.now();
  console.log(`${C.dim}$ ${cmd} ${args.join(' ')}${C.n}`);
  const r = cp.spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  const ms = Date.now() - t0;
  return { ...r, ms };
}

function runCapture(cmd, args, opts = {}) {
  const t0 = Date.now();
  const r = cp.spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  const ms = Date.now() - t0;
  return { ...r, ms };
}

function has(cmd) {
  const r = runCapture(cmd, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
  return r.status === 0;
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) {
    // ignore
  }
}

(async function main() {
  let sequence = 0;
  if (process.env.CI && process.env.EYELING_RUN_NOTATION3TESTS !== '1') {
    warn('CI detected; set EYELING_RUN_NOTATION3TESTS=1 to run Notation3 tests');
    return;
  }

  if (!has('git')) {
    failResult(++sequence, 'git not found in PATH', 0);
    process.exitCode = 1;
    return;
  }
  if (!has('npm')) {
    failResult(++sequence, 'npm not found in PATH', 0);
    process.exitCode = 1;
    return;
  }

  const tmpBase = os.tmpdir();
  const workDir = path.join(tmpBase, `eyeling-notation3tests-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const suiteDir = path.join(workDir, 'notation3tests');

  console.log(`${C.dim}Working directory:${C.n} ${workDir}`);
  fs.mkdirSync(workDir, { recursive: true });

  // 1) Clone suite
  let r = run('git', ['clone', '--depth', '1', 'https://codeberg.org/phochste/notation3tests', suiteDir]);
  if (r.status !== 0) {
    failResult(++sequence, `git clone failed (exit ${r.status})`, r.ms);
    process.exitCode = 1;
    rmrf(workDir);
    return;
  }
  pass(++sequence, 'cloned notation3tests', r.ms);

  // 2) Install suite dependencies
  // Notation3tests can carry vulnerabilities in its transient dependency tree.
  // These are outside Eyeling's control, and npm's audit summary can be noisy in logs.
  // Disable audit/funding output for this integration test install.
  r = run('npm', ['ci', '--audit=false', '--fund=false'], { cwd: suiteDir });
  if (r.status !== 0) {
    failResult(++sequence, `npm ci failed (exit ${r.status})`, r.ms);
    process.exitCode = 1;
    rmrf(workDir);
    return;
  }
  pass(++sequence, 'npm ci', r.ms);

  // 3) Pack local Eyeling
  const pack = runCapture('npm', ['pack', '--silent'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (pack.status !== 0) {
    console.error(pack.stderr || '');
    failResult(++sequence, `npm pack failed (exit ${pack.status})`, pack.ms);
    process.exitCode = 1;
    rmrf(workDir);
    return;
  }
  const tgzName = String(pack.stdout).trim().split(/\r?\n/).pop();
  const tgzPath = path.join(ROOT, tgzName);
  if (!fs.existsSync(tgzPath)) {
    failResult(++sequence, `npm pack did not produce expected tarball: ${tgzPath}`, pack.ms);
    process.exitCode = 1;
    rmrf(workDir);
    return;
  }
  pass(++sequence, `packed ${tgzName}`, pack.ms);

  // 4) Install local tarball into suite
  // Keep the install output focused on the actual test run.
  r = run('npm', ['install', '--no-save', '--audit=false', '--fund=false', tgzPath], { cwd: suiteDir });
  if (r.status !== 0) {
    failResult(++sequence, `npm install eyeling tarball failed (exit ${r.status})`, r.ms);
    process.exitCode = 1;
    rmrf(tgzPath);
    rmrf(workDir);
    return;
  }
  pass(++sequence, 'installed local eyeling', r.ms);

  // 5) Run suite test target
  const t0 = Date.now();
  r = run('npm', ['run', 'test:eyeling'], { cwd: suiteDir });
  const totalMs = Date.now() - t0;

  // Cleanup tarball
  rmrf(tgzPath);

  if (r.status === 0) {
    pass(++sequence, 'notation3tests:eyeling passed', totalMs);
    if (process.env.EYELING_KEEP_NOTATION3TESTS === '1') {
      console.log(`${C.dim}Keeping workdir (EYELING_KEEP_NOTATION3TESTS=1):${C.n} ${workDir}`);
    } else {
      rmrf(workDir);
    }
    return;
  }

  failResult(++sequence, `notation3tests:eyeling failed (exit ${r.status})`, totalMs);
  process.exitCode = 1;
  if (process.env.EYELING_KEEP_NOTATION3TESTS === '1') {
    console.log(`${C.dim}Keeping workdir (EYELING_KEEP_NOTATION3TESTS=1):${C.n} ${workDir}`);
  } else {
    rmrf(workDir);
  }
})();
