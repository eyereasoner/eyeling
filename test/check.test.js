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
    maxBuffer: 200 * 1024 * 1024,
    ...opts,
  });
}

function normalizeForCompare(n3Text) {
  return String(n3Text)
    .split(/\r?\n/)
    .map((l) => l.replace(/[\t ]+$/g, ''))
    .filter((l) => l.length > 0)
    .sort((a, b) => a.localeCompare(b))
    .join('\n');
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-check-'));
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

  const root = path.resolve(__dirname, '..');
  const inputDir = path.join(root, 'examples', 'check', 'input');
  const generatedDir = path.join(root, 'examples', 'check', 'output');
  const expectedDir = path.join(root, 'examples', 'output');
  const compiler = process.env.CC || 'cc';

  if (!fs.existsSync(inputDir)) {
    ok(`No check inputs directory found: ${inputDir}`);
    process.exit(0);
  }

  fs.mkdirSync(generatedDir, { recursive: true });

  const files = fs
    .readdirSync(inputDir)
    .filter((f) => f.endsWith('.c'))
    .sort((a, b) => a.localeCompare(b));

  info(`Running ${files.length} C check tests`);
  console.log(`${C.dim}compiler ${compiler}; node ${process.version}${C.n}`);

  if (files.length === 0) {
    ok('No .c files found in examples/check/input/');
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;
  const idxWidth = String(files.length).length;

  for (let i = 0; i < files.length; i++) {
    const idx = String(i + 1).padStart(idxWidth, '0');
    const file = files[i];
    const start = Date.now();

    const sourcePath = path.join(inputDir, file);
    const stem = path.basename(file, '.c');
    const expectedPath = path.join(expectedDir, `${stem}.n3`);
    const generatedPath = path.join(generatedDir, `${stem}.n3`);
    const tmpDir = mkTmpDir();
    const executablePath = path.join(tmpDir, stem + (process.platform === 'win32' ? '.exe' : ''));

    try {
      if (!fs.existsSync(expectedPath)) {
        throw new Error(`Missing expected output: ${path.relative(root, expectedPath)}`);
      }

      const compile = run(compiler, [
        '-std=c11',
        '-Wall',
        '-Wextra',
        '-pedantic',
        sourcePath,
        '-lm',
        '-o',
        executablePath,
      ]);

      if (compile.error) {
        throw new Error(`Cannot run compiler '${compiler}': ${compile.error.message}`);
      }
      if (compile.status !== 0) {
        throw new Error(`Compilation failed\n${compile.stderr || compile.stdout || ''}`.trim());
      }

      const execResult = run(executablePath, [], { cwd: root });
      if (execResult.error) {
        throw new Error(`Cannot run executable: ${execResult.error.message}`);
      }

      fs.writeFileSync(generatedPath, execResult.stdout || '', 'utf8');

      if (execResult.status !== 0) {
        throw new Error(`Executable exited with ${execResult.status}\n${execResult.stderr || ''}`.trim());
      }

      const expectedText = fs.readFileSync(expectedPath, 'utf8');
      const generatedText = fs.readFileSync(generatedPath, 'utf8');
      const same = normalizeForCompare(expectedText) === normalizeForCompare(generatedText);
      const ms = Date.now() - start;

      if (same) {
        ok(`${idx} ${file} ${msTag(ms)}`);
        passed++;
      } else {
        fail(`${idx} ${file} ${msTag(ms)}`);
        fail('Output differs');
        showDiff(expectedPath, generatedPath);
        failed++;
      }
    } catch (err) {
      const ms = Date.now() - start;
      fail(`${idx} ${file} ${msTag(ms)}`);
      fail(err.message);
      failed++;
    } finally {
      rmrf(tmpDir);
    }
  }

  console.log('');
  const suiteMs = Date.now() - suiteStart;
  info(`Total elapsed: ${suiteMs} ms (${(suiteMs / 1000).toFixed(2)} s)`);

  if (failed === 0) {
    ok(`All C check tests passed (${passed}/${files.length})`);
    process.exit(0);
  }

  fail(`Some C check tests failed (${passed}/${files.length})`);
  process.exit(2);
}

main();
