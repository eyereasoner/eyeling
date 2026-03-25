/**
 * Eyeling Reasoner — RDF/JS compatibility helpers
 *
 * A lightweight RDF/JS DataFactory plus adapters between Eyeling's internal
 * N3 term model and RDF/JS terms/quads.
 */

'use strict';

const {
  XSD_NS,
  Literal: InternalLiteral,
  Iri,
  Blank,
  Var,
  ListTerm,
  OpenListTerm,
  GraphTerm,
  Triple,
  Rule,
  PrefixEnv,
  literalParts,
} = require('./prelude');
const { termToN3, tripleToN3 } = require('./printing');

function isObject(value) {
  return value != null && typeof value === 'object';
}

function isIterable(value) {
  return value != null && typeof value[Symbol.iterator] === 'function';
}

function isAsyncIterable(value) {
  return value != null && typeof value[Symbol.asyncIterator] === 'function';
}

function getTypeTag(value) {
  if (!isObject(value)) return '';
  if (typeof value._type === 'string' && value._type) return value._type;
  if (value.constructor && typeof value.constructor.name === 'string' && value.constructor.name)
    return value.constructor.name;
  return '';
}

function isRdfJsTerm(value) {
  return isObject(value) && typeof value.termType === 'string' && typeof value.value === 'string';
}

function isRdfJsQuad(value) {
  return (
    isObject(value) &&
    value.termType === 'Quad' &&
    isRdfJsTerm(value.subject) &&
    isRdfJsTerm(value.predicate) &&
    isRdfJsTerm(value.object) &&
    isRdfJsTerm(value.graph)
  );
}

function isEyelingPrefixEnvLike(value) {
  if (value instanceof PrefixEnv) return true;
  return isObject(value) && (getTypeTag(value) === 'PrefixEnv' || (isObject(value.map) && 'baseIri' in value));
}

function isEyelingTripleLike(value) {
  if (value instanceof Triple) return true;
  return isObject(value) && (getTypeTag(value) === 'Triple' || ('s' in value && 'p' in value && 'o' in value));
}

function isEyelingRuleLike(value) {
  if (value instanceof Rule) return true;
  return (
    isObject(value) &&
    (getTypeTag(value) === 'Rule' || (Array.isArray(value.premise) && Array.isArray(value.conclusion)))
  );
}

function isEyelingAstBundleLike(value) {
  return (
    Array.isArray(value) &&
    value.length >= 4 &&
    value.length <= 5 &&
    (value[0] == null || isEyelingPrefixEnvLike(value[0])) &&
    Array.isArray(value[1]) &&
    Array.isArray(value[2]) &&
    Array.isArray(value[3])
  );
}

function termEquals(self, other) {
  if (!other || typeof other !== 'object') return false;
  if (self.termType !== other.termType) return false;
  if (self.value !== other.value) return false;

  if (self.termType === 'Literal') {
    return (
      !!self.datatype &&
      typeof self.datatype.equals === 'function' &&
      self.datatype.equals(other.datatype) &&
      self.language === (other.language || '')
    );
  }

  if (self.termType === 'Quad') {
    return (
      self.subject.equals(other.subject) &&
      self.predicate.equals(other.predicate) &&
      self.object.equals(other.object) &&
      self.graph.equals(other.graph)
    );
  }

  return true;
}

class NamedNode {
  constructor(value) {
    this.termType = 'NamedNode';
    this.value = String(value);
  }

  equals(other) {
    return termEquals(this, other);
  }
}

class BlankNode {
  constructor(value) {
    this.termType = 'BlankNode';
    this.value = String(value);
  }

  equals(other) {
    return termEquals(this, other);
  }
}

class Variable {
  constructor(value) {
    this.termType = 'Variable';
    this.value = String(value);
  }

  equals(other) {
    return termEquals(this, other);
  }
}

class DefaultGraph {
  constructor() {
    this.termType = 'DefaultGraph';
    this.value = '';
  }

  equals(other) {
    return termEquals(this, other);
  }
}

class Literal {
  constructor(value, languageOrDatatype) {
    this.termType = 'Literal';
    this.value = String(value);
    this.language = '';
    this.datatype = null;

    if (typeof languageOrDatatype === 'string') {
      this.language = languageOrDatatype;
      this.datatype = new NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
    } else if (isRdfJsTerm(languageOrDatatype)) {
      this.datatype = languageOrDatatype;
    } else {
      this.datatype = new NamedNode(XSD_NS + 'string');
    }
  }

  equals(other) {
    return termEquals(this, other);
  }
}

class Quad {
  constructor(subject, predicate, object, graph) {
    this.termType = 'Quad';
    this.value = '';
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
    this.graph = graph || new DefaultGraph();
  }

  equals(other) {
    return termEquals(this, other);
  }
}

const defaultGraphSingleton = new DefaultGraph();

const dataFactory = {
  namedNode(value) {
    return new NamedNode(value);
  },
  blankNode(value) {
    return new BlankNode(value == null ? '' : value);
  },
  literal(value, languageOrDatatype) {
    return new Literal(value, languageOrDatatype);
  },
  variable(value) {
    return new Variable(value);
  },
  defaultGraph() {
    return defaultGraphSingleton;
  },
  quad(subject, predicate, object, graph) {
    return new Quad(subject, predicate, object, graph || defaultGraphSingleton);
  },
};

function getDataFactory(factory) {
  return factory && typeof factory.quad === 'function' ? factory : dataFactory;
}

function getLiteralLexicalKind(value) {
  if (typeof value !== 'string' || value.length === 0) return 'typed';
  if (value === 'true' || value === 'false') return 'boolean';
  if (/^[+-]?[0-9]+$/.test(value)) return 'integer';
  if (/^[+-]?(?:[0-9]*\.[0-9]+|[0-9]+\.)$/.test(value)) return 'decimal';
  if (/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)[eE][+-]?[0-9]+$/.test(value)) return 'double';
  return 'typed';
}

function inferDatatypeForLexical(value) {
  switch (getLiteralLexicalKind(value)) {
    case 'boolean':
      return XSD_NS + 'boolean';
    case 'integer':
      return XSD_NS + 'integer';
    case 'decimal':
      return XSD_NS + 'decimal';
    case 'double':
      return XSD_NS + 'double';
    default:
      return XSD_NS + 'string';
  }
}

function quotedLexicalToValue(lexical) {
  if (typeof lexical !== 'string' || lexical.length < 2 || lexical[0] !== '"' || lexical[lexical.length - 1] !== '"') {
    return lexical;
  }
  try {
    return JSON.parse(lexical);
  } catch {
    return lexical.slice(1, -1);
  }
}

function splitLiteralLexAndLang(value) {
  if (typeof value !== 'string') return { lexical: value, language: '' };
  if (!(value.startsWith('"') && value.length >= 2)) return { lexical: value, language: '' };
  const lastQuote = value.lastIndexOf('"');
  if (lastQuote <= 0 || lastQuote >= value.length - 1 || value[lastQuote + 1] !== '@') {
    return { lexical: value, language: '' };
  }
  const language = value.slice(lastQuote + 2);
  if (!/^[A-Za-z]+(?:-[A-Za-z0-9]+)*$/.test(language)) {
    return { lexical: value, language: '' };
  }
  return { lexical: value.slice(0, lastQuote + 1), language };
}

function internalLiteralToRdfJs(term, factory) {
  const rdfFactory = getDataFactory(factory);
  const [lexicalWithMaybeLang, datatypeIri] = literalParts(term.value);
  const { lexical, language } = splitLiteralLexAndLang(lexicalWithMaybeLang);
  const isQuotedLexical =
    typeof lexical === 'string' && lexical.length >= 2 && lexical[0] === '"' && lexical[lexical.length - 1] === '"';
  const value = isQuotedLexical ? quotedLexicalToValue(lexical) : lexical;

  if (language) return rdfFactory.literal(value, language);
  if (datatypeIri) return rdfFactory.literal(value, rdfFactory.namedNode(datatypeIri));
  return rdfFactory.literal(value, rdfFactory.namedNode(inferDatatypeForLexical(lexical)));
}

function unsupportedRdfJsTerm(term, position) {
  const kind = term && term.constructor && term.constructor.name ? term.constructor.name : typeof term;
  const where = position ? ` in ${position}` : '';
  throw new TypeError(`Cannot convert N3-only term ${kind}${where} to RDF/JS`);
}

function internalTermToRdfJs(term, factory, position) {
  const rdfFactory = getDataFactory(factory);
  if (term instanceof Iri) return rdfFactory.namedNode(term.value);
  if (term instanceof Blank) {
    const label = typeof term.label === 'string' && term.label.startsWith('_:') ? term.label.slice(2) : term.label;
    return rdfFactory.blankNode(label);
  }
  if (term instanceof Var) return rdfFactory.variable(term.name);
  if (term instanceof InternalLiteral) return internalLiteralToRdfJs(term, rdfFactory);
  return unsupportedRdfJsTerm(term, position);
}

function internalTripleToRdfJsQuad(triple, factory) {
  const rdfFactory = getDataFactory(factory);
  return rdfFactory.quad(
    internalTermToRdfJs(triple.s, rdfFactory, 'subject'),
    internalTermToRdfJs(triple.p, rdfFactory, 'predicate'),
    internalTermToRdfJs(triple.o, rdfFactory, 'object'),
    rdfFactory.defaultGraph(),
  );
}

function escapeStringForN3(value) {
  return JSON.stringify(String(value));
}

function assertSupportedRdfJsTerm(term, position) {
  if (!isRdfJsTerm(term)) {
    throw new TypeError(`Expected an RDF/JS term in ${position}`);
  }
}

function rdfJsTermToN3(term, position = 'term') {
  assertSupportedRdfJsTerm(term, position);

  switch (term.termType) {
    case 'NamedNode':
      return `<${term.value}>`;
    case 'BlankNode':
      return `_:${term.value}`;
    case 'Variable':
      return `?${term.value}`;
    case 'DefaultGraph':
      throw new TypeError(`DefaultGraph is not a valid standalone N3 term in ${position}`);
    case 'Literal': {
      const lang = typeof term.language === 'string' ? term.language : '';
      const datatype = term.datatype && term.datatype.termType === 'NamedNode' ? term.datatype.value : null;
      const lexical = escapeStringForN3(term.value);
      if (lang) return `${lexical}@${lang}`;
      if (!datatype || datatype === XSD_NS + 'string') return lexical;
      return `${lexical}^^<${datatype}>`;
    }
    case 'Quad':
      throw new TypeError(`Quoted triple terms are not supported in ${position}`);
    default:
      throw new TypeError(`Unsupported RDF/JS termType ${JSON.stringify(term.termType)} in ${position}`);
  }
}

function rdfJsTermToInternal(term, position = 'term') {
  assertSupportedRdfJsTerm(term, position);

  switch (term.termType) {
    case 'NamedNode':
      return new Iri(term.value);
    case 'BlankNode':
      return new Blank(`_:${term.value}`);
    case 'Variable':
      return new Var(term.value);
    case 'Literal':
      return new InternalLiteral(rdfJsTermToN3(term, position));
    case 'DefaultGraph':
      throw new TypeError(`DefaultGraph is not a valid standalone N3 term in ${position}`);
    case 'Quad':
      throw new TypeError(`Quoted triple terms are not supported in ${position}`);
    default:
      throw new TypeError(`Unsupported RDF/JS termType ${JSON.stringify(term.termType)} in ${position}`);
  }
}

function rdfJsQuadToInternalTriple(quad) {
  if (!isRdfJsQuad(quad)) throw new TypeError('Expected an RDF/JS Quad');
  if (quad.graph.termType !== 'DefaultGraph') {
    throw new TypeError('Named graph quads are not supported by Eyeling input; use the default graph only');
  }
  return new Triple(
    rdfJsTermToInternal(quad.subject, 'quad.subject'),
    rdfJsTermToInternal(quad.predicate, 'quad.predicate'),
    rdfJsTermToInternal(quad.object, 'quad.object'),
  );
}

function rdfJsQuadToN3(quad) {
  if (!isRdfJsQuad(quad)) throw new TypeError('Expected an RDF/JS Quad');
  if (quad.graph.termType !== 'DefaultGraph') {
    throw new TypeError('Named graph quads are not supported by Eyeling input; use the default graph only');
  }
  return `${rdfJsTermToN3(quad.subject, 'quad.subject')} ${rdfJsTermToN3(quad.predicate, 'quad.predicate')} ${rdfJsTermToN3(quad.object, 'quad.object')}.`;
}

function collectIterableToArray(iterable, label) {
  if (!isIterable(iterable)) throw new TypeError(`${label} must be an iterable of RDF/JS quads`);
  return Array.from(iterable);
}

async function collectAsyncIterableToArray(iterable, label) {
  if (isIterable(iterable)) return Array.from(iterable);
  if (!isAsyncIterable(iterable)) throw new TypeError(`${label} must be an iterable or async iterable of RDF/JS quads`);
  const out = [];
  for await (const item of iterable) out.push(item);
  return out;
}

function pickInputQuadIterable(input) {
  if (!isObject(input)) return null;
  if (input.quads != null) return { value: input.quads, label: 'input.quads' };
  if (input.dataset != null) return { value: input.dataset, label: 'input.dataset' };
  if (input.facts != null) return { value: input.facts, label: 'input.facts' };
  return null;
}

function getRulesText(input) {
  if (!isObject(input)) return '';
  return '';
}

function getFactsText(input) {
  if (!isObject(input)) return '';
  for (const key of ['factsN3', 'n3Facts']) {
    if (typeof input[key] === 'string') return input[key];
  }
  return '';
}

function getPrefixesText(input) {
  if (!isObject(input)) return '';
  for (const key of ['prefixesN3', 'n3Prefixes']) {
    if (typeof input[key] === 'string') return input[key];
  }
  return '';
}

function joinN3Sections(parts) {
  return parts
    .filter((part) => typeof part === 'string' && part.length > 0)
    .map((part) => (part.endsWith('\n') ? part : part + '\n'))
    .join('');
}

function reviveHeadBlankLabels(value) {
  if (value instanceof Set) return new Set(value);
  if (Array.isArray(value)) return new Set(value.map((item) => String(item)));
  return new Set();
}

function reviveEyelingTerm(value) {
  if (value instanceof Iri || value instanceof InternalLiteral || value instanceof Var || value instanceof Blank)
    return value;
  if (value instanceof ListTerm || value instanceof OpenListTerm || value instanceof GraphTerm) return value;

  const tag = getTypeTag(value);

  switch (tag) {
    case 'Iri':
      return new Iri(value.value);
    case 'Literal':
      return new InternalLiteral(value.value);
    case 'Var':
      return new Var(value.name);
    case 'Blank':
      return new Blank(value.label);
    case 'ListTerm':
      return new ListTerm((value.elems || []).map((item) => reviveEyelingTerm(item)));
    case 'OpenListTerm':
      return new OpenListTerm(
        (value.prefix || []).map((item) => reviveEyelingTerm(item)),
        value.tailVar,
      );
    case 'GraphTerm':
      return new GraphTerm((value.triples || []).map((item) => reviveEyelingTriple(item)));
    default:
      break;
  }

  if (isRdfJsTerm(value)) return rdfJsTermToInternal(value);
  throw new TypeError(`Unsupported Eyeling term object: ${JSON.stringify(tag || value)}`);
}

function reviveEyelingTriple(value) {
  if (value instanceof Triple) return value;
  if (!isEyelingTripleLike(value)) throw new TypeError('Expected an Eyeling Triple-like object');
  return new Triple(reviveEyelingTerm(value.s), reviveEyelingTerm(value.p), reviveEyelingTerm(value.o));
}

function reviveEyelingRule(value) {
  if (value instanceof Rule) return value;
  if (!isEyelingRuleLike(value)) throw new TypeError('Expected an Eyeling Rule-like object');

  const rule = new Rule(
    (value.premise || []).map((item) => reviveEyelingTriple(item)),
    (value.conclusion || []).map((item) => reviveEyelingTriple(item)),
    value.isForward !== false,
    !!value.isFuse,
    reviveHeadBlankLabels(value.headBlankLabels),
  );

  if (value.__dynamicConclusionTerm != null) {
    Object.defineProperty(rule, '__dynamicConclusionTerm', {
      value: reviveEyelingTerm(value.__dynamicConclusionTerm),
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }

  return rule;
}

function revivePrefixEnv(value) {
  if (value instanceof PrefixEnv) return value;
  if (!isEyelingPrefixEnvLike(value)) return PrefixEnv.newDefault();
  return new PrefixEnv({ ...(value.map || {}) }, value.baseIri || '');
}

function reviveRuleArray(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array of Eyeling Rule objects`);
  return value.map((item) => reviveEyelingRule(item));
}

function reviveTripleArray(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array of Eyeling Triple objects`);
  return value.map((item) => reviveEyelingTriple(item));
}

function serializePrefixEnv(prefixes) {
  const pref = revivePrefixEnv(prefixes);
  const out = [];

  if (pref.baseIri) out.push(`@base <${pref.baseIri}> .`);

  for (const [name, iri] of Object.entries(pref.map || {})) {
    if (!iri) continue;
    out.push(`@prefix ${name ? `${name}:` : ':'} <${iri}> .`);
  }

  return out.join('\n');
}

function serializeFormulaTriples(triples, prefixes) {
  if (!Array.isArray(triples) || triples.length === 0) return '{ }';
  return `{
${triples.map((tr) => `  ${tripleToN3(tr, prefixes)}`).join('\n')}
}`;
}

function serializeRuleHead(rule, prefixes) {
  if (rule.isFuse) return 'false';
  if (rule.__dynamicConclusionTerm) return termToN3(rule.__dynamicConclusionTerm, prefixes);
  if (!Array.isArray(rule.conclusion) || rule.conclusion.length === 0) return 'true';
  return serializeFormulaTriples(rule.conclusion, prefixes);
}

function serializeRulePremise(rule, prefixes) {
  if (!Array.isArray(rule.premise) || rule.premise.length === 0) return 'true';
  return serializeFormulaTriples(rule.premise, prefixes);
}

function serializeRule(rule, prefixes) {
  if (rule.isForward === false) {
    const head =
      rule.conclusion && rule.conclusion.length ? serializeFormulaTriples(rule.conclusion, prefixes) : 'true';
    return `${head} <= ${serializeRulePremise(rule, prefixes)} .`;
  }
  return `${serializeRulePremise(rule, prefixes)} => ${serializeRuleHead(rule, prefixes)} .`;
}

function serializeQueryRule(rule, prefixes) {
  return `${serializeRulePremise(rule, prefixes)} log:query ${serializeRuleHead(rule, prefixes)} .`;
}

function serializeEyelingDocument(doc) {
  const prefixes = revivePrefixEnv(doc.prefixes);
  const prefixText = serializePrefixEnv(prefixes);
  const tripleText = (doc.triples || []).map((tr) => tripleToN3(tr, prefixes)).join('\n');
  const fruleText = (doc.frules || []).map((rule) => serializeRule(rule, prefixes)).join('\n');
  const bruleText = (doc.brules || []).map((rule) => serializeRule(rule, prefixes)).join('\n');
  const qruleText = (doc.logQueryRules || []).map((rule) => serializeQueryRule(rule, prefixes)).join('\n');
  return joinN3Sections([prefixText, tripleText, fruleText, bruleText, qruleText]);
}

function parseAstBundle(bundle) {
  if (!isEyelingAstBundleLike(bundle))
    throw new TypeError('Expected an Eyeling AST bundle [prefixes, triples, forwardRules, backwardRules,? queryRules]');
  return {
    prefixes: revivePrefixEnv(bundle[0]),
    triples: reviveTripleArray(bundle[1], 'ast[1]'),
    frules: reviveRuleArray(bundle[2], 'ast[2]'),
    brules: reviveRuleArray(bundle[3], 'ast[3]'),
    logQueryRules: reviveRuleArray(bundle[4] || [], 'ast[4]'),
  };
}

function combineDocuments(base, extra) {
  return {
    prefixes: extra.prefixes || base.prefixes,
    triples: base.triples.concat(extra.triples || []),
    frules: base.frules.concat(extra.frules || []),
    brules: base.brules.concat(extra.brules || []),
    logQueryRules: base.logQueryRules.concat(extra.logQueryRules || []),
  };
}

function emptyDocument() {
  return {
    prefixes: PrefixEnv.newDefault(),
    triples: [],
    frules: [],
    brules: [],
    logQueryRules: [],
  };
}

function hasEyelingObjectInput(input) {
  if (isEyelingAstBundleLike(input)) return true;
  if (!isObject(input)) return false;
  if (
    isEyelingAstBundleLike(input.ast) ||
    isEyelingAstBundleLike(input.document) ||
    isEyelingAstBundleLike(input.rules)
  )
    return true;
  if (isEyelingPrefixEnvLike(input.prefixes)) return true;
  if (Array.isArray(input.triples) || Array.isArray(input.forwardRules) || Array.isArray(input.frules)) return true;
  if (Array.isArray(input.backwardRules) || Array.isArray(input.brules)) return true;
  if (Array.isArray(input.queryRules) || Array.isArray(input.logQueryRules) || Array.isArray(input.qrules)) return true;
  if (Array.isArray(input.rules) && input.rules.some((item) => isEyelingRuleLike(item))) return true;
  return false;
}

function parseEyelingDocumentBase(input) {
  if (isEyelingAstBundleLike(input)) return parseAstBundle(input);
  if (!isObject(input)) return null;

  let doc = emptyDocument();
  let found = false;

  const embeddedAst = input.ast || input.document;
  if (isEyelingAstBundleLike(embeddedAst)) {
    doc = combineDocuments(doc, parseAstBundle(embeddedAst));
    found = true;
  }

  if (isEyelingAstBundleLike(input.rules)) {
    doc = combineDocuments(doc, parseAstBundle(input.rules));
    found = true;
  } else if (Array.isArray(input.rules) && input.rules.some((item) => isEyelingRuleLike(item))) {
    doc.frules = doc.frules.concat(reviveRuleArray(input.rules, 'input.rules'));
    found = true;
  }

  if (isEyelingPrefixEnvLike(input.prefixes)) {
    doc.prefixes = revivePrefixEnv(input.prefixes);
    found = true;
  }

  if (Array.isArray(input.triples)) {
    doc.triples = doc.triples.concat(reviveTripleArray(input.triples, 'input.triples'));
    found = true;
  }

  if (Array.isArray(input.forwardRules)) {
    doc.frules = doc.frules.concat(reviveRuleArray(input.forwardRules, 'input.forwardRules'));
    found = true;
  }
  if (Array.isArray(input.frules)) {
    doc.frules = doc.frules.concat(reviveRuleArray(input.frules, 'input.frules'));
    found = true;
  }
  if (Array.isArray(input.backwardRules)) {
    doc.brules = doc.brules.concat(reviveRuleArray(input.backwardRules, 'input.backwardRules'));
    found = true;
  }
  if (Array.isArray(input.brules)) {
    doc.brules = doc.brules.concat(reviveRuleArray(input.brules, 'input.brules'));
    found = true;
  }
  if (Array.isArray(input.queryRules)) {
    doc.logQueryRules = doc.logQueryRules.concat(reviveRuleArray(input.queryRules, 'input.queryRules'));
    found = true;
  }
  if (Array.isArray(input.logQueryRules)) {
    doc.logQueryRules = doc.logQueryRules.concat(reviveRuleArray(input.logQueryRules, 'input.logQueryRules'));
    found = true;
  }
  if (Array.isArray(input.qrules)) {
    doc.logQueryRules = doc.logQueryRules.concat(reviveRuleArray(input.qrules, 'input.qrules'));
    found = true;
  }

  return found ? doc : null;
}

function appendSyncQuadFacts(doc, input) {
  const quadsInfo = pickInputQuadIterable(input);
  if (!quadsInfo) return doc;
  const quads = collectIterableToArray(quadsInfo.value, quadsInfo.label);
  return {
    ...doc,
    triples: doc.triples.concat(quads.map((quad) => rdfJsQuadToInternalTriple(quad))),
  };
}

async function appendAsyncQuadFacts(doc, input) {
  const quadsInfo = pickInputQuadIterable(input);
  if (!quadsInfo) return doc;
  const quads = await collectAsyncIterableToArray(quadsInfo.value, quadsInfo.label);
  return {
    ...doc,
    triples: doc.triples.concat(quads.map((quad) => rdfJsQuadToInternalTriple(quad))),
  };
}

function normalizeParsedReasonerInputSync(input) {
  const baseDoc = parseEyelingDocumentBase(input);
  if (!baseDoc) return null;
  return appendSyncQuadFacts(baseDoc, input);
}

async function normalizeParsedReasonerInputAsync(input) {
  const baseDoc = parseEyelingDocumentBase(input);
  if (!baseDoc) return null;
  return appendAsyncQuadFacts(baseDoc, input);
}

function normalizeReasonerInputSync(input) {
  if (typeof input === 'string') return input;
  const parsed = normalizeParsedReasonerInputSync(input);
  if (parsed) return serializeEyelingDocument(parsed);
  if (!isObject(input)) {
    throw new TypeError(
      'Reasoner input must be an N3 string, an Eyeling AST/rule object, or an object containing RDF/JS quads plus optional rules',
    );
  }
  if (typeof input.n3 === 'string') return input.n3;

  const quadsInfo = pickInputQuadIterable(input);
  const rulesText = getRulesText(input);
  const factsText = getFactsText(input);
  const prefixesText = getPrefixesText(input);

  if (!quadsInfo) {
    if (rulesText || factsText || prefixesText) return joinN3Sections([prefixesText, factsText, rulesText]);
    throw new TypeError('Input object must provide n3 text, Eyeling AST/rule objects, or RDF/JS quads/facts/dataset');
  }

  const quads = collectIterableToArray(quadsInfo.value, quadsInfo.label);
  const quadText = quads.map((quad) => rdfJsQuadToN3(quad)).join('\n');
  return joinN3Sections([prefixesText, factsText, quadText, rulesText]);
}

async function normalizeReasonerInputAsync(input) {
  if (typeof input === 'string') return input;
  const parsed = await normalizeParsedReasonerInputAsync(input);
  if (parsed) return serializeEyelingDocument(parsed);
  if (!isObject(input)) {
    throw new TypeError(
      'Reasoner input must be an N3 string, an Eyeling AST/rule object, or an object containing RDF/JS quads plus optional rules',
    );
  }
  if (typeof input.n3 === 'string') return input.n3;

  const quadsInfo = pickInputQuadIterable(input);
  const rulesText = getRulesText(input);
  const factsText = getFactsText(input);
  const prefixesText = getPrefixesText(input);

  if (!quadsInfo) {
    if (rulesText || factsText || prefixesText) return joinN3Sections([prefixesText, factsText, rulesText]);
    throw new TypeError('Input object must provide n3 text, Eyeling AST/rule objects, or RDF/JS quads/facts/dataset');
  }

  const quads = await collectAsyncIterableToArray(quadsInfo.value, quadsInfo.label);
  const quadText = quads.map((quad) => rdfJsQuadToN3(quad)).join('\n');
  return joinN3Sections([prefixesText, factsText, quadText, rulesText]);
}

module.exports = {
  dataFactory,
  getDataFactory,
  isRdfJsTerm,
  isRdfJsQuad,
  rdfJsTermToN3,
  rdfJsQuadToN3,
  rdfJsQuadToInternalTriple,
  internalTermToRdfJs,
  internalTripleToRdfJsQuad,
  normalizeParsedReasonerInputSync,
  normalizeReasonerInputSync,
  normalizeReasonerInputAsync,
  hasEyelingObjectInput,
};
