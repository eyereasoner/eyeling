#!/usr/bin/env node
'use strict';

// Convert examples/input/*.{ttl,trig} -> examples/*.n3 using n3gen.js
//
// For reproducibility and to avoid mutating tracked files during tests, generated output
// is always written to a temporary file and compared against examples/<name>.n3.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const TTY = process.stdout.isTTY;
const C = TTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', n: '\x1b[0m' }
  : { g: '', r: '', y: '', dim: '', n: '' };

function ok(msg) {
  console.log(`${C.g}OK ${C.n} ${msg}`);
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
    maxBuffer: 200 * 1024 * 1024,
    ...opts,
  });
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-n3-'));
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {}
}

function showDiff({ examplesDir, expectedPath, generatedPath }) {
  const d = run('diff', ['-u', expectedPath, generatedPath], { cwd: examplesDir });
  if (d.stdout) process.stdout.write(d.stdout);
  if (d.stderr) process.stderr.write(d.stderr);
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

  const inputs = fs
    .readdirSync(inputDir)
    .filter((f) => /\.(ttl|trig)$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  info(`Running n3 conversions for ${inputs.length} inputs`);
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

    if (!fs.existsSync(expectedPath)) {
      const ms = Date.now() - start;
      fail(`${idx} ${inFile} -> ${outFile} (${ms} ms)`);
      fail(`Missing expected examples/${outFile}`);
      failed++;
      continue;
    }

    const tmpDir = mkTmpDir();
    const generatedPath = path.join(tmpDir, outFile);

    // Run converter (stdout -> file; stderr captured)
    const outFd = fs.openSync(generatedPath, 'w');
    const r = cp.spawnSync(nodePath, [n3GenJsPath, inPath], {
      cwd: root,
      stdio: ['ignore', outFd, 'pipe'],
      encoding: 'utf8',
      maxBuffer: 200 * 1024 * 1024,
    });
    fs.closeSync(outFd);

    const rc = r.status == null ? 1 : r.status;
    const ms = Date.now() - start;

    if (rc !== 0) {
      fail(`${idx} ${inFile} -> ${outFile} (${ms} ms)`);
      fail(`Converter exit code ${rc}`);
      if (r.stderr) process.stderr.write(String(r.stderr));
      failed++;
      rmrf(tmpDir);
      continue;
    }

    // Compare output (always compare expected vs generated temp file)
    const d = run('diff', ['-u', expectedPath, generatedPath], { cwd: examplesDir });
    const diffOk = d.status === 0;

    if (diffOk) {
      ok(`${idx} ${inFile} -> ${outFile} (${ms} ms)`);
      passed++;
    } else {
      fail(`${idx} ${inFile} -> ${outFile} (${ms} ms)`);
      fail('Output differs');
      showDiff({ examplesDir, expectedPath, generatedPath });
      failed++;
    }

    rmrf(tmpDir);
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
