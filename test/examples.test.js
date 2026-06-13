#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const { C, detail, failResult, info, pass } = require('./report');

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

function resolveExampleRdfSurfaceInput(root, inputFile) {
  const stem = path.basename(inputFile, path.extname(inputFile));
  const rel = path.join('input', `${stem}.ttl`);
  const abs = path.join(root, 'examples', rel);
  if (!fs.existsSync(abs)) return null;
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.includes('%not[')) return null;
  return { abs, rel };
}


function exampleOptionFlags(sourceText) {
  const m = String(sourceText || '').match(/^[ \t]*#\s*eyeling-options:\s*(.*?)\s*$/m);
  if (!m) return [];
  return m[1].trim().split(/\s+/).filter(Boolean);
}

function addUniqueFlag(args, flag) {
  if (!args.includes(flag)) args.push(flag);
}

function resolveExampleBuiltinPath(root, inputFile) {
  const stem = path.basename(inputFile, path.extname(inputFile));
  const rel = path.join('examples', 'builtin', `${stem}.js`);
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return null;
  return { abs, rel };
}

function runExampleToFile({ root, examplesDir, eyelingJsPath, nodePath, file, generatedPath, proof = false, sourceText = '' }) {
  const builtin = resolveExampleBuiltinPath(root, file);
  const trigInput = resolveExampleTrigInput(root, file);
  const rdfSurfaceInput = resolveExampleRdfSurfaceInput(root, file);
  const optionFlags = exampleOptionFlags(sourceText);
  const rdfSurfacesMode = !!rdfSurfaceInput || optionFlags.includes('--rdf-surfaces');
  const rdfMode = !!trigInput || rdfSurfacesMode || optionFlags.includes('--rdf') || optionFlags.includes('-r');
  const modeFlag = proof ? '-p' : '-d';
  const outFd = fs.openSync(generatedPath, 'w');

  try {
    if (builtin) {
      const args = [eyelingJsPath, modeFlag];
      if (rdfMode) args.push('-r');
      for (const flag of optionFlags) addUniqueFlag(args, flag);
      if (rdfSurfacesMode) addUniqueFlag(args, '--rdf-surfaces');
      args.push('--builtin');
      args.push(builtin.rel);
      if (rdfSurfaceInput) args.push(path.join('examples', rdfSurfaceInput.rel));
      args.push(path.join('examples', file));
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
    for (const flag of optionFlags) addUniqueFlag(args, flag);
    if (rdfSurfacesMode) addUniqueFlag(args, '--rdf-surfaces');
    if (rdfSurfaceInput) args.push(rdfSurfaceInput.rel);
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
  const proofOnly = process.argv.includes('--proof-only');


  // test/examples.test.js -> repo root is one level up
  const root = path.resolve(__dirname, '..');
  const examplesDir = path.join(root, 'examples');
  const outputDir = path.join(examplesDir, 'output');
  const proofDir = path.join(examplesDir, 'proof');
  const eyelingJsPath = path.join(root, 'eyeling.js');
  const nodePath = process.execPath;

  if (!fs.existsSync(examplesDir)) {
    failResult(1, `Cannot find examples directory: ${examplesDir}`, 0);
    process.exit(1);
  }
  if (!fs.existsSync(eyelingJsPath)) {
    failResult(1, `Cannot find eyeling.js: ${eyelingJsPath}`, 0);
    process.exit(1);
  }

  const files = proofOnly
    ? []
    : fs
        .readdirSync(examplesDir)
        .filter((f) => f.endsWith('.n3'))
        .sort((a, b) => a.localeCompare(b));
  const proofFiles = proofOnly && fs.existsSync(proofDir)
    ? fs
        .readdirSync(proofDir)
        .filter((f) => f.endsWith('.n3') && fs.existsSync(path.join(examplesDir, f)))
        .sort((a, b) => a.localeCompare(b))
    : [];
  const totalTests = files.length + proofFiles.length;

  info(proofOnly
    ? `Running ${proofFiles.length} proof golden tests`
    : `Running ${files.length} examples tests`);
  console.log(`${C.dim}${getEyelingVersion(nodePath, eyelingJsPath, root)}; node ${process.version}${C.n}`);

  if (totalTests === 0) {
    info(proofOnly ? 'No proof goldens found in examples/proof/' : 'No .n3 files found in examples/');
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;

  let sequence = 0;

  for (let i = 0; i < files.length; i++) {
    const testNr = ++sequence;
    const file = files[i];
    const testName = file;

    const start = Date.now();

    const filePath = path.join(examplesDir, file);
    const expectedPath = resolveExpectedPath(outputDir, file);

    let n3Text;
    try {
      n3Text = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      const ms = Date.now() - start;
      failResult(testNr, testName, ms);
      detail(`Cannot read input: ${e.message}`);
      failed++;
      continue;
    }

    const expectedRc = expectedExitCode(n3Text);

    // Always write generated output to a temp file. This avoids mutating tracked
    // examples/output/* during normal test runs and makes timing behavior more
    // comparable across environments.
    if (!fs.existsSync(expectedPath)) {
      const ms = Date.now() - start;
      failResult(testNr, testName, ms);
      detail(`Missing expected output for ${path.basename(file, path.extname(file))}.*`);
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
    const r = runExampleToFile({ root, examplesDir, eyelingJsPath, nodePath, file, generatedPath, sourceText: n3Text });

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
        pass(testNr, testName, ms);
      } else {
        pass(testNr, `${testName} (expected exit ${expectedRc})`, ms);
      }
      passed++;
    } else {
      failResult(testNr, testName, ms);
      if (!rcOk) {
        detail(`Exit code ${rc}, expected ${expectedRc}`);
      }
      if (!diffOk) {
        detail('Output differs');
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
    const testNr = ++sequence;
    const file = proofFiles[i];
    const testName = proofOnly ? file : `proof ${file}`;
    const start = Date.now();
    const filePath = path.join(examplesDir, file);
    const expectedPath = path.join(proofDir, file);

    let n3Text;
    try {
      n3Text = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      const ms = Date.now() - start;
      failResult(testNr, testName, ms);
      detail(`Cannot read proof input: ${e.message}`);
      failed++;
      continue;
    }

    const expectedRc = expectedExitCode(n3Text);
    const tmpDir = mkTmpDir();
    const generatedPath = path.join(tmpDir, 'generated.n3');
    const r = runExampleToFile({ root, examplesDir, eyelingJsPath, nodePath, file, generatedPath, proof: true, sourceText: n3Text });
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
        pass(testNr, testName, ms);
      } else {
        pass(testNr, `${testName} (expected exit ${expectedRc})`, ms);
      }
      passed++;
    } else {
      failResult(testNr, testName, ms);
      if (!rcOk) {
        detail(`Exit code ${rc}, expected ${expectedRc}`);
      }
      if (!diffOk) {
        detail('Proof output differs');
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
    info(proofOnly
      ? `All proof golden tests passed (${passed}/${totalTests})`
      : `All examples tests passed (${passed}/${totalTests})`);
    process.exit(0);
  } else {
    info(proofOnly
      ? `Some proof golden tests failed (${passed}/${totalTests})`
      : `Some examples tests failed (${passed}/${totalTests})`);
    // keep exit code 2 (matches historical behavior of examples/test)
    process.exit(2);
  }
}

main();
