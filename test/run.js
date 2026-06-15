#!/usr/bin/env node
'use strict';

const cp = require('node:child_process');

const { C, formatDuration } = require('./report');

const sections = [
  ['Build bundle', 'npm', ['run', 'build']],
  ['Packlist checks', 'npm', ['run', 'test:packlist']],
  ['API tests', 'npm', ['run', 'test:api']],
  ['Streaming RDF Messages tests', 'npm', ['run', 'test:stream-messages']],
  ['Builtin contract tests', 'npm', ['run', 'test:builtins']],
  ['Store tests', 'npm', ['run', 'test:store']],
  ['Examples tests', 'npm', ['run', 'test:examples']],
  ['Proof examples tests', 'npm', ['run', 'test:examples:proof']],
  ['Manifest tests', 'npm', ['run', 'test:manifest']],
  ['RDF 1.2 syntax tests', 'npm', ['run', 'test:rdf12']],
  ['Playground tests', 'npm', ['run', 'test:playground']],
  ['Eyelang second-engine tests', 'npm', ['run', 'test:eyelang']],
  ['Package tests', 'npm', ['run', 'test:package']],
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
    // The eyelang corpus runner uses: "1 OK ..." / "1 FAIL ...".
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

function scoreLine() {
  const score = aggregate.total === 0 ? 0 : (100 * aggregate.ok) / aggregate.total;
  return `TOTAL [COUNT:${aggregate.total}] OK: ⭐${aggregate.ok}⭐ INCOMPLETE: ⭐${aggregate.incomplete}⭐ NONCONFORM: ⭐${aggregate.nonconform}⭐ CRASHED: ⭐${aggregate.crashed}⭐ => SCORE: ⭐⭐⭐${score.toFixed(1)}⭐⭐⭐`;
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
      env: process.env,
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
  let status = 0;
  for (const [label, cmd, args] of sections) {
    const sectionStatus = await runSection(label, cmd, args);
    if (sectionStatus !== 0) {
      status = sectionStatus;
      break;
    }
  }

  console.log('');
  console.log(scoreLine());

  process.exit(status);
})();
