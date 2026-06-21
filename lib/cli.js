/**
 * Eyeling Reasoner — cli
 *
 * CLI helpers: argument handling, user-facing errors, and convenient wrappers
 * around the core engine for command-line usage.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL, fileURLToPath, URL } = require('node:url');
const { TextDecoder } = require('node:util');
const http = require('node:http');
const https = require('node:https');
const readline = require('node:readline');
const zlib = require('node:zlib');

const engine = require('./engine');
const deref = require('./deref');
const { PrefixEnv } = require('./prelude');
const { normalizeRdfCompatibility } = require('./lexer');
const { parseN3Text, mergeParsedDocuments } = require('./multisource');

function offsetToLineCol(text, offset) {
  const chars = Array.from(text);
  const n = Math.max(0, Math.min(typeof offset === 'number' ? offset : 0, chars.length));
  let line = 1;
  let col = 1;
  for (let i = 0; i < n; i++) {
    const c = chars[i];
    if (c === '\n') {
      line++;
      col = 1;
    } else if (c === '\r') {
      line++;
      col = 1;
      if (i + 1 < n && chars[i + 1] === '\n') i++; // swallow \n in CRLF
    } else {
      col++;
    }
  }
  return { line, col };
}

function formatN3SyntaxError(err, text, path) {
  const off = err && typeof err.offset === 'number' ? err.offset : null;
  const label = path ? String(path) : '<input>';
  if (off === null) {
    return `Syntax error in ${label}: ${err && err.message ? err.message : String(err)}`;
  }
  const { line, col } = offsetToLineCol(text, off);
  const lines = String(text).split(/\r\n|\n|\r/);
  const lineText = lines[line - 1] ?? '';
  const caret = ' '.repeat(Math.max(0, col - 1)) + '^';
  return `Syntax error in ${label}:${line}:${col}: ${err.message}\n${lineText}\n${caret}`;
}

// CLI entry point (invoked when eyeling.js is run directly)
function readTextFromStdinSync() {
  return fs.readFileSync(0, { encoding: 'utf8' });
}

function __isNetworkOrFileIri(s) {
  return typeof s === 'string' && /^(https?:|file:\/\/)/i.test(s);
}

function __isHttpSource(s) {
  return typeof s === 'string' && /^https?:/i.test(s);
}

function __sourceLabelToBaseIri(sourceLabel) {
  if (!sourceLabel || sourceLabel === '<stdin>') return '';
  if (__isNetworkOrFileIri(sourceLabel)) return deref.stripFragment(sourceLabel);
  return pathToFileURL(path.resolve(sourceLabel)).toString();
}

function __readInputSourceSync(sourceLabel) {
  if (sourceLabel === '<stdin>') return readTextFromStdinSync();

  if (__isNetworkOrFileIri(sourceLabel)) {
    const txt = deref.derefTextSync(sourceLabel);
    if (typeof txt !== 'string') throw new Error(`Failed to dereference ${sourceLabel}`);
    return txt;
  }

  return fs.readFileSync(sourceLabel, { encoding: 'utf8' });
}

function __httpFetchScriptBody({ prefixOnly = false } = {}) {
  return `
    const fs = require('fs');
    const http = require('http');
    const https = require('https');
    const zlib = require('zlib');
    const { URL } = require('url');
    const urlArg = process.argv[1];
    const outFile = process.argv[2] || '';
    const limit = Math.max(1, Number(process.argv[3] || 65536));
    const prefixOnly = ${prefixOnly ? 'true' : 'false'};
    const maxRedirects = 10;
    function requestUrl(u, redirects) {
      if (redirects > maxRedirects) { console.error('Too many redirects'); process.exit(3); }
      const parsed = new URL(u);
      const mod = parsed.protocol === 'https:' ? https : parsed.protocol === 'http:' ? http : null;
      if (!mod) { console.error('Unsupported protocol ' + parsed.protocol); process.exit(2); }
      const headers = {
        accept: 'text/n3, text/turtle, application/trig, application/n-triples, application/n-quads, text/plain;q=0.8, */*;q=0.01',
        'accept-encoding': 'identity',
        'user-agent': 'eyeling-rdf-message-stream'
      };
      if (prefixOnly) headers.range = 'bytes=0-' + String(limit - 1);
      const req = mod.request({
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        headers,
      }, (res) => {
        const sc = res.statusCode || 0;
        if (sc >= 300 && sc < 400 && res.headers && res.headers.location) {
          const next = new URL(res.headers.location, u).toString();
          res.resume();
          return requestUrl(next, redirects + 1);
        }
        if (sc < 200 || sc >= 300) {
          res.resume();
          console.error('HTTP status ' + sc);
          process.exit(4);
        }
        const enc = String((res.headers && res.headers['content-encoding']) || '').toLowerCase();
        let body = res;
        if (enc.includes('gzip')) body = res.pipe(zlib.createGunzip());
        else if (enc.includes('deflate')) body = res.pipe(zlib.createInflate());
        else if (enc.includes('br')) body = res.pipe(zlib.createBrotliDecompress());
        if (prefixOnly) {
          const chunks = [];
          let bytes = 0;
          let finished = false;
          function finish() {
            if (finished) return;
            finished = true;
            const buf = Buffer.concat(chunks, bytes).subarray(0, limit);
            process.stdout.write(buf.toString('utf8'));
            process.exit(0);
          }
          body.on('data', (chunk) => {
            if (finished) return;
            chunks.push(chunk);
            bytes += chunk.length;
            const text = Buffer.concat(chunks, bytes).toString('utf8');
            if (bytes >= limit || /^\\s*(?:@version|VERSION)\\s+(["'])(?:1\\.1|1\\.2|1\\.2-basic)-messages\\1\\s*\\.?\\s*(?:#.*)?$/im.test(text)) finish();
          });
          body.on('end', finish);
          body.on('error', (e) => { console.error(e && e.message ? e.message : String(e)); process.exit(5); });
          return;
        }
        const out = fs.createWriteStream(outFile);
        body.pipe(out);
        body.on('error', (e) => { console.error(e && e.message ? e.message : String(e)); process.exit(5); });
        out.on('error', (e) => { console.error(e && e.message ? e.message : String(e)); process.exit(6); });
        out.on('finish', () => process.exit(0));
      });
      req.on('error', (e) => { console.error(e && e.message ? e.message : String(e)); process.exit(5); });
      req.end();
    }
    requestUrl(urlArg, 0);
  `;
}

function __readHttpPrefixSync(sourceLabel, byteLimit = 64 * 1024) {
  const cp = require('node:child_process');
  const r = cp.spawnSync(process.execPath, ['-e', __httpFetchScriptBody({ prefixOnly: true }), sourceLabel, '', String(byteLimit)], {
    encoding: 'utf8',
    maxBuffer: byteLimit + 16 * 1024,
  });
  if (r.status !== 0) throw new Error(`Failed to dereference ${sourceLabel}${r.stderr ? ': ' + String(r.stderr).trim() : ''}`);
  return r.stdout;
}

function __openHttpTextStream(sourceLabel, redirects = 0) {
  const maxRedirects = 10;
  return new Promise((resolve, reject) => {
    if (redirects > maxRedirects) {
      reject(new Error('Too many redirects'));
      return;
    }

    let parsed;
    try {
      parsed = new URL(sourceLabel);
    } catch (e) {
      reject(e);
      return;
    }

    const mod = parsed.protocol === 'https:' ? https : parsed.protocol === 'http:' ? http : null;
    if (!mod) {
      reject(new Error(`Unsupported protocol ${parsed.protocol}`));
      return;
    }

    const req = mod.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        headers: {
          accept: 'text/n3, text/turtle, application/trig, application/n-triples, application/n-quads, text/plain;q=0.8, */*;q=0.01',
          'accept-encoding': 'identity',
          'user-agent': 'eyeling-rdf-message-stream',
        },
      },
      (res) => {
        const sc = res.statusCode || 0;
        if (sc >= 300 && sc < 400 && res.headers && res.headers.location) {
          const next = new URL(res.headers.location, sourceLabel).toString();
          res.resume();
          resolve(__openHttpTextStream(next, redirects + 1));
          return;
        }
        if (sc < 200 || sc >= 300) {
          res.resume();
          reject(new Error(`HTTP status ${sc}`));
          return;
        }

        const enc = String((res.headers && res.headers['content-encoding']) || '').toLowerCase();
        let body = res;
        if (enc.includes('gzip')) body = res.pipe(zlib.createGunzip());
        else if (enc.includes('deflate')) body = res.pipe(zlib.createInflate());
        else if (enc.includes('br')) body = res.pipe(zlib.createBrotliDecompress());
        resolve(body);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function forEachLineInHttpSource(sourceLabel, onLine) {
  const body = await __openHttpTextStream(sourceLabel);
  await new Promise((resolve, reject) => {
    let settled = false;
    function done(err) {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    }

    const rl = readline.createInterface({ input: body, crlfDelay: Infinity });
    rl.on('line', (line) => {
      try {
        onLine(line + '\n');
      } catch (e) {
        try { rl.close(); } catch {}
        if (body && typeof body.destroy === 'function') {
          try { body.destroy(); } catch {}
        }
        done(e);
      }
    });
    rl.on('close', () => done());
    rl.on('error', done);
    body.on('error', done);
  });
}

const RDF_MESSAGE_VERSION_RE = /^\s*(?:@version|VERSION)\s+(["'])(?:1\.1|1\.2|1\.2-basic)-messages\1\s*\.?\s*(?:#.*)?$/im;
const RDF_MESSAGE_VERSION_LINE_RE = /^\s*(?:@version|VERSION)\s+(["'])(?:1\.1|1\.2|1\.2-basic)-messages\1\s*\.?\s*(?:#.*)?$/i;
const RDF_DIRECTIVE_LINE_RE = /^\s*(?:@?(?:prefix|base)\b|PREFIX\b|BASE\b)/i;
const RDF_MESSAGE_DELIMITER_LINE_RE = /^\s*(?:MESSAGE\b|@message\s*\.?)\s*(?:#.*)?$/i;
const LOG_NAME_OF_IRI = '<http://www.w3.org/2000/10/swap/log#nameOf>';
const RDF_TYPE_IRI = '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>';
const XSD_INTEGER_IRI = '<http://www.w3.org/2001/XMLSchema#integer>';
const EYMSG_NS = 'https://eyereasoner.github.io/eyeling/vocab/message#';
const EYMSG_IRIS = Object.freeze({
  RDFMessageStream: `<${EYMSG_NS}RDFMessageStream>`,
  MessageEnvelope: `<${EYMSG_NS}MessageEnvelope>`,
  envelope: `<${EYMSG_NS}envelope>`,
  firstEnvelope: `<${EYMSG_NS}firstEnvelope>`,
  lastEnvelope: `<${EYMSG_NS}lastEnvelope>`,
  orderedEnvelopes: `<${EYMSG_NS}orderedEnvelopes>`,
  offset: `<${EYMSG_NS}offset>`,
  payloadGraph: `<${EYMSG_NS}payloadGraph>`,
  payloadKind: `<${EYMSG_NS}payloadKind>`,
  empty: `<${EYMSG_NS}empty>`,
  nonEmpty: `<${EYMSG_NS}nonEmpty>`,
});

function simpleHashText(s) {
  let h = 0x811c9dc5;
  const text = String(s || '');
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function __isLocalPathSource(sourceLabel) {
  return typeof sourceLabel === 'string' && sourceLabel !== '<stdin>' && !/^(https?:|file:\/\/)/i.test(sourceLabel);
}

function __localPathForSource(sourceLabel) {
  if (__isLocalPathSource(sourceLabel)) return sourceLabel;
  if (typeof sourceLabel === 'string' && /^file:\/\//i.test(sourceLabel)) return fileURLToPath(sourceLabel);
  return null;
}

function __sourceLooksLikeRdfMessageLogSync(sourceLabel) {
  const filePath = __localPathForSource(sourceLabel);
  if (filePath) {
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.allocUnsafe(64 * 1024);
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      return RDF_MESSAGE_VERSION_RE.test(buf.toString('utf8', 0, n));
    } finally {
      fs.closeSync(fd);
    }
  }
  if (__isHttpSource(sourceLabel)) {
    return RDF_MESSAGE_VERSION_RE.test(__readHttpPrefixSync(sourceLabel));
  }
  return RDF_MESSAGE_VERSION_RE.test(__readInputSourceSync(sourceLabel));
}

function stripRdfDirectiveLines(text) {
  return String(text || '')
    .split(/(?<=\r\n|\n|\r)/)
    .filter((line) => !RDF_DIRECTIVE_LINE_RE.test(line) && !RDF_MESSAGE_VERSION_LINE_RE.test(line))
    .join('');
}

function hasRdfPayload(text) {
  return String(text || '')
    .split(/\r\n|\n|\r/)
    .some((line) => {
      const trimmed = line.replace(/#.*$/g, '').trim();
      return trimmed && !RDF_DIRECTIVE_LINE_RE.test(trimmed) && !RDF_MESSAGE_VERSION_LINE_RE.test(trimmed);
    });
}

function addRdfDirective(directives, seen, line) {
  if (!RDF_DIRECTIVE_LINE_RE.test(line)) return;
  const key = line.trim();
  if (!key || seen.has(key)) return;
  seen.add(key);
  directives.push(line.endsWith('\n') || line.endsWith('\r') ? line : line + '\n');
}

function normalizeStreamingPayloadChunk(chunk, directives) {
  const prelude = directives.join('');
  const normalized = normalizeRdfCompatibility(prelude + String(chunk || ''));
  return stripRdfDirectiveLines(normalized).trim();
}

function buildSingleMessageReplayDocument({ sourceLabel, messageIndex, chunk, directives }) {
  const hash = simpleHashText(sourceLabel || '<stream>');
  const base = `urn:eyeling:message-stream:${hash}`;
  const padded = String(messageIndex).padStart(6, '0');
  const stream = `<${base}#stream>`;
  const envelope = `<${base}#m${padded}>`;
  const payload = `<${base}#m${padded}/payload>`;
  const body = normalizeStreamingPayloadChunk(chunk, directives);
  const hasBody = hasRdfPayload(body);
  const out = [];

  out.push(...directives.map((line) => line.trim()).filter(Boolean));
  out.push(`${stream} ${RDF_TYPE_IRI} ${EYMSG_IRIS.RDFMessageStream} .`);
  out.push(`${stream} ${EYMSG_IRIS.envelope} ${envelope} .`);
  out.push(`${stream} ${EYMSG_IRIS.orderedEnvelopes} (${envelope}) .`);
  out.push(`${stream} ${EYMSG_IRIS.firstEnvelope} ${envelope} .`);
  out.push(`${stream} ${EYMSG_IRIS.lastEnvelope} ${envelope} .`);
  out.push(`${envelope} ${RDF_TYPE_IRI} ${EYMSG_IRIS.MessageEnvelope} .`);
  out.push(`${envelope} ${EYMSG_IRIS.offset} "${messageIndex}"^^${XSD_INTEGER_IRI} .`);
  out.push(`${envelope} ${EYMSG_IRIS.payloadKind} ${hasBody ? EYMSG_IRIS.nonEmpty : EYMSG_IRIS.empty} .`);
  if (hasBody) {
    out.push(`${envelope} ${EYMSG_IRIS.payloadGraph} ${payload} .`);
    out.push(`${payload} ${LOG_NAME_OF_IRI} {`);
    out.push(body);
    out.push(`} .`);
  }
  return out.join('\n') + '\n';
}

function forEachRdfMessageChunkInText(text, onMessage) {
  const directives = [];
  const seenDirectives = new Set();
  let chunk = '';
  let messageIndex = 1;
  let sawVersion = false;
  let sawDelimiter = false;

  function emit() {
    onMessage({ messageIndex, chunk, directives: directives.slice() });
    messageIndex += 1;
    chunk = '';
  }

  const lines = String(text || '').match(/.*(?:\r\n|\n|\r)|.+$/g) || [];
  for (const line of lines) {
    if (RDF_MESSAGE_VERSION_LINE_RE.test(line)) {
      sawVersion = true;
      continue;
    }
    if (RDF_MESSAGE_DELIMITER_LINE_RE.test(line)) {
      emit();
      sawDelimiter = true;
      continue;
    }
    addRdfDirective(directives, seenDirectives, line);
    chunk += line;
  }
  if (!sawVersion) throw new Error('not an RDF Message Log: missing VERSION "*-messages" directive');
  if (sawDelimiter || hasRdfPayload(chunk)) emit();
}

function forEachLineInFileSync(filePath, onLine) {
  const fd = fs.openSync(filePath, 'r');
  const decoder = new TextDecoder('utf8');
  const buf = Buffer.allocUnsafe(64 * 1024);
  let carry = '';
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n === 0) break;
      carry += decoder.decode(buf.subarray(0, n), { stream: true });
      for (;;) {
        const m = /\r\n|\n|\r/.exec(carry);
        if (!m) break;
        const end = m.index + m[0].length;
        onLine(carry.slice(0, end));
        carry = carry.slice(end);
      }
    }
    carry += decoder.decode();
    if (carry) onLine(carry);
  } finally {
    fs.closeSync(fd);
  }
}

function forEachRdfMessageChunkInFileSync(filePath, onMessage) {
  const directives = [];
  const seenDirectives = new Set();
  let chunk = '';
  let messageIndex = 1;
  let sawVersion = false;
  let sawDelimiter = false;

  function emit() {
    onMessage({ messageIndex, chunk, directives: directives.slice() });
    messageIndex += 1;
    chunk = '';
  }

  forEachLineInFileSync(filePath, (line) => {
    if (RDF_MESSAGE_VERSION_LINE_RE.test(line)) {
      sawVersion = true;
      return;
    }
    if (RDF_MESSAGE_DELIMITER_LINE_RE.test(line)) {
      emit();
      sawDelimiter = true;
      return;
    }
    addRdfDirective(directives, seenDirectives, line);
    chunk += line;
  });

  if (!sawVersion) throw new Error('not an RDF Message Log: missing VERSION "*-messages" directive');
  if (sawDelimiter || hasRdfPayload(chunk)) emit();
}


function __forEachRdfMessageChunkSync(sourceLabel, onMessage) {
  const filePath = __localPathForSource(sourceLabel);
  if (filePath) {
    forEachRdfMessageChunkInFileSync(filePath, onMessage);
    return;
  }
  if (__isHttpSource(sourceLabel)) {
    throw new Error('internal error: HTTP RDF Message Logs must be streamed asynchronously');
  }
  forEachRdfMessageChunkInText(__readInputSourceSync(sourceLabel), onMessage);
}


async function forEachRdfMessageChunkInHttpSource(sourceLabel, onMessage) {
  const directives = [];
  const seenDirectives = new Set();
  let chunk = '';
  let messageIndex = 1;
  let sawVersion = false;
  let sawDelimiter = false;

  function emit() {
    onMessage({ messageIndex, chunk, directives: directives.slice() });
    messageIndex += 1;
    chunk = '';
  }

  await forEachLineInHttpSource(sourceLabel, (line) => {
    if (RDF_MESSAGE_VERSION_LINE_RE.test(line)) {
      sawVersion = true;
      return;
    }
    if (RDF_MESSAGE_DELIMITER_LINE_RE.test(line)) {
      emit();
      sawDelimiter = true;
      return;
    }
    addRdfDirective(directives, seenDirectives, line);
    chunk += line;
  });

  if (!sawVersion) throw new Error('not an RDF Message Log: missing VERSION "*-messages" directive');
  if (sawDelimiter || hasRdfPayload(chunk)) emit();
}

async function __forEachRdfMessageChunk(sourceLabel, onMessage) {
  if (__isHttpSource(sourceLabel)) {
    await forEachRdfMessageChunkInHttpSource(sourceLabel, onMessage);
    return;
  }
  __forEachRdfMessageChunkSync(sourceLabel, onMessage);
}

function factsContainOutputStrings(triplesForOutput) {
  const LOG_OUTPUT_STRING = 'http://www.w3.org/2000/10/swap/log#outputString';
  return (
    Array.isArray(triplesForOutput) &&
    triplesForOutput.some(
      (tr) => tr && tr.p && tr.p.constructor && tr.p.constructor.name === 'Iri' && tr.p.value === LOG_OUTPUT_STRING,
    )
  );
}

function programMayProduceOutputStrings(topLevelTriples, forwardRules, logQueryRules) {
  const hasOutputStringPredicate = (trs) => factsContainOutputStrings(trs);
  if (hasOutputStringPredicate(topLevelTriples)) return true;
  if (Array.isArray(forwardRules) && forwardRules.some((r) => hasOutputStringPredicate(r && r.conclusion))) return true;
  if (Array.isArray(logQueryRules) && logQueryRules.some((r) => hasOutputStringPredicate(r && r.conclusion))) return true;
  return false;
}

function runParsedDocumentOnce(mergedDocument, { rdfMode = false, outputPrefixes = null } = {}) {
  const prefixes = mergedDocument.prefixes;
  const triples = mergedDocument.triples;
  const frules = mergedDocument.frules;
  const brules = mergedDocument.brules;
  const qrules = mergedDocument.logQueryRules;

  engine.materializeRdfLists(triples, frules.concat(qrules || []), brules);
  const facts = triples.slice();
  const hasQueries = Array.isArray(qrules) && qrules.length;
  const mayAutoRenderOutputStrings = programMayProduceOutputStrings(triples, frules, qrules);

  let derived = [];
  let outTriples = [];
  let queryDerived = [];
  if (hasQueries) {
    const res = engine.forwardChainAndCollectLogQueryConclusions(facts, frules, brules, qrules, null, { captureExplanations: false, prefixes });
    derived = res.derived;
    outTriples = res.queryTriples;
    queryDerived = res.queryDerived || [];
  } else {
    const skipDerivedCollection = mayAutoRenderOutputStrings;
    derived = engine.forwardChain(facts, frules, brules, null, {
      captureExplanations: false,
      collectDerived: !skipDerivedCollection,
      prefixes,
    });
    outTriples = skipDerivedCollection ? [] : derived.map((df) => df.fact);
  }

  const renderedOutputTriples = hasQueries ? outTriples : facts;
  if (factsContainOutputStrings(renderedOutputTriples)) {
    process.stdout.write(engine.collectOutputStringsFromFacts(renderedOutputTriples, prefixes));
    return { facts, derived, outTriples, queryDerived, queryMode: !!hasQueries };
  }

  const outPrefixEnv = outputPrefixes || prefixes;
  if (rdfMode) {
    for (const tr of outTriples) console.log(engine.tripleToRdfCompatible(tr, outPrefixEnv));
  } else if (hasQueries) {
    const bodyText = engine.prettyPrintQueryTriples(outTriples, outPrefixEnv);
    if (bodyText) process.stdout.write(String(bodyText).replace(/\s*$/g, '') + '\n');
  } else {
    for (const df of derived) console.log(engine.tripleToN3(df.fact, outPrefixEnv));
  }
  return { facts, derived, outTriples, queryDerived, queryMode: !!hasQueries };
}

async function createCliStore({ storeName, storePath = null, storeClear = false } = {}) {
  if (!storeName) return null;
  return engine.createFactStore({ name: storeName, path: storePath || undefined, clear: !!storeClear });
}

async function persistRunResultToStore(store, runResult) {
  if (!store || !runResult) return;
  await store.batchAdd(runResult.facts || [], 'explicit');
  await store.batchAdd((runResult.derived || []).map((df) => df.fact), 'inferred');
  await store.batchAdd((runResult.queryDerived || []).map((df) => df.fact), 'inferred');
  await store.batchAdd(runResult.outTriples || [], 'inferred');
}

function sourceLooksLikeLineBasedRdf(sourceLabel) {
  if (typeof sourceLabel !== 'string') return false;
  const clean = sourceLabel.split(/[?#]/, 1)[0].toLowerCase();
  return /\.(?:nt|nq)(?:\.gz|\.br|\.deflate)?$/.test(clean);
}

function parseLineBasedRdfLine(line, { sourceLabel, lineNumber, rdfMode }) {
  const text = String(line || '');
  if (!text.trim() || /^\s*#/.test(text)) return [];
  const doc = parseN3Text(text, {
    baseIri: __sourceLabelToBaseIri(sourceLabel),
    label: `${sourceLabel}:${lineNumber}`,
    keepSourceArtifacts: false,
    sourceLocations: false,
    rdf: rdfMode,
  });
  return doc.triples || [];
}

async function ingestLineBasedRdfSourceToStore(sourceLabel, store, { rdfMode = true } = {}) {
  let lineNumber = 0;
  let count = 0;
  const onLine = async (line) => {
    lineNumber += 1;
    let triples;
    try {
      triples = parseLineBasedRdfLine(line, { sourceLabel, lineNumber, rdfMode });
    } catch (e) {
      if (e && e.name === 'N3SyntaxError') {
        throw new Error(formatN3SyntaxError(e, line, `${sourceLabel}:${lineNumber}`));
      }
      throw e;
    }
    count += await store.batchAdd(triples, 'explicit');
  };

  const filePath = __localPathForSource(sourceLabel);
  if (filePath) {
    const fd = fs.openSync(filePath, 'r');
    const decoder = new TextDecoder('utf8');
    const buf = Buffer.allocUnsafe(64 * 1024);
    let carry = '';
    try {
      for (;;) {
        const n = fs.readSync(fd, buf, 0, buf.length, null);
        if (n === 0) break;
        carry += decoder.decode(buf.subarray(0, n), { stream: true });
        for (;;) {
          const m = /\r\n|\n|\r/.exec(carry);
          if (!m) break;
          const end = m.index + m[0].length;
          await onLine(carry.slice(0, end));
          carry = carry.slice(end);
        }
      }
      carry += decoder.decode();
      if (carry) await onLine(carry);
    } finally {
      fs.closeSync(fd);
    }
    return count;
  }

  if (__isHttpSource(sourceLabel)) {
    const body = await __openHttpTextStream(sourceLabel);
    const rl = readline.createInterface({ input: body, crlfDelay: Infinity });
    for await (const line of rl) await onLine(line + '\n');
    return count;
  }

  const text = __readInputSourceSync(sourceLabel);
  for (const line of text.match(/.*(?:\r\n|\n|\r)|.+$/g) || []) await onLine(line);
  return count;
}


async function runStreamMessagesMode(sourceLabels, { rdfMode, storeName = null, storePath = null, storeClear = false } = {}) {
  const ordinarySourceLabels = [];
  const messageSourceLabels = [];

  for (const sourceLabel of sourceLabels) {
    try {
      if (__sourceLooksLikeRdfMessageLogSync(sourceLabel)) messageSourceLabels.push(sourceLabel);
      else ordinarySourceLabels.push(sourceLabel);
    } catch (e) {
      console.error(`Error reading source ${JSON.stringify(sourceLabel)}: ${e && e.message ? e.message : String(e)}`);
      process.exit(1);
    }
  }

  if (!messageSourceLabels.length) {
    console.error('Error: --stream-messages did not find any RDF Message Log input.');
    process.exit(1);
  }

  const programSources = [];
  for (const sourceLabel of ordinarySourceLabels) {
    let text;
    try {
      text = __readInputSourceSync(sourceLabel);
    } catch (e) {
      if (sourceLabel === '<stdin>') console.error(`Error reading stdin: ${e.message}`);
      else console.error(`Error reading source ${JSON.stringify(sourceLabel)}: ${e.message}`);
      process.exit(1);
    }

    try {
      programSources.push(
        parseN3Text(text, {
          baseIri: __sourceLabelToBaseIri(sourceLabel),
          label: sourceLabel,
          keepSourceArtifacts: false,
          sourceLocations: false,
          rdf: rdfMode,
        }),
      );
    } catch (e) {
      if (e && e.name === 'N3SyntaxError') {
        console.error(formatN3SyntaxError(e, text, sourceLabel));
        process.exit(1);
      }
      throw e;
    }
  }

  const store = await createCliStore({ storeName, storePath, storeClear });
  let pendingStoreWrites = Promise.resolve();

  const fullIriPrefixes = new PrefixEnv({});
  try {
    for (const messageSourceLabel of messageSourceLabels) {
      try {
        await __forEachRdfMessageChunk(messageSourceLabel, ({ messageIndex, chunk, directives }) => {
          const messageText = buildSingleMessageReplayDocument({
            sourceLabel: messageSourceLabel,
            messageIndex,
            chunk,
            directives,
          });
          let messageDoc;
          try {
            messageDoc = parseN3Text(messageText, {
              baseIri: `${__sourceLabelToBaseIri(messageSourceLabel)}#message-${messageIndex}`,
              label: `${messageSourceLabel}#message-${messageIndex}`,
              keepSourceArtifacts: false,
              sourceLocations: false,
              rdf: false,
            });
          } catch (e) {
            if (e && e.name === 'N3SyntaxError') {
              console.error(formatN3SyntaxError(e, messageText, `${messageSourceLabel}#message-${messageIndex}`));
              process.exit(1);
            }
            throw e;
          }

          const merged = mergeParsedDocuments(programSources.concat([messageDoc]));
          const result = runParsedDocumentOnce(merged, { rdfMode, outputPrefixes: fullIriPrefixes });
          if (store) pendingStoreWrites = pendingStoreWrites.then(() => persistRunResultToStore(store, result));
        });
      } catch (e) {
        console.error(`Error streaming RDF Message Log ${JSON.stringify(messageSourceLabel)}: ${e && e.message ? e.message : String(e)}`);
        process.exit(1);
      }
    }
    await pendingStoreWrites;
  } finally {
    if (store && typeof store.close === 'function') await store.close();
  }
}

async function main() {
  // Drop "node" and script name; keep only user-provided args
  // Expand combined short options: -pt == -p -t
  const argvRaw = process.argv.slice(2);
  const argv = [];
  for (const a of argvRaw) {
    if (a === '-' || !a.startsWith('-') || a.startsWith('--') || a.length === 2) {
      argv.push(a);
      continue;
    }
    // Combined short flags (the long --builtin option takes a value)
    for (const ch of a.slice(1)) argv.push('-' + ch);
  }
  const prog = String(process.argv[1] || 'eyeling')
    .split(/\//)
    .pop();

  function printHelp(toStderr = false) {
    const msg =
      `Usage: ${prog} [options] [file-or-url.n3|- ...]\n\n` +
      `When no file is given and stdin is piped, read N3 from stdin.\n` +
      `When multiple inputs are given, parse each source separately, merge ASTs, then reason once.\n\n` +
      `Options:\n` +
      `  -a, --ast                    Print parsed AST as JSON and exit.\n` +
      `      --builtin <module.js>    Load a custom builtin module (repeatable).\n` +
      `  -d, --deterministic-skolem   Make log:skolem stable across reasoning runs.\n` +
      `  -e, --enforce-https          Rewrite http:// IRIs to https:// for log dereferencing builtins.\n` +
      `  -h, --help                   Show this help and exit.\n` +
      `  -p, --proof                  Enable proof explanations.\n` +
      `  -r, --rdf                    Enable RDF/TriG input/output compatibility.\n` +
      `      --stream-messages        Process RDF Message Logs one message at a time under -r.\n` +
      `      --store <name>           Use an optional persistent fact store.\n` +
      `      --store-clear            Clear the named store before this run.\n` +
      `      --store-path <dir>       Node.js persistent store directory.\n` +
      `  -s, --super-restricted       Disable all builtins except => and <=.\n` +
      `  -t, --stream                 Stream derived triples as soon as they are derived.\n` +
      `  -v, --version                Print version and exit.\n`;
    (toStderr ? console.error : console.log)(msg);
  }

  // --help / -h: print help and exit
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp(false);
    process.exit(0);
  }

  // --version / -v: print version and exit
  if (argv.includes('--version') || argv.includes('-v')) {
    console.log(`eyeling v${engine.version}`);
    process.exit(0);
  }

  const builtinModules = [];
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--builtin') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        console.error('Error: --builtin expects a module path.');
        process.exit(1);
      }
      builtinModules.push(next);
      i += 1;
      continue;
    }
    if (typeof a === 'string' && a.startsWith('--builtin=')) {
      builtinModules.push(a.slice('--builtin='.length));
      continue;
    }
    if (a === '--store') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        console.error('Error: --store expects a store name.');
        process.exit(1);
      }
      argv.__storeName = next;
      i += 1;
      continue;
    }
    if (typeof a === 'string' && a.startsWith('--store=')) {
      argv.__storeName = a.slice('--store='.length);
      continue;
    }
    if (a === '--store-path') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        console.error('Error: --store-path expects a directory path.');
        process.exit(1);
      }
      argv.__storePath = next;
      i += 1;
      continue;
    }
    if (typeof a === 'string' && a.startsWith('--store-path=')) {
      argv.__storePath = a.slice('--store-path='.length);
      continue;
    }
    if (a === '--store-clear') continue;
    if (a === '-' || !a.startsWith('-')) positional.push(a);
  }

  const showAst = argv.includes('--ast') || argv.includes('-a');
  const streamMode = argv.includes('--stream') || argv.includes('-t');
  const streamMessagesMode = argv.includes('--stream-messages');
  const rdfMode = argv.includes('--rdf') || argv.includes('-r');
  const storeName = argv.__storeName || null;
  const storePath = argv.__storePath || null;
  const storeClear = argv.includes('--store-clear');

  // --enforce-https: rewrite http:// -> https:// for log dereferencing builtins
  if (argv.includes('--enforce-https') || argv.includes('-e')) {
    engine.setEnforceHttpsEnabled(true);
  }

  // --deterministic-skolem / -d: make log:skolem stable across runs
  if (argv.includes('--deterministic-skolem') || argv.includes('-d')) {
    if (typeof engine.setDeterministicSkolemEnabled === 'function') engine.setDeterministicSkolemEnabled(true);
  }

  // --proof / -p: enable proof explanations as N3 proof graphs
  if (argv.includes('--proof') || argv.includes('--proof-comments') || argv.includes('-p')) {
    engine.setProofCommentsEnabled(true);
  }

  // --super-restricted / -s: disable all builtins except => / <=
  if (argv.includes('--super-restricted') || argv.includes('-s')) {
    if (typeof engine.setSuperRestrictedMode === 'function') engine.setSuperRestrictedMode(true);
  }


  if (streamMessagesMode) {
    if (!rdfMode) {
      console.error('Error: --stream-messages requires -r/--rdf.');
      process.exit(1);
    }
    if (showAst) {
      console.error('Error: --stream-messages cannot be combined with --ast.');
      process.exit(1);
    }
    if (streamMode) {
      console.error('Error: --stream-messages cannot be combined with --stream.');
      process.exit(1);
    }
    if (engine.getProofCommentsEnabled()) {
      console.error('Error: --stream-messages currently does not support proof output.');
      process.exit(1);
    }
  }

  // Positional args (one or more N3 sources).
  const useImplicitStdin = positional.length === 0 && !process.stdin.isTTY;
  if (positional.length === 0 && !useImplicitStdin) {
    printHelp(false);
    process.exit(0);
  }

  for (const spec of builtinModules) {
    try {
      if (typeof engine.loadBuiltinModule === 'function')
        engine.loadBuiltinModule(spec, { resolveFrom: process.cwd() });
    } catch (e) {
      console.error(`Error loading builtin module ${JSON.stringify(spec)}: ${e && e.message ? e.message : String(e)}`);
      process.exit(1);
    }
  }

  let sourceLabels = useImplicitStdin ? ['<stdin>'] : positional.map((item) => (item === '-' ? '<stdin>' : item));
  if (sourceLabels.filter((item) => item === '<stdin>').length > 1) {
    console.error('Error: stdin can only be used once.');
    process.exit(1);
  }

  if (streamMessagesMode) {
    await runStreamMessagesMode(sourceLabels, { rdfMode, storeName, storePath, storeClear });
    return;
  }

  if (storeName && rdfMode) {
    const lineBasedSources = sourceLabels.filter(sourceLooksLikeLineBasedRdf);
    if (lineBasedSources.length) {
      if (showAst) {
        console.error('Error: line-based --store ingestion cannot be combined with --ast.');
        process.exit(1);
      }
      if (streamMode) {
        console.error('Error: line-based --store ingestion cannot be combined with --stream.');
        process.exit(1);
      }
      if (engine.getProofCommentsEnabled()) {
        console.error('Error: line-based --store ingestion currently does not support proof output.');
        process.exit(1);
      }

      const store = await createCliStore({ storeName, storePath, storeClear });
      try {
        for (const sourceLabel of lineBasedSources) {
          try {
            await ingestLineBasedRdfSourceToStore(sourceLabel, store, { rdfMode });
          } catch (e) {
            console.error(`Error streaming RDF source ${JSON.stringify(sourceLabel)}: ${e && e.message ? e.message : String(e)}`);
            process.exit(1);
          }
        }

        sourceLabels = sourceLabels.filter((sourceLabel) => !sourceLooksLikeLineBasedRdf(sourceLabel));
        if (!sourceLabels.length) return;

        const parsedRuleSources = [];
        for (const sourceLabel of sourceLabels) {
          let text;
          try {
            text = __readInputSourceSync(sourceLabel);
          } catch (e) {
            if (sourceLabel === '<stdin>') console.error(`Error reading stdin: ${e.message}`);
            else console.error(`Error reading source ${JSON.stringify(sourceLabel)}: ${e.message}`);
            process.exit(1);
          }

          try {
            parsedRuleSources.push(
              parseN3Text(text, {
                baseIri: __sourceLabelToBaseIri(sourceLabel),
                label: sourceLabel,
                collectUsedPrefixes: false,
                keepSourceArtifacts: false,
                sourceLocations: false,
                rdf: rdfMode,
              }),
            );
          } catch (e) {
            if (e && e.name === 'N3SyntaxError') {
              console.error(formatN3SyntaxError(e, text, sourceLabel));
              process.exit(1);
            }
            throw e;
          }
        }

        const mergedRuleDocument = mergeParsedDocuments(parsedRuleSources);
        const result = await engine.runStoreBacked(mergedRuleDocument, store, { rdf: rdfMode });
        const outTriples = result.queryMode ? result.queryTriples || [] : (result.derived || []).map((df) => df.fact);
        if (result.queryMode) {
          const bodyText = engine.prettyPrintQueryTriples(outTriples, result.prefixes);
          if (bodyText) process.stdout.write(String(bodyText).replace(/\s*$/g, '') + '\n');
        } else {
          for (const tr of outTriples) console.log(engine.tripleToRdfCompatible(tr, result.prefixes));
        }
        return;
      } finally {
        if (store && typeof store.close === 'function') await store.close();
      }
    }
  }

  const parsedSources = [];
  for (const sourceLabel of sourceLabels) {
    let text;
    try {
      text = __readInputSourceSync(sourceLabel);
    } catch (e) {
      if (sourceLabel === '<stdin>') console.error(`Error reading stdin: ${e.message}`);
      else console.error(`Error reading source ${JSON.stringify(sourceLabel)}: ${e.message}`);
      process.exit(1);
    }

    try {
      parsedSources.push(
        parseN3Text(text, {
          baseIri: __sourceLabelToBaseIri(sourceLabel),
          label: sourceLabel,
          collectUsedPrefixes: streamMode,
          keepSourceArtifacts: false,
          sourceLocations: engine.getProofCommentsEnabled(),
          rdf: rdfMode,
        }),
      );
    } catch (e) {
      if (e && e.name === 'N3SyntaxError') {
        console.error(formatN3SyntaxError(e, text, sourceLabel));
        process.exit(1);
      }
      throw e;
    }
  }

  const mergedDocument = mergeParsedDocuments(parsedSources);
  const prefixes = mergedDocument.prefixes;
  const triples = mergedDocument.triples;
  const frules = mergedDocument.frules;
  const brules = mergedDocument.brules;
  const qrules = mergedDocument.logQueryRules;
  if (showAst) {
    function astReplacer(unusedJsonKey, value) {
      if (value instanceof Set) return Array.from(value);
      if (value && typeof value === 'object' && value.constructor) {
        const t = value.constructor.name;
        if (t && t !== 'Object' && t !== 'Array') return { _type: t, ...value };
      }
      return value;
    }
    // For backwards compatibility, --ast prints exactly four top-level elements:
    //   [prefixes, triples, forwardRules, backwardRules]
    // log:query directives are output-selection statements and are not included
    // in the legacy AST contract expected by test suites and downstream tools.
    console.log(JSON.stringify([prefixes, triples, frules, brules], astReplacer, 2));
    process.exit(0);
  }

  // Materialize anonymous rdf:first/rdf:rest collections into list terms.
  // Named list nodes keep identity; list:* builtins can traverse them.
  engine.materializeRdfLists(triples, frules.concat(qrules || []), brules);

  // Keep non-ground top-level facts too (e.g., universally quantified N3 vars)
  // so they can participate in rule matching. Derived/output facts remain
  // ground-gated in the engine.
  const facts = triples.slice();

  const LOG_OUTPUT_STRING = 'http://www.w3.org/2000/10/swap/log#outputString';

  function programMayProduceOutputStrings(topLevelTriples, forwardRules, logQueryRules) {
    const hasOutputStringPredicate = (trs) =>
      Array.isArray(trs) &&
      trs.some(
        (tr) => tr && tr.p && tr.p.constructor && tr.p.constructor.name === 'Iri' && tr.p.value === LOG_OUTPUT_STRING,
      );

    if (hasOutputStringPredicate(topLevelTriples)) return true;
    if (Array.isArray(forwardRules) && forwardRules.some((r) => hasOutputStringPredicate(r && r.conclusion)))
      return true;
    if (Array.isArray(logQueryRules) && logQueryRules.some((r) => hasOutputStringPredicate(r && r.conclusion)))
      return true;
    return false;
  }

  
function factsContainOutputStrings(triplesForOutput) {
    return (
      Array.isArray(triplesForOutput) &&
      triplesForOutput.some(
        (tr) => tr && tr.p && tr.p.constructor && tr.p.constructor.name === 'Iri' && tr.p.value === LOG_OUTPUT_STRING,
      )
    );
  }

  // In --stream mode we print prefixes *before* any derivations happen.
  // To keep the header small and stable, emit only prefixes that are actually
  // used (as QNames) in the *input* N3 program.
  function restrictPrefixEnv(prefEnv, usedSet) {
    const m = {};
    for (const p of usedSet) {
      if (Object.prototype.hasOwnProperty.call(prefEnv.map, p)) {
        m[p] = prefEnv.map[p];
      }
    }
    return new PrefixEnv(m, prefEnv.baseIri || '');
  }

  // Streaming mode: print (input) prefixes first, then print derived triples as soon as they are found.
  // Note: when log:query directives are present, we cannot stream output because
  // the selected results depend on the saturated closure.
  const hasQueries = Array.isArray(qrules) && qrules.length;
  const mayAutoRenderOutputStrings = programMayProduceOutputStrings(triples, frules, qrules);

  if (storeName) {
    if (streamMode) {
      console.error('Error: --store cannot be combined with --stream yet.');
      process.exit(1);
    }

    const storeResult = await engine.runAsync(
      { prefixes, triples, frules, brules, logQueryRules: qrules },
      {
        proof: engine.getProofCommentsEnabled(),
        rdf: rdfMode,
        store: { name: storeName, clear: storeClear, path: storePath || undefined },
      },
    );

    const storeFacts = storeResult.facts || [];
    const storeDerived = storeResult.derived || [];
    const storeHasQueries = !!storeResult.queryMode;
    const storeOutTriples = storeHasQueries ? (storeResult.queryTriples || []) : (mayAutoRenderOutputStrings && !engine.getProofCommentsEnabled() ? [] : storeDerived.map((df) => df.fact));
    const storeOutDerived = storeHasQueries ? (storeResult.queryDerived || []) : storeDerived;
    const renderedOutputTriples = storeHasQueries ? storeOutTriples : storeFacts;

    if (factsContainOutputStrings(renderedOutputTriples)) {
      process.stdout.write(engine.collectOutputStringsFromFacts(renderedOutputTriples, prefixes));
      if (storeResult.store && typeof storeResult.store.close === 'function') await storeResult.store.close();
      return;
    }

    if (engine.getProofCommentsEnabled()) {
      process.stdout.write(engine.renderProofDocument(storeOutDerived, storeDerived.concat(storeOutDerived || []), triples, prefixes, brules));
      if (storeResult.store && typeof storeResult.store.close === 'function') await storeResult.store.close();
      return;
    }

    let bodyText = '';
    if (rdfMode) bodyText = storeOutTriples.map((tr) => engine.tripleToRdfCompatible(tr, prefixes)).join('\n');
    else if (storeHasQueries) bodyText = engine.prettyPrintQueryTriples(storeOutTriples, prefixes);

    let usedPrefixes = prefixes.prefixesUsedForOutput(storeOutTriples);
    if (rdfMode && bodyText) usedPrefixes = usedPrefixes.filter(([pfx]) => pfx === '' || bodyText.includes(pfx + ':'));

    if (rdfMode && bodyText.includes('<<(')) {
      console.log('VERSION "1.2"');
      console.log();
    }

    for (const [pfx, base] of usedPrefixes) {
      if (pfx === '') console.log(`@prefix : <${base}> .`);
      else console.log(`@prefix ${pfx}: <${base}> .`);
    }
    if (storeOutTriples.length && usedPrefixes.length) console.log();

    if (bodyText) process.stdout.write(String(bodyText).replace(/\s*$/g, '') + '\n');
    else {
      for (const df of storeOutDerived) {
        console.log(rdfMode ? engine.tripleToRdfCompatible(df.fact, prefixes) : engine.tripleToN3(df.fact, prefixes));
      }
    }

    if (storeResult.store && typeof storeResult.store.close === 'function') await storeResult.store.close();
    return;
  }

  if (streamMode && !hasQueries && !mayAutoRenderOutputStrings && !engine.getProofCommentsEnabled()) {
    const usedInInput = mergedDocument.usedPrefixes instanceof Set ? new Set(mergedDocument.usedPrefixes) : new Set();
    const outPrefixes = restrictPrefixEnv(prefixes, usedInInput);

    // Ensure log:trace uses the same compact prefix set as the output.
    engine.setTracePrefixes(outPrefixes);

    const entries = Object.entries(outPrefixes.map)
      .filter(([, base]) => !!base)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

    for (const [pfx, base] of entries) {
      if (pfx === '') console.log(`@prefix : <${base}> .`);
      else console.log(`@prefix ${pfx}: <${base}> .`);
    }
    if (entries.length) console.log();

    engine.forwardChain(
      facts,
      frules,
      brules,
      (df) => {
        if (engine.getProofCommentsEnabled()) {
          engine.printExplanation(df, outPrefixes);
          console.log(rdfMode ? engine.tripleToRdfCompatible(df.fact, outPrefixes) : engine.tripleToN3(df.fact, outPrefixes));
          console.log();
        } else {
          console.log(rdfMode ? engine.tripleToRdfCompatible(df.fact, outPrefixes) : engine.tripleToN3(df.fact, outPrefixes));
        }
      },
      { captureExplanations: engine.getProofCommentsEnabled(), prefixes: outPrefixes },
    );
    return;
  }

  // Default (non-streaming):
  // - without log:query: derive everything first, then print only newly derived facts
  // - with log:query: derive everything first, then print only unique instantiated
  //   conclusion triples from the log:query directives.
  let derived = [];
  let outTriples = [];
  let outDerived = [];

  if (hasQueries) {
    const res = engine.forwardChainAndCollectLogQueryConclusions(facts, frules, brules, qrules, null, { captureExplanations: engine.getProofCommentsEnabled(), prefixes });
    derived = res.derived;
    outTriples = res.queryTriples;
    outDerived = res.queryDerived;
  } else {
    const skipDerivedCollection = mayAutoRenderOutputStrings && !engine.getProofCommentsEnabled();
    derived = engine.forwardChain(facts, frules, brules, null, {
      captureExplanations: engine.getProofCommentsEnabled(),
      collectDerived: !skipDerivedCollection,
      prefixes,
    });
    outDerived = derived;
    outTriples = skipDerivedCollection ? [] : derived.map((df) => df.fact);
  }

  const renderedOutputTriples = hasQueries ? outTriples : facts;
  if (factsContainOutputStrings(renderedOutputTriples)) {
    process.stdout.write(engine.collectOutputStringsFromFacts(renderedOutputTriples, prefixes));
    return;
  }

  if (engine.getProofCommentsEnabled()) {
    process.stdout.write(engine.renderProofDocument(outDerived, derived.concat(outDerived || []), triples, prefixes, brules));
    return;
  }

  let bodyText = '';
  if (rdfMode && !engine.getProofCommentsEnabled()) {
    bodyText = outTriples.map((tr) => engine.tripleToRdfCompatible(tr, prefixes)).join('\n');
  } else if (hasQueries && !engine.getProofCommentsEnabled()) {
    // In log:query mode, when proof comments are disabled, pretty-print blank-node
    // shaped outputs as Turtle property lists ("[ ... ] .") for readability.
    bodyText = engine.prettyPrintQueryTriples(outTriples, prefixes);
  }

  let usedPrefixes = prefixes.prefixesUsedForOutput(outTriples);
  if (rdfMode && bodyText) {
    usedPrefixes = usedPrefixes.filter(([pfx]) => pfx === '' || bodyText.includes(pfx + ':'));
  }

  if (rdfMode && bodyText.includes('<<(')) {
    console.log('VERSION "1.2"');
    console.log();
  }

  for (const [pfx, base] of usedPrefixes) {
    if (pfx === '') console.log(`@prefix : <${base}> .`);
    else console.log(`@prefix ${pfx}: <${base}> .`);
  }
  if (outTriples.length && usedPrefixes.length) console.log();

  if (bodyText) {
    process.stdout.write(String(bodyText).replace(/\s*$/g, '') + '\n');
    return;
  }

  for (const df of outDerived) {
    if (engine.getProofCommentsEnabled()) {
      engine.printExplanation(df, prefixes);
      console.log(rdfMode ? engine.tripleToRdfCompatible(df.fact, prefixes) : engine.tripleToN3(df.fact, prefixes));
      console.log();
    } else {
      console.log(rdfMode ? engine.tripleToRdfCompatible(df.fact, prefixes) : engine.tripleToN3(df.fact, prefixes));
    }
  }
}

module.exports = { main, formatN3SyntaxError };
