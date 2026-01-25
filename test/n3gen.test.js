#!/usr/bin/env node
'use strict';

// Convert examples/input/*.{ttl,trig} -> examples/*.n3 using n3gen.js
// Designed to work both in a git checkout (maintainer mode) and in an npm-installed package.
//
// In git mode:
//   - overwrites examples/<name>.n3
//   - uses `git diff` to validate + show diffs
// In non-git mode:
//   - writes to a temp dir
//   - compares against packaged examples/<name>.n3 without modifying it

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const TTY = process.stdout.isTTY;
const C = TTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', n: '\x1b[0m' }
  : { g: '', r: '', y: '', dim: '', n: '' };

function ok(msg) { console.log(`${C.g}OK ${C.n} ${msg}`); }
function fail(msg) { console.error(`${C.r}FAIL${C.n} ${msg}`); }
function info(msg) { console.log(`${C.y}==${C.n} ${msg}`); }

function run(cmd, args, opts = {}) {
  return cp.spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 200 * 1024 * 1024,
    ...opts,
  });
}

function hasGit() {
  const r = run('git', ['--version']);
  return r.status === 0;
}

function inGitWorktree(cwd) {
  if (!hasGit()) return false;
  const r = run('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
  return r.status === 0 && String(r.stdout).trim() === 'true';
}

function isTracked(cwd, relPathPosix) {
  if (!hasGit()) return false;
  const r = run('git', ['ls-files', '--error-unmatch', relPathPosix], { cwd });
  return r.status === 0;
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-n3-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
}

function showDiff({ IN_GIT, examplesDir, expectedPath, generatedPath, relExpectedPosix }) {
  if (hasGit()) {
    if (IN_GIT) {
      // If tracked: show repo diff; if untracked: show addition via no-index diff against /dev/null.
      if (isTracked(examplesDir, relExpectedPosix)) {
        const d = run('git', ['diff', '--', relExpectedPosix], { cwd: examplesDir });
        if (d.stdout) process.stdout.write(d.stdout);
        if (d.stderr) process.stderr.write(d.stderr);
      } else {
        const d = run('git', ['diff', '--no-index', '--', '/dev/null', expectedPath], { cwd: examplesDir });
        if (d.stdout) process.stdout.write(String(d.stdout).replaceAll(expectedPath, relExpectedPosix));
        if (d.stderr) process.stderr.write(String(d.stderr).replaceAll(expectedPath, relExpectedPosix));
      }
    } else {
      const d = run('git', ['diff', '--no-index', expectedPath, generatedPath], { cwd: examplesDir });
      if (d.stdout) process.stdout.write(String(d.stdout).replaceAll(generatedPath, 'generated'));
      if (d.stderr) process.stderr.write(String(d.stderr).replaceAll(generatedPath, 'generated'));
    }
  } else {
    const d = run('diff', ['-u', expectedPath, generatedPath], { cwd: examplesDir });
    if (d.stdout) process.stdout.write(d.stdout);
    if (d.stderr) process.stderr.write(d.stderr);
  }
}

function main() {
  const suiteStart = Date.now();

  // test/n3gen.test.js -> repo root is one level up
  const root = path.resolve(__dirname, '..');
  const examplesDir = path.join(root, 'examples');
  const inputDir = path.join(examplesDir, 'input');
  const n3GenJsPath = path.join(root, 'tools/n3gen.js');
  const nodePath = process.execPath;

  if (!fs.existsSync(examplesDir)) {
    fail(`Cannot find examples directory: ${examplesDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(inputDir)) {
    fail(`Cannot find examples/input directory: ${inputDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(n3GenJsPath)) {
    fail(`Cannot find n3gen.js: ${n3GenJsPath}`);
    process.exit(1);
  }

  const IN_GIT = inGitWorktree(root);

  const inputs = fs.readdirSync(inputDir)
    .filter(f => /\.(ttl|trig)$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  info(`Running n3 conversions for ${inputs.length} inputs (${IN_GIT ? 'git worktree mode' : 'npm-installed mode'})`);
  console.log(`${C.dim}node ${process.version}${C.n}`);

  if (inputs.length === 0) {
    ok('No .ttl/.trig files found in examples/input/');
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < inputs.length; i++) {
    const idx = String(i + 1).padStart(2, '0');
    const inFile = inputs[i];
    const start = Date.now();

    const inPath = path.join(inputDir, inFile);
    const base = inFile.replace(/\.(ttl|trig)$/i, '');
    const outFile = `${base}.n3`;

    const expectedPath = path.join(examplesDir, outFile);
    const relExpectedPosix = outFile; // relative to examplesDir

    let tmpDir = null;
    let generatedPath = expectedPath;

    if (!IN_GIT) {
      if (!fs.existsSync(expectedPath)) {
        const ms = Date.now() - start;
        fail(`${idx} ${inFile} -> ${outFile} (${ms} ms)`);
        fail(`Missing expected examples/${outFile}`);
        failed++;
        continue;
      }
      tmpDir = mkTmpDir();
      generatedPath = path.join(tmpDir, outFile);
    }

    // Run converter (stdout -> file; stderr captured)
    const outFd = fs.openSync(generatedPath, 'w');
    const r = cp.spawnSync(nodePath, [n3GenJsPath, inPath], {
      cwd: root,
      stdio: ['ignore', outFd, 'pipe'],
      encoding: 'utf8',
      maxBuffer: 200 * 1024 * 1024,
    });
    fs.closeSync(outFd);

    const rc = (r.status == null) ? 1 : r.status;
    const ms = Date.now() - start;

    if (rc !== 0) {
      fail(`${idx} ${inFile} -> ${outFile} (${ms} ms)`);
      fail(`Converter exit code ${rc}`);
      if (r.stderr) process.stderr.write(String(r.stderr));
      failed++;
      if (tmpDir) rmrf(tmpDir);
      continue;
    }

    // Compare output
    let diffOk = false;
    if (IN_GIT) {
      if (isTracked(examplesDir, relExpectedPosix)) {
        const d = run('git', ['diff', '--quiet', '--', relExpectedPosix], { cwd: examplesDir });
        diffOk = (d.status === 0);
      } else {
        // Untracked file counts as a diff (work to do)
        diffOk = false;
      }
    } else {
      if (hasGit()) {
        const d = run('git', ['diff', '--no-index', '--quiet', expectedPath, generatedPath], { cwd: examplesDir });
        diffOk = (d.status === 0);
      } else {
        const d = run('diff', ['-u', expectedPath, generatedPath], { cwd: examplesDir });
        diffOk = (d.status === 0);
      }
    }

    if (diffOk) {
      ok(`${idx} ${inFile} -> ${outFile} (${ms} ms)`);
      passed++;
    } else {
      fail(`${idx} ${inFile} -> ${outFile} (${ms} ms)`);
      fail('Output differs');
      showDiff({ IN_GIT, examplesDir, expectedPath, generatedPath, relExpectedPosix });
      failed++;
    }

    if (tmpDir) rmrf(tmpDir);
  }

  console.log('');
  const suiteMs = Date.now() - suiteStart;
  info(`Total elapsed: ${suiteMs} ms (${(suiteMs / 1000).toFixed(2)} s)`);

  if (failed === 0) {
    ok(`All n3 conversions passed (${passed}/${inputs.length})`);
    process.exit(0);
  } else {
    fail(`Some n3 conversions failed (${passed}/${inputs.length})`);
    process.exit(2);
  }
}

main();
