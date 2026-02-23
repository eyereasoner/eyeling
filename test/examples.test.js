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

// Normalize output for comparison.
// Eyeling (and other N3 tools) may emit the same closure with different
// triple ordering. Examples tests should verify content, not presentation.
function normalizeForCompare(n3Text) {
  return String(n3Text)
    .split(/\r?\n/)
    .map((l) => l.replace(/[\t ]+$/g, '')) // trim trailing whitespace
    .filter((l) => l.length > 0)
    .sort((a, b) => a.localeCompare(b))
    .join('\n');
}

// Expectation logic (robust, long-term):
// 1) If file contains:  # expect-exit: N  -> use N
// 2) Else -> expect exit 0
//
// Rationale: Some examples include inference fuses ("=> false") as *guards*.
// Those guards should not imply an expected non-zero exit unless they actually
// fire. Tests that want a non-zero exit should declare it explicitly.
function expectedExitCode(n3Text) {
  const m = n3Text.match(/^[ \t]*#[: ]*expect-exit:[ \t]*([0-9]+)\b/m);
  if (m) return parseInt(m[1], 10);
  return 0;
}

function getEyelingVersion(nodePath, eyelingJsPath, cwd) {
  const r = run(nodePath, [eyelingJsPath, '-v'], { cwd });
  const s = (r.stdout || r.stderr || '').trim();
  return s || 'eyeling (unknown version)';
}

function mkTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-examples-'));
  return dir;
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

  // test/examples.test.js -> repo root is one level up
  const root = path.resolve(__dirname, '..');
  const examplesDir = path.join(root, 'examples');
  const outputDir = path.join(examplesDir, 'output');
  const eyelingJsPath = path.join(root, 'eyeling.js');
  const nodePath = process.execPath;

  if (!fs.existsSync(examplesDir)) {
    fail(`Cannot find examples directory: ${examplesDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(eyelingJsPath)) {
    fail(`Cannot find eyeling.js: ${eyelingJsPath}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(examplesDir)
    .filter((f) => f.endsWith('.n3'))
    .sort((a, b) => a.localeCompare(b));

  info(`Running ${files.length} examples tests`);
  console.log(`${C.dim}${getEyelingVersion(nodePath, eyelingJsPath, root)}; node ${process.version}${C.n}`);

  if (files.length === 0) {
    ok('No .n3 files found in examples/');
    process.exit(0);
  }


  let passed = 0;
  let failed = 0;

  // Pretty, stable numbering (e.g., 001..100 when running 100 tests)
  const idxWidth = String(files.length).length;

  for (let i = 0; i < files.length; i++) {
    const idx = String(i + 1).padStart(idxWidth, '0');
    const file = files[i];

    const start = Date.now();

    const filePath = path.join(examplesDir, file);
    const expectedPath = path.join(outputDir, file);

    let n3Text;
    try {
      n3Text = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      const ms = Date.now() - start;
      fail(`${idx} ${file} ${msTag(ms)}`);
      fail(`Cannot read input: ${e.message}`);
      failed++;
      continue;
    }

    const expectedRc = expectedExitCode(n3Text);

    // Always write generated output to a temp file. This avoids mutating tracked
    // examples/output/* during normal test runs and makes timing behavior more
    // comparable across environments.
    if (!fs.existsSync(expectedPath)) {
      const ms = Date.now() - start;
      fail(`${idx} ${file} ${msTag(ms)}`);
      fail(`Missing expected output/${file}`);
      failed++;
      continue;
    }

    let tmpDir = mkTmpDir();
    let generatedPath = path.join(tmpDir, 'generated.n3');

    // Run eyeling on this file (cwd examplesDir so relative behavior matches old script)
    const outFd = fs.openSync(generatedPath, 'w');

    const r = cp.spawnSync(nodePath, [eyelingJsPath, '-d', file], {
      cwd: examplesDir,
      stdio: ['ignore', outFd, 'pipe'], // stdout -> file, stderr captured
      maxBuffer: 200 * 1024 * 1024,
      encoding: 'utf8',
    });

    fs.closeSync(outFd);

    const rc = r.status == null ? 1 : r.status;

    const ms = Date.now() - start;

    // Compare output (order-insensitive)
    let diffOk = false;
    try {
      const expectedText = fs.readFileSync(expectedPath, 'utf8');
      const generatedText = fs.readFileSync(generatedPath, 'utf8');
      if (expectedText == null) throw new Error('missing expected output');
      diffOk = normalizeForCompare(expectedText) === normalizeForCompare(generatedText);
    } catch {
      diffOk = false;
    }

    const rcOk = rc === expectedRc;

    if (diffOk && rcOk) {
      if (expectedRc === 0) {
        ok(`${idx} ${file} ${msTag(ms)}`);
      } else {
        ok(`${idx} ${file} (expected exit ${expectedRc}) ${msTag(ms)}`);
      }
      passed++;
    } else {
      fail(`${idx} ${file} ${msTag(ms)}`);
      if (!rcOk) {
        fail(`Exit code ${rc}, expected ${expectedRc}`);
      }
      if (!diffOk) {
        fail('Output differs');
      }

      // Show diffs, because this is a test runner
      showDiff({
        examplesDir,
        expectedPath,
        generatedPath,
      });

      failed++;
    }

    if (tmpDir) rmrf(tmpDir);
  }

  console.log('');
  const suiteMs = Date.now() - suiteStart;
  info(`Total elapsed: ${suiteMs} ms (${(suiteMs / 1000).toFixed(2)} s)`);

  if (failed === 0) {
    ok(`All examples tests passed (${passed}/${files.length})`);
    process.exit(0);
  } else {
    fail(`Some examples tests failed (${passed}/${files.length})`);
    // keep exit code 2 (matches historical behavior of examples/test)
    process.exit(2);
  }
}

main();
