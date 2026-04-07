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
    } catch {
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

  function normalizeText(text){
    return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  function posToIndex(text, line, ch){
    line = Math.max(0, line|0);
    ch = Math.max(0, ch|0);
    const norm = normalizeText(text);
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

    sizer.appendChild(code);
    scroll.appendChild(sizer);
    wrapper.appendChild(scroll);

    return { wrapper: wrapper, scroll: scroll, sizer: sizer, code: code };
  }

  function makeLineHandle(lineNo, text){
    var wrap = document.createElement('div');
    wrap.className = 'CodeMirror-linewrap';
    wrap.dataset.lineNumber = String(lineNo + 1);

    var bg = document.createElement('div');
    bg.className = 'CodeMirror-linebackground';

    var pre = document.createElement('pre');
    pre.className = 'CodeMirror-line';
    pre.textContent = text && text.length ? text : ' ';

    wrap.appendChild(bg);
    wrap.appendChild(pre);
    return { lineNo: lineNo, wrap: wrap, bg: bg, pre: pre };
  }

  window.__cmStubsById = window.__cmStubsById || Object.create(null);

  window.CodeMirror = {
    fromTextArea: function(textarea/*, opts*/){
      var obj = mkWrapper(textarea);
      var listeners = Object.create(null);
      var lineHandles = [];
      var cursor = { line: 0, ch: 0 };

      function emit(name){
        var hs = listeners[name] || [];
        var args = Array.prototype.slice.call(arguments, 1);
        for (var i = 0; i < hs.length; i++) {
          try { hs[i].apply(null, args); } catch(_) {}
        }
      }

      function getText(){
        return normalizeText(textarea.value || '');
      }

      function getLines(){
        return getText().split('\n');
      }

      function render(){
        var lines = getLines();
        obj.code.innerHTML = '';
        lineHandles = [];
        for (var i = 0; i < lines.length; i++) {
          var h = makeLineHandle(i, lines[i]);
          lineHandles.push(h);
          obj.code.appendChild(h.wrap);
        }
        if (!lineHandles.length) {
          var h0 = makeLineHandle(0, '');
          lineHandles.push(h0);
          obj.code.appendChild(h0.wrap);
        }
      }

      try {
        textarea.style.display = 'none';
        textarea.parentNode.insertBefore(obj.wrapper, textarea.nextSibling);
      } catch(_) {}

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

      const api = {
        getValue: function(){ return textarea.value || ''; },
        setValue: function(v){ textarea.value = String(v == null ? '' : v); render(); emit('change', api, { origin: 'setValue' }); },

        // Methods used by demo.html's streaming appender
        getScrollerElement: function(){ return obj.scroll; },
        lastLine: function(){ const ls = getLines(); return Math.max(0, ls.length - 1); },
        getLine: function(n){ const ls = getLines(); return ls[n] == null ? '' : ls[n]; },
        replaceRange: function(text, pos){
          const cur = String(textarea.value || '');
          const idx = posToIndex(cur, pos && pos.line, pos && pos.ch);
          textarea.value = cur.slice(0, idx) + String(text == null ? '' : text) + cur.slice(idx);
          render();
          emit('change', api, { origin: '+input' });
        },

        // Misc methods used by layout / resizing code
        refresh: function(){},
        setSize: function(){},
        setOption: function(){},
        on: function(name, fn){ if (!listeners[name]) listeners[name] = []; listeners[name].push(fn); },
        operation: function(fn){ try{ fn(); } catch(_){} },
        getWrapperElement: function(){ return obj.wrapper; },
        getScrollInfo: function(){ return { height: 0, clientHeight: 0, top: 0 }; },
        defaultTextHeight: function(){ return 17; },
        lineCount: function(){ return lineHandles.length; },
        getLineHandle: function(n){ return (n >= 0 && n < lineHandles.length) ? lineHandles[n] : null; },
        scrollIntoView: function(){},
        setCursor: function(pos){ cursor = { line: pos && pos.line || 0, ch: pos && pos.ch || 0 }; },
        getCursor: function(){ return { line: cursor.line, ch: cursor.ch }; },

        // Error highlighting hooks
        addLineClass: function(handle, where, cls){
          if (!handle || !cls) return handle;
          if (where === 'background' && handle.bg) handle.bg.classList.add(cls);
          if (handle.wrap) handle.wrap.classList.add(cls);
          return handle;
        },
        removeLineClass: function(handle, where, cls){
          if (!handle || !cls) return;
          if (where === 'background' && handle.bg) handle.bg.classList.remove(cls);
          if (handle.wrap) handle.wrap.classList.remove(cls);
        },
        clearGutter: function(){},
        setGutterMarker: function(){},

        // Minimal doc access for error helpers (if ever invoked)
        getDoc: function(){ return doc; },
        doc: doc
      };

      render();
      textarea.__cmInstance = api;
      window.__cmStubsById[textarea.id || ('cm-' + Object.keys(window.__cmStubsById).length)] = api;
      return api;
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
      [
        'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.min.js',
        { ct: 'application/javascript', body: CODEMIRROR_STUB },
      ],
      [
        'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/turtle/turtle.min.js',
        { ct: 'application/javascript', body: '' },
      ],
      [
        'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/sparql/sparql.min.js',
        { ct: 'application/javascript', body: '' },
      ],
      [
        'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.min.css',
        { ct: 'text/css', body: '/* stub */\n' },
      ],

      // GitHub raw references used by demo.html for the "latest version" display.
      [
        'https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/package.json',
        { ct: 'application/json', body: localPkg },
      ],
      [
        'https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/eyeling.js',
        { ct: 'application/javascript', body: localEyeling },
      ],
    ]);

    await cdp.send(
      'Fetch.enable',
      {
        patterns: [
          { urlPattern: 'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/*', requestStage: 'Request' },
          {
            urlPattern: 'https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/*',
            requestStage: 'Request',
          },
        ],
      },
      sessionId,
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
            sessionId,
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

    async function evalInPage(expression) {
      const r = await cdp.send(
        'Runtime.evaluate',
        {
          expression,
          returnByValue: true,
          awaitPromise: true,
        },
        sessionId,
      );
      return r && r.result ? r.result.value : undefined;
    }

    function failFastOnExceptions() {
      if (exceptions.length) {
        throw new Error(`Uncaught exception in demo.html: ${JSON.stringify(exceptions[0] || {})}`);
      }
    }

    async function getPlaygroundState() {
      return (
        (await evalInPage(`(() => {
        const statusEl = document.getElementById('status');
        const outputTa = document.getElementById('output-editor');
        const inputCm = window.__cmStubsById && (window.__cmStubsById['n3-editor'] || window.__cmStubsById['input-editor']);
        const outputCm = window.__cmStubsById && window.__cmStubsById['output-editor'];
        const inputWrapper = inputCm && typeof inputCm.getWrapperElement === 'function' ? inputCm.getWrapperElement() : null;
        const highlighted = inputWrapper
          ? Array.from(inputWrapper.querySelectorAll('.CodeMirror-linebackground.cm-error-line')).map((el) => {
              const wrap = el.parentElement;
              const pre = wrap && wrap.querySelector('pre');
              return {
                line: wrap && wrap.dataset && wrap.dataset.lineNumber ? Number(wrap.dataset.lineNumber) : null,
                text: pre ? String(pre.textContent || '') : '',
              };
            })
          : [];
        return {
          status: statusEl ? String(statusEl.textContent || '') : '',
          output: outputCm && typeof outputCm.getValue === 'function'
            ? String(outputCm.getValue() || '')
            : (outputTa ? String(outputTa.value || '') : ''),
          highlighted,
        };
      })()`)) || { status: '', output: '', highlighted: [] }
      );
    }

    async function setProgram(text) {
      const payload = JSON.stringify(String(text));
      await evalInPage(`(() => {
        const cm = window.__cmStubsById && (window.__cmStubsById['n3-editor'] || window.__cmStubsById['input-editor']);
        if (cm && typeof cm.setValue === 'function') {
          cm.setValue(${payload});
          return true;
        }
        const ta = document.getElementById('n3-editor') || document.getElementById('input-editor');
        if (!ta) throw new Error('n3-editor textarea not found');
        ta.value = ${payload};
        return true;
      })()`);
    }

    async function clickRun() {
      await evalInPage(`(() => {
        const btn = document.getElementById('run-btn');
        if (!btn) throw new Error('run-btn not found');
        btn.click();
        return true;
      })()`);
    }

    async function waitForState(label, predicate, timeoutMs = 60000) {
      const deadline = Date.now() + timeoutMs;
      let last = { status: '', output: '', highlighted: [] };
      while (Date.now() < deadline) {
        failFastOnExceptions();
        last = await getPlaygroundState();
        if (predicate(last)) return last;
        await sleep(100);
      }
      throw new Error(`Timed out waiting for ${label}. Last state:
${JSON.stringify(last, null, 2)}`);
    }

    const DEFAULT_PROGRAM_EXPECTS = [
      [/Socrates/i, 'Expected output to mention Socrates'],
      [/Mortal/i, 'Expected output to mention Mortal'],
    ];
    const syntaxErrorProgram = `@prefix : <#> .
:alice :name "Ada" .
^
`;
    const fuseProgram = fs.readFileSync(path.join(ROOT, 'examples', 'fuse.n3'), 'utf8');
    const outputStringProgram = `@prefix : <#> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
:report log:outputString "Hello from output string\nLine 2\n" .
`;

    // 1) Baseline smoke test: the default program runs to completion.
    await clickRun();
    const baseline = await waitForState(
      'default program completion',
      (st) =>
        String(st.status || '')
          .trim()
          .startsWith('Done'),
      60000,
    );
    assert.ok(typeof baseline.output === 'string' && baseline.output.length > 0, 'Expected non-empty output');
    for (const [re, msg] of DEFAULT_PROGRAM_EXPECTS) assert.match(baseline.output, re, msg);
    ok('playground runs the default Socrates program');

    // 2) N3 syntax errors should be shown in Output and highlight the offending line.
    await setProgram(syntaxErrorProgram);
    await clickRun();
    const syntaxErr = await waitForState(
      'syntax error reporting',
      (st) => String(st.status || '').trim() === 'Error.' && /syntax error/i.test(String(st.output || '')),
      20000,
    );
    assert.match(syntaxErr.output, /Syntax error in input\.n3:3:1:/i, 'Expected line/column in syntax error output');
    assert.match(syntaxErr.output, /\n\^\s*$/m, 'Expected caret line in syntax error output');
    assert.equal(syntaxErr.highlighted[0].line, 3, 'Expected line 3 to be highlighted');
    assert.equal(syntaxErr.highlighted[0].text, '^', 'Expected highlighted line text to match the broken line');
    ok('playground shows syntax errors in Output and highlights the offending line');

    // 3) Inference fuse output should be visible in the Output pane.
    await setProgram(fuseProgram);
    await clickRun();
    const fuse = await waitForState(
      'inference fuse reporting',
      (st) =>
        String(st.status || '')
          .trim()
          .startsWith('Done') && /Inference fuse triggered/i.test(String(st.output || '')),
      30000,
    );
    assert.match(fuse.output, /Inference fuse triggered\./i, 'Expected fuse message in Output');
    assert.match(fuse.output, /Fired rule:/i, 'Expected fired rule explanation in Output');
    assert.match(fuse.output, /Matched instance:/i, 'Expected matched instance in Output');
    ok('playground clearly shows inference fuse output');

    // 4) log:outputString should render as clean text, not raw triples.
    await setProgram(outputStringProgram);
    await clickRun();
    const rendered = await waitForState(
      'log:outputString rendering',
      (st) =>
        String(st.status || '')
          .trim()
          .startsWith('Done') && /Hello from output string/.test(String(st.output || '')),
      20000,
    );
    assert.match(rendered.output, /^Hello from output string\nLine 2\n?$/m, 'Expected rendered outputString text');
    assert.doesNotMatch(
      rendered.output,
      /:report\s+log:outputString\s+"|# Derived triples/i,
      'Expected clean rendered output without raw triples',
    );
    ok('playground renders log:outputString cleanly in Output');

    // Ensure no uncaught runtime exceptions.
    assert.equal(exceptions.length, 0, `Uncaught exceptions in demo.html: ${JSON.stringify(exceptions[0] || {})}`);

    // Console errors are noisy and often indicate a broken UI.
    // (We suppress known noise like /favicon.ico on the server.)
    assert.equal(consoleErrors.length, 0, `Console errors in demo.html: ${JSON.stringify(consoleErrors[0] || {})}`);

    // Cleanup.
    try {
      await cdp.send('Browser.close');
    } catch (_) {}
  } finally {
    await cleanup();
  }
}

main().catch((e) => {
  fail(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
