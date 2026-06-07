#!/usr/bin/env node
'use strict';

const cp = require('node:child_process');

const USE_COLOR = !process.env.NO_COLOR && (
  process.stdout.isTTY ||
  (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0')
);
const C = USE_COLOR
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', gray: '\x1b[90m', dim: '\x1b[2m', n: '\x1b[0m' }
  : { g: '', r: '', y: '', gray: '', dim: '', n: '' };

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;

  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1).padStart(4, '0');
  return `${minutes}m ${seconds}s`;
}

function durationSuffix(ms) {
  return ms == null ? '' : ` ${C.gray}${formatDuration(ms)}${C.n}`;
}

function ok(msg, ms) {
  console.log(`${C.g}OK${C.n}  ${msg}${durationSuffix(ms)}`);
}

function fail(msg, ms) {
  console.error(`${C.r}FAIL${C.n} ${msg}${durationSuffix(ms)}`);
}

function info(msg, ms) {
  console.log(`${C.y}==${C.n} ${msg}${durationSuffix(ms)}`);
}

function detail(msg) {
  console.log(`${C.dim}${msg}${C.n}`);
}

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

const RDF_TEST_SUITE = process.platform === 'win32' ? 'rdf-test-suite.cmd' : 'rdf-test-suite';
const CACHE_DIR = '.rdf-test-suite-cache/';

const SUITES = {
  turtle: {
    label: 'RDF 1.2 Turtle',
    format: 'turtle',
    manifest: 'https://w3c.github.io/rdf-tests/rdf/rdf12/rdf-turtle/syntax/manifest.ttl',
  },
  ntriples: {
    label: 'RDF 1.2 N-Triples',
    format: 'n-triples',
    manifest: 'https://w3c.github.io/rdf-tests/rdf/rdf12/rdf-n-triples/syntax/manifest.ttl',
  },
  nquads: {
    label: 'RDF 1.2 N-Quads',
    format: 'n-quads',
    manifest: 'https://w3c.github.io/rdf-tests/rdf/rdf12/rdf-n-quads/syntax/manifest.ttl',
  },
  trig: {
    label: 'RDF 1.2 TriG',
    format: 'trig',
    manifest: 'https://w3c.github.io/rdf-tests/rdf/rdf12/rdf-trig/syntax/manifest.ttl',
  },
};

const ALIASES = new Map([
  ['all', Object.keys(SUITES)],
  ['rdf12', Object.keys(SUITES)],
  ['rdf-12-turtle', ['turtle']],
  ['rdf-12-ntriples', ['ntriples']],
  ['rdf-12-n-triples', ['ntriples']],
  ['rdf-12-nquads', ['nquads']],
  ['rdf-12-n-quads', ['nquads']],
  ['rdf-12-trig', ['trig']],
  ['turtle', ['turtle']],
  ['ntriples', ['ntriples']],
  ['n-triples', ['ntriples']],
  ['nquads', ['nquads']],
  ['n-quads', ['nquads']],
  ['trig', ['trig']],
]);

function stripAnsi(text) {
  return String(text).replace(/\x1b\[[0-9;]*m/g, '');
}

function normalizeLine(line) {
  return stripAnsi(line).replace(/\r/g, '').trim();
}

function classifyLine(line) {
  const text = normalizeLine(line);
  if (!text) return null;

  const pass = text.match(/^(?:✔|✓|√)\s*(.*)$/u);
  if (pass) return { kind: 'ok', message: pass[1].trim() || 'passed' };

  const failure = text.match(/^(?:✘|✖|✗|×)\s*(.*)$/u);
  if (failure) return { kind: 'fail', message: failure[1].trim() || 'failed' };

  const tapFail = text.match(/^not ok\b\s*(.*)$/i);
  if (tapFail) return { kind: 'fail', message: tapFail[1].trim() || text };

  const tapOk = text.match(/^ok\b\s*(.*)$/i);
  if (tapOk) return { kind: 'ok', message: tapOk[1].trim() || text };

  return { kind: 'info', message: text };
}

function rdfTestSuiteArgs(suite) {
  return [
    'spec/rdf12-parser.js',
    suite.manifest,
    '-i',
    JSON.stringify({ format: suite.format }),
    '-c',
    CACHE_DIR,
  ];
}

function resolveSuiteKeys(args) {
  if (args.length === 0) return Object.keys(SUITES);

  const keys = [];
  for (const arg of args) {
    const expanded = ALIASES.get(arg);
    if (!expanded) {
      throw new Error(`Unknown RDF 1.2 suite: ${arg}. Use one of: ${Array.from(ALIASES.keys()).sort().join(', ')}`);
    }
    for (const key of expanded) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

function sequenceLabel(n) {
  return String(n).padStart(3, '0');
}

function createLineReader(onLine) {
  let buffer = '';

  return {
    push(chunk) {
      buffer += String(chunk);
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) onLine(line);
    },
    flush() {
      if (buffer) {
        onLine(buffer);
        buffer = '';
      }
    },
  };
}

function printEvent(suiteResult, event, totals) {
  if (event.kind === 'info') {
    detail(`    ${event.message}`);
    return;
  }

  totals.sequence++;
  const now = nowMs();
  const caseElapsedMs = now - suiteResult.lastCaseAt;
  suiteResult.lastCaseAt = now;

  const message = `${sequenceLabel(totals.sequence)} ${suiteResult.suite.label}: ${event.message}`;
  if (event.kind === 'ok') {
    ok(message, caseElapsedMs);
    totals.passed++;
  } else {
    fail(message, caseElapsedMs);
    totals.failed++;
    suiteResult.failedCount++;
  }
}

function runSuite(key, totals) {
  return new Promise((resolve) => {
    const suite = SUITES[key];
    const startedAt = nowMs();
    const suiteResult = {
      key,
      suite,
      status: null,
      error: null,
      startedAt,
      lastCaseAt: startedAt,
      caseCount: 0,
      failedCount: 0,
    };

    info(`${suite.label} syntax suite`);

    let sawCase = false;
    let settled = false;

    function handleLine(line) {
      const event = classifyLine(line);
      if (!event) return;
      if (event.kind === 'ok' || event.kind === 'fail') {
        sawCase = true;
        suiteResult.caseCount++;
      }
      printEvent(suiteResult, event, totals);
    }

    const stdout = createLineReader(handleLine);
    const stderr = createLineReader(handleLine);

    let child;
    try {
      child = cp.spawn(RDF_TEST_SUITE, rdfTestSuiteArgs(suite), {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          FORCE_COLOR: '0',
          NO_COLOR: '1',
        },
      });
    } catch (e) {
      const elapsedMs = nowMs() - startedAt;
      suiteResult.error = e;
      if (!sawCase) {
        totals.sequence++;
        fail(`${sequenceLabel(totals.sequence)} ${suite.label}: rdf-test-suite could not start: ${e.message || String(e)}`, elapsedMs);
        totals.failed++;
        suiteResult.caseCount++;
      }
      console.log(`${C.gray}Suite elapsed ${formatDuration(elapsedMs)}${C.n}`);
      console.log('');
      resolve({ ...suiteResult, status: 1, elapsedMs });
      return;
    }

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));

    child.on('error', (e) => {
      suiteResult.error = e;
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;

      stdout.flush();
      stderr.flush();

      suiteResult.status = code == null ? 1 : code;
      const elapsedMs = nowMs() - startedAt;
      suiteResult.elapsedMs = elapsedMs;

      if (!sawCase) {
        totals.sequence++;
        const startError = suiteResult.error && suiteResult.error.message ? suiteResult.error.message : null;
        const exitText = signal ? `signal ${signal}` : `status ${suiteResult.status}`;
        const message = startError
          ? `${suite.label}: rdf-test-suite could not start: ${startError}`
          : `${suite.label}: rdf-test-suite exited with ${suiteResult.status === 0 ? 'success' : exitText}`;

        if (suiteResult.status === 0) {
          ok(`${sequenceLabel(totals.sequence)} ${message}`, elapsedMs);
          totals.passed++;
        } else {
          fail(`${sequenceLabel(totals.sequence)} ${message}`, elapsedMs);
          totals.failed++;
        }
        suiteResult.caseCount++;
      } else if (suiteResult.status !== 0 && suiteResult.failedCount === 0) {
        totals.sequence++;
        fail(`${sequenceLabel(totals.sequence)} ${suite.label}: rdf-test-suite exited with status ${suiteResult.status}`, elapsedMs);
        totals.failed++;
        suiteResult.caseCount++;
      }

      console.log(`${C.gray}Suite elapsed ${formatDuration(elapsedMs)}${C.n}`);
      console.log('');
      resolve(suiteResult);
    });
  });
}

async function main() {
  let keys;
  try {
    keys = resolveSuiteKeys(process.argv.slice(2));
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
    process.exit(1);
    return;
  }

  const grandStartedAt = nowMs();
  const totals = {
    sequence: 0,
    passed: 0,
    failed: 0,
  };

  info(`Running ${keys.length} RDF 1.2 syntax suite${keys.length === 1 ? '' : 's'}`);
  const results = [];
  for (const key of keys) {
    // Run suites sequentially so the live output stays readable and sequence numbers remain stable.
    results.push(await runSuite(key, totals));
  }

  const grandElapsedMs = nowMs() - grandStartedAt;
  info(`Grand total: ${totals.passed} OK, ${totals.failed} FAIL, ${totals.sequence} RDF 1.2 tests`, grandElapsedMs);

  if (totals.failed === 0 && results.every((suiteResult) => suiteResult.status === 0)) {
    ok(`All RDF 1.2 syntax tests passed (${totals.passed}/${totals.sequence})`);
    process.exit(0);
    return;
  }

  fail(`Some RDF 1.2 syntax tests failed (${totals.passed}/${totals.sequence})`);
  process.exit(1);
}

main().catch((e) => {
  fail(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
