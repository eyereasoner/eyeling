// RDF 1.2 / Notation3 compatibility layer.
//
// The core eyelang parser intentionally stays small and Prolog-like.  This file
// accepts a practical Turtle/N-Triples/N3 subset and lowers it to ordinary
// eyelang clauses over rdf/3:
//
//   rdf(Subject, Predicate, Object).
//
// RDF terms are represented explicitly so they cannot collide with ordinary
// eyelang atoms:
//
//   iri("https://example.org/s")
//   bnode("b0")
//   literal("Alice", iri("http://www.w3.org/2001/XMLSchema#string"), "", "")
//   triple(Subject, Predicate, Object)        % RDF 1.2 triple term
//
// N3 rules of the form `{ ... } => { ... } .` become Horn clauses whose heads
// and bodies are rdf/3 goals.  RDF 1.2 reified triples and annotation syntax are
// expanded to rdf:reifies triples.
import { atom, compound, listFromItems, numberTerm, stringTerm, termToString, variable } from './term.mjs';

const TOKEN = {
  EOF: 'eof', IRI: 'iri', STRING: 'string', NUMBER: 'number', NAME: 'name', BNODE: 'bnode', VAR: 'var', LANG: 'lang', ATWORD: 'atword',
  DOT: '.', COMMA: ',', SEMI: ';', LBRACKET: '[', RBRACKET: ']', LPAREN: '(', RPAREN: ')', LBRACE: '{', RBRACE: '}',
  TT_START: '<<(', TT_END: ')>>', REIF_START: '<<', REIF_END: '>>', ANNO_START: '{|', ANNO_END: '|}', HATHAT: '^^', TILDE: '~', IMPLIES: '=>', IMPLIED_BY: '<=',
};

export const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
export const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';
export const OWL_NS = 'http://www.w3.org/2002/07/owl#';
export const CRYPTO_NS = 'http://www.w3.org/2000/10/swap/crypto#';
export const LIST_NS = 'http://www.w3.org/2000/10/swap/list#';
export const LOG_NS = 'http://www.w3.org/2000/10/swap/log#';
export const MATH_NS = 'http://www.w3.org/2000/10/swap/math#';
export const STRING_NS = 'http://www.w3.org/2000/10/swap/string#';
export const TIME_NS = 'http://www.w3.org/2000/10/swap/time#';

export const RDF_TYPE = `${RDF_NS}type`;
export const RDF_REIFIES = `${RDF_NS}reifies`;
export const RDF_FIRST = `${RDF_NS}first`;
export const RDF_REST = `${RDF_NS}rest`;
export const RDF_NIL = `${RDF_NS}nil`;
export const RDF_LANG_STRING = `${RDF_NS}langString`;
export const RDF_DIR_LANG_STRING = `${RDF_NS}dirLangString`;
export const XSD_STRING = `${XSD_NS}string`;
export const XSD_INTEGER = `${XSD_NS}integer`;
export const XSD_DECIMAL = `${XSD_NS}decimal`;
export const XSD_DOUBLE = `${XSD_NS}double`;
export const XSD_BOOLEAN = `${XSD_NS}boolean`;

const DEFAULT_PREFIXES = new Map([
  ['rdf', RDF_NS],
  ['rdfs', RDFS_NS],
  ['xsd', XSD_NS],
  ['owl', OWL_NS],
  ['crypto', CRYPTO_NS],
  ['list', LIST_NS],
  ['log', LOG_NS],
  ['math', MATH_NS],
  ['string', STRING_NS],
  ['time', TIME_NS],
]);

export function rdfIri(iri) {
  return compound('iri', [stringTerm(String(iri ?? ''))]);
}

export function rdfBlank(label) {
  return compound('bnode', [stringTerm(String(label ?? ''))]);
}

export function rdfLiteral(value, datatype = XSD_STRING, lang = '', direction = '') {
  return compound('literal', [stringTerm(String(value ?? '')), rdfIri(datatype), stringTerm(lang ?? ''), stringTerm(direction ?? '')]);
}

export function rdfTripleTerm(subject, predicate, object) {
  return compound('triple', [subject, predicate, object]);
}

export function rdfGoal(subject, predicate, object) {
  return compound('rdf', [subject, predicate, object]);
}

export function filenameLooksRdf(filename = '') {
  return /\.(?:ttl|nt|n3)$/i.test(String(filename));
}

export function parseRdfClauses(source, options = {}) {
  return new RdfParser(source, options).parseDocument();
}

export function rdfToEyelang(source, options = {}) {
  return clausesToEyelang(parseRdfClauses(source, options));
}

export function clausesToEyelang(clauses) {
  return clauses.map((clause) => {
    const head = termToString(clause.head, undefined, true);
    if (!clause.body?.length) return `${head}.\n`;
    return `${head} :- ${clause.body.map((goal) => termToString(goal, undefined, true)).join(', ')}.\n`;
  }).join('');
}

class RdfTokenizer {
  constructor(source, filename = '<rdf>') {
    this.source = String(source ?? '');
    this.filename = filename;
    this.pos = 0;
    this.line = 1;
  }
  peek(offset = 0) {
    return this.source[this.pos + offset] ?? '';
  }
  starts(text) {
    return this.source.startsWith(text, this.pos);
  }
  take() {
    const ch = this.peek();
    if (ch) {
      this.pos++;
      if (ch === '\n') this.line++;
    }
    return ch;
  }
  token(type, text, line = this.line, value = text) {
    return { type, text, value, line };
  }
  skipSpaceAndComments() {
    while (true) {
      while (/\s/.test(this.peek())) this.take();
      if (this.peek() === '#') {
        while (this.peek() && this.peek() !== '\n') this.take();
        continue;
      }
      break;
    }
  }
  nextToken() {
    this.skipSpaceAndComments();
    const line = this.line;
    const ch = this.peek();
    if (!ch) return this.token(TOKEN.EOF, '', line);

    if (this.starts('<<(')) { this.pos += 3; return this.token(TOKEN.TT_START, '<<(', line); }
    if (this.starts(')>>')) { this.pos += 3; return this.token(TOKEN.TT_END, ')>>', line); }
    if (this.starts('<<')) { this.pos += 2; return this.token(TOKEN.REIF_START, '<<', line); }
    if (this.starts('>>')) { this.pos += 2; return this.token(TOKEN.REIF_END, '>>', line); }
    if (this.starts('{|')) { this.pos += 2; return this.token(TOKEN.ANNO_START, '{|', line); }
    if (this.starts('|}')) { this.pos += 2; return this.token(TOKEN.ANNO_END, '|}', line); }
    if (this.starts('^^')) { this.pos += 2; return this.token(TOKEN.HATHAT, '^^', line); }
    if (this.starts('=>')) { this.pos += 2; return this.token(TOKEN.IMPLIES, '=>', line); }
    if (this.starts('<=')) { this.pos += 2; return this.token(TOKEN.IMPLIED_BY, '<=', line); }

    if (ch === '<') return this.readIri(line);
    if (ch === '"' || ch === "'") return this.readString(line);
    if (ch === '@') return this.readAtToken(line);
    if (ch === '?' || (ch === '$' && this.peek(1) && !/\s/.test(this.peek(1)))) return this.readVariable(line);
    if (ch === '_' && this.peek(1) === ':') return this.readBlankNode(line);

    const punct = {
      '.': TOKEN.DOT, ',': TOKEN.COMMA, ';': TOKEN.SEMI, '[': TOKEN.LBRACKET, ']': TOKEN.RBRACKET,
      '(': TOKEN.LPAREN, ')': TOKEN.RPAREN, '{': TOKEN.LBRACE, '}': TOKEN.RBRACE, '~': TOKEN.TILDE,
    };
    if (punct[ch]) {
      this.take();
      return this.token(punct[ch], ch, line);
    }

    if (isNumberStart(this.source, this.pos)) return this.readNumber(line);
    return this.readName(line);
  }
  readIri(line) {
    this.take();
    let value = '';
    while (true) {
      if (!this.peek()) this.fail(line, 'unterminated IRI reference');
      let ch = this.take();
      if (ch === '>') break;
      if (ch === '\\') ch = this.readEscape(line, true);
      value += ch;
    }
    return this.token(TOKEN.IRI, `<${value}>`, line, value);
  }
  readString(line) {
    const quote = this.take();
    const long = this.peek() === quote && this.peek(1) === quote;
    if (long) { this.take(); this.take(); }
    let value = '';
    while (true) {
      if (!this.peek()) this.fail(line, 'unterminated string literal');
      if (long && this.peek() === quote && this.peek(1) === quote && this.peek(2) === quote) {
        this.take(); this.take(); this.take();
        break;
      }
      let ch = this.take();
      if (!long && ch === quote) break;
      if (ch === '\\') ch = this.readEscape(line, false);
      value += ch;
    }
    return this.token(TOKEN.STRING, value, line, value);
  }
  readEscape(line, iriMode) {
    const ch = this.take();
    if (!ch) this.fail(line, 'unterminated escape');
    if (ch === 'u' || ch === 'U') {
      const width = ch === 'u' ? 4 : 8;
      let hex = '';
      for (let i = 0; i < width; i++) {
        const h = this.take();
        if (!/[0-9A-Fa-f]/.test(h)) this.fail(line, `bad Unicode escape`);
        hex += h;
      }
      return String.fromCodePoint(Number.parseInt(hex, 16));
    }
    if (iriMode) return ch;
    const escapes = { t: '\t', b: '\b', n: '\n', r: '\r', f: '\f', '"': '"', "'": "'", '\\': '\\' };
    return escapes[ch] ?? ch;
  }
  readAtToken(line) {
    this.take();
    let text = '@';
    while (this.peek() && /[A-Za-z0-9_-]/.test(this.peek())) text += this.take();
    if (['@prefix', '@base', '@version', '@forAll', '@forSome', '@keywords'].includes(text)) return this.token(TOKEN.ATWORD, text, line, text.slice(1));
    return this.token(TOKEN.LANG, text, line, text.slice(1));
  }
  readVariable(line) {
    const sigil = this.take();
    let name = '';
    while (this.peek() && /[A-Za-z0-9_\-]/.test(this.peek())) name += this.take();
    if (!name) this.fail(line, 'empty variable name');
    return this.token(TOKEN.VAR, `${sigil}${name}`, line, name);
  }
  readBlankNode(line) {
    this.pos += 2;
    let name = '';
    while (this.peek() && /[^\s\[\]\(\)\{\};,<>"'`]/.test(this.peek())) {
      const ch = this.peek();
      if (ch === '.') break;
      name += this.take();
    }
    if (!name) this.fail(line, 'empty blank node label');
    return this.token(TOKEN.BNODE, `_:${name}`, line, name);
  }
  readNumber(line) {
    const start = this.pos;
    if (this.peek() === '+' || this.peek() === '-') this.take();
    while (/[0-9]/.test(this.peek())) this.take();
    if (this.peek() === '.' && /[0-9]/.test(this.source[this.pos + 1] ?? '')) {
      this.take();
      while (/[0-9]/.test(this.peek())) this.take();
    }
    if (this.peek() === 'e' || this.peek() === 'E') {
      const save = this.pos;
      this.take();
      if (this.peek() === '+' || this.peek() === '-') this.take();
      if (!/[0-9]/.test(this.peek())) this.pos = save;
      else while (/[0-9]/.test(this.peek())) this.take();
    }
    const text = this.source.slice(start, this.pos);
    return this.token(TOKEN.NUMBER, text, line, text);
  }
  readName(line) {
    const start = this.pos;
    while (this.peek() && !isNameStop(this.peek())) this.take();
    if (this.pos === start) this.fail(line, `bad character ${JSON.stringify(this.peek())}`);
    const text = this.source.slice(start, this.pos);
    return this.token(TOKEN.NAME, text, line, text);
  }
  fail(line, message) {
    throw new Error(`${this.filename}:${line}: ${message}`);
  }
}

function isNameStop(ch) {
  return /\s/.test(ch) || '.;,[](){}<>^"\'`|'.includes(ch) || ch === '#';
}

function isNumberStart(source, pos) {
  const ch = source[pos] ?? '';
  const next = source[pos + 1] ?? '';
  if (/[0-9]/.test(ch)) return true;
  if ((ch === '+' || ch === '-') && /[0-9.]/.test(next)) return true;
  if (ch === '.' && /[0-9]/.test(next)) return true;
  return false;
}

class RdfParser {
  constructor(source, options = {}) {
    this.filename = options.filename ?? '<rdf>';
    this.tokens = new RdfTokenizer(source, this.filename);
    this.token = this.tokens.nextToken();
    this.prefixes = new Map(DEFAULT_PREFIXES);
    for (const [prefix, iri] of Object.entries(options.prefixes ?? {})) this.prefixes.set(prefix, String(iri));
    this.base = options.baseIRI ?? options.base ?? '';
    this.blankCounter = 0;
    this.variableNames = new Map();
    this.collectionTerms = new Map();
    this.clauses = [];
    this.sourceMetadata = options.sourceMetadata !== false;
    this.addMaterialize = options.materializeRdf !== false;
  }
  parseDocument() {
    if (this.addMaterialize) this.pushClause(compound('materialize', [atom('rdf'), numberTerm('3')]), [], this.token.line);
    while (this.token.type !== TOKEN.EOF) {
      if (this.consumeOptionalDot()) continue;
      if (this.parseDirective()) continue;
      if (this.token.type === TOKEN.LBRACE) this.parseN3Rule();
      else {
        this.parseTriples(null);
        this.expect(TOKEN.DOT, '.');
        this.advance();
      }
    }
    return this.clauses;
  }
  parseDirective() {
    if (this.token.type === TOKEN.ATWORD) {
      const name = this.token.value;
      const oldStyle = true;
      this.advance();
      if (name === 'prefix') this.parsePrefixDirective(oldStyle);
      else if (name === 'base') this.parseBaseDirective(oldStyle);
      else if (name === 'version') this.parseVersionDirective(oldStyle);
      else if (name === 'forAll' || name === 'forSome' || name === 'keywords') this.skipDirectiveLikeStatement();
      else this.fail(`unsupported @ directive @${name}`);
      return true;
    }
    if (this.token.type !== TOKEN.NAME) return false;
    const upper = this.token.text.toUpperCase();
    if (upper === 'PREFIX' || upper === 'BASE' || upper === 'VERSION') {
      this.advance();
      if (upper === 'PREFIX') this.parsePrefixDirective(false);
      else if (upper === 'BASE') this.parseBaseDirective(false);
      else this.parseVersionDirective(false);
      return true;
    }
    return false;
  }
  parsePrefixDirective(oldStyle) {
    this.expect(TOKEN.NAME, 'prefix name');
    const prefixToken = this.token.text;
    if (!prefixToken.endsWith(':')) this.fail('prefix name must end with :');
    const prefix = prefixToken.slice(0, -1);
    this.advance();
    this.expect(TOKEN.IRI, 'prefix IRI');
    this.prefixes.set(prefix, this.resolveIri(this.token.value));
    this.advance();
    if (oldStyle) { this.expect(TOKEN.DOT, '.'); this.advance(); }
  }
  parseBaseDirective(oldStyle) {
    this.expect(TOKEN.IRI, 'base IRI');
    this.base = this.resolveIri(this.token.value);
    this.advance();
    if (oldStyle) { this.expect(TOKEN.DOT, '.'); this.advance(); }
  }
  parseVersionDirective(oldStyle) {
    this.expect(TOKEN.STRING, 'version string');
    this.advance();
    if (oldStyle) { this.expect(TOKEN.DOT, '.'); this.advance(); }
  }
  skipDirectiveLikeStatement() {
    while (this.token.type !== TOKEN.EOF && this.token.type !== TOKEN.DOT) this.advance();
    if (this.token.type === TOKEN.DOT) this.advance();
  }
  parseN3Rule() {
    const line = this.token.line;
    const first = [];
    this.parseFormula(first, { rawTriples: true });
    if (this.token.type === TOKEN.IMPLIES) {
      this.advance();
      const second = this.parseRuleFormula({ rawTriples: true });
      this.expect(TOKEN.DOT, '.');
      this.advance();
      const body = this.lowerFormula(first, 'body');
      const heads = this.lowerFormula(second, 'head');
      for (const head of heads) this.pushClause(head, body, line);
      return;
    }
    if (this.token.type === TOKEN.IMPLIED_BY) {
      this.advance();
      const second = this.parseRuleFormula({ rawTriples: true });
      this.expect(TOKEN.DOT, '.');
      this.advance();
      const heads = this.lowerFormula(first, 'head');
      const body = this.lowerFormula(second, 'body');
      for (const head of heads) this.pushClause(head, body, line);
      return;
    }
    this.fail('expected => or <= after N3 formula');
  }
  parseRuleFormula(options = {}) {
    if (this.token.type === TOKEN.NAME && this.token.text === 'true') {
      this.advance();
      return [];
    }
    const triples = [];
    this.parseFormula(triples, options);
    return triples;
  }
  lowerFormula(triples, role) {
    return triples.map(({ subject, predicate, object }) => {
      const s = this.collectionOrSelf(subject);
      const p = this.collectionOrSelf(predicate);
      const o = this.collectionOrSelf(object);
      const builtin = role === 'body' ? this.n3BuiltinGoal(s, p, o) : null;
      return builtin ?? rdfGoal(s, p, o);
    });
  }
  parseFormula(sink, options = {}) {
    this.expect(TOKEN.LBRACE, '{');
    this.advance();
    while (this.token.type !== TOKEN.RBRACE && this.token.type !== TOKEN.EOF) {
      if (this.consumeOptionalDot()) continue;
      if (this.parseDirective()) continue;
      this.parseTriples(sink, options);
      if (this.token.type === TOKEN.DOT) this.advance();
      else if (this.token.type !== TOKEN.RBRACE) this.expect(TOKEN.DOT, '.');
    }
    this.expect(TOKEN.RBRACE, '}');
    this.advance();
  }
  parseTriples(sink, options = {}) {
    const subject = this.parseSubject(sink);
    this.parsePredicateObjectList(subject, sink, options);
  }
  parsePredicateObjectList(subject, sink, options = {}) {
    while (true) {
      if (this.token.type === TOKEN.RBRACKET || this.token.type === TOKEN.ANNO_END || this.token.type === TOKEN.RBRACE || this.token.type === TOKEN.DOT) break;
      const predicate = this.parseVerb();
      this.parseObjectList(subject, predicate, sink, options);
      if (this.token.type !== TOKEN.SEMI) break;
      while (this.token.type === TOKEN.SEMI) this.advance();
      if (this.token.type === TOKEN.RBRACKET || this.token.type === TOKEN.ANNO_END || this.token.type === TOKEN.RBRACE || this.token.type === TOKEN.DOT) break;
    }
  }
  parseObjectList(subject, predicate, sink, options = {}) {
    while (true) {
      const object = this.parseObject(sink);
      const tripleTerm = rdfTripleTerm(subject, predicate, object);
      this.emitTriple(subject, predicate, object, sink, options);
      this.parseAnnotations(tripleTerm, sink, options);
      if (this.token.type !== TOKEN.COMMA) break;
      this.advance();
    }
  }
  parseAnnotations(tripleTerm, sink, options = {}) {
    let lastReifier = null;
    while (this.token.type === TOKEN.TILDE || this.token.type === TOKEN.ANNO_START) {
      if (this.token.type === TOKEN.TILDE) {
        this.advance();
        const reifier = this.canStartReifierTerm() ? this.parseReifierTerm(sink) : this.freshBlank();
        this.emitTriple(reifier, rdfIri(RDF_REIFIES), tripleTerm, sink, options);
        lastReifier = reifier;
        if (this.token.type === TOKEN.ANNO_START) {
          this.parseAnnotationBlock(lastReifier, sink, options);
          lastReifier = null;
        }
      } else {
        const reifier = lastReifier ?? this.freshBlank();
        this.emitTriple(reifier, rdfIri(RDF_REIFIES), tripleTerm, sink, options);
        this.parseAnnotationBlock(reifier, sink, options);
        lastReifier = null;
      }
    }
  }
  parseAnnotationBlock(reifier, sink, options = {}) {
    this.expect(TOKEN.ANNO_START, '{|');
    this.advance();
    if (this.token.type !== TOKEN.ANNO_END) this.parsePredicateObjectList(reifier, sink, options);
    this.expect(TOKEN.ANNO_END, '|}');
    this.advance();
  }
  parseSubject(sink) {
    if (this.token.type === TOKEN.REIF_START) return this.parseReifiedTriple(sink);
    return this.parseTerm(sink, { role: 'subject' });
  }
  parseObject(sink) {
    return this.parseTerm(sink, { role: 'object' });
  }
  parseReifierTerm(sink) {
    if (this.token.type === TOKEN.REIF_START) return this.parseReifiedTriple(sink);
    return this.parseTerm(sink, { role: 'reifier' });
  }
  parseVerb() {
    if (this.token.type === TOKEN.NAME && this.token.text === 'a') {
      this.advance();
      return rdfIri(RDF_TYPE);
    }
    if (this.token.type === TOKEN.NAME && this.token.text === '=') {
      this.advance();
      return rdfIri(`${OWL_NS}sameAs`);
    }
    if (this.token.type === TOKEN.VAR) return this.parseVariable();
    return this.parseIri();
  }
  parseTerm(sink, { role }) {
    switch (this.token.type) {
      case TOKEN.IRI: return this.parseIri();
      case TOKEN.NAME: {
        if (role === 'object' && (this.token.text === 'true' || this.token.text === 'false')) return this.parseBooleanLiteral();
        return this.parseIri();
      }
      case TOKEN.BNODE: return this.parseBlankNode();
      case TOKEN.VAR: return this.parseVariable();
      case TOKEN.STRING: return this.parseStringLiteral();
      case TOKEN.NUMBER: return this.parseNumericLiteral();
      case TOKEN.LBRACKET: return this.parseBlankNodePropertyList(sink);
      case TOKEN.LPAREN: return this.parseCollection(sink);
      case TOKEN.TT_START: return this.parseTripleTerm(sink);
      case TOKEN.REIF_START: return this.parseReifiedTriple(sink);
      default: this.fail(`expected ${role} term, got ${this.token.text || this.token.type}`);
    }
  }
  parseIri() {
    if (this.token.type === TOKEN.IRI) {
      const iri = this.resolveIri(this.token.value);
      this.advance();
      return rdfIri(iri);
    }
    if (this.token.type !== TOKEN.NAME) this.expect(TOKEN.IRI, 'IRI or prefixed name');
    const text = this.token.text;
    if (!text.includes(':')) this.fail(`expected prefixed name or IRI, got ${text}`);
    const iri = this.expandPrefixedName(text);
    this.advance();
    return rdfIri(iri);
  }
  parseBlankNode() {
    const label = this.token.value;
    this.advance();
    return rdfBlank(label);
  }
  parseVariable() {
    const sourceName = this.token.value;
    this.advance();
    if (!this.variableNames.has(sourceName)) this.variableNames.set(sourceName, variable(toEyelangVariableName(sourceName)));
    return this.variableNames.get(sourceName);
  }
  parseStringLiteral() {
    const value = this.token.value;
    this.advance();
    if (this.token.type === TOKEN.LANG) {
      const { lang, direction } = parseLangDir(this.token.value, this.token.line, this.filename);
      this.advance();
      return rdfLiteral(value, direction ? RDF_DIR_LANG_STRING : RDF_LANG_STRING, lang, direction);
    }
    if (this.token.type === TOKEN.HATHAT) {
      this.advance();
      const datatype = iriStringValue(this.parseIri());
      return rdfLiteral(value, datatype, '', '');
    }
    return rdfLiteral(value, XSD_STRING, '', '');
  }
  parseNumericLiteral() {
    const text = this.token.text;
    this.advance();
    const datatype = /[eE]/.test(text) ? XSD_DOUBLE : text.includes('.') ? XSD_DECIMAL : XSD_INTEGER;
    return rdfLiteral(text, datatype, '', '');
  }
  parseBooleanLiteral() {
    const text = this.token.text;
    this.advance();
    return rdfLiteral(text, XSD_BOOLEAN, '', '');
  }
  parseBlankNodePropertyList(sink) {
    this.expect(TOKEN.LBRACKET, '[');
    this.advance();
    const node = this.freshBlank();
    if (this.token.type !== TOKEN.RBRACKET) this.parsePredicateObjectList(node, sink);
    this.expect(TOKEN.RBRACKET, ']');
    this.advance();
    return node;
  }
  parseCollection(sink) {
    this.expect(TOKEN.LPAREN, '(');
    this.advance();
    if (this.token.type === TOKEN.RPAREN) {
      this.advance();
      return rdfIri(RDF_NIL);
    }
    const items = [];
    while (this.token.type !== TOKEN.RPAREN && this.token.type !== TOKEN.EOF) items.push(this.parseObject(sink));
    this.expect(TOKEN.RPAREN, ')');
    this.advance();

    const nodes = items.map(() => this.freshBlank());
    if (!sink) {
      for (let i = 0; i < items.length; i++) {
        this.emitTriple(nodes[i], rdfIri(RDF_FIRST), items[i], sink);
        this.emitTriple(nodes[i], rdfIri(RDF_REST), i + 1 < nodes.length ? nodes[i + 1] : rdfIri(RDF_NIL), sink);
      }
    }
    const node = nodes[0] ?? rdfIri(RDF_NIL);
    this.collectionTerms.set(collectionKey(node), listFromItems(items));
    return node;
  }
  parseTripleTerm(sink) {
    this.expect(TOKEN.TT_START, '<<(');
    this.advance();
    const subject = this.parseTerm(sink, { role: 'triple-term subject' });
    const predicate = this.parseVerb();
    const object = this.parseTerm(sink, { role: 'triple-term object' });
    this.expect(TOKEN.TT_END, ')>>');
    this.advance();
    return rdfTripleTerm(subject, predicate, object);
  }
  parseReifiedTriple(sink) {
    this.expect(TOKEN.REIF_START, '<<');
    this.advance();
    const subject = this.token.type === TOKEN.REIF_START ? this.parseReifiedTriple(sink) : this.parseTerm(sink, { role: 'reified-triple subject' });
    const predicate = this.parseVerb();
    const object = this.parseTerm(sink, { role: 'reified-triple object' });
    let reifier = null;
    if (this.token.type === TOKEN.TILDE) {
      this.advance();
      reifier = this.canStartReifierTerm() ? this.parseReifierTerm(sink) : this.freshBlank();
    }
    this.expect(TOKEN.REIF_END, '>>');
    this.advance();
    reifier ??= this.freshBlank();
    this.emitTriple(reifier, rdfIri(RDF_REIFIES), rdfTripleTerm(subject, predicate, object), sink);
    return reifier;
  }
  canStartReifierTerm() {
    return this.token.type === TOKEN.IRI || this.token.type === TOKEN.NAME || this.token.type === TOKEN.BNODE || this.token.type === TOKEN.VAR || this.token.type === TOKEN.LBRACKET || this.token.type === TOKEN.REIF_START;
  }
  emitTriple(subject, predicate, object, sink, options = {}) {
    if (options.rawTriples && sink) {
      sink.push({ subject, predicate, object });
      return;
    }
    const s = this.collectionOrSelf(subject);
    const p = this.collectionOrSelf(predicate);
    const o = this.collectionOrSelf(object);
    const builtinGoal = options.role === 'body' ? this.n3BuiltinGoal(s, p, o) : null;
    const goal = builtinGoal ?? rdfGoal(s, p, o);
    if (sink) sink.push(goal);
    else this.pushClause(goal, [], this.token.line);
  }
  n3BuiltinGoal(subject, predicate, object) {
    const iri = iriStringValue(predicate);
    const name = n3BuiltinName(iri);
    if (!name) return null;
    return compound(name, [this.collectionOrSelf(subject), this.collectionOrSelf(object)]);
  }
  collectionOrSelf(term, seen = new Set()) {
    const key = collectionKey(term);
    if (!seen.has(key) && this.collectionTerms.has(key)) {
      seen.add(key);
      return this.collectionOrSelf(this.collectionTerms.get(key), seen);
    }
    if (term?.type === 'compound' && term.name === '.' && term.arity === 2) {
      return compound('.', [this.collectionOrSelf(term.args[0], seen), this.collectionOrSelf(term.args[1], seen)]);
    }
    return term;
  }
  pushClause(head, body = [], line = this.token.line) {
    const clause = { head, body: [...body] };
    if (this.sourceMetadata) clause.source = { filename: this.filename, line, clause: this.clauses.length + 1 };
    this.clauses.push(clause);
  }
  freshBlank() {
    return rdfBlank(`b${this.blankCounter++}`);
  }
  expandPrefixedName(text) {
    const colon = text.indexOf(':');
    const prefix = text.slice(0, colon);
    const local = text.slice(colon + 1);
    if (!this.prefixes.has(prefix)) this.fail(`unknown prefix ${prefix}:`);
    return `${this.prefixes.get(prefix)}${unescapeLocalName(local)}`;
  }
  resolveIri(value) {
    const iri = String(value ?? '');
    if (!this.base || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(iri)) return iri;
    try {
      return new URL(iri, this.base).href;
    } catch (_) {
      return iri;
    }
  }
  consumeOptionalDot() {
    if (this.token.type !== TOKEN.DOT) return false;
    this.advance();
    return true;
  }
  advance() {
    this.token = this.tokens.nextToken();
  }
  expect(type, desc = type) {
    if (this.token.type !== type) this.fail(`expected ${desc}, got ${this.token.text || this.token.type}`);
  }
  fail(message) {
    throw new Error(`${this.filename}:${this.token.line}: ${message}`);
  }
}


function collectionKey(term) {
  if (term?.type === 'compound' && term.name === 'bnode' && term.args.length === 1) return `bnode:${term.args[0].name}`;
  if (term?.type === 'compound' && term.name === 'iri' && term.args.length === 1 && term.args[0].name === RDF_NIL) return `iri:${RDF_NIL}`;
  return termToString(term, undefined, true);
}

const N3_BUILTIN_PREFIXES = [
  [MATH_NS, 'n3_math_'],
  [STRING_NS, 'n3_string_'],
  [LIST_NS, 'n3_list_'],
  [TIME_NS, 'n3_time_'],
  [CRYPTO_NS, 'n3_crypto_'],
  [LOG_NS, 'n3_log_'],
];

function n3BuiltinName(iri) {
  if (!iri || typeof iri !== 'string') return null;
  for (const [ns, prefix] of N3_BUILTIN_PREFIXES) {
    if (iri.startsWith(ns)) {
      const local = iri.slice(ns.length).replace(/[^A-Za-z0-9_]/g, '_');
      return local ? `${prefix}${local}` : null;
    }
  }
  return null;
}

function iriStringValue(term) {
  if (term?.type === 'compound' && term.name === 'iri' && term.args.length === 1) return term.args[0].name;
  return termToString(term, undefined, true);
}

function parseLangDir(value, line, filename) {
  const parts = String(value).split('--');
  const lang = parts[0];
  const direction = parts[1] ?? '';
  if (!lang || !/^[A-Za-z]+(?:-[A-Za-z0-9]+)*$/.test(lang)) throw new Error(`${filename}:${line}: malformed language tag @${value}`);
  if (direction && direction !== 'ltr' && direction !== 'rtl') throw new Error(`${filename}:${line}: RDF 1.2 literal direction must be ltr or rtl`);
  return { lang: lang.toLowerCase(), direction };
}

function unescapeLocalName(local) {
  return String(local).replace(/\\([_~.\-!$&'()*+,;=/?#@%])/g, '$1');
}

function toEyelangVariableName(name) {
  const clean = String(name ?? '').replace(/[^A-Za-z0-9_]/g, '_') || 'V';
  const first = clean[0];
  if (/[A-Z_]/.test(first)) return clean;
  return `${first.toUpperCase()}${clean.slice(1)}`;
}
