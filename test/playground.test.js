'use strict';

// Smoke-test the browser playground (playground.html).
//
// Goal: ensure playground.html loads without runtime exceptions and that the default
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

const { detail, failResult, info, pass, warn } = require('./report');

const TOTAL_TESTS = (fs.readFileSync(__filename, 'utf8').match(/^\s*beginTest\(/gm) || []).length;
let passed = 0;
let failed = 0;
let currentTest = null;
let nonTestFailure = false;
const suiteStart = Date.now();

function beginTest(msg) {
  currentTest = { msg, start: Date.now() };
}
function endTest() {
  const tc = currentTest;
  if (!tc) return;
  pass(passed + failed + 1, tc.msg, Date.now() - tc.start);
  passed += 1;
  currentTest = null;
}
function recordCurrentFailure() {
  const tc = currentTest;
  if (!tc) return false;
  failResult(passed + failed + 1, tc.msg, Date.now() - tc.start);
  failed += 1;
  currentTest = null;
  return true;
}
function printSummary() {
  console.log('');
  const suiteMs = Date.now() - suiteStart;
  info(`Total elapsed: ${suiteMs} ms (${(suiteMs / 1000).toFixed(2)} s)`);
  if (failed === 0 && !nonTestFailure) {
    info(`All playground tests passed (${passed}/${TOTAL_TESTS})`);
  } else {
    info(`Some playground tests failed (${passed}/${TOTAL_TESTS})`);
  }
}

function guessContentType(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.ttl' || ext === '.trig' || ext === '.n3') return 'text/plain; charset=utf-8';
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

      if (pathname === '/redirect/playground-stream-messages.txt') {
        res.writeHead(302, {
          Location: '/test/fixtures/playground-stream-messages.txt',
          'Cache-Control': 'no-store',
        });
        res.end();
        return;
      }

      if (pathname === '/' || pathname === '') pathname = '/playground.html';
      // Prevent directory traversal.
      let fsPath = path.resolve(rootDir, '.' + pathname);
      if (!fsPath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      // Match GitHub Pages' convenient extensionless HTML URLs for local smoke tests.
      if (!fs.existsSync(fsPath) && !path.extname(fsPath) && fs.existsSync(`${fsPath}.html`)) {
        fsPath = `${fsPath}.html`;
      }

      const st = fs.statSync(fsPath);
      if (st.isDirectory()) {
        res.writeHead(301, { Location: pathname.replace(/\/$/, '') + '/playground' });
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
  // Avoid spawnSync (keeps this file in the same style as other tests: lightweight).
  const paths = String(process.env.PATH || '').split(path.delimiter);
  for (const p of paths) {
    const fp = path.join(p, cmd);
    try {
      fs.accessSync(fp, fs.constants.X_OK);
      return fp;
    } catch (_) {}
  }
  return null;
}

function canLaunch(binary) {
  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(binary, ['--version'], { stdio: 'ignore' });
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(false);
    }, 3000);

    function finish(ok) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(ok);
    }

    child.on('error', () => finish(false));
    child.on('exit', (code) => finish(code === 0));
  });
}

async function findChromium() {
  // Allow overrides.
  const env = process.env.EYELING_BROWSER || process.env.CHROME_BIN || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env && fs.existsSync(env)) return env;

  // Common binaries. Probe each one because some Linux distributions leave a
  // chromium-browser launcher in PATH even when its required Snap is absent.
  const candidates = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome'];
  for (const c of candidates) {
    const p = which(c);
    if (p && await canLaunch(p)) return p;
  }
  return null;
}

// Minimal CodeMirror stub for the playground.
// The real playground loads CodeMirror from a CDN. In CI/offline tests we intercept
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

        // Methods used by playground.html's streaming appender
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
  const browserPath = await findChromium();
  if (!browserPath) {
    warn('Playground browser tests skipped: no usable Chromium/Chrome binary found (set EYELING_BROWSER to override).');
    return;
  }

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
    const playgroundUrl = `${started.baseUrl}/playground.html`;
    const cleanPlaygroundUrl = `${started.baseUrl}/playground`;
    const legacyDemoUrl = `${started.baseUrl}/demo?url=https://example.org/example.n3#state`;
    info(`Static server: ${playgroundUrl}`);

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
    const localSmokeArithmetic = fs.readFileSync(path.join(ROOT, 'examples', 'smoke-arithmetic.n3'), 'utf8');
    const localSmokeArithmeticTrig = fs.readFileSync(path.join(ROOT, 'examples', 'input', 'smoke-arithmetic.trig'), 'utf8');
    const localSudoku = fs.readFileSync(path.join(ROOT, 'examples', 'sudoku.n3'), 'utf8');
    const localSudokuBuiltin = fs.readFileSync(path.join(ROOT, 'examples', 'builtin', 'sudoku.js'), 'utf8');

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

      // GitHub raw references used by playground.html for the "latest version" display.
      [
        'https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/package.json',
        { ct: 'application/json', body: localPkg },
      ],
      [
        'https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/eyeling.js',
        { ct: 'application/javascript', body: localEyeling },
      ],
      [
        'https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/examples/smoke-arithmetic.n3',
        { ct: 'text/plain', body: localSmokeArithmetic },
      ],
      [
        'https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/examples/input/smoke-arithmetic.trig',
        { ct: 'text/plain', body: localSmokeArithmeticTrig },
      ],
      [
        'https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/examples/sudoku.n3',
        { ct: 'text/plain', body: localSudoku },
      ],
      [
        'https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/examples/builtin/sudoku.js',
        { ct: 'application/javascript', body: localSudokuBuiltin },
      ],
      [
        'https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/examples/input/sudoku.trig',
        { code: 404, ct: 'text/plain', body: 'not found' },
      ],
    ]);

    async function getText(url) {
      return new Promise((resolve, reject) => {
        http
          .get(url, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
          })
          .on('error', reject);
      });
    }

    beginTest('clean /playground URL serves the playground');
    const cleanRes = await getText(cleanPlaygroundUrl);
    assert.equal(cleanRes.statusCode, 200, 'clean /playground URL should serve the playground');
    assert.match(cleanRes.body, /Eyeling N3 Playground/, 'clean /playground URL should load the playground');
    endTest();

    beginTest('legacy /demo URL serves the redirect page');
    const legacyRes = await getText(legacyDemoUrl);
    assert.equal(legacyRes.statusCode, 200, 'legacy /demo URL should serve redirect page');
    assert.match(legacyRes.body, /playground/, 'legacy /demo URL should point to the playground');
    endTest();

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
              responseCode: hit.code || 200,
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
    const nav = await cdp.send('Page.navigate', { url: playgroundUrl }, sessionId);
    assert.ok(!nav.errorText, `playground.html navigation failed: ${nav.errorText}`);
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
        throw new Error(`Uncaught exception in playground.html: ${JSON.stringify(exceptions[0] || {})}`);
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
        const renderedPanel = document.getElementById('output-rendered');
        const outputTabs = document.querySelector('.output-tabs');
        const renderedTab = document.getElementById('output-rendered-tab');
        const sourceTab = document.getElementById('output-source-tab');
        const sourceWrapper = document.getElementById('output-source');
        return {
          status: statusEl ? String(statusEl.textContent || '') : '',
          output: outputCm && typeof outputCm.getValue === 'function'
            ? String(outputCm.getValue() || '')
            : (outputTa ? String(outputTa.value || '') : ''),
          renderedText: renderedPanel ? String(renderedPanel.textContent || '') : '',
          renderedHtml: renderedPanel ? String(renderedPanel.innerHTML || '') : '',
          renderedHidden: renderedPanel ? !!renderedPanel.hidden : true,
          sourceHidden: sourceWrapper ? sourceWrapper.classList.contains('markdown-source-hidden') : true,
          outputTabsHidden: outputTabs ? !!outputTabs.hidden : true,
          renderedTabSelected: renderedTab ? renderedTab.getAttribute('aria-selected') === 'true' : false,
          sourceTabSelected: sourceTab ? sourceTab.getAttribute('aria-selected') === 'true' : false,
          shareStatus: document.getElementById('share-status') ? String(document.getElementById('share-status').textContent || '') : '',
          gistShareHidden: document.getElementById('create-gist-share-btn') ? !!document.getElementById('create-gist-share-btn').hidden : true,
          gistShareText: document.getElementById('create-gist-share-btn') ? String(document.getElementById('create-gist-share-btn').textContent || '').trim() : '',
          backgroundStatus: document.getElementById('background-status') ? String(document.getElementById('background-status').textContent || '') : '',
          href: String(window.location.href || ''),
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

    async function clickOutputSourceTab() {
      await evalInPage(`(() => {
        const btn = document.getElementById('output-source-tab');
        if (!btn) throw new Error('output-source-tab not found');
        btn.click();
        return true;
      })()`);
    }

    async function clickOutputRenderedTab() {
      await evalInPage(`(() => {
        const btn = document.getElementById('output-rendered-tab');
        if (!btn) throw new Error('output-rendered-tab not found');
        btn.click();
        return true;
      })()`);
    }

    async function makeShareUrlInPage() {
      return await evalInPage(`window.__eyelingPlaygroundMakeShareUrl()`);
    }

    async function makeShareUrlDiagnosticsInPage() {
      return await evalInPage(`(async () => {
        const url = await window.__eyelingPlaygroundMakeShareUrl();
        return {
          url,
          length: url.length,
          threshold: window.__eyelingPlaygroundGistShareThreshold,
          needsGistShare: window.__eyelingPlaygroundShouldOfferGistShare(url),
          hasEmbeddedState: window.__eyelingPlaygroundShareUrlHasEmbeddedState(url),
          stateUrlShare: window.__eyelingPlaygroundMakeShareUrlFromStateUrl('https://gist.githubusercontent.com/user/id/raw/eyeling-playground-state.json'),
        };
      })()`);
    }

    async function createGistBackedShareUrlWithStubInPage(token, response) {
      const payload = JSON.stringify({ token: String(token), response });
      return await evalInPage(`(async () => {
        const args = ${payload};
        const originalFetch = window.fetch;
        let seen = null;
        window.fetch = async (url, options) => {
          options = options || {};
          seen = {
            url: String(url || ''),
            options: {
              method: options.method,
              headers: options.headers,
              body: options.body,
              cache: options.cache,
              referrerPolicy: options.referrerPolicy,
              hasSignal: !!options.signal,
            },
          };
          return {
            ok: true,
            status: 200,
            json: async () => args.response,
          };
        };
        try {
          const state = {
            edit: (window.__cmStubsById && window.__cmStubsById['n3-editor']) ? window.__cmStubsById['n3-editor'].getValue() : '',
            url: '',
            loadbg: false,
            proofcomments: false,
            httpsderef: true,
          };
          const shareUrl = await window.__eyelingPlaygroundCreateGistBackedShareUrl(state, args.token);
          return { shareUrl, seen };
        } finally {
          window.fetch = originalFetch;
        }
      })()`);
    }

    async function loadUrlIntoEditor(url) {
      const payload = JSON.stringify(String(url));
      await evalInPage(`(() => {
        const input = document.getElementById('n3-uri');
        const asBackground = document.getElementById('load-as-background');
        const btn = document.getElementById('load-uri-btn');
        if (!input) throw new Error('n3-uri input not found');
        if (!btn) throw new Error('load-uri-btn not found');
        input.value = ${payload};
        if (asBackground) asBackground.checked = false;
        btn.click();
        return true;
      })()`);
    }


    async function setStreamMessageUrlMode(messageLogUrl) {
      const payload = JSON.stringify(String(messageLogUrl || ''));
      await evalInPage(`(() => {
        const rdf = document.getElementById('rdf-mode');
        const stream = document.getElementById('stream-messages');
        const input = document.getElementById('message-log-uri');
        if (!rdf) throw new Error('rdf-mode checkbox not found');
        if (!stream) throw new Error('stream-messages checkbox not found');
        if (!input) throw new Error('message-log-uri input not found');
        rdf.checked = true;
        rdf.dispatchEvent(new Event('change', { bubbles: true }));
        stream.checked = true;
        stream.dispatchEvent(new Event('change', { bubbles: true }));
        input.value = ${payload};
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return {
          visible: !document.getElementById('message-log-uri-row').hidden,
          label: document.getElementById('n3-editor-label').textContent,
        };
      })()`);
    }

    async function clearStreamMessageUrlMode() {
      await evalInPage(`(() => {
        const rdf = document.getElementById('rdf-mode');
        const stream = document.getElementById('stream-messages');
        const input = document.getElementById('message-log-uri');
        if (!rdf) throw new Error('rdf-mode checkbox not found');
        if (!stream) throw new Error('stream-messages checkbox not found');
        if (!input) throw new Error('message-log-uri input not found');
        stream.checked = false;
        stream.dispatchEvent(new Event('change', { bubbles: true }));
        rdf.checked = false;
        rdf.dispatchEvent(new Event('change', { bubbles: true }));
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
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
:report log:outputString """## Hello from output string

Line 2 with **bold** and [Eyeling](https://example.org/eyeling)
""" .
`;
    const riskMarkdownOutputStringProgram = `@prefix : <#> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
:report log:outputString """# Risk report

### Clause H1 — score 100

Risk: secondary use is permitted without a safeguard. Clause H1: Hospital may provide electronic health data for secondary use.

- **Mitigation for clause H1:** Require a permit before secondary use.
""" .
`;
    const baseOnlyMarkdownProgram = `@base <https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/examples/smoke-arithmetic.n3> .
@prefix : <#> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
:report log:outputString """# stateurl link base

[N3 rules](../smoke-arithmetic.n3)
[Input TriG](../input/smoke-arithmetic.trig)
""" .
`;
    const logQueryTurtleProgram = `@prefix : <#> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

:Socrates a :Human .
{ ?x a :Human } => { ?x a :Mortal } .
{ ?s ?p ?o } log:query { ?s ?p ?o } .
`;

    // 1) Baseline smoke test: the default program runs to completion.
    beginTest('playground runs the default Socrates program');
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
    assert.equal(baseline.outputTabsHidden, true, 'Expected plain Turtle output to hide Markdown tabs');
    assert.equal(baseline.renderedHidden, true, 'Expected plain Turtle output to skip rendered Markdown panel');
    assert.equal(baseline.sourceHidden, false, 'Expected plain Turtle output to show source directly');
    endTest();

    // 2) N3 syntax errors should be shown in Output and highlight the offending line.
    beginTest('playground shows syntax errors in Output and highlights the offending line');
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
    endTest();

    // 3) Inference fuse output should be visible in the Output pane.
    beginTest('playground clearly shows inference fuse output');
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
    endTest();

    // 4) log:outputString should render as clean text, not raw triples.
    beginTest('playground renders log:outputString Markdown with Rendered/Markdown source tabs');
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
    assert.match(rendered.output, /^## Hello from output string\n\nLine 2 with \*\*bold\*\*/m, 'Expected markdown source output');
    assert.doesNotMatch(
      rendered.output,
      /:report\s+log:outputString\s+"|# Derived triples/i,
      'Expected clean rendered output without raw triples',
    );
    assert.equal(rendered.outputTabsHidden, false, 'Expected Markdown output tabs to be visible for log:outputString');
    assert.equal(rendered.renderedHidden, false, 'Expected rendered Markdown tab to be visible by default');
    assert.equal(rendered.sourceHidden, true, 'Expected Markdown source tab to be hidden by default');
    assert.equal(rendered.renderedTabSelected, true, 'Expected Rendered tab to be selected by default');
    assert.match(rendered.renderedText, /Hello from output string/, 'Expected rendered Markdown text');
    assert.match(rendered.renderedHtml, /<h2>Hello from output string<\/h2>/i, 'Expected Markdown heading rendering');
    assert.match(rendered.renderedHtml, /<strong>bold<\/strong>/i, 'Expected Markdown bold rendering');
    assert.match(rendered.renderedHtml, /href="https:\/\/example\.org\/eyeling"/i, 'Expected Markdown link rendering');

    await clickOutputSourceTab();
    const sourceView = await getPlaygroundState();
    assert.equal(sourceView.outputTabsHidden, false, 'Expected Markdown output tabs to stay visible in source view');
    assert.equal(sourceView.sourceTabSelected, true, 'Expected Markdown source tab to be selectable');
    assert.equal(sourceView.renderedHidden, true, 'Expected rendered Markdown panel to hide after selecting source');
    assert.equal(sourceView.sourceHidden, false, 'Expected source editor to show after selecting source');
    assert.match(sourceView.output, /^## Hello from output string/m, 'Expected source tab to show markdown source');

    await clickOutputRenderedTab();
    const renderedAgain = await getPlaygroundState();
    assert.equal(renderedAgain.renderedTabSelected, true, 'Expected Rendered tab to be selectable again');
    endTest();

    beginTest('playground renders Markdown reports with colon-led prose lines');
    await setProgram(riskMarkdownOutputStringProgram);
    await clickRun();
    const riskMarkdown = await waitForState(
      'risk Markdown rendering',
      (st) =>
        String(st.status || '')
          .trim()
          .startsWith('Done') && /Risk report/.test(String(st.output || '')),
      20000,
    );
    assert.equal(riskMarkdown.outputTabsHidden, false, 'Expected risk-report Markdown tabs to be visible');
    assert.equal(riskMarkdown.renderedHidden, false, 'Expected risk-report Markdown to render by default');
    assert.equal(riskMarkdown.sourceHidden, true, 'Expected risk-report Markdown source to be hidden by default');
    assert.match(riskMarkdown.renderedHtml, /<h1>Risk report<\/h1>/i, 'Expected risk-report heading rendering');
    assert.match(riskMarkdown.renderedHtml, /<h3>Clause H1 — score 100<\/h3>/i, 'Expected risk-report clause heading rendering');
    assert.match(riskMarkdown.renderedHtml, /<strong>Mitigation for clause H1:<\/strong>/i, 'Expected risk-report mitigation bold rendering');
    endTest();

    // 5) Shared state files may only restore editor text. If that text came from a repository
    // example, the injected @base line should still give Markdown links the static output-page base.
    beginTest('playground resolves Markdown links from restored example base directives');
    await setProgram(baseOnlyMarkdownProgram);
    await clickRun();
    const baseOnlyMarkdown = await waitForState(
      'base-only Markdown output completion',
      (st) =>
        String(st.status || '')
          .trim()
          .startsWith('Done') && /stateurl link base/i.test(String(st.output || '')),
      20000,
    );
    assert.match(
      baseOnlyMarkdown.renderedHtml,
      new RegExp('href="' + started.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/examples/smoke-arithmetic\\.n3"'),
      'Expected restored-state Markdown source links to resolve against the static output page',
    );
    assert.match(
      baseOnlyMarkdown.renderedHtml,
      new RegExp('href="' + started.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/examples/input/smoke-arithmetic\\.trig"'),
      'Expected restored-state Markdown TriG links to resolve against the static output page',
    );
    endTest();

    // 6) Normal editing should not keep rewriting the browser URL with raw N3 content.
    beginTest('playground keeps the live URL short and creates compact share links on demand');
    await setProgram(outputStringProgram);
    const compactShareState = await getPlaygroundState();
    assert.doesNotMatch(compactShareState.href, /[?&](?:edit|program)=/, 'Expected live URL to avoid raw editor content');
    const compactShareUrl = await makeShareUrlInPage();
    const rawEditorUrlLength = playgroundUrl.length + '?edit='.length + encodeURIComponent(outputStringProgram).length;
    assert.match(compactShareUrl, /[?&]state=/, 'Expected an on-demand compact state parameter');
    assert.doesNotMatch(compactShareUrl, /[?&](?:edit|program)=/, 'Expected share link to avoid raw edit/program params');
    assert.ok(compactShareUrl.length < rawEditorUrlLength, 'Expected compact share URL to be shorter than raw editor URL');
    assert.equal(compactShareState.gistShareHidden, true, 'Expected ordinary compact share links to keep the Gist share option hidden');
    endTest();

    // 7) Very large edited programs should offer a Gist-backed share option instead of only a huge link.
    beginTest('playground offers a Gist-backed option for oversized state links');
    const longShareProgram = Array.from({ length: 1400 }, (_, i) => {
      const n = String(i).padStart(4, '0');
      const token = ((i * 2654435761) >>> 0).toString(36).padStart(7, '0');
      return `:s${n}_${token} :p${token}_${n} "literal-${n}-${token}-${i * 9973}" .`;
    }).join('\n');
    await setProgram(longShareProgram);
    const longShare = await makeShareUrlDiagnosticsInPage();
    assert.ok(longShare.length > longShare.threshold, `Expected test share URL to exceed threshold (${longShare.length} <= ${longShare.threshold})`);
    assert.equal(longShare.needsGistShare, true, 'Expected oversized embedded state to request a Gist-backed sharing option');
    assert.equal(longShare.hasEmbeddedState, true, 'Expected oversized edited program to be an embedded state link');
    assert.match(longShare.stateUrlShare, /[?&]stateurl=/, 'Expected stateurl= links to be supported for externally stored state');
    assert.doesNotMatch(longShare.stateUrlShare, /[?&]state=/, 'Expected externally stored state links to avoid embedded state payloads');
    const gistShare = await createGistBackedShareUrlWithStubInPage('github-gist-token-123', {
      files: {
        'eyeling-playground-state.json': {
          raw_url: 'https://gist.githubusercontent.com/user/id/raw/eyeling-playground-state.json',
        },
      },
    });
    assert.match(gistShare.shareUrl, /[?&]stateurl=/, 'Expected Gist-backed share URL to use a compact stateurl parameter');
    assert.doesNotMatch(gistShare.shareUrl, /[?&]state=/, 'Expected Gist-backed share URL not to embed the compressed state');
    assert.ok(gistShare.shareUrl.length < 300, 'Expected Gist-backed share URL to stay small');
    assert.equal(gistShare.seen.url, 'https://api.github.com/gists', 'Expected GitHub Gist create endpoint');
    assert.equal(gistShare.seen.options.method, 'POST', 'Expected GitHub Gist API POST request');
    assert.equal(gistShare.seen.options.headers.Authorization, 'Bearer github-gist-token-123', 'Expected bearer token authorization');
    assert.equal(gistShare.seen.options.referrerPolicy, 'no-referrer', 'Expected GitHub Gist API request not to send a long Referer');
    assert.match(String(gistShare.seen.options.body || ''), /"public":false/, 'Expected a secret Gist, not a public Gist');
    assert.match(String(gistShare.seen.options.body || ''), /eyeling-playground-state\.json/, 'Expected shared state to be saved as JSON');
    assert.match(String(gistShare.seen.options.body || ''), /\\"e\\":/, 'Expected compact editor state in the Gist payload');
    endTest();

    // 8) log:query can produce Turtle; that should stay in plain source output without Markdown tabs.
    beginTest('playground hides markdown tabs for Turtle log:query output');
    await setProgram(logQueryTurtleProgram);
    await clickRun();
    const logQueryTurtle = await waitForState(
      'log:query Turtle output completion',
      (st) =>
        String(st.status || '')
          .trim()
          .startsWith('Done') && /:Socrates\s+a\s+:Mortal\s*\./.test(String(st.output || '')),
      30000,
    );
    assert.match(logQueryTurtle.output, /:Socrates\s+a\s+:Human\s*\./, 'Expected Turtle-style source output');
    assert.match(logQueryTurtle.output, /:Socrates\s+a\s+:Mortal\s*\./, 'Expected inferred Turtle-style source output');
    assert.doesNotMatch(logQueryTurtle.output, /^#{1,6}\s+/m, 'Expected non-Markdown Turtle output');
    assert.equal(logQueryTurtle.outputTabsHidden, true, 'Expected Turtle log:query output to hide Markdown tabs');
    assert.equal(logQueryTurtle.renderedHidden, true, 'Expected Turtle log:query output to skip rendered Markdown panel');
    assert.equal(logQueryTurtle.sourceHidden, false, 'Expected Turtle log:query output to show source directly');
    endTest();

    beginTest('playground follows redirects while streaming RDF Messages from a URL');
    const streamMessageRules = `@prefix : <urn:test#> .
@prefix eymsg: <https://eyereasoner.github.io/eyeling/vocab/message#> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

{
  ?Envelope eymsg:payloadGraph ?Payload.
  ?Payload log:nameOf ?PayloadContext.
  ?PayloadContext log:includes { ?Subject :line ?Line. }.
} => {
  ?Subject :seen ?Line.
}.
`;
    await setProgram(streamMessageRules);
    await setStreamMessageUrlMode(started.baseUrl + '/redirect/playground-stream-messages.txt');
    await clickRun();
    const streamedMessages = await waitForState(
      'URL-backed RDF Message stream completion',
      (st) =>
        String(st.status || '')
          .trim()
          .startsWith('Done') && /:a\s+:seen\s+"one"\s*\./.test(String(st.output || '')),
      30000,
    );
    assert.match(streamedMessages.output, /:a\s+:seen\s+"one"\s*\./, 'Expected first streamed message to fire the rule');
    assert.match(streamedMessages.output, /:b\s+:seen\s+"two"\s*\./, 'Expected second streamed message to fire the rule');
    assert.doesNotMatch(streamedMessages.output, /@version|@message/i, 'Expected the message log to stay outside the editor/output text');
    const streamShareUrl = await makeShareUrlInPage();
    assert.match(streamShareUrl, /[?&]state=/, 'Expected stream-message URL state to be shared compactly');
    await clearStreamMessageUrlMode();
    endTest();

    // 10) URL-loaded examples should auto-load matching examples/input/<stem>.trig and run in RDF/TriG mode.
    beginTest('playground auto-loads companion TriG sidecars and uses RDF/TriG mode');
    await loadUrlIntoEditor('https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/examples/smoke-arithmetic.n3');
    const smokeLoaded = await waitForState(
      'smoke-arithmetic URL loaded with companion TriG input',
      (st) => /companion RDF\/TriG input/i.test(String(st.status || '')) && /input\/smoke-arithmetic\.trig/i.test(String(st.backgroundStatus || '')),
      20000,
    );
    assert.match(smokeLoaded.backgroundStatus, /smoke-arithmetic\.trig/i, 'Expected companion TriG sidecar in background status');
    await clickRun();
    const smoke = await waitForState(
      'URL-loaded smoke-arithmetic example completion with sidecar input',
      (st) =>
        String(st.status || '')
          .trim()
          .startsWith('Done') && /product = 42/i.test(String(st.output || '')),
      30000,
    );
    assert.match(smoke.output, /product = 42/i, 'Expected result derived from companion TriG evidence');
    assert.match(
      smoke.renderedHtml,
      new RegExp('href="' + started.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/examples/smoke-arithmetic\\.n3"'),
      'Expected relative Markdown source links to resolve against the static output page, not /playground',
    );
    assert.match(
      smoke.renderedHtml,
      new RegExp('href="' + started.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/examples/input/smoke-arithmetic\\.trig"'),
      'Expected relative Markdown TriG links to resolve against the static output page, not /playground',
    );
    assert.equal(smoke.outputTabsHidden, false, 'Expected smoke-arithmetic Markdown output tabs to be visible');
    assert.equal(smoke.renderedHidden, false, 'Expected smoke-arithmetic Markdown output to render by default');
    assert.equal(smoke.sourceHidden, true, 'Expected smoke-arithmetic Markdown source to be hidden by default');

    await clickOutputSourceTab();
    const smokeSourceView = await getPlaygroundState();
    assert.equal(smokeSourceView.sourceTabSelected, true, 'Expected smoke-arithmetic Markdown source tab to be selectable');
    assert.equal(smokeSourceView.renderedHidden, true, 'Expected smoke-arithmetic rendered panel to hide in source view');
    assert.equal(smokeSourceView.sourceHidden, false, 'Expected smoke-arithmetic source editor to show in source view');
    assert.match(smokeSourceView.output, /^# smoke-arithmetic/m, 'Expected smoke-arithmetic source tab to show Markdown source');

    await clickOutputRenderedTab();
    const smokeRenderedAgain = await getPlaygroundState();
    assert.equal(smokeRenderedAgain.renderedTabSelected, true, 'Expected smoke-arithmetic Rendered tab to be selectable again');
    assert.equal(smokeRenderedAgain.renderedHidden, false, 'Expected smoke-arithmetic rendered panel to show again');
    assert.equal(smokeRenderedAgain.sourceHidden, true, 'Expected smoke-arithmetic source editor to hide again');
    endTest();

    // 10) URL-loaded repository examples should auto-load matching examples/builtin/<stem>.js.
    beginTest('playground auto-loads a companion example builtin for URL-loaded Sudoku');
    await loadUrlIntoEditor('https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/examples/sudoku.n3');
    await waitForState(
      'sudoku URL loaded with companion builtin',
      (st) => /loaded n3 into the editor and loaded its example builtin/i.test(String(st.status || '')),
      20000,
    );
    const urlLoadedShareUrl = await makeShareUrlInPage();
    assert.match(urlLoadedShareUrl, /[?&]url=/, 'Expected URL-loaded examples to share as a short url= link');
    assert.doesNotMatch(urlLoadedShareUrl, /[?&]state=/, 'Expected unedited URL-loaded examples to avoid state payloads');
    await clickRun();
    const sudoku = await waitForState(
      'URL-loaded Sudoku example completion',
      (st) =>
        String(st.status || '')
          .trim()
          .startsWith('Done') && /The puzzle is solved/i.test(String(st.output || '')),
      60000,
    );
    assert.match(sudoku.output, /Completed grid/i, 'Expected Sudoku rendered output');
    assert.match(sudoku.output, /unique valid Sudoku solution/i, 'Expected Sudoku builtin-backed result');
    endTest();

    // 10) Ensure no uncaught runtime exceptions.
    beginTest('playground has no uncaught runtime exceptions');
    assert.equal(exceptions.length, 0, `Uncaught exceptions in playground.html: ${JSON.stringify(exceptions[0] || {})}`);
    endTest();

    // 11) Console errors are noisy and often indicate a broken UI.
    // (We suppress known noise like /favicon.ico on the server.)
    beginTest('playground has no console errors');
    assert.equal(consoleErrors.length, 0, `Console errors in playground.html: ${JSON.stringify(consoleErrors[0] || {})}`);
    endTest();

    // Cleanup.
    try {
      await cdp.send('Browser.close');
    } catch (_) {}
  } finally {
    await cleanup();
  }

  printSummary();
}

main().catch((e) => {
  if (!recordCurrentFailure()) nonTestFailure = true;
  printSummary();
  detail(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
