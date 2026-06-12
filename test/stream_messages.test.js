'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const eyelingJsPath = path.join(root, 'eyeling.js');

const { detail, failResult, info, pass } = require('./report');
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

function startFileServer(file) {
  const dir = path.dirname(file);
  const script = path.join(dir, 'server.js');
  const portFile = path.join(dir, 'server.port');
  fs.writeFileSync(
    script,
    `const fs = require('node:fs');\n` +
      `const http = require('node:http');\n` +
      `const file = process.argv[2];\n` +
      `const portFile = process.argv[3];\n` +
      `const size = fs.statSync(file).size;\n` +
      `const server = http.createServer((req, res) => {\n` +
      `  const headers = { 'content-type': 'text/plain', 'accept-ranges': 'bytes' };\n` +
      `  if (req.method === 'HEAD') { res.writeHead(200, { ...headers, 'content-length': size }); res.end(); return; }\n` +
      `  const range = req.headers.range;\n` +
      `  if (range) {\n` +
      `    const m = /^bytes=(\\d+)-(\\d*)$/.exec(range);\n` +
      `    const start = m ? Number(m[1]) : 0;\n` +
      `    const end = m && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;\n` +
      `    res.writeHead(206, { ...headers, 'content-range': 'bytes ' + start + '-' + end + '/' + size, 'content-length': end - start + 1 });\n` +
      `    fs.createReadStream(file, { start, end }).pipe(res);\n` +
      `    return;\n` +
      `  }\n` +
      `  res.writeHead(200, { ...headers, 'content-length': size });\n` +
      `  fs.createReadStream(file).pipe(res);\n` +
      `});\n` +
      `server.listen(0, '127.0.0.1', () => fs.writeFileSync(portFile, String(server.address().port)));\n`,
    'utf8',
  );
  const child = cp.spawn(process.execPath, [script, file, portFile], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (fs.existsSync(portFile)) {
      const port = fs.readFileSync(portFile, 'utf8').trim();
      return { url: `http://127.0.0.1:${port}/messages.txt`, stop: () => child.kill() };
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
  child.kill();
  throw new Error('test HTTP server did not start');
}


function startOpenEndedMessageServer() {
  const dir = mkTmpDir();
  const script = path.join(dir, 'server.js');
  const portFile = path.join(dir, 'server.port');
  fs.writeFileSync(
    script,
    [
      "const http = require('node:http');",
      "const fs = require('node:fs');",
      'const portFile = process.argv[2];',
      'const server = http.createServer((req, res) => {',
      "  res.writeHead(200, { 'content-type': 'text/plain' });",
      "  res.write('VERSION \\\"1.2-messages\\\"\\nPREFIX : <urn:test#>\\n');",
      "  res.write(':a :line \\\"one\\\\n\\\".\\nMESSAGE\\n');",
      "  setInterval(() => res.write('# keepalive\\n'), 1000);",
      '});',
      "server.listen(0, '127.0.0.1', () => fs.writeFileSync(portFile, String(server.address().port)));",
      '',
    ].join('\n'),
    'utf8',
  );
  const child = cp.spawn(process.execPath, [script, portFile], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (fs.existsSync(portFile)) {
      const port = fs.readFileSync(portFile, 'utf8').trim();
      return {
        url: `http://127.0.0.1:${port}/messages.txt`,
        stop: () => {
          child.kill();
          rmrf(dir);
        },
      };
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
  child.kill();
  rmrf(dir);
  throw new Error('test open-ended HTTP server did not start');
}

function waitForEyelingOutput(args, pattern, opts = {}) {
  const timeoutMs = opts.timeoutMs || 4000;
  return new Promise((resolve, reject) => {
    const child = cp.spawn(process.execPath, [eyelingJsPath, ...args], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`timed out waiting for ${pattern}; stdout=${JSON.stringify(stdout)} stderr=${JSON.stringify(stderr)}`));
    }, timeoutMs);

    function finish(err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (err) reject(err);
      else resolve(stdout);
    }

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
      if (pattern.test(stdout)) finish();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', finish);
    child.on('exit', (code) => {
      if (!settled && code !== 0) finish(new Error(`eyeling exited with ${code}; stdout=${stdout}; stderr=${stderr}`));
    });
  });
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
    name: 'remote text/plain RDF Message Logs are streamed via HTTP',
    run(tmp) {
      const rules = path.join(tmp, 'rules.n3');
      const log = path.join(tmp, 'remote.trig');
      writeScopedPayloadRules(rules);
      writeLargeMessageLog(log, 25);
      const server = startFileServer(log);
      try {
        const out = expectEyelingOk(['-r', '--stream-messages', server.url, rules]);
        const lines = out.trim().split('\n');
        assert.equal(lines.length, 25);
        assert.equal(lines[0], '1');
        assert.equal(lines[24], '25');
      } finally {
        server.stop();
      }
    },
  },
  {
    name: 'remote HTTP RDF Message Logs emit before the response ends',
    async run(tmp) {
      const rules = path.join(tmp, 'rules.n3');
      writeScopedPayloadRules(rules);
      const server = startOpenEndedMessageServer();
      try {
        const out = await waitForEyelingOutput(['-r', '--stream-messages', rules, server.url], /^one\n/);
        assert.equal(out, 'one\n');
      } finally {
        server.stop();
      }
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
    name: '--stream-messages can persist each message result into a named store',
    run(tmp) {
      const rules = path.join(tmp, 'rules.n3');
      const log = path.join(tmp, 'messages.trig');
      const storePath = path.join(tmp, 'store');
      writeScopedPayloadRules(rules);
      writeBasicMessageLog(log);
      const out = expectEyelingOk(['-r', '--stream-messages', '--store', 'messages', '--store-path', storePath, '--store-clear', rules, log]);
      assert.equal(out, 'one\ntwo\nthree\n');
      assert.ok(fs.existsSync(path.join(storePath, 'messages.json')) || fs.existsSync(path.join(storePath, 'messages')));
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

(async function main() {
  const suiteStart = msNow();
  info(`Running ${cases.length} stream-message tests`);
  let passed = 0;
  let failed = 0;
  for (const [index, tc] of cases.entries()) {
    const tmp = mkTmpDir();
    const testNr = index + 1;
    const testName = tc.name;
    const start = msNow();
    try {
      await tc.run(tmp);
      pass(testNr, testName, msNow() - start);
      passed++;
    } catch (e) {
      failResult(testNr, testName, msNow() - start);
      detail(e && e.stack ? e.stack : String(e));
      failed++;
    } finally {
      rmrf(tmp);
    }
  }
  console.log('');
  const suiteMs = msNow() - suiteStart;
  info(`Total elapsed: ${suiteMs} ms (${(suiteMs / 1000).toFixed(2)} s)`);
  if (failed === 0) {
    info(`All stream-message tests passed (${passed}/${cases.length})`);
    process.exit(0);
  }
  info(`Some stream-message tests failed (${passed}/${cases.length})`);
  process.exit(1);
})().catch((e) => {
  failResult(1, 'stream-message test runner failed', 0);
  detail(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
