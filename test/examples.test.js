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

function normalizeNewlines(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripTrailingWhitespace(text) {
  return normalizeNewlines(text)
    .split('\n')
    .map((line) => line.replace(/[\t ]+$/g, ''))
    .join('\n');
}

function normalizeTextForCompare(text) {
  return stripTrailingWhitespace(text).trim();
}

function normalizeMarkdownForCompare(text) {
  return normalizeNewlines(text).replace(/^\n+|\n+$/g, '');
}

// Normalize N3 output for comparison.
// Eyeling (and other N3 tools) may emit the same closure with different
// triple ordering. Examples tests should verify content, not presentation.
function normalizeN3ForCompare(n3Text, sourceText = '', expectedPath = '') {
  let value = stripTrailingWhitespace(n3Text);

  // get-uuid.n3 intentionally uses log:skolem and relative IRIs, so its
  // output depends on the checkout path and generated skolem seed. Compare the
  // shape of the generated triples rather than those environment-specific bits.
  if (/\blog:skolem\b/.test(sourceText) || path.basename(expectedPath) === 'get-uuid.n3') {
    value = value
      .replace(/<urn:uuid:[^>]+>/g, '<urn:uuid:__UUID__>')
      .replace(/<file:\/\/[^>\s]*\/examples\/([^/>]+)>/g, '<file://__EXAMPLES__/$1>');
  }

  return value
    .split('\n')
    .filter((l) => l.length > 0)
    .sort((a, b) => a.localeCompare(b))
    .join('\n');
}

function normalizeForCompare(text, expectedPath, sourceText = '') {
  const ext = path.extname(expectedPath);
  const value = text;
  if (ext === '.md') return normalizeMarkdownForCompare(value);
  if (ext === '.txt') return normalizeTextForCompare(value);
  return normalizeN3ForCompare(value, sourceText, expectedPath);
}

function normalizeProofForCompare(text, expectedPath, sourceText) {
  let value = normalizeForCompare(text, expectedPath, sourceText);

  // Some proof goldens intentionally cover volatile builtins such as
  // time:localTime. Keep those examples useful by comparing proof structure
  // while masking only the volatile literal values.
  if (/\btime:localTime\b/.test(sourceText)) {
    value = value
      .replace(/"[^"\n]*"\^\^xsd:dateTime/g, '"__DATETIME__"^^xsd:dateTime')
      .replace(/"PT[0-9]+(?:\.[0-9]+)?S"\^\^xsd:duration/g, '"__DURATION__"^^xsd:duration');
  }

  return value;
}

function compareGeneratedOutput({ expectedPath, generatedPath, sourceText, proof }) {
  const expectedText = fs.readFileSync(expectedPath, 'utf8');
  const generatedText = fs.readFileSync(generatedPath, 'utf8');
  const normalize = proof ? normalizeProofForCompare : normalizeForCompare;
  return normalize(expectedText, expectedPath, sourceText) === normalize(generatedText, expectedPath, sourceText);
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

function resolveExpectedPath(outputDir, inputFile) {
  const stem = path.basename(inputFile, path.extname(inputFile));
  const preference = new Map([
    ['.md', 0],
    ['.txt', 1],
    ['.n3', 2],
  ]);
  const candidates = fs
    .readdirSync(outputDir)
    .filter((name) => path.basename(name, path.extname(name)) === stem)
    .sort((a, b) => {
      const pa = preference.get(path.extname(a)) ?? 99;
      const pb = preference.get(path.extname(b)) ?? 99;
      return pa - pb || a.localeCompare(b);
    });

  if (candidates.length === 0) return null;
  return path.join(outputDir, candidates[0]);
}


function resolveExampleTrigInput(root, inputFile) {
  const stem = path.basename(inputFile, path.extname(inputFile));
  const rel = path.join('input', `${stem}.trig`);
  const abs = path.join(root, 'examples', rel);
  if (!fs.existsSync(abs)) return null;
  return { abs, rel };
}

function resolveExampleBuiltinPath(root, inputFile) {
  const stem = path.basename(inputFile, path.extname(inputFile));
  const rel = path.join('examples', 'builtin', `${stem}.js`);
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return null;
  return { abs, rel };
}

function runExampleToFile({ root, examplesDir, eyelingJsPath, nodePath, file, generatedPath, proof = false }) {
  const builtin = resolveExampleBuiltinPath(root, file);
  const trigInput = resolveExampleTrigInput(root, file);
  const rdfMode = !!trigInput;
  const modeFlag = proof ? '-p' : '-d';
  const outFd = fs.openSync(generatedPath, 'w');

  try {
    if (builtin) {
      const args = [eyelingJsPath, modeFlag];
      if (rdfMode) args.push('-r');
      args.push('--builtin', builtin.rel, path.join('examples', file));
      if (trigInput) args.push(path.join('examples', trigInput.rel));
      return cp.spawnSync(nodePath, args, {
        cwd: root,
        stdio: ['ignore', outFd, 'pipe'], // stdout -> file, stderr captured
        maxBuffer: 200 * 1024 * 1024,
        encoding: 'utf8',
      });
    }

    const args = [eyelingJsPath, modeFlag];
    if (rdfMode) args.push('-r');
    args.push(file);
    if (trigInput) args.push(trigInput.rel);
    return cp.spawnSync(nodePath, args, {
      cwd: examplesDir,
      stdio: ['ignore', outFd, 'pipe'], // stdout -> file, stderr captured
      maxBuffer: 200 * 1024 * 1024,
      encoding: 'utf8',
    });
  } finally {
    fs.closeSync(outFd);
  }
}

function main() {
  const suiteStart = Date.now();

  // test/examples.test.js -> repo root is one level up
  const root = path.resolve(__dirname, '..');
  const examplesDir = path.join(root, 'examples');
  const outputDir = path.join(examplesDir, 'output');
  const proofDir = path.join(examplesDir, 'proof');
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
  const proofFiles = fs.existsSync(proofDir)
    ? fs
        .readdirSync(proofDir)
        .filter((f) => f.endsWith('.n3') && fs.existsSync(path.join(examplesDir, f)))
        .sort((a, b) => a.localeCompare(b))
    : [];
  const totalTests = files.length + proofFiles.length;

  info(`Running ${files.length} examples tests and ${proofFiles.length} proof golden tests`);
  console.log(`${C.dim}${getEyelingVersion(nodePath, eyelingJsPath, root)}; node ${process.version}${C.n}`);

  if (files.length === 0) {
    ok('No .n3 files found in examples/');
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;

  // Pretty, stable numbering (e.g., 001..100 when running 100 tests)
  const idxWidth = String(files.length).length;
  const proofIdxWidth = String(Math.max(proofFiles.length, 1)).length;

  for (let i = 0; i < files.length; i++) {
    const idx = String(i + 1).padStart(idxWidth, '0');
    const file = files[i];

    const start = Date.now();

    const filePath = path.join(examplesDir, file);
    const expectedPath = resolveExpectedPath(outputDir, file);

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
      fail(`Missing expected output for ${path.basename(file, path.extname(file))}.*`);
      failed++;
      continue;
    }

    const tmpDir = mkTmpDir();
    const generatedPath = path.join(tmpDir, 'generated.n3');

    // Run eyeling on this file. If examples/builtin/<stem>.js exists,
    // load it for the matching examples/<stem>.n3 file. Builtin-backed examples
    // run from the repository root so the command shape matches documented usage:
    //   node eyeling.js --builtin examples/builtin/foo.js examples/foo.n3
    // A matching examples/input/<stem>.trig sidecar is external RDF/TriG
    // evidence for this example, so include it and run in -r mode automatically.
    const r = runExampleToFile({ root, examplesDir, eyelingJsPath, nodePath, file, generatedPath });

    const rc = r.status == null ? 1 : r.status;

    const ms = Date.now() - start;

    // Compare output. N3 outputs are order-insensitive; Markdown outputs are order-sensitive.
    let diffOk = false;
    try {
      diffOk = compareGeneratedOutput({ expectedPath, generatedPath, sourceText: n3Text, proof: false });
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


  for (let i = 0; i < proofFiles.length; i++) {
    const idx = String(i + 1).padStart(proofIdxWidth, '0');
    const file = proofFiles[i];
    const start = Date.now();
    const filePath = path.join(examplesDir, file);
    const expectedPath = path.join(proofDir, file);

    let n3Text;
    try {
      n3Text = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      const ms = Date.now() - start;
      fail(`proof ${idx} ${file} ${msTag(ms)}`);
      fail(`Cannot read proof input: ${e.message}`);
      failed++;
      continue;
    }

    const expectedRc = expectedExitCode(n3Text);
    const tmpDir = mkTmpDir();
    const generatedPath = path.join(tmpDir, 'generated.n3');
    const r = runExampleToFile({ root, examplesDir, eyelingJsPath, nodePath, file, generatedPath, proof: true });
    const rc = r.status == null ? 1 : r.status;
    const ms = Date.now() - start;

    let diffOk = false;
    try {
      diffOk = compareGeneratedOutput({ expectedPath, generatedPath, sourceText: n3Text, proof: true });
    } catch {
      diffOk = false;
    }

    const rcOk = rc === expectedRc;

    if (diffOk && rcOk) {
      if (expectedRc === 0) {
        ok(`proof ${idx} ${file} ${msTag(ms)}`);
      } else {
        ok(`proof ${idx} ${file} (expected exit ${expectedRc}) ${msTag(ms)}`);
      }
      passed++;
    } else {
      fail(`proof ${idx} ${file} ${msTag(ms)}`);
      if (!rcOk) {
        fail(`Exit code ${rc}, expected ${expectedRc}`);
      }
      if (!diffOk) {
        fail('Proof output differs');
      }
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
    ok(`All examples tests passed (${passed}/${totalTests})`);
    process.exit(0);
  } else {
    fail(`Some examples tests failed (${passed}/${totalTests})`);
    // keep exit code 2 (matches historical behavior of examples/test)
    process.exit(2);
  }
}

main();
