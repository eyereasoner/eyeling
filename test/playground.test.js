'use strict';

// Smoke-test the browser playground (demo.html).
//
// Goal: ensure demo.html loads without runtime exceptions and that the default
// Socrates program can be executed to completion ("Done") with non-empty output.
//
// This test is dependency-free: it drives Chromium directly via the Chrome
// DevTools Protocol (CDP) over WebSocket.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: sleep } = require('node:timers/promises');

const ROOT = path.resolve(__dirname, '..');

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

function guessContentType(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.ttl' || ext === '.n3') return 'text/plain; charset=utf-8';
  if (ext === '.txt' || ext === '.md') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function startStaticServer(rootDir) {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      let pathname = decodeURIComponent(url.pathname);

      // Avoid noisy browser console errors.
      if (pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (pathname === '/' || pathname === '') pathname = '/demo.html';
      // Prevent directory traversal.
      const fsPath = path.resolve(rootDir, '.' + pathname);
      if (!fsPath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      const st = fs.statSync(fsPath);
      if (st.isDirectory()) {
        res.writeHead(301, { Location: pathname.replace(/\/$/, '') + '/demo.html' });
        res.end();
        return;
      }

      res.writeHead(200, { 'Content-Type': guessContentType(fsPath), 'Cache-Control': 'no-store' });
      fs.createReadStream(fsPath).pipe(res);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        port: addr.port,
        baseUrl: `http://127.0.0.1:${addr.port}`,
      });
    });
  });
}

function which(cmd) {
  try {
    // Avoid spawnSync (keeps this file in the same style as other tests: lightweight).
    const paths = String(process.env.PATH || '').split(path.delimiter);
    for (const p of paths) {
      const fp = path.join(p, cmd);
      if (fs.existsSync(fp)) return fp;
    }
  } catch (_) {}
  return null;
}

function findChromium() {
  // Allow overrides.
  const env = process.env.EYELING_BROWSER || process.env.CHROME_BIN || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env && fs.existsSync(env)) return env;

  // Common binaries.
  const candidates = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome'];
  for (const c of candidates) {
    const p = which(c);
    if (p) return p;
  }
  return null;
}

// Minimal CodeMirror stub for the playground.
// The real demo loads CodeMirror from a CDN. In CI/offline tests we intercept
// those script requests and provide this stub to prevent runtime failures.
const CODEMIRROR_STUB = String.raw`(function(){
  if (window.CodeMirror) return;

  function posToIndex(text, line, ch){
    line = Math.max(0, line|0);
    ch = Math.max(0, ch|0);
    const norm = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = norm.split('\n');
    if (lines.length === 0) return 0;
    if (line >= lines.length) line = lines.length - 1;
    if (ch > lines[line].length) ch = lines[line].length;
    let idx = 0;
    for (let i = 0; i < line; i++) idx += lines[i].length + 1;
    return idx + ch;
  }

  function mkWrapper(textarea){
    var wrapper = document.createElement('div');
    wrapper.className = 'CodeMirror';

    var scroll = document.createElement('div');
    scroll.className = 'CodeMirror-scroll';
    scroll.style.overflow = 'auto';

    var sizer = document.createElement('div');
    sizer.className = 'CodeMirror-sizer';

    var code = document.createElement('div');
    code.className = 'CodeMirror-code';

    var pre = document.createElement('pre');
    pre.textContent = textarea.value || '';

    code.appendChild(pre);
    sizer.appendChild(code);
    scroll.appendChild(sizer);
    wrapper.appendChild(scroll);

    return { wrapper: wrapper, scroll: scroll, pre: pre };
  }

  window.CodeMirror = {
    fromTextArea: function(textarea/*, opts*/){
      var obj = mkWrapper(textarea);
      try {
        textarea.style.display = 'none';
        textarea.parentNode.insertBefore(obj.wrapper, textarea.nextSibling);
      } catch(_) {}

      function sync(){ obj.pre.textContent = textarea.value || ''; }
      function getLines(){
        return String(textarea.value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      }

      const doc = {
        posFromIndex: function(i){
          i = Math.max(0, i|0);
          const lines = getLines();
          let acc = 0;
          for (let ln = 0; ln < lines.length; ln++){
            const len = lines[ln].length;
            if (i <= acc + len) return { line: ln, ch: i - acc };
            acc += len + 1;
          }
          return { line: Math.max(0, lines.length - 1), ch: (lines[lines.length-1] || '').length };
        }
      };

      return {
        getValue: function(){ return textarea.value || ''; },
        setValue: function(v){ textarea.value = String(v == null ? '' : v); sync(); },

        // Methods used by demo.html's streaming appender
        getScrollerElement: function(){ return obj.scroll; },
        lastLine: function(){ const ls = getLines(); return Math.max(0, ls.length - 1); },
        getLine: function(n){ const ls = getLines(); return ls[n] == null ? '' : ls[n]; },
        replaceRange: function(text, pos){
          const cur = String(textarea.value || '');
          const idx = posToIndex(cur, pos && pos.line, pos && pos.ch);
          textarea.value = cur.slice(0, idx) + String(text == null ? '' : text) + cur.slice(idx);
          sync();
        },

        // Misc methods used by layout / resizing code
        refresh: function(){},
        setSize: function(){},
        setOption: function(){},
        on: function(){},
        operation: function(fn){ try{ fn(); } catch(_){} },
        getWrapperElement: function(){ return obj.wrapper; },
        getScrollInfo: function(){ return { height: 0, clientHeight: 0, top: 0 }; },
        defaultTextHeight: function(){ return 17; },

        // Error highlighting hooks (no-op in stub)
        addLineClass: function(){},
        removeLineClass: function(){},
        clearGutter: function(){},
        setGutterMarker: function(){},

        // Minimal doc access for error helpers (if ever invoked)
        getDoc: function(){ return doc; },
        doc: doc
      };
    }
  };
})();`;

function b64(s) {
  return Buffer.from(String(s), 'utf8').toString('base64');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) {
          const e = new Error(msg.error.message || 'CDP error');
          e.data = msg.error;
          p.reject(e);
        } else {
          p.resolve(msg.result);
        }
        return;
      }
      const key = `${msg.sessionId || ''}:${msg.method}`;
      const hs = this.handlers.get(key);
      if (hs) {
        for (const h of hs) {
          try {
            h(msg.params);
          } catch (_) {}
        }
      }
    };
  }

  send(method, params = {}, sessionId, timeoutMs = 15000) {
    const id = ++this.nextId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout (${timeoutMs}ms): ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(t);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(t);
          reject(e);
        },
      });
    });
  }

  on(method, sessionId, fn) {
    const key = `${sessionId || ''}:${method}`;
    let hs = this.handlers.get(key);
    if (!hs) this.handlers.set(key, (hs = []));
    hs.push(fn);
  }

  once(method, sessionId, timeoutMs = 15000, predicate = null) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for ${method}`));
      }, timeoutMs);
      const handler = (params) => {
        if (predicate && !predicate(params)) return;
        cleanup();
        resolve(params);
      };
      const cleanup = () => {
        clearTimeout(t);
        const key = `${sessionId || ''}:${method}`;
        const hs = this.handlers.get(key) || [];
        const idx = hs.indexOf(handler);
        if (idx >= 0) hs.splice(idx, 1);
      };
      this.on(method, sessionId, handler);
    });
  }
}

async function main() {
  const browserPath = findChromium();
  assert.ok(browserPath, 'No Chromium/Chrome binary found. Set EYELING_BROWSER to override.');

  let server = null;
  let chrome = null;
  let ws = null;

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-playground-'));

  async function cleanup() {
    try {
      if (ws) ws.close();
    } catch (_) {}
    try {
      if (chrome) chrome.kill('SIGKILL');
    } catch (_) {}
    try {
      if (server) server.close();
    } catch (_) {}
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (_) {}
  }

  try {
    const started = await startStaticServer(ROOT);
    server = started.server;
    const demoUrl = `${started.baseUrl}/demo.html`;
    info(`Static server: ${demoUrl}`);

    const chromeArgs = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ];

    chrome = spawn(browserPath, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });

  let wsUrl = null;
  const wsRe = /DevTools listening on (ws:\/\/[^\s]+)/;
  const stderrChunks = [];

  chrome.stderr.on('data', (buf) => {
    const s = String(buf);
    stderrChunks.push(s);
    const m = wsRe.exec(s);
    if (m && m[1]) wsUrl = m[1];
  });

  // Wait for DevTools endpoint.
  const start = Date.now();
  while (!wsUrl) {
    if (chrome.exitCode != null) {
      throw new Error(`Chromium exited early: ${chrome.exitCode}\n${stderrChunks.join('')}`);
    }
    if (Date.now() - start > 15000) {
      throw new Error(`Timed out waiting for DevTools URL.\n${stderrChunks.join('')}`);
    }
    await sleep(50);
  }

  info(`Chromium: ${browserPath}`);
  info(`CDP: ${wsUrl}`);

    ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  const cdp = new CDP(ws);

  // Create and attach to a new page target.
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  // Capture exceptions and console errors.
  const exceptions = [];
  const consoleErrors = [];
  cdp.on('Runtime.exceptionThrown', sessionId, (p) => exceptions.push(p));
  cdp.on('Log.entryAdded', sessionId, (p) => {
    if (p && p.entry && p.entry.level === 'error') consoleErrors.push(p.entry);
  });
  cdp.on('Runtime.consoleAPICalled', sessionId, (p) => {
    if (p && p.type === 'error') consoleErrors.push({ source: 'console', text: JSON.stringify(p.args || []) });
  });

  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Log.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);

  // Intercept CodeMirror + remote GitHub raw URLs (keep test deterministic).
  const localPkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  const localEyeling = fs.readFileSync(path.join(ROOT, 'eyeling.js'), 'utf8');

  const intercept = new Map([
    // CodeMirror assets (CDN)
    ['https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.min.js', { ct: 'application/javascript', body: CODEMIRROR_STUB }],
    ['https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/turtle/turtle.min.js', { ct: 'application/javascript', body: '' }],
    ['https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/sparql/sparql.min.js', { ct: 'application/javascript', body: '' }],
    ['https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.min.css', { ct: 'text/css', body: '/* stub */\n' }],

    // GitHub raw references used for "latest" version display
    ['https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/package.json', { ct: 'application/json', body: localPkg }],
    ['https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/eyeling.js', { ct: 'application/javascript', body: localEyeling }],
  ]);

  await cdp.send(
    'Fetch.enable',
    {
      patterns: [
        { urlPattern: 'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/*', requestStage: 'Request' },
        { urlPattern: 'https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/*', requestStage: 'Request' },
      ],
    },
    sessionId
  );

  cdp.on('Fetch.requestPaused', sessionId, async (p) => {
    const url = p && p.request && p.request.url ? p.request.url : '';
    const hit = intercept.get(url);
    try {
      if (hit) {
        await cdp.send(
          'Fetch.fulfillRequest',
          {
            requestId: p.requestId,
            responseCode: 200,
            responseHeaders: [
              { name: 'Content-Type', value: `${hit.ct}; charset=utf-8` },
              { name: 'Cache-Control', value: 'no-store' },
              // Avoid CORS surprises for fetch() from the page.
              { name: 'Access-Control-Allow-Origin', value: '*' },
            ],
            body: b64(hit.body),
          },
          sessionId
        );
      } else {
        await cdp.send('Fetch.continueRequest', { requestId: p.requestId }, sessionId);
      }
    } catch (_) {
      // Best-effort: if interception fails, just continue.
      try {
        await cdp.send('Fetch.continueRequest', { requestId: p.requestId }, sessionId);
      } catch (_) {}
    }
  });

    const loadFired = cdp.once('Page.loadEventFired', sessionId, 30000);
    const nav = await cdp.send('Page.navigate', { url: demoUrl }, sessionId);
    assert.ok(!nav.errorText, `demo.html navigation failed: ${nav.errorText}`);
    await loadFired;

  // Click the Run button.
  await cdp.send(
    'Runtime.evaluate',
    { expression: `document.getElementById('run-btn') && document.getElementById('run-btn').click();`, returnByValue: true },
    sessionId
  );

  // Wait for completion and capture output.
// The demo reports completion with status strings like:
//   "Done. Derived: …", "Done (paused). …", or "Done. (Run N)".
let last = { status: '', output: '' };
const deadline = Date.now() + 60000;

while (Date.now() < deadline) {
  // Fail fast on runtime exceptions (often indicates a broken CodeMirror stub or worker init).
  if (exceptions.length) {
    throw new Error(`Uncaught exception in demo.html: ${JSON.stringify(exceptions[0] || {})}`);
  }

  const r = await cdp.send(
    'Runtime.evaluate',
    {
      expression: `(() => {
        const s = document.getElementById('status');
        const o = document.getElementById('output-editor');
        return { status: s ? String(s.textContent || '') : '', output: o ? String(o.value || '') : '' };
      })()`,
      returnByValue: true,
    },
    sessionId
  );
  last = r && r.result ? r.result.value : last;

  const st = (last && typeof last.status === 'string') ? last.status : '';

  // Treat any "Reasoning error" as failure.
  if (/Reasoning error/i.test(st)) {
    throw new Error(`Playground reported error: ${st}
Output:
${last.output || ''}`);
  }

  // Success conditions: status starts with "Done" (covers "Done." and "Done (paused).")
  if (String(st || '').trim().startsWith('Done')) break;

  await sleep(100);
}

assert.ok(last && typeof last.status === 'string' && String(last.status || '').trim().startsWith('Done'), `Expected Done. Got: ${last.status}`);
  assert.ok(last && typeof last.output === 'string' && last.output.length > 0, 'Expected non-empty output');
  assert.match(last.output, /Socrates/i, 'Expected output to mention Socrates');
  assert.match(last.output, /Mortal/i, 'Expected output to mention Mortal');

  // Ensure no uncaught runtime exceptions.
  assert.equal(exceptions.length, 0, `Uncaught exceptions in demo.html: ${JSON.stringify(exceptions[0] || {})}`);

  // Console errors are noisy and often indicate a broken UI.
  // (We suppress known noise like /favicon.ico on the server.)
  assert.equal(consoleErrors.length, 0, `Console errors in demo.html: ${JSON.stringify(consoleErrors[0] || {})}`);

    // Cleanup.
    try {
      await cdp.send('Browser.close');
    } catch (_) {}

    ok('demo.html loads and runs the default program');
  } finally {
    await cleanup();
  }
}

main().catch((e) => {
  fail(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
