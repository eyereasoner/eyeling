'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const TTY = process.stdout.isTTY;
const C = TTY ? { g: '[32m', r: '[31m', y: '[33m', dim: '[2m', n: '[0m' } : { g: '', r: '', y: '', dim: '', n: '' };
const msTag = (ms) => `${C.dim}(${ms} ms)${C.n}`;

function ok(msg) {
  console.log(`${C.g}OK ${C.n} ${msg}`);
}
function info(msg) {
  console.log(`${C.y}==${C.n} ${msg}`);
}
function fail(msg) {
  console.error(`${C.r}FAIL${C.n} ${msg}`);
}

const ROOT = path.resolve(__dirname, '..');
const ARCLING_DIR = path.join(ROOT, 'examples', 'arcling');

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listCaseDirs(baseDir) {
  if (!isDirectory(baseDir)) {
    throw new Error(`Arcling directory not found: ${baseDir}`);
  }

  return fs
    .readdirSync(baseDir)
    .map((name) => path.join(baseDir, name))
    .filter(isDirectory)
    .sort();
}

function findModelPath(caseDir, base) {
  const candidates = [path.join(caseDir, `${base}.model.go`), path.join(caseDir, `${base}.model.mjs`)];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`Missing required arcling model artifact for ${base}`);
}

function findCaseFiles(caseDir) {
  const base = path.basename(caseDir);
  const modelPath = findModelPath(caseDir, base);
  const dataPath = path.join(caseDir, `${base}.data.json`);
  const expectedPath = path.join(caseDir, `${base}.expected.json`);

  for (const required of [modelPath, dataPath, expectedPath]) {
    if (!fs.existsSync(required)) {
      throw new Error(`Missing required arcling artifact: ${required}`);
    }
  }

  return { base, modelPath, dataPath, expectedPath };
}

function runModelJson(modelPath, dataPath) {
  const ext = path.extname(modelPath);

  if (ext === '.go') {
    const stdout = execFileSync('go', ['run', modelPath, dataPath, '--json'], {
      cwd: path.dirname(modelPath),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(stdout);
  }

  if (ext === '.mjs') {
    const stdout = execFileSync(process.execPath, [modelPath, dataPath, '--json'], {
      cwd: path.dirname(modelPath),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(stdout);
  }

  throw new Error(`Unsupported arcling model extension: ${modelPath}`);
}

function assertArcTextShape(arcText, label) {
  assert.equal(typeof arcText, 'string', `${label}: arcText must be a string`);
  assert.match(arcText, /=== Answer ===/, `${label}: missing Answer section`);
  assert.match(arcText, /=== Reason Why ===/, `${label}: missing Reason Why section`);
  assert.match(arcText, /=== Check ===/, `${label}: missing Check section`);
}

async function runCase(caseDir) {
  const { base, modelPath, dataPath, expectedPath } = findCaseFiles(caseDir);
  const data = readJson(dataPath);
  const expected = readJson(expectedPath);
  const actual = runModelJson(modelPath, dataPath);

  assert.equal(actual.allChecksPass, true, `${base}: expected allChecksPass === true`);
  assertArcTextShape(actual.arcText, base);
  assert.deepStrictEqual(actual, expected, `${base}: actual result does not match expected JSON`);

  return { base, caseName: data.caseName, modelPath };
}

async function main() {
  const suiteStart = Date.now();
  const caseDirs = listCaseDirs(ARCLING_DIR);

  if (caseDirs.length === 0) {
    throw new Error(`No arcling cases found in ${ARCLING_DIR}`);
  }

  info(`arcling tests: ${caseDirs.length} case(s)`);

  let passed = 0;

  for (let i = 0; i < caseDirs.length; i += 1) {
    const start = Date.now();
    const caseDir = caseDirs[i];
    const n = i + 1;
    const label = path.basename(caseDir);

    try {
      await runCase(caseDir);
      passed += 1;
      ok(`${n}. ${label} ${msTag(Date.now() - start)}`);
    } catch (error) {
      fail(`${n}. ${label} ${msTag(Date.now() - start)}`);
      fail(error.stack || String(error));
      process.exit(2);
    }
  }

  console.log('');
  const suiteMs = Date.now() - suiteStart;
  info(`Total elapsed: ${suiteMs} ms (${(suiteMs / 1000).toFixed(2)} s)`);
  info(`all ${passed} arcling test(s) passed`);
}

main().catch((error) => {
  fail(error.stack || String(error));
  process.exit(2);
});
