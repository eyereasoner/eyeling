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

const TTY = process.stdout.isTTY;
const C = TTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', n: '\x1b[0m' }
  : { g: '', r: '', y: '', dim: '', n: '' };

function ok(msg) {
  console.log(`${C.g}OK${C.n}  ${msg}`);
}
function warn(msg) {
  console.log(`${C.y}SKIP${C.n}  ${msg}`);
}
function fail(msg) {
  console.error(`${C.r}FAIL${C.n} ${msg}`);
  process.exitCode = 1;
}

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
  if (process.env.CI && process.env.EYELING_RUN_NOTATION3TESTS !== '1') {
    warn('CI detected; set EYELING_RUN_NOTATION3TESTS=1 to run Notation3 tests');
    return;
  }

  if (!has('git')) {
    fail('git not found in PATH');
    return;
  }
  if (!has('npm')) {
    fail('npm not found in PATH');
    return;
  }

  const tmpBase = os.tmpdir();
  const workDir = path.join(
    tmpBase,
    `eyeling-notation3tests-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  const suiteDir = path.join(workDir, 'notation3tests');

  console.log(`${C.dim}Working directory:${C.n} ${workDir}`);
  fs.mkdirSync(workDir, { recursive: true });

  // 1) Clone suite
  let r = run('git', ['clone', '--depth', '1', 'https://codeberg.org/phochste/notation3tests', suiteDir]);
  if (r.status !== 0) {
    fail(`git clone failed (exit ${r.status})`);
    rmrf(workDir);
    return;
  }
  ok(`cloned notation3tests ${C.dim}(${r.ms} ms)${C.n}`);

  // 2) Install suite dependencies
  r = run('npm', ['ci'], { cwd: suiteDir });
  if (r.status !== 0) {
    fail(`npm ci failed (exit ${r.status})`);
    rmrf(workDir);
    return;
  }
  ok(`npm ci ${C.dim}(${r.ms} ms)${C.n}`);

  // 3) Build + pack local Eyeling
  r = run('npm', ['run', 'build'], { cwd: ROOT });
  if (r.status !== 0) {
    fail(`npm run build failed (exit ${r.status})`);
    rmrf(workDir);
    return;
  }
  ok(`built eyeling ${C.dim}(${r.ms} ms)${C.n}`);

  const pack = runCapture('npm', ['pack', '--silent'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (pack.status !== 0) {
    console.error(pack.stderr || '');
    fail(`npm pack failed (exit ${pack.status})`);
    rmrf(workDir);
    return;
  }
  const tgzName = String(pack.stdout).trim().split(/\r?\n/).pop();
  const tgzPath = path.join(ROOT, tgzName);
  if (!fs.existsSync(tgzPath)) {
    fail(`npm pack did not produce expected tarball: ${tgzPath}`);
    rmrf(workDir);
    return;
  }
  ok(`packed ${tgzName} ${C.dim}(${pack.ms} ms)${C.n}`);

  // 4) Install local tarball into suite
  r = run('npm', ['install', '--no-save', tgzPath], { cwd: suiteDir });
  if (r.status !== 0) {
    fail(`npm install eyeling tarball failed (exit ${r.status})`);
    rmrf(tgzPath);
    rmrf(workDir);
    return;
  }
  ok(`installed local eyeling ${C.dim}(${r.ms} ms)${C.n}`);

  // 5) Run suite test target
  const t0 = Date.now();
  r = run('npm', ['run', 'test:eyeling'], { cwd: suiteDir });
  const totalMs = Date.now() - t0;

  // Cleanup tarball
  rmrf(tgzPath);

  if (r.status === 0) {
    ok(`notation3tests:eyeling passed ${C.dim}(${totalMs} ms)${C.n}`);
    if (process.env.EYELING_KEEP_NOTATION3TESTS === '1') {
      console.log(`${C.dim}Keeping workdir (EYELING_KEEP_NOTATION3TESTS=1):${C.n} ${workDir}`);
    } else {
      rmrf(workDir);
    }
    return;
  }

  fail(`notation3tests:eyeling failed (exit ${r.status}) ${C.dim}(${totalMs} ms)${C.n}`);
  if (process.env.EYELING_KEEP_NOTATION3TESTS === '1') {
    console.log(`${C.dim}Keeping workdir (EYELING_KEEP_NOTATION3TESTS=1):${C.n} ${workDir}`);
  } else {
    rmrf(workDir);
  }
})();
