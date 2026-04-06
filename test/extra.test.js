#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
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

function main() {
  const suiteStart = Date.now();
  const root = path.resolve(__dirname, '..');
  const extraDir = path.join(root, 'examples', 'extra');
  const outputDir = path.join(extraDir, 'output');
  const nodePath = process.execPath;

  if (!fs.existsSync(extraDir)) {
    fail(`Cannot find examples/extra directory: ${extraDir}`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const files = fs
    .readdirSync(extraDir)
    .filter((f) => f.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b));

  info(`Running ${files.length} extra examples`);
  console.log(`${C.dim}node ${process.version}${C.n}`);

  if (files.length === 0) {
    ok('No .js files found in examples/extra/');
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;
  const idxWidth = String(files.length).length;

  for (let i = 0; i < files.length; i += 1) {
    const idx = String(i + 1).padStart(idxWidth, '0');
    const file = files[i];
    const start = Date.now();

    const inputPath = path.join(extraDir, file);
    const outputPath = path.join(outputDir, file.replace(/\.js$/i, '.txt'));

    const r = cp.spawnSync(nodePath, [inputPath], {
      cwd: extraDir,
      encoding: 'utf8',
      maxBuffer: 200 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout = r.stdout || '';
    fs.writeFileSync(outputPath, stdout, 'utf8');

    const rc = r.status == null ? 1 : r.status;
    const ms = Date.now() - start;

    if (rc === 0) {
      ok(`${idx} ${file} -> output/${path.basename(outputPath)} ${msTag(ms)}`);
      passed += 1;
    } else {
      fail(`${idx} ${file} ${msTag(ms)}`);
      fail(`Exit code ${rc}`);
      if (r.stderr) process.stderr.write(r.stderr);
      failed += 1;
    }
  }

  console.log('');
  const suiteMs = Date.now() - suiteStart;
  info(`Total elapsed: ${suiteMs} ms (${(suiteMs / 1000).toFixed(2)} s)`);

  if (failed === 0) {
    ok(`All extra examples passed (${passed}/${files.length})`);
    process.exit(0);
  }

  fail(`Some extra examples failed (${passed}/${files.length})`);
  process.exit(2);
}

main();
