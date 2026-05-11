#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const TTY = process.stdout.isTTY;
const C = TTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', n: '\x1b[0m' }
  : { g: '', r: '', y: '', dim: '', n: '' };
const msTag = (ms) => `${C.dim}(${ms} ms)${C.n}`;

function ok(msg) {
  console.log(`${C.g}OK${C.n}  ${msg}`);
}
function fail(msg) {
  console.error(`${C.r}FAIL${C.n} ${msg}`);
}
function info(msg) {
  console.log(`${C.y}==${C.n} ${msg}`);
}

function run(cmd, args, opts = {}) {
  return cp.spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
}

function getEyelingVersion(nodePath, eyelingJsPath, cwd) {
  const r = run(nodePath, [eyelingJsPath, '-v'], { cwd });
  const s = (r.stdout || r.stderr || '').trim();
  return s || 'eyeling (unknown version)';
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-see-'));
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {}
}

function showDiff(expectedPath, generatedPath) {
  const d = run('diff', ['-u', expectedPath, generatedPath]);
  if (d.stdout) process.stdout.write(d.stdout);
  if (d.stderr) process.stderr.write(d.stderr);
}

function main() {
  const suiteStart = Date.now();

  // test/see.test.js -> repo root is one level up
  const root = path.resolve(__dirname, '..');
  const seeDir = path.join(root, 'see');
  const examplesDir = path.join(seeDir, 'examples');
  const outputDir = path.join(examplesDir, 'output');
  const eyelingJsPath = path.join(root, 'eyeling.js');
  const nodePath = process.execPath;

  if (!fs.existsSync(examplesDir)) {
    fail(`Cannot find SEE examples directory: ${examplesDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(outputDir)) {
    fail(`Cannot find SEE expected output directory: ${outputDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(examplesDir)
    .filter((file) => file.endsWith('.js') && !file.startsWith('_'))
    .sort((a, b) => a.localeCompare(b));

  info(`Running ${files.length} SEE examples tests`);
  console.log(`${C.dim}${getEyelingVersion(nodePath, eyelingJsPath, root)}; node ${process.version}${C.n}`);

  if (files.length === 0) {
    ok('No SEE example .js files found in see/examples/');
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;
  const idxWidth = String(files.length).length;

  for (let i = 0; i < files.length; i++) {
    const idx = String(i + 1).padStart(idxWidth, '0');
    const file = files[i];
    const name = path.basename(file, '.js');
    const start = Date.now();

    const examplePath = path.join(examplesDir, file);
    const expectedPath = path.join(outputDir, `${name}.md`);
    if (!fs.existsSync(expectedPath)) {
      fail(`${idx} ${file} ${msTag(Date.now() - start)}`);
      fail(`Missing expected output: ${path.relative(root, expectedPath)}`);
      failed++;
      continue;
    }

    const tmpDir = mkTmpDir();
    const generatedPath = path.join(tmpDir, `${name}.md`);
    const outFd = fs.openSync(generatedPath, 'w');
    let r;
    try {
      r = cp.spawnSync(nodePath, [examplePath], {
        cwd: seeDir,
        stdio: ['ignore', outFd, 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
        encoding: 'utf8',
      });
    } finally {
      fs.closeSync(outFd);
    }

    const ms = Date.now() - start;
    const rc = r.status == null ? 1 : r.status;

    let outputOk = false;
    try {
      outputOk = fs.readFileSync(generatedPath, 'utf8') === fs.readFileSync(expectedPath, 'utf8');
    } catch {
      outputOk = false;
    }

    if (rc === 0 && outputOk) {
      ok(`${idx} ${file} ${msTag(ms)}`);
      passed++;
    } else {
      fail(`${idx} ${file} ${msTag(ms)}`);
      if (rc !== 0) fail(`Exit code ${rc}, expected 0`);
      if (r.stderr) process.stderr.write(r.stderr);
      if (!outputOk) {
        fail('Output differs');
        showDiff(expectedPath, generatedPath);
      }
      failed++;
    }

    rmrf(tmpDir);
  }

  console.log('');
  info(`Total elapsed: ${Date.now() - suiteStart} ms`);
  if (failed === 0) {
    ok(`All SEE examples tests passed (${passed}/${files.length})`);
    process.exit(0);
  }
  fail(`Some SEE examples tests failed (${passed}/${files.length})`);
  process.exit(1);
}

main();
