/**
 * Eyeling Reasoner — deref
 *
 * Synchronous dereferencing + parsing support for log:content / log:semantics.
 * Includes small in-memory caches and optional HTTPS enforcement.
 */

'use strict';

// Dereferencing + parsing support for log:content / log:semantics.
// This is intentionally synchronous to keep the core engine synchronous.
// In browsers/workers, dereferencing uses synchronous XHR (subject to CORS).

const {
  LOG_NS,
  GraphTerm,
  Triple,
  internIri,
  internLiteral,
} = require('./prelude');

const { lex } = require('./lexer');
const { Parser } = require('./parser');

// -----------------------------------------------------------------------------
// Offline fixtures
// -----------------------------------------------------------------------------
// Some bundled examples (e.g. examples/reaching-out.n3) dereference well-known
// W3C resources. To keep the test suite runnable offline (CI, air-gapped
// environments), we ship a tiny set of built-in fixtures.
//
// IMPORTANT: keys must be *document* IRIs (no fragment).

const __OFFLINE_FIXTURES = new Map([
  [
    'https://www.w3.org/2000/10/swap/test/s1.n3',
    // Exact content of https://www.w3.org/2000/10/swap/test/s1.n3
    // (kept byte-for-byte stable to match examples/output/reaching-out.n3)
    [
      '# Schema for test data',
      '#',
      '# This is only ',
      '@prefix daml: <http://www.daml.org/2001/03/daml+oil#> .',
      '@prefix mech: <#> .',
      '',
      '@prefix : <#> .',
      '',
      ':includes a daml:TransitiveProperty .',
      '',
      ':partOf a daml:TransitiveProperty; daml:inverseOf :includes .',
      '',
      ':dependsOn a daml:TransitiveProperty ;',
      '      daml:hasSubProperty  :includes .   # Real name of subproperty?',
      '',
      '',
      '',
      '',
      '',
    ].join('\n'),
  ],
  // Also accept the http:// form when --enforce-https is disabled.
  [
    'http://www.w3.org/2000/10/swap/test/s1.n3',
    [
      '# Schema for test data',
      '#',
      '# This is only ',
      '@prefix daml: <http://www.daml.org/2001/03/daml+oil#> .',
      '@prefix mech: <#> .',
      '',
      '@prefix : <#> .',
      '',
      ':includes a daml:TransitiveProperty .',
      '',
      ':partOf a daml:TransitiveProperty; daml:inverseOf :includes .',
      '',
      ':dependsOn a daml:TransitiveProperty ;',
      '      daml:hasSubProperty  :includes .   # Real name of subproperty?',
      '',
      '',
      '',
      '',
      '',
    ].join('\n'),
  ],
  // (Duplicate key removed; the entry above already covers http://.)
]);

// Larger example programs sometimes dereference files that are shipped inside
// this package (e.g. examples/shacl-conforms.n3). To keep these examples
// runnable offline, mirror a small set of well-known HTTP(S) document IRIs to
// local files.
//
// IMPORTANT: keys must be *document* IRIs (no fragment).
// Values are repo-relative paths from the package root.
const __OFFLINE_LOCAL_MIRRORS = new Map([
  [
    'https://eyereasoner.github.io/eyeling/examples/eventual-interoperability-interaction-patterns.n3',
    'examples/eventual-interoperability-interaction-patterns.n3',
  ],
  [
    'http://eyereasoner.github.io/eyeling/examples/eventual-interoperability-interaction-patterns.n3',
    'examples/eventual-interoperability-interaction-patterns.n3',
  ],
]);

function __offlineFixtureTextForKey(key) {
  if (__OFFLINE_FIXTURES.has(key)) return __OFFLINE_FIXTURES.get(key);
  const rel = __OFFLINE_LOCAL_MIRRORS.get(key);
  if (!rel || !__IS_NODE) return null;
  try {
    const path = require('path');
    // In the source tree, deref.js lives in lib/, so the package root is one
    // directory up. In the bundled CLI (eyeling.js), __dirname is the package
    // root. Try both layouts.
    const abs1 = path.join(__dirname, '..', rel);
    const t1 = __readFileText(abs1);
    if (typeof t1 === 'string') return t1;

    const abs2 = path.join(__dirname, rel);
    const t2 = __readFileText(abs2);
    if (typeof t2 === 'string') return t2;

    return null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Caches (module-level)
// -----------------------------------------------------------------------------
// Key is the dereferenced document IRI *without* fragment.
const __logContentCache = new Map(); // iri -> string | null (null means fetch/read failed)
const __logSemanticsCache = new Map(); // iri -> GraphTerm | null (null means parse failed)
const __logSemanticsOrErrorCache = new Map(); // iri -> Term (GraphTerm | Literal) for log:semanticsOrError

// When enabled, force http:// IRIs to be dereferenced as https://
// (CLI: --enforce-https, API: reasonStream({ enforceHttps: true })).
let enforceHttpsEnabled = false;

function getEnforceHttpsEnabled() {
  return enforceHttpsEnabled;
}

function setEnforceHttpsEnabled(v) {
  enforceHttpsEnabled = !!v;
}

function __maybeEnforceHttps(iri) {
  if (!enforceHttpsEnabled) return iri;
  return typeof iri === 'string' && iri.startsWith('http://') ? 'https://' + iri.slice('http://'.length) : iri;
}

// Environment detection (Node vs Browser/Worker).
const __IS_NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node);

function __hasXmlHttpRequest() {
  return typeof XMLHttpRequest !== 'undefined';
}

function __resolveBrowserUrl(ref) {
  if (!ref) return ref;
  // If already absolute, keep as-is.
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) return ref;
  const base =
    (typeof document !== 'undefined' && document.baseURI) || (typeof location !== 'undefined' && location.href) || '';
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}

function __fetchHttpTextSyncBrowser(url) {
  if (!__hasXmlHttpRequest()) return null;
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false); // synchronous
    try {
      xhr.setRequestHeader(
        'Accept',
        'text/n3, text/turtle, application/n-triples, application/n-quads, text/plain;q=0.1, */*;q=0.01',
      );
    } catch {
      // Some environments restrict setting headers (ignore).
    }
    xhr.send(null);
    const sc = xhr.status || 0;
    if (sc < 200 || sc >= 300) return null;
    return xhr.responseText;
  } catch {
    return null;
  }
}

function normalizeDerefIri(iriNoFrag) {
  // In Node, treat non-http as local path; leave as-is.
  if (__IS_NODE) return __maybeEnforceHttps(iriNoFrag);
  // In browsers/workers, resolve relative references against the page URL.
  return __maybeEnforceHttps(__resolveBrowserUrl(iriNoFrag));
}

function stripFragment(iri) {
  const i = iri.indexOf('#');
  return i >= 0 ? iri.slice(0, i) : iri;
}

function __isHttpIri(iri) {
  return typeof iri === 'string' && (iri.startsWith('http://') || iri.startsWith('https://'));
}

function __isFileIri(iri) {
  return typeof iri === 'string' && iri.startsWith('file://');
}

function __fileIriToPath(fileIri) {
  // Basic file:// URI decoding. Handles file:///abs/path and file://localhost/abs/path.
  try {
    const u = new URL(fileIri);
    return decodeURIComponent(u.pathname);
  } catch {
    return decodeURIComponent(fileIri.replace(/^file:\/\//, ''));
  }
}

function __readFileText(pathOrFileIri) {
  if (!__IS_NODE) return null;
  const fs = require('fs');
  let path = pathOrFileIri;
  if (__isFileIri(pathOrFileIri)) path = __fileIriToPath(pathOrFileIri);
  try {
    return fs.readFileSync(path, { encoding: 'utf8' });
  } catch {
    return null;
  }
}

function __fetchHttpTextViaSubprocess(url) {
  if (!__IS_NODE) return null;
  const cp = require('child_process');
  // Use a subprocess so this code remains synchronous without rewriting the whole reasoner to async.
  const script = `
    const enforceHttps = ${enforceHttpsEnabled ? 'true' : 'false'};
    const url = process.argv[1];
    const maxRedirects = 10;
    function norm(u) {
      if (enforceHttps && typeof u === 'string' && u.startsWith('http://')) {
        return 'https://' + u.slice('http://'.length);
      }
      return u;
    }
    function get(u, n) {
      u = norm(u);
      if (n > maxRedirects) { console.error('Too many redirects'); process.exit(3); }
      let mod;
      if (u.startsWith('https://')) mod = require('https');
      else if (u.startsWith('http://')) mod = require('http');
      else { console.error('Not http(s)'); process.exit(2); }

      const { URL } = require('url');
      const uu = new URL(u);
      const opts = {
        protocol: uu.protocol,
        hostname: uu.hostname,
        port: uu.port || undefined,
        path: uu.pathname + uu.search,
        headers: {
          'accept': 'text/n3, text/turtle, application/n-triples, application/n-quads, text/plain;q=0.1, */*;q=0.01',
          // Ask for an uncompressed response when possible; some servers send
          // compressed bodies that are not valid UTF-8 text for the parser.
          // We still handle common encodings below if they are returned anyway.
          'accept-encoding': 'identity',
          'user-agent': 'eyeling-log-builtins'
        }
      };
      const req = mod.request(opts, (res) => {
        const sc = res.statusCode || 0;
        if (sc >= 300 && sc < 400 && res.headers && res.headers.location) {
          let next = new URL(res.headers.location, u).toString();
          next = norm(next);
          res.resume();
          return get(next, n + 1);
        }
        if (sc < 200 || sc >= 300) {
          res.resume();
          console.error('HTTP status ' + sc);
          process.exit(4);
        }
        const chunks = [];
        res.on('data', (c) => { chunks.push(c); });
        res.on('end', () => {
          try {
            const { Buffer } = require('buffer');
            const zlib = require('zlib');
            const buf = Buffer.concat(chunks);
            const enc = ((res.headers && res.headers['content-encoding']) || '').toString().toLowerCase();
            let out = buf;
            if (enc.includes('gzip')) out = zlib.gunzipSync(buf);
            else if (enc.includes('deflate')) out = zlib.inflateSync(buf);
            else if (enc.includes('br')) out = zlib.brotliDecompressSync(buf);
            process.stdout.write(out.toString('utf8'));
          } catch (e) {
            // Best-effort fallback: treat as UTF-8.
            try {
              const { Buffer } = require('buffer');
              process.stdout.write(Buffer.concat(chunks).toString('utf8'));
            } catch {
              process.exit(6);
            }
          }
        });
      });
      req.on('error', (e) => { console.error(e && e.message ? e.message : String(e)); process.exit(5); });
      req.end();
    }
    get(url, 0);
  `;
  const r = cp.spawnSync(process.execPath, ['-e', script, url], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) return null;
  return r.stdout;
}

function derefTextSync(iriNoFrag) {
  const norm = normalizeDerefIri(iriNoFrag);
  const key = typeof norm === 'string' && norm ? norm : iriNoFrag;

  if (__logContentCache.has(key)) return __logContentCache.get(key);

  // Offline fixtures (before attempting network / filesystem access).
  // This keeps bundled examples deterministic even without Internet access.
  const __fixtureTxt = __offlineFixtureTextForKey(key);
  if (__fixtureTxt !== null && typeof __fixtureTxt !== 'undefined') {
    __logContentCache.set(key, __fixtureTxt);
    return __fixtureTxt;
  }

  let text = null;

  if (__IS_NODE) {
    if (__isHttpIri(key)) {
      text = __fetchHttpTextViaSubprocess(key);
    } else {
      // Treat any non-http(s) IRI as a local path (including file://), for basic usability.
      text = __readFileText(key);
    }
  } else {
    // Browser / Worker: we can only dereference over HTTP(S), and it must pass CORS.
    const url = typeof norm === 'string' && norm ? norm : key;
    if (__isHttpIri(url)) text = __fetchHttpTextSyncBrowser(url);
  }

  __logContentCache.set(key, text);
  return text;
}

const __IMPLIES_PRED = internIri(LOG_NS + 'implies');
const __IMPLIED_BY_PRED = internIri(LOG_NS + 'impliedBy');

function parseSemanticsToFormula(text, baseIri) {
  const toks = lex(text);
  const parser = new Parser(toks);
  if (typeof baseIri === 'string' && baseIri) parser.prefixes.setBase(baseIri);

  const [_prefixes, triples, frules, brules] = parser.parseDocument();

  const all = triples.slice();

  // Represent top-level => / <= rules as triples between formula terms,
  // so the returned formula can include them.
  for (const r of frules) {
    const concTerm = r.isFuse ? internLiteral('false') : new GraphTerm(r.conclusion);
    all.push(new Triple(new GraphTerm(r.premise), __IMPLIES_PRED, concTerm));
  }
  for (const r of brules) {
    all.push(new Triple(new GraphTerm(r.conclusion), __IMPLIED_BY_PRED, new GraphTerm(r.premise)));
  }

  return new GraphTerm(all);
}

function derefSemanticsSync(iriNoFrag) {
  const norm = normalizeDerefIri(iriNoFrag);
  const key = typeof norm === 'string' && norm ? norm : iriNoFrag;
  if (__logSemanticsCache.has(key)) return __logSemanticsCache.get(key);

  const text = derefTextSync(iriNoFrag);
  if (typeof text !== 'string') {
    __logSemanticsCache.set(key, null);
    return null;
  }
  try {
    const baseIri = typeof key === 'string' && key ? key : iriNoFrag;
    const formula = parseSemanticsToFormula(text, baseIri);
    __logSemanticsCache.set(key, formula);
    return formula;
  } catch {
    __logSemanticsCache.set(key, null);
    return null;
  }
}

function __makeStringLiteral(str) {
  return internLiteral(JSON.stringify(str));
}

function derefSemanticsOrError(iriNoFrag) {
  const norm = normalizeDerefIri(iriNoFrag);
  const key = typeof norm === 'string' && norm ? norm : iriNoFrag;

  if (__logSemanticsOrErrorCache.has(key)) return __logSemanticsOrErrorCache.get(key);

  let term = null;

  // If we already successfully computed log:semantics, reuse it.
  const formula = derefSemanticsSync(iriNoFrag);

  if (formula instanceof GraphTerm) {
    term = formula;
  } else {
    // Try to get an informative error.
    const txt = derefTextSync(iriNoFrag);
    if (typeof txt !== 'string') {
      term = __makeStringLiteral(`error(dereference_failed,${iriNoFrag})`);
    } else {
      try {
        const baseIri = typeof key === 'string' && key ? key : iriNoFrag;
        term = parseSemanticsToFormula(txt, baseIri);
        // Keep the semantics cache consistent.
        __logSemanticsCache.set(key, term);
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        term = __makeStringLiteral(`error(parse_error,${msg})`);
      }
    }
  }

  __logSemanticsOrErrorCache.set(key, term);
  return term;
}

module.exports = {
  // flags
  getEnforceHttpsEnabled,
  setEnforceHttpsEnabled,

  // helpers
  stripFragment,
  normalizeDerefIri,

  // deref + parse
  derefTextSync,
  derefSemanticsSync,
  derefSemanticsOrError,
  parseSemanticsToFormula,

  // caches (exposed for tests/debugging if needed)
  __logContentCache,
  __logSemanticsCache,
  __logSemanticsOrErrorCache,
};
