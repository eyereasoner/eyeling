/**
 * Eyeling Reasoner — multi-source parsing helpers
 *
 * These helpers let the CLI/API parse several N3 documents independently and
 * merge their parsed ASTs before reasoning. This avoids building one giant N3
 * string while preserving the existing lexer/parser/engine pipeline.
 */

'use strict';

const { lex } = require('./lexer');
const { Parser } = require('./parser');
const {
  Blank,
  ListTerm,
  OpenListTerm,
  GraphTerm,
  Triple,
  Rule,
  PrefixEnv,
  annotateQuotedGraphTerm,
} = require('./prelude');

function emptyParsedDocument() {
  return {
    prefixes: PrefixEnv.newDefault(),
    triples: [],
    frules: [],
    brules: [],
    logQueryRules: [],
  };
}

function parseN3Text(text, opts = {}) {
  const { baseIri = '', label = '<input>' } = opts || {};
  const tokens = lex(text);
  const parser = new Parser(tokens);
  if (baseIri) parser.prefixes.setBase(baseIri);
  const [prefixes, triples, frules, brules, logQueryRules] = parser.parseDocument();
  return { prefixes, triples, frules, brules, logQueryRules, tokens, text, label };
}

function sourceBlankPrefix(sourceIndex) {
  return `_:src${sourceIndex}_`;
}

function scopedBlankLabel(label, sourceIndex, mapping) {
  const key = String(label || '');
  let out = mapping.get(key);
  if (out) return out;

  const bare = key.startsWith('_:') ? key.slice(2) : key;
  out = sourceBlankPrefix(sourceIndex) + bare;
  mapping.set(key, out);
  return out;
}

function scopeBlankNodesInDocument(doc, sourceIndex) {
  const mapping = new Map();

  function cloneTerm(term) {
    if (term instanceof Blank) return new Blank(scopedBlankLabel(term.label, sourceIndex, mapping));
    if (term instanceof ListTerm) return new ListTerm(term.elems.map(cloneTerm));
    if (term instanceof OpenListTerm) return new OpenListTerm(term.prefix.map(cloneTerm), term.tailVar);
    if (term instanceof GraphTerm) return annotateQuotedGraphTerm(new GraphTerm(term.triples.map(cloneTriple)));
    return term;
  }

  function cloneTriple(triple) {
    return new Triple(cloneTerm(triple.s), cloneTerm(triple.p), cloneTerm(triple.o));
  }

  function cloneRule(rule) {
    const headBlankLabels = new Set();
    if (rule && rule.headBlankLabels instanceof Set) {
      for (const label of rule.headBlankLabels) headBlankLabels.add(scopedBlankLabel(label, sourceIndex, mapping));
    }

    const out = new Rule(
      (rule.premise || []).map(cloneTriple),
      (rule.conclusion || []).map(cloneTriple),
      rule.isForward,
      rule.isFuse,
      headBlankLabels,
    );

    if (rule && Object.prototype.hasOwnProperty.call(rule, '__dynamicConclusionTerm')) {
      Object.defineProperty(out, '__dynamicConclusionTerm', {
        value: cloneTerm(rule.__dynamicConclusionTerm),
        enumerable: false,
        writable: false,
        configurable: true,
      });
    }

    return out;
  }

  return {
    prefixes: doc.prefixes,
    triples: (doc.triples || []).map(cloneTriple),
    frules: (doc.frules || []).map(cloneRule),
    brules: (doc.brules || []).map(cloneRule),
    logQueryRules: (doc.logQueryRules || []).map(cloneRule),
    tokens: doc.tokens,
    text: doc.text,
    label: doc.label,
  };
}

function mergePrefixEnvs(target, source) {
  if (!source) return target;
  const map = source.map || {};
  for (const [prefix, iri] of Object.entries(map)) {
    // Every parser starts with an empty default namespace. Do not let a later
    // source that never declared ':' erase a useful default namespace from an
    // earlier source; prefix merging is for output readability only.
    if (iri || !Object.prototype.hasOwnProperty.call(target.map, prefix)) target.set(prefix, iri);
  }
  if (source.baseIri) target.setBase(source.baseIri);
  return target;
}

function mergeParsedDocuments(docs, opts = {}) {
  const documents = Array.isArray(docs) ? docs : [];
  const scopeBlankNodes = typeof opts.scopeBlankNodes === 'boolean' ? opts.scopeBlankNodes : documents.length > 1;

  const merged = emptyParsedDocument();
  const mergedSources = [];

  for (let i = 0; i < documents.length; i++) {
    const originalDoc = documents[i] || emptyParsedDocument();
    const doc = scopeBlankNodes ? scopeBlankNodesInDocument(originalDoc, i + 1) : originalDoc;

    mergePrefixEnvs(merged.prefixes, doc.prefixes);
    merged.triples.push(...(doc.triples || []));
    merged.frules.push(...(doc.frules || []));
    merged.brules.push(...(doc.brules || []));
    merged.logQueryRules.push(...(doc.logQueryRules || []));
    mergedSources.push(doc);
  }

  Object.defineProperty(merged, 'sources', {
    value: mergedSources,
    enumerable: false,
    writable: false,
    configurable: true,
  });

  return merged;
}

function isN3SourceListInput(input) {
  return !!(input && typeof input === 'object' && !Array.isArray(input) && Array.isArray(input.sources));
}

function normalizeN3SourceItem(source, index) {
  const sourceNumber = index + 1;
  if (typeof source === 'string') {
    return { text: source, label: `<source ${sourceNumber}>`, baseIri: '' };
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('Each N3 source must be a string or an object with an n3/text field');
  }

  const text = typeof source.n3 === 'string' ? source.n3 : typeof source.text === 'string' ? source.text : null;
  if (text === null) throw new TypeError('Each N3 source object must provide an n3 or text string');

  return {
    text,
    label: typeof source.label === 'string' && source.label ? source.label : `<source ${sourceNumber}>`,
    baseIri: typeof source.baseIri === 'string' ? source.baseIri : '',
  };
}

function parseN3SourceList(input, opts = {}) {
  if (!isN3SourceListInput(input)) return null;
  const sources = input.sources.map(normalizeN3SourceItem);
  const defaultBaseIri = typeof opts.baseIri === 'string' ? opts.baseIri : '';
  const parsed = sources.map((source, index) =>
    parseN3Text(source.text, {
      label: source.label,
      baseIri: source.baseIri || (sources.length === 1 ? defaultBaseIri : ''),
    }),
  );
  return mergeParsedDocuments(parsed, {
    scopeBlankNodes: typeof input.scopeBlankNodes === 'boolean' ? input.scopeBlankNodes : parsed.length > 1,
  });
}

module.exports = {
  emptyParsedDocument,
  parseN3Text,
  mergeParsedDocuments,
  scopeBlankNodesInDocument,
  isN3SourceListInput,
  parseN3SourceList,
};
