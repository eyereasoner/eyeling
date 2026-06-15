'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const { pathToFileURL } = require('node:url');

const eyeling = require('..');
const { detail, failResult, info, pass } = require('./report');

const startedAt = Date.now();
const program = `
materialize(out, 1).
in(done).
out(X) :- in(X).
`;

(async () => {
  info('Checking eyelang second-engine integration…');

  const syncOutput = eyeling.reason({ engine: 'eyelang' }, program);
  assert.match(syncOutput, /out\(done\)\./);

  const asyncOutput = await eyeling.reasonEyelang(program);
  assert.match(asyncOutput, /out\(done\)\./);

  const asyncRun = await eyeling.runAsync(program, { engine: 'eyelang' });
  assert.match(asyncRun.stdout, /out\(done\)\./);

  const subpath = await import('eyeling/eyelang');
  assert.equal(typeof subpath.run, 'function');
  assert.match(subpath.run(program).stdout, /out\(done\)\./);

  const cli = cp.spawnSync(process.execPath, ['bin/eyeling.cjs', '--engine', 'eyelang', 'examples/eyelang/ancestor.pl'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
  });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.match(cli.stdout, /ancestor\(pat, emma\)\./);

  const directCli = cp.spawnSync(process.execPath, ['lib/eyelang/bin.js', 'examples/eyelang/ancestor.pl'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
  });
  assert.equal(directCli.status, 0, directCli.stderr || directCli.stdout);
  assert.match(directCli.stdout, /ancestor\(jan, emma\)\./);

  // Sanity check the ESM file URL too; this catches nested package type regressions.
  const esm = await import(pathToFileURL(`${process.cwd()}/lib/eyelang/index.js`).href);
  assert.equal(typeof esm.Program, 'function');

  pass(1, 'eyelang second-engine integration passed', Date.now() - startedAt);
})().catch((e) => {
  failResult(1, 'eyelang second-engine integration failed', Date.now() - startedAt);
  detail(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
