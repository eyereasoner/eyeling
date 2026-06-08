/**
 * Fast RDF compatibility parser for line-oriented RDF inputs.
 *
 * This is deliberately conservative.  It directly builds Eyeling AST terms for
 * common RDF parser workloads (N-Triples-style Turtle, simple prefixed triples,
 * N-Quads, and RDF Message Logs) and returns null for richer N3/Turtle/TriG
 * constructs so the full lexer/parser remains the source of truth.
 */

'use strict';

const { N3SyntaxError, decodeN3StringEscapes } = require('./lexer');
const {
  RDF_NS,
  LOG_NS,
  XSD_NS,
  Blank,
  GraphTerm,
  ListTerm,
  Triple,
  PrefixEnv,
  internIri,
  internLiteral,
  resolveIriRef,
  annotateQuotedGraphTerm,
} = require('./prelude');

const RDF_TYPE = internIri(RDF_NS + 'type');
const LOG_NAME_OF = internIri(LOG_NS + 'nameOf');
const XSD_INTEGER_IRI = XSD_NS + 'integer';
const XSD_INTEGER_LITERAL_SUFFIX = `^^<${XSD_INTEGER_IRI}>`;

const EYMSG_NS = 'https://eyereasoner.github.io/eyeling/vocab/message#';
const EYMSG_IRIS = Object.freeze({
  RDFMessageStream: internIri(`${EYMSG_NS}RDFMessageStream`),
  MessageEnvelope: internIri(`${EYMSG_NS}MessageEnvelope`),
  envelope: internIri(`${EYMSG_NS}envelope`),
  firstEnvelope: internIri(`${EYMSG_NS}firstEnvelope`),
  lastEnvelope: internIri(`${EYMSG_NS}lastEnvelope`),
  orderedEnvelopes: internIri(`${EYMSG_NS}orderedEnvelopes`),
  messageCount: internIri(`${EYMSG_NS}messageCount`),
  offset: internIri(`${EYMSG_NS}offset`),
  nextEnvelope: internIri(`${EYMSG_NS}nextEnvelope`),
  payloadGraph: internIri(`${EYMSG_NS}payloadGraph`),
  payloadKind: internIri(`${EYMSG_NS}payloadKind`),
  empty: internIri(`${EYMSG_NS}empty`),
  nonEmpty: internIri(`${EYMSG_NS}nonEmpty`),
});

const VERSION_LINE_RE = /^\s*(?:@version|VERSION)\s+(["'])(?:1\.1|1\.2|1\.2-basic)(?:-messages)?\1\s*\.?\s*(?:#.*)?$/im;
const MESSAGE_VERSION_LINE_RE = /^\s*(?:@version|VERSION)\s+(["'])(?:1\.1|1\.2|1\.2-basic)-messages\1\s*\.?\s*(?:#.*)?$/im;
const MESSAGE_LINE_RE = /^\s*(?:MESSAGE\b|@message\s*\.?)\s*(?:#.*)?$/i;

function simpleHashText(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function addOffset(obj, offset) {
  if (!obj || typeof offset !== 'number') return obj;
  Object.defineProperty(obj, '__sourceOffset', {
    value: offset,
    enumerable: false,
    writable: false,
    configurable: true,
  });
  return obj;
}

function skipWs(s, i) {
  while (i < s.length) {
    const code = s.charCodeAt(i);
    if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d && code !== 0x0c) break;
    i += 1;
  }
  return i;
}

function maybeDecodeIriRef(raw, offset, prefixes) {
  const iri = raw.includes('\\') ? decodeN3StringEscapes(raw, offset) : raw;
  if (!prefixes.baseIri || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(iri)) return iri;
  return resolveIriRef(iri, prefixes.baseIri || '');
}

function readIriRef(s, i) {
  if (s[i] !== '<' || s[i + 1] === '<') return null;
  let j = i + 1;
  while (j < s.length) {
    const ch = s[j];
    if (ch === '\\') {
      j += 2;
      continue;
    }
    if (ch === '>') return { raw: s.slice(i + 1, j), end: j + 1 };
    j += 1;
  }
  throw new N3SyntaxError('Unterminated IRI <...>', i);
}

function readQuoted(s, i) {
  const quote = s[i];
  if (quote !== '"' && quote !== "'") return null;
  const long = s.startsWith(quote.repeat(3), i);
  const start = i;
  if (long) {
    i += 3;
    const contentStart = i;
    let hasEscape = false;
    while (i < s.length) {
      if (s.startsWith(quote.repeat(3), i)) {
        return { text: s.slice(contentStart, i), end: i + 3, hasEscape };
      }
      const ch = s[i];
      if (ch === '\\') {
        hasEscape = true;
        i += 2;
      } else {
        i += 1;
      }
    }
    throw new N3SyntaxError(`Unterminated long string literal ${quote.repeat(3)}...${quote.repeat(3)}`, start);
  }

  i += 1;
  const contentStart = i;
  let hasEscape = false;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\') {
      hasEscape = true;
      i += 2;
      continue;
    }
    if (ch === quote) return { text: s.slice(contentStart, i), end: i + 1, hasEscape };
    i += 1;
  }
  throw new N3SyntaxError(`Unterminated string literal ${quote}...${quote}`, start);
}

function readToken(s, i) {
  const start = i;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch) || ch === '.' || ch === ',' || ch === ';' || ch === '[' || ch === ']' || ch === '{' || ch === '}' || ch === '(' || ch === ')') break;
    i += 1;
  }
  if (i === start) return null;
  return { text: s.slice(start, i), end: i };
}

function expandQNameToken(token, prefixes, usedPrefixes) {
  if (token === 'a') return RDF_NS + 'type';
  const sep = token.indexOf(':');
  if (sep < 0) return null;
  if (sep === 1 && token.charCodeAt(0) === 95) return null;
  const pfx = token.slice(0, sep);
  const local = token.slice(sep + 1);
  const base = prefixes.map[pfx] || '';
  if (!base && pfx !== '') return null;
  if (usedPrefixes && pfx) usedPrefixes.add(pfx);
  return base ? base + local : token;
}

function parseIriOrQName(s, i, prefixes, usedPrefixes) {
  i = skipWs(s, i);
  const iri = readIriRef(s, i);
  if (iri) {
    return { term: internIri(maybeDecodeIriRef(iri.raw, i, prefixes)), end: iri.end };
  }
  const tok = readToken(s, i);
  if (!tok) return null;
  const expanded = expandQNameToken(tok.text, prefixes, usedPrefixes);
  if (expanded === null) return null;
  return { term: internIri(expanded), end: tok.end };
}

function parseTerm(s, i, prefixes, usedPrefixes, blankPrefix = '') {
  i = skipWs(s, i);
  if (i >= s.length) return null;
  const ch = s[i];

  if (ch === '<') return parseIriOrQName(s, i, prefixes, usedPrefixes);

  if (ch === '_' && s[i + 1] === ':') {
    const tok = readToken(s, i);
    if (!tok) return null;
    let label = tok.text;
    if (blankPrefix) label = blankPrefix + label.slice(2).replace(/[^A-Za-z0-9_]/g, '_');
    return { term: new Blank(label), end: tok.end };
  }

  if (ch === '"' || ch === "'") {
    const q = readQuoted(s, i);
    let end = q.end;
    const rawText = q.text;
    let value = q.hasEscape ? JSON.stringify(decodeN3StringEscapes(rawText, i)) : `"${rawText}"`;

    if (s[end] === '@') {
      let j = end + 1;
      if (!/[A-Za-z]/.test(s[j] || '')) return null;
      while (j < s.length && /[A-Za-z0-9-]/.test(s[j])) j += 1;
      if (s[j] === '-' && s[j + 1] === '-') {
        const dir = s.slice(j + 2, j + 5);
        if ((dir === 'ltr' || dir === 'rtl') && !/[A-Za-z0-9-]/.test(s[j + 5] || '')) j += 5;
      }
      value += s.slice(end, j);
      end = j;
    } else if (s.startsWith('^^', end)) {
      const dt = parseIriOrQName(s, end + 2, prefixes, usedPrefixes);
      if (!dt || !(dt.term && typeof dt.term.value === 'string')) return null;
      value += `^^<${dt.term.value}>`;
      end = dt.end;
    }

    return { term: internLiteral(value), end };
  }

  if (ch === '(') {
    let pos = i + 1;
    const items = [];
    for (;;) {
      pos = skipWs(s, pos);
      if (pos >= s.length) throw new N3SyntaxError('Unterminated collection (...)', i);
      if (s[pos] === ')') return { term: new ListTerm(items), end: pos + 1 };
      const item = parseTerm(s, pos, prefixes, usedPrefixes, blankPrefix);
      if (!item) return null;
      items.push(item.term);
      pos = item.end;
    }
  }

  if (ch === '[' || ch === '{') return null;

  const tok = readToken(s, i);
  if (!tok) return null;
  const word = tok.text;
  if (word === 'true' || word === 'false' || /^-?(?:[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|\.[0-9]+(?:[eE][+-]?[0-9]+)?)$/.test(word)) {
    return { term: internLiteral(word), end: tok.end };
  }

  const expanded = expandQNameToken(word, prefixes, usedPrefixes);
  if (expanded !== null) return { term: internIri(expanded), end: tok.end };
  return null;
}

function parseDirective(line, prefixes, usedPrefixes) {
  let m = /^\s*@prefix\s+([^\s]+)\s+<([^>]*)>\s*\.\s*(?:#.*)?$/i.exec(line);
  if (!m) m = /^\s*PREFIX\s+([^\s]+)\s+<([^>]*)>\s*\.?\s*(?:#.*)?$/i.exec(line);
  if (m) {
    const raw = m[1];
    if (!raw.endsWith(':')) throw new N3SyntaxError("Invalid @prefix directive: prefix name must end with ':'");
    const pfx = raw.slice(0, -1);
    prefixes.set(pfx, maybeDecodeIriRef(m[2], 0, prefixes));
    if (usedPrefixes && pfx) usedPrefixes.add(pfx);
    return true;
  }

  m = /^\s*@base\s+<([^>]*)>\s*\.\s*(?:#.*)?$/i.exec(line);
  if (!m) m = /^\s*BASE\s+<([^>]*)>\s*\.?\s*(?:#.*)?$/i.exec(line);
  if (m) {
    prefixes.setBase(maybeDecodeIriRef(m[1], 0, prefixes));
    return true;
  }

  return false;
}

function parseFastStatement(line, prefixes, usedPrefixes, blankPrefix, sourceOffset = null) {
  let s = String(line || '');
  const leading = s.length - s.trimStart().length;
  s = s.slice(leading);
  if (!s || s[0] === '#') return [];
  if (VERSION_LINE_RE.test(s)) return [];
  if (MESSAGE_LINE_RE.test(s)) return '__MESSAGE__';
  if (parseDirective(s, prefixes, usedPrefixes)) return [];

  let pos = 0;
  const subj = parseTerm(s, pos, prefixes, usedPrefixes, blankPrefix);
  if (!subj) return null;
  pos = subj.end;
  const pred = parseIriOrQName(s, pos, prefixes, usedPrefixes);
  if (!pred) return null;
  pos = pred.end;
  const obj = parseTerm(s, pos, prefixes, usedPrefixes, blankPrefix);
  if (!obj) return null;
  pos = skipWs(s, obj.end);

  let graph = null;
  if (s[pos] !== '.') {
    const graphTerm = parseIriOrQName(s, pos, prefixes, usedPrefixes);
    if (!graphTerm) return null;
    graph = graphTerm.term;
    pos = skipWs(s, graphTerm.end);
  }
  if (s[pos] !== '.') return null;
  pos = skipWs(s, pos + 1);
  if (pos !== s.length && s[pos] !== '#') return null;

  const triple = addOffset(new Triple(subj.term, pred.term, obj.term), typeof sourceOffset === 'number' ? sourceOffset + leading : sourceOffset);
  if (!graph) return [triple];
  return [addOffset(new Triple(graph, LOG_NAME_OF, annotateQuotedGraphTerm(new GraphTerm([triple]))), sourceOffset)];
}

function lineIterator(text) {
  const s = String(text ?? '');
  let start = 0;
  return {
    *[Symbol.iterator]() {
      for (let i = 0; i <= s.length; i += 1) {
        if (i === s.length || s[i] === '\n' || s[i] === '\r') {
          const line = s.slice(start, i);
          const offset = start;
          if (i < s.length && s[i] === '\r' && s[i + 1] === '\n') i += 1;
          start = i + 1;
          yield { line, offset };
        }
      }
    },
  };
}

function makeDoc(prefixes, triples, label, usedPrefixes) {
  const doc = {
    prefixes,
    triples,
    frules: [],
    brules: [],
    logQueryRules: [],
    label,
  };
  Object.defineProperty(doc, 'usedPrefixes', {
    value: usedPrefixes,
    enumerable: false,
    writable: false,
    configurable: true,
  });
  Object.defineProperty(doc, '__fastRdf', {
    value: true,
    enumerable: false,
    writable: false,
    configurable: true,
  });
  return doc;
}

function parseLineOrAbort(line, prefixes, usedPrefixes, blankPrefix, sourceOffset) {
  const parsed = parseFastStatement(line, prefixes, usedPrefixes, blankPrefix, sourceOffset);
  if (parsed === null || parsed === '__MESSAGE__') return parsed;
  return parsed;
}

function parseFastRdfText(text, opts = {}) {
  const source = String(text ?? '');
  // Try the fast line parser directly. It returns null on richer multi-line
  // Turtle/N3 constructs, so ordinary complex programs still fall back safely.
  const prefixes = PrefixEnv.newDefault();
  if (opts.baseIri) prefixes.setBase(opts.baseIri);
  const triples = [];
  const usedPrefixes = new Set();
  let sawUsefulLine = false;

  for (const { line, offset } of lineIterator(source)) {
    const parsed = parseLineOrAbort(line, prefixes, usedPrefixes, '', offset);
    if (parsed === null || parsed === '__MESSAGE__') return null;
    if (parsed.length) sawUsefulLine = true;
    triples.push(...parsed);
  }

  if (!sawUsefulLine && !/^\s*(?:@prefix|PREFIX|@base|BASE|@version|VERSION)\b/im.test(source)) return null;
  return makeDoc(prefixes, triples, opts.label || '<input>', usedPrefixes);
}

function parseFastRdfMessageLog(text, opts = {}) {
  const source = String(text ?? '');
  if (!MESSAGE_VERSION_LINE_RE.test(source)) return null;

  const prefixes = PrefixEnv.newDefault();
  if (opts.baseIri) prefixes.setBase(opts.baseIri);
  const usedPrefixes = new Set();
  const payloads = [[]];
  let current = payloads[0];
  let messageIndex = 1;
  let sawVersion = false;

  for (const { line, offset } of lineIterator(source)) {
    const stripped = String(line || '').trimStart();
    if (!stripped || stripped[0] === '#') continue;
    if (MESSAGE_VERSION_LINE_RE.test(stripped)) {
      sawVersion = true;
      continue;
    }
    if (VERSION_LINE_RE.test(stripped)) continue;
    if (MESSAGE_LINE_RE.test(stripped)) {
      payloads.push([]);
      current = payloads[payloads.length - 1];
      messageIndex += 1;
      continue;
    }

    const blankPrefix = `_:eyeling_m${String(messageIndex).padStart(3, '0')}_`;
    const parsed = parseLineOrAbort(line, prefixes, usedPrefixes, blankPrefix, offset);
    if (parsed === null || parsed === '__MESSAGE__') return null;
    current.push(...parsed);
  }

  if (!sawVersion) return null;

  const hash = simpleHashText(source);
  const base = `urn:eyeling:message-log:${hash}`;
  const stream = internIri(`${base}#stream`);
  const envelopes = payloads.map((unused, idx) => internIri(`${base}#m${String(idx + 1).padStart(3, '0')}`));
  const payloadIris = payloads.map((unused, idx) => internIri(`${base}#m${String(idx + 1).padStart(3, '0')}/payload`));
  const triples = [];

  triples.push(new Triple(stream, RDF_TYPE, EYMSG_IRIS.RDFMessageStream));
  triples.push(new Triple(stream, EYMSG_IRIS.messageCount, internLiteral(`"${payloads.length}"${XSD_INTEGER_LITERAL_SUFFIX}`)));
  if (envelopes.length) {
    triples.push(new Triple(stream, EYMSG_IRIS.orderedEnvelopes, new ListTerm(envelopes)));
    triples.push(new Triple(stream, EYMSG_IRIS.firstEnvelope, envelopes[0]));
    triples.push(new Triple(stream, EYMSG_IRIS.lastEnvelope, envelopes[envelopes.length - 1]));
  }

  for (let idx = 0; idx < payloads.length; idx += 1) {
    const envelope = envelopes[idx];
    const payload = payloadIris[idx];
    const bodyTriples = payloads[idx];
    const hasBody = bodyTriples.length > 0;

    triples.push(new Triple(stream, EYMSG_IRIS.envelope, envelope));
    triples.push(new Triple(envelope, RDF_TYPE, EYMSG_IRIS.MessageEnvelope));
    triples.push(new Triple(envelope, EYMSG_IRIS.offset, internLiteral(`"${idx + 1}"${XSD_INTEGER_LITERAL_SUFFIX}`)));
    triples.push(new Triple(envelope, EYMSG_IRIS.payloadKind, hasBody ? EYMSG_IRIS.nonEmpty : EYMSG_IRIS.empty));
    if (idx + 1 < envelopes.length) triples.push(new Triple(envelope, EYMSG_IRIS.nextEnvelope, envelopes[idx + 1]));
    if (hasBody) {
      triples.push(new Triple(envelope, EYMSG_IRIS.payloadGraph, payload));
      triples.push(new Triple(payload, LOG_NAME_OF, annotateQuotedGraphTerm(new GraphTerm(bodyTriples))));
    }
  }

  return makeDoc(prefixes, triples, opts.label || '<input>', usedPrefixes);
}

function tryParseFastRdfText(text, opts = {}) {
  return parseFastRdfMessageLog(text, opts) || parseFastRdfText(text, opts);
}

module.exports = { tryParseFastRdfText, parseFastRdfText, parseFastRdfMessageLog };
