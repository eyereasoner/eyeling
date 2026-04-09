'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');

const TTY = process.stdout.isTTY;
const C = TTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', n: '\x1b[0m' }
  : { g: '', r: '', y: '', dim: '', n: '' };

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

function findCaseFiles(caseDir) {
  const base = path.basename(caseDir);

  const modelPath = path.join(caseDir, `${base}.model.mjs`);
  const dataPath = path.join(caseDir, `${base}.data.json`);
  const expectedPath = path.join(caseDir, `${base}.expected.json`);

  for (const required of [modelPath, dataPath, expectedPath]) {
    if (!fs.existsSync(required)) {
      throw new Error(`Missing required arcling artifact: ${required}`);
    }
  }

  return { base, modelPath, dataPath, expectedPath };
}

async function loadEvaluate(modelPath) {
  const moduleUrl = pathToFileURL(modelPath).href;
  const mod = await import(moduleUrl);

  if (typeof mod.evaluate !== 'function') {
    throw new Error(`Model does not export evaluate(data): ${modelPath}`);
  }

  return mod.evaluate;
}

function assertArcTextShape(arcText, label) {
  assert.equal(typeof arcText, 'string', `${label}: arcText must be a string`);
  assert.match(arcText, /=== Answer ===/, `${label}: missing Answer section`);
  assert.match(arcText, /=== Reason Why ===/, `${label}: missing Reason Why section`);
  assert.match(arcText, /=== Check ===/, `${label}: missing Check section`);
}

async function runCase(caseDir) {
  const { base, modelPath, dataPath, expectedPath } = findCaseFiles(caseDir);

  const evaluate = await loadEvaluate(modelPath);
  const data = readJson(dataPath);
  const expected = readJson(expectedPath);
  const actual = await evaluate(data);

  assert.equal(actual.allChecksPass, true, `${base}: expected allChecksPass === true`);

  assertArcTextShape(actual.arcText, base);

  assert.deepStrictEqual(actual, expected, `${base}: actual result does not match expected JSON`);

  return base;
}

async function main() {
  const caseDirs = listCaseDirs(ARCLING_DIR);

  if (caseDirs.length === 0) {
    throw new Error(`No arcling cases found in ${ARCLING_DIR}`);
  }

  info(`arcling tests: ${caseDirs.length} case(s)`);

  let passed = 0;

  for (let i = 0; i < caseDirs.length; i += 1) {
    const caseDir = caseDirs[i];
    const n = i + 1;
    const label = path.basename(caseDir);

    try {
      await runCase(caseDir);
      passed += 1;
      ok(`${n}. ${label}`);
    } catch (error) {
      fail(`${n}. ${label}`);
      fail(error.stack || String(error));
      process.exit(2);
    }
  }

  info(`all ${passed} arcling test(s) passed`);
}

main().catch((error) => {
  fail(error.stack || String(error));
  process.exit(2);
});
