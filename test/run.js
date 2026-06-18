#!/usr/bin/env node
'use strict';

const cp = require('node:child_process');

const { C, formatDuration } = require('./report');

const node = process.execPath;

// Run test files directly instead of through `npm run …`. This keeps the
// output in the compact Eyeling reporter style and avoids npm's script banners
// between the colored OK/FAIL test lines.
const sections = [
  ['Build bundle', node, ['tools/bundle.js']],
  ['Packlist checks', node, ['test/packlist.test.js']],
  ['API tests', node, ['test/api.test.js']],
  ['Streaming RDF Messages tests', node, ['test/stream_messages.test.js']],
  ['Builtin contract tests', node, ['test/builtins.test.js']],
  ['Store tests', node, ['test/store.test.js']],
  ['Examples tests', node, ['test/examples.test.js']],
  ['Proof examples tests', node, ['test/examples.test.js', '--proof-only']],
  ['Manifest tests', node, ['test/manifest.test.js']],
  ['RDF 1.2 syntax tests', node, ['test/rdf12.test.js']],
  ['Playground tests', node, ['test/playground.test.js']],
  ['Package tests', node, ['test/package.test.js']],
];

const aggregate = {
  total: 0,
  ok: 0,
  incomplete: 0,
  nonconform: 0,
  crashed: 0,
};

function sectionLine(kind, label, ms) {
  const suffix = typeof ms === 'number' ? ` (${formatDuration(ms)})` : '';
  console.log(`${C.y}==${C.n} ${kind} ${label}${suffix}`);
}

function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}

function makeSectionSummary() {
  return {
    // Normal Eyeling tests use report.js: "OK 001 ..." / "FAIL 001 ...".
    reportOk: 0,
    reportFail: 0,
    // Older corpus runners used: "1 OK ..." / "1 FAIL ...". Keep
    // parsing that shape so aggregate totals remain robust across local runs.
    numberedOk: 0,
    numberedFail: 0,
    // notation3tests prints a suite-level line with the real manifest count.
    manifestTotal: null,
  };
}

function parseLineForSummary(rawLine, summary) {
  const line = stripAnsi(rawLine).trimEnd();
  if (!line) return;

  if (/^OK\s+\d{3}\s/.test(line)) {
    summary.reportOk++;
    return;
  }
  if (/^FAIL\s+\d{3}\s/.test(line)) {
    summary.reportFail++;
    return;
  }
  if (/^\d+\s+OK\s+/.test(line)) {
    summary.numberedOk++;
    return;
  }
  if (/^\d+\s+FAIL\s+/.test(line)) {
    summary.numberedFail++;
    return;
  }

  const manifest = line.match(
    /^TOTAL\s+\[COUNT:(\d+)\]\s+OK:\s*[^0-9]*(\d+)[^0-9]+INCOMPLETE:\s*[^0-9]*(\d+)[^0-9]+NONCONFORM:\s*[^0-9]*(\d+)[^0-9]+CRASHED:\s*[^0-9]*(\d+)/,
  );
  if (manifest) {
    summary.manifestTotal = {
      count: Number(manifest[1]),
      ok: Number(manifest[2]),
      incomplete: Number(manifest[3]),
      nonconform: Number(manifest[4]),
      crashed: Number(manifest[5]),
    };
  }
}

function makeStreamingParser(summary) {
  let buffer = '';
  return {
    feed(chunk) {
      buffer += String(chunk);
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) parseLineForSummary(line, summary);
    },
    finish() {
      if (buffer) parseLineForSummary(buffer, summary);
      buffer = '';
    },
  };
}

function addSectionToAggregate(summary) {
  if (summary.manifestTotal) {
    aggregate.total += summary.manifestTotal.count;
    aggregate.ok += summary.manifestTotal.ok;
    aggregate.incomplete += summary.manifestTotal.incomplete;
    aggregate.nonconform += summary.manifestTotal.nonconform;
    aggregate.crashed += summary.manifestTotal.crashed;
    return;
  }

  const ok = summary.reportOk + summary.numberedOk;
  const failed = summary.reportFail + summary.numberedFail;
  aggregate.total += ok + failed;
  aggregate.ok += ok;
  aggregate.nonconform += failed;
}

function scoreColor(score) {
  if (aggregate.crashed || aggregate.nonconform) return C.r;
  if (aggregate.incomplete || score < 100) return C.y;
  return C.g;
}

function scoreLine(elapsedMs) {
  const score = aggregate.total === 0 ? 0 : (100 * aggregate.ok) / aggregate.total;
  const scoreC = scoreColor(score);
  return [
    `${C.dim}TOTAL${C.n}`,
    `${C.dim}[COUNT:${aggregate.total}]${C.n}`,
    `${C.g}OK:${C.n} ${C.y}⭐${aggregate.ok}⭐${C.n}`,
    `${C.r}INCOMPLETE:${C.n} ${C.y}⭐${aggregate.incomplete}⭐${C.n}`,
    `${C.r}NONCONFORM:${C.n} ${C.y}⭐${aggregate.nonconform}⭐${C.n}`,
    `${C.r}CRASHED:${C.n} ${C.y}⭐${aggregate.crashed}⭐${C.n}`,
    '=>',
    `${scoreC}SCORE:${C.n} ${C.y}⭐⭐⭐${score.toFixed(1)}⭐⭐⭐${C.n}`,
    `${C.dim}ELAPSED:${C.n} ${C.y}${formatDuration(elapsedMs)}${C.n}`,
  ].join(' ');
}

function childEnv() {
  const env = { ...process.env };
  if (!env.NO_COLOR && C.g && !env.FORCE_COLOR) env.FORCE_COLOR = '1';
  return env;
}

function runSection(label, cmd, args) {
  console.log('');
  sectionLine('Start', label);
  const startedAt = Date.now();
  const summary = makeSectionSummary();
  const stdoutParser = makeStreamingParser(summary);
  const stderrParser = makeStreamingParser(summary);

  return new Promise((resolve) => {
    const child = cp.spawn(cmd, args, {
      cwd: process.cwd(),
      env: childEnv(),
      shell: process.platform === 'win32',
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      stdoutParser.feed(chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrParser.feed(chunk);
      process.stderr.write(chunk);
    });

    child.on('error', (err) => {
      stdoutParser.finish();
      stderrParser.finish();
      addSectionToAggregate(summary);
      aggregate.total++;
      aggregate.crashed++;
      const elapsed = Date.now() - startedAt;
      console.error(`${C.r}FAIL${C.n} ${label}: ${err.message || String(err)}`);
      sectionLine('End', `${label} failed`, elapsed);
      console.log('');
      resolve(1);
    });

    child.on('close', (code, signal) => {
      stdoutParser.finish();
      stderrParser.finish();
      addSectionToAggregate(summary);
      const elapsed = Date.now() - startedAt;
      const status = typeof code === 'number' ? code : 1;
      if (status !== 0 && summary.reportFail + summary.numberedFail === 0 && !summary.manifestTotal) {
        aggregate.total++;
        aggregate.crashed++;
      }
      const suffix = signal ? ` (${signal})` : '';
      sectionLine('End', status === 0 ? `${label} passed` : `${label} failed${suffix}`, elapsed);
      console.log('');
      resolve(status);
    });
  });
}

(async function main() {
  const suiteStartedAt = Date.now();
  let status = 0;
  for (const [label, cmd, args] of sections) {
    const sectionStatus = await runSection(label, cmd, args);
    if (sectionStatus !== 0) {
      status = sectionStatus;
      break;
    }
  }

  console.log('');
  console.log(scoreLine(Date.now() - suiteStartedAt));

  process.exit(status);
})();
