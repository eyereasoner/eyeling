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
  ['Package tests', 'npm', ['run', 'test:package']],
];

function sectionLine(kind, label, ms) {
  const suffix = typeof ms === 'number' ? ` (${formatDuration(ms)})` : '';
  console.log(`${C.y}==${C.n} ${kind} ${label}${suffix}`);
}

function runSection(label, cmd, args) {
  console.log('');
  sectionLine('Start', label);
  const startedAt = Date.now();
  const r = cp.spawnSync(cmd, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  const elapsed = Date.now() - startedAt;
  if (r.error) {
    console.error(`${C.r}FAIL${C.n} ${label}: ${r.error.message || String(r.error)}`);
    sectionLine('End', `${label} failed`, elapsed);
    console.log('');
    return 1;
  }
  const status = typeof r.status === 'number' ? r.status : 1;
  sectionLine('End', status === 0 ? `${label} passed` : `${label} failed`, elapsed);
  console.log('');
  return status;
}

let status = 0;
for (const [label, cmd, args] of sections) {
  const sectionStatus = runSection(label, cmd, args);
  if (sectionStatus !== 0) {
    status = sectionStatus;
    break;
  }
}

process.exit(status);
