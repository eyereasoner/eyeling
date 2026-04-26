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

function prefixesUsedInTokens(tokens, prefEnv) {
  const used = new Set();
  const toks = Array.isArray(tokens) ? tokens : [];
  const prefixes = prefEnv && prefEnv.map ? prefEnv.map : {};

  function maybeAddFromQName(name) {
    if (typeof name !== 'string') return;
    if (!name.includes(':')) return;
    if (name.startsWith('_:')) return; // blank node

    // Split only on the first ':'; the empty prefix is valid for ":foo".
    const idx = name.indexOf(':');
    const p = name.slice(0, idx);

    // Ignore strings like "http://..." unless that prefix is actually defined.
    if (!Object.prototype.hasOwnProperty.call(prefixes, p)) return;

    used.add(p);
  }

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!t) continue;

    // Skip @prefix ... .
    if (t.typ === 'AtPrefix') {
      while (i < toks.length && toks[i].typ !== 'Dot' && toks[i].typ !== 'EOF') i++;
      continue;
    }

    // Skip @base ... .
    if (t.typ === 'AtBase') {
      while (i < toks.length && toks[i].typ !== 'Dot' && toks[i].typ !== 'EOF') i++;
      continue;
    }

    // Skip SPARQL/Turtle PREFIX pfx: <iri>
    if (
      t.typ === 'Ident' &&
      typeof t.value === 'string' &&
      t.value.toLowerCase() === 'prefix' &&
      toks[i + 1] &&
      toks[i + 1].typ === 'Ident' &&
      typeof toks[i + 1].value === 'string' &&
      toks[i + 1].value.endsWith(':') &&
      toks[i + 2] &&
      (toks[i + 2].typ === 'IriRef' || toks[i + 2].typ === 'Ident')
    ) {
      i += 2;
      continue;
    }

    // Skip SPARQL BASE <iri>
    if (
      t.typ === 'Ident' &&
      typeof t.value === 'string' &&
      t.value.toLowerCase() === 'base' &&
      toks[i + 1] &&
      toks[i + 1].typ === 'IriRef'
    ) {
      i += 1;
      continue;
    }

    // Count QNames in identifiers, including datatypes like xsd:integer.
    if (t.typ === 'Ident') maybeAddFromQName(t.value);
  }

  return used;
}

function parseN3Text(text, opts = {}) {
  const { baseIri = '', label = '<input>', keepSourceArtifacts = true, collectUsedPrefixes = false } = opts || {};
  const tokens = lex(text);
  const parser = new Parser(tokens);
  if (baseIri) parser.prefixes.setBase(baseIri);
  const [prefixes, triples, frules, brules, logQueryRules] = parser.parseDocument();

  const doc = { prefixes, triples, frules, brules, logQueryRules, label };

  if (collectUsedPrefixes) {
    Object.defineProperty(doc, 'usedPrefixes', {
      value: prefixesUsedInTokens(tokens, prefixes),
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }

  if (keepSourceArtifacts) {
    doc.tokens = tokens;
    doc.text = text;
  }

  return doc;
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

  const out = {
    prefixes: doc.prefixes,
    triples: (doc.triples || []).map(cloneTriple),
    frules: (doc.frules || []).map(cloneRule),
    brules: (doc.brules || []).map(cloneRule),
    logQueryRules: (doc.logQueryRules || []).map(cloneRule),
    label: doc.label,
  };

  if (doc.usedPrefixes instanceof Set) {
    Object.defineProperty(out, 'usedPrefixes', {
      value: new Set(doc.usedPrefixes),
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }
  if (Object.prototype.hasOwnProperty.call(doc, 'tokens')) out.tokens = doc.tokens;
  if (Object.prototype.hasOwnProperty.call(doc, 'text')) out.text = doc.text;

  return out;
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
  const keepSources = !!opts.keepSources || !!opts.keepSourceArtifacts;

  const merged = emptyParsedDocument();
  const mergedSources = keepSources ? [] : null;

  for (let i = 0; i < documents.length; i++) {
    const originalDoc = documents[i] || emptyParsedDocument();
    const doc = scopeBlankNodes ? scopeBlankNodesInDocument(originalDoc, i + 1) : originalDoc;

    mergePrefixEnvs(merged.prefixes, doc.prefixes);
    merged.triples.push(...(doc.triples || []));
    merged.frules.push(...(doc.frules || []));
    merged.brules.push(...(doc.brules || []));
    merged.logQueryRules.push(...(doc.logQueryRules || []));

    if (doc.usedPrefixes instanceof Set) {
      if (!(merged.usedPrefixes instanceof Set)) {
        Object.defineProperty(merged, 'usedPrefixes', {
          value: new Set(),
          enumerable: false,
          writable: false,
          configurable: true,
        });
      }
      for (const pfx of doc.usedPrefixes) merged.usedPrefixes.add(pfx);
    }

    if (keepSources) mergedSources.push(doc);
  }

  if (keepSources) {
    Object.defineProperty(merged, 'sources', {
      value: mergedSources,
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }

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
  const parsed = sources.map((source) =>
    parseN3Text(source.text, {
      label: source.label,
      baseIri: source.baseIri || (sources.length === 1 ? defaultBaseIri : ''),
      collectUsedPrefixes: true,
      keepSourceArtifacts: !!opts.keepSourceArtifacts,
    }),
  );
  return mergeParsedDocuments(parsed, {
    scopeBlankNodes: typeof input.scopeBlankNodes === 'boolean' ? input.scopeBlankNodes : parsed.length > 1,
    keepSources: !!opts.keepSourceArtifacts,
  });
}

module.exports = {
  emptyParsedDocument,
  parseN3Text,
  mergeParsedDocuments,
  scopeBlankNodesInDocument,
  prefixesUsedInTokens,
  isN3SourceListInput,
  parseN3SourceList,
};
