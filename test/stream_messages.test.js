'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const eyelingJsPath = path.join(root, 'eyeling.js');

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

function numberedName(index, name) {
  return `${String(index + 1).padStart(3, '0')} ${name}`;
}

function msNow() {
  return Date.now();
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-stream-messages-'));
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {}
}

function runEyeling(args, opts = {}) {
  return cp.spawnSync(process.execPath, [eyelingJsPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: opts.maxBuffer || 20 * 1024 * 1024,
  });
}

function expectEyelingOk(args, opts = {}) {
  const r = runEyeling(args, opts);
  if (r.status === 0) return r.stdout;

  throw new Error(
    `eyeling failed with exit ${r.status}\n` +
      `STDOUT:\n${r.stdout || ''}\n` +
      `STDERR:\n${r.stderr || ''}`,
  );
}

function writeScopedPayloadRules(file) {
  fs.writeFileSync(
    file,
    `@prefix : <urn:test#>.\n` +
      `@prefix eymsg: <https://eyereasoner.github.io/eyeling/vocab/message#>.\n` +
      `@prefix log: <http://www.w3.org/2000/10/swap/log#>.\n` +
      `{\n` +
      `  ?Envelope eymsg:payloadGraph ?Payload.\n` +
      `  ?Payload log:nameOf ?PayloadContext.\n` +
      `  ?PayloadContext log:includes { ?Subject :line ?Line. }.\n` +
      `} => {\n` +
      `  ?Envelope log:outputString ?Line.\n` +
      `}.\n`,
    'utf8',
  );
}

function writeBasicMessageLog(file) {
  fs.writeFileSync(
    file,
    `VERSION "1.2-messages"\n` +
      `PREFIX : <urn:test#>\n` +
      `\n` +
      `:a :line "one\\n".\n` +
      `MESSAGE\n` +
      `\n` +
      `:b :line "two\\n".\n` +
      `MESSAGE\n` +
      `# empty heartbeat\n` +
      `MESSAGE\n` +
      `:c :line "three\\n".\n`,
    'utf8',
  );
}

function writeLargeMessageLog(file, count) {
  let text = 'VERSION "1.2-messages"\nPREFIX : <urn:test#>\n';
  for (let i = 1; i <= count; i += 1) {
    text += `:m${i} :line "${i}\\n".\n`;
    if (i < count) text += 'MESSAGE\n';
  }
  fs.writeFileSync(file, text, 'utf8');
}

function writeMarcMessageLog(file) {
  fs.writeFileSync(
    file,
    `VERSION "1.2-messages"\n` +
      `PREFIX : <http://example.org/ns#>\n` +
      `\n` +
      `:record1 :record (\n` +
      `  ("001" "_" "_" "_" "42")\n` +
      `  ("245" "1" "0" "a" "Streaming RDF Messages")\n` +
      `  ("650" "_" "0" "a" "Semantic Web")\n` +
      `  ("920" "_" "_" "a" "book")\n` +
      `).\n` +
      `MESSAGE\n` +
      `:record2 :record (\n` +
      `  ("001" "_" "_" "_" "43")\n` +
      `  ("245" "1" "0" "a" "Incremental MARC Extraction")\n` +
      `  ("650" "_" "0" "a" "Linked data")\n` +
      `  ("920" "_" "_" "a" "article")\n` +
      `).\n`,
    'utf8',
  );
}

const cases = [
  {
    name: 'scoped payload rules run once per RDF Message',
    run(tmp) {
      const rules = path.join(tmp, 'rules.n3');
      const log = path.join(tmp, 'messages.trig');
      writeScopedPayloadRules(rules);
      writeBasicMessageLog(log);

      const out = expectEyelingOk(['-r', '--stream-messages', rules, log]);
      assert.equal(out, 'one\ntwo\nthree\n');
    },
  },
  {
    name: 'empty heartbeat messages do not leak previous payloads',
    run(tmp) {
      const rules = path.join(tmp, 'rules.n3');
      const log = path.join(tmp, 'messages.trig');
      writeScopedPayloadRules(rules);
      writeBasicMessageLog(log);

      const out = expectEyelingOk(['-r', '--stream-messages', rules, log]);
      assert.equal(out.trim().split('\n').length, 3);
      assert.ok(!out.includes('one\none'));
    },
  },
  {
    name: 'large message logs stream without requiring one monolithic dataset',
    run(tmp) {
      const rules = path.join(tmp, 'rules.n3');
      const log = path.join(tmp, 'large.trig');
      writeScopedPayloadRules(rules);
      writeLargeMessageLog(log, 1000);

      const out = expectEyelingOk(['-r', '--stream-messages', rules, log]);
      const lines = out.trim().split('\n');
      assert.equal(lines.length, 1000);
      assert.equal(new Set(lines).size, 1000);
      assert.ok(lines.includes('1'));
      assert.ok(lines.includes('999'));
      assert.ok(lines.includes('1000'));
    },
  },
  {
    name: 'MARC extraction rules fire over each streamed payload graph',
    run(tmp) {
      const log = path.join(tmp, 'marc.messages.txt');
      writeMarcMessageLog(log);

      const fixture = path.join(root, 'test', 'fixtures', 'marc-rules-stream-messages.n3');
      const out = expectEyelingOk(['-r', '--stream-messages', fixture, log]);
      assert.deepEqual(out.trim().split('\n').sort(), [
        '<http://lib.ugent.be/record/42> <http://example.org/ns#subject> "Semantic Web" .',
        '<http://lib.ugent.be/record/42> <http://example.org/ns#title> "Streaming RDF Messages" .',
        '<http://lib.ugent.be/record/42> <http://example.org/ns#type> "book" .',
        '<http://lib.ugent.be/record/43> <http://example.org/ns#subject> "Linked data" .',
        '<http://lib.ugent.be/record/43> <http://example.org/ns#title> "Incremental MARC Extraction" .',
        '<http://lib.ugent.be/record/43> <http://example.org/ns#type> "article" .',
      ]);
    },
  },
  {
    name: '--stream-messages requires RDF mode',
    run(tmp) {
      const rules = path.join(tmp, 'rules.n3');
      const log = path.join(tmp, 'messages.trig');
      writeScopedPayloadRules(rules);
      writeBasicMessageLog(log);

      const r = runEyeling(['--stream-messages', rules, log]);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /requires -r\/--rdf/);
    },
  },
];

(function main() {
  const suiteStart = msNow();
  info(`Running ${cases.length} stream-message tests`);

  let passed = 0;
  let failed = 0;

  for (const [index, tc] of cases.entries()) {
    const tmp = mkTmpDir();
    const testName = numberedName(index, tc.name);
    const start = msNow();

    try {
      tc.run(tmp);
      ok(`${testName} ${C.dim}(${msNow() - start} ms)${C.n}`);
      passed++;
    } catch (e) {
      fail(`${testName} ${C.dim}(${msNow() - start} ms)${C.n}`);
      fail(e && e.stack ? e.stack : String(e));
      failed++;
    } finally {
      rmrf(tmp);
    }
  }

  console.log('');
  const suiteMs = msNow() - suiteStart;
  console.log(`${C.y}==${C.n} Total elapsed: ${suiteMs} ms (${(suiteMs / 1000).toFixed(2)} s)`);

  if (failed === 0) {
    ok(`All stream-message tests passed (${passed}/${cases.length})`);
    process.exit(0);
  }

  fail(`Some stream-message tests failed (${passed}/${cases.length})`);
  process.exit(1);
})();
