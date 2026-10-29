#!/usr/bin/env node
'use strict';

/**
 * Notation3 conformance against the local mirror of the notation3tests suite.
 *
 * Each test file in test/notation3tests/tests/ runs through the eyeling CLI
 * as the upstream harness runs it (`eyeling -n file`, stdout and stderr
 * together, a 10 s timeout), and its output is scored by the upstream rules:
 * `:test :contains ?t` names the tests, `:result :has ?t` or `:test :is true`
 * passes a success test, and a fail test must conclude neither.
 *
 * The suite is local-only; `npm run sync:test-suites` refreshes the mirror
 * from https://codeberg.org/phochste/notation3tests.
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Iri, Literal } = require('../lib/prelude');
const { parseN3Text } = require('../lib/multisource');
const { C, failResult, info, pass } = require('./report');

const ROOT = path.resolve(__dirname, '..');
const SUITE = path.join(__dirname, 'notation3tests');
const EYELING = path.join(ROOT, 'eyeling.js');
const EX = 'http://example.org/';
const BOOLEAN = 'http://www.w3.org/2001/XMLSchema#boolean';
const TIMEOUT_MS = (parseInt(process.env.TIMEOUT, 10) || 10) * 1000;
// Each run gets a bounded heap, so a runaway test fails alone instead of
// exhausting the machine.
const HEAP_MB = 768;
const JOBS = Math.max(1, Math.min(4, parseInt(process.env.EYELING_TEST_JOBS, 10) || os.cpus().length));

function collectN3Files(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectN3Files(full, out);
    else if (entry.name.endsWith('.n3')) out.push(path.relative(SUITE, full));
  }
  return out;
}

// Upstream skips networking tests only when NETWORKING=0.
function isSkipped(file) {
  return process.env.NETWORKING === '0' && fs.readFileSync(path.join(SUITE, file), 'utf8').includes('@pragma networking');
}

function reasonToFile(file, outPath) {
  return new Promise((resolve) => {
    const fd = fs.openSync(outPath, 'w');
    const child = cp.spawn(process.execPath, [`--max-old-space-size=${HEAP_MB}`, EYELING, '-n', file], {
      cwd: SUITE,
      stdio: ['ignore', fd, fd],
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.on('close', () => {
      clearTimeout(timer);
      fs.closeSync(fd);
      resolve(fs.readFileSync(outPath, 'utf8'));
    });
  });
}

const isIri = (term, name) => term instanceof Iri && term.value === EX + name;

function score(file, output) {
  const isCrash = path.basename(file).startsWith('crash');
  let triples;
  try {
    if (!output.trim()) throw new Error('empty output');
    triples = parseN3Text(output, {}).triples;
  } catch (_) {
    return isCrash ? { ok: 1 } : { crashed: 1 };
  }

  const tests = [
    ...new Set(triples.filter((t) => isIri(t.s, 'test') && isIri(t.p, 'contains')).map((t) => t.o.value)),
  ].sort();
  if (isCrash) return tests.length ? { nonconform: 1 } : { ok: 1 };
  if (!tests.length) return { incomplete: 1 };

  const hasResult = (test) => triples.some((t) => isIri(t.s, 'result') && isIri(t.p, 'has') && t.o.value === test);
  const hasBoolean = (value) =>
    triples.some(
      (t) =>
        isIri(t.s, 'test') &&
        isIri(t.p, 'is') &&
        t.o instanceof Literal &&
        (t.o.value === value || t.o.value === `"${value}"^^<${BOOLEAN}>`),
    );

  const result = {};
  const add = (key) => (result[key] = (result[key] || 0) + 1);
  for (const test of tests) {
    const name = test.replace(/.*[/#]/, '');
    if (name.startsWith('fail')) {
      add(hasResult(test) || hasBoolean('true') || hasBoolean('false') ? 'nonconform' : 'ok');
    } else if (name.startsWith('success')) {
      if (hasResult(test) || hasBoolean('true')) add('ok');
      else add(hasBoolean('false') ? 'nonconform' : 'incomplete');
    } else {
      add('incomplete');
    }
  }
  return result;
}

(async function main() {
  const testsDir = path.join(SUITE, 'tests');
  if (!fs.existsSync(testsDir)) {
    failResult(1, 'No local notation3tests mirror; run npm run sync:test-suites', 0);
    process.exitCode = 1;
    return;
  }

  const files = collectN3Files(testsDir, []).sort().filter((file) => !isSkipped(file));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-notation3tests-'));
  const totals = { count: 0, ok: 0, incomplete: 0, nonconform: 0, crashed: 0 };
  const failures = [];
  const started = Date.now();
  info(`Checking ${files.length} notation3tests files with ${JOBS} worker${JOBS === 1 ? '' : 's'}`);

  let next = 0;
  async function worker(id) {
    const outPath = path.join(outDir, `out-${id}`);
    while (next < files.length) {
      const index = next++;
      const file = files[index];
      const result = score(file, await reasonToFile(file, outPath));
      for (const key of ['ok', 'incomplete', 'nonconform', 'crashed']) {
        totals[key] += result[key] || 0;
        totals.count += result[key] || 0;
      }
      if (result.incomplete || result.nonconform || result.crashed) {
        failures.push(`${file} => ${JSON.stringify(result)}`);
      }
      if ((index + 1) % 100 === 0) console.log(`${C.dim}notation3tests [${index + 1}/${files.length}]${C.n}`);
    }
  }
  await Promise.all(Array.from({ length: JOBS }, (_, id) => worker(id)));
  fs.rmSync(outDir, { recursive: true, force: true });

  const ms = Date.now() - started;
  const percent = totals.count ? ((100 * totals.ok) / totals.count).toFixed(1) : '0.0';
  console.log(
    `TOTAL [COUNT:${totals.count}] OK: ${totals.ok} INCOMPLETE: ${totals.incomplete} ` +
      `NONCONFORM: ${totals.nonconform} CRASHED: ${totals.crashed} => SCORE: ${percent}`,
  );
  if (failures.length) {
    for (const failure of failures.sort()) console.log(`  ${failure}`);
    failResult(1, `notation3tests had unresolved failures (${totals.ok}/${totals.count})`, ms);
    process.exitCode = 1;
    return;
  }
  pass(1, `notation3tests ${totals.ok}/${totals.count}`, ms);
})();
