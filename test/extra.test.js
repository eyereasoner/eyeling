#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const { C, detail, failResult, info, pass } = require('./report');

function main() {
  const suiteStart = Date.now();
  const root = path.resolve(__dirname, '..');
  const extraDir = path.join(root, 'examples', 'extra');
  const outputDir = path.join(extraDir, 'output');
  const nodePath = process.execPath;

  if (!fs.existsSync(extraDir)) {
    failResult(1, `Cannot find examples/extra directory: ${extraDir}`, 0);
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
    info('No .js files found in examples/extra/');
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;
  for (let i = 0; i < files.length; i += 1) {
    const testNr = i + 1;
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
      pass(testNr, `${file} -> output/${path.basename(outputPath)}`, ms);
      passed += 1;
    } else {
      failResult(testNr, file, ms);
      detail(`Exit code ${rc}`);
      if (r.stderr) process.stderr.write(r.stderr);
      failed += 1;
    }
  }

  console.log('');
  const suiteMs = Date.now() - suiteStart;
  info(`Total elapsed: ${suiteMs} ms (${(suiteMs / 1000).toFixed(2)} s)`);

  if (failed === 0) {
    info(`All extra examples passed (${passed}/${files.length})`);
    process.exit(0);
  }

  info(`Some extra examples failed (${passed}/${files.length})`);
  process.exit(2);
}

main();
