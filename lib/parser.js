/**
 * Eyeling Reasoner — parser
 *
 * Parser for the supported N3 syntax. Turns tokens into the internal term and
 * formula representation used by the engine.
 */

'use strict';

const {
  RDF_NS,
  OWL_NS,
  LOG_NS,
  resolveIriRef,
  Literal,
  Var,
  Blank,
  ListTerm,
  GraphTerm,
  Triple,
  Rule,
  internIri,
  internLiteral,
  PrefixEnv,
  collectBlankLabelsInTriples,
  isLogImplies,
  isLogImpliedBy,
  isLogQuery,
} = require('./prelude');

const { N3SyntaxError } = require('./lexer');
const { liftBlankRuleVars } = require('./rules');

function assertValidQNamePrefix(prefixName, fail, tok, context = 'prefixed name') {
  if (typeof prefixName === 'string' && prefixName.endsWith('.')) {
    fail(`Invalid ${context}: prefix names cannot end with '.'`, tok);
  }
}

class Parser {
  constructor(tokens) {
    this.toks = tokens;
    this.pos = 0;
    this.prefixes = PrefixEnv.newDefault();
    this.blankCounter = 0;
    // Helper triples that must be emitted *before* the triple that consumes them.
    // Used primarily for N3 path expansion (e.g. :a :p/:q :b .).
    this.pendingTriples = [];

    // Helper triples that should be emitted *after* the triple that references
    // the described term (used for [...] blank-node / IRI property lists). This
    // makes derived output read naturally, e.g. ':s :p _:b.' preceding
    // '_:b :q :r.'
    this.pendingTriplesAfter = [];
  }

  peek() {
    return this.toks[this.pos];
  }

  next() {
    const tok = this.toks[this.pos];
    this.pos += 1;
    return tok;
  }

  fail(message, tok = this.peek()) {
    const off = tok && typeof tok.offset === 'number' ? tok.offset : null;
    throw new N3SyntaxError(message, off);
  }

  expectDot() {
    const tok = this.next();
    if (tok.typ !== 'Dot') {
      this.fail(`Expected '.', got ${tok.toString()}`, tok);
    }
  }

  peekAt(offset) {
    return this.toks[this.pos + offset];
  }

  isIdentKeyword(tok, keyword) {
    return tok && tok.typ === 'Ident' && typeof tok.value === 'string' && tok.value.toLowerCase() === keyword;
  }

  canStartSparqlPrefixDirective() {
    const prefixNameTok = this.peekAt(1);
    const iriTok = this.peekAt(2);
    return (
      this.isIdentKeyword(this.peek(), 'prefix') &&
      prefixNameTok &&
      prefixNameTok.typ === 'Ident' &&
      typeof prefixNameTok.value === 'string' &&
      prefixNameTok.value.endsWith(':') &&
      iriTok &&
      (iriTok.typ === 'IriRef' || iriTok.typ === 'Ident')
    );
  }

  canStartSparqlBaseDirective(allowIdentIri = false) {
    const iriTok = this.peekAt(1);
    return (
      this.isIdentKeyword(this.peek(), 'base') &&
      iriTok &&
      (iriTok.typ === 'IriRef' || (allowIdentIri && iriTok.typ === 'Ident'))
    );
  }

  parseDirectiveIfPresent({ allowIdentBaseIri = false } = {}) {
    if (this.peek().typ === 'AtPrefix') {
      this.next();
      this.parsePrefixDirective();
      return true;
    }
    if (this.peek().typ === 'AtBase') {
      this.next();
      this.parseBaseDirective();
      return true;
    }
    if (this.canStartSparqlPrefixDirective()) {
      this.next();
      this.parseSparqlPrefixDirective();
      return true;
    }
    if (this.canStartSparqlBaseDirective(allowIdentBaseIri)) {
      this.next();
      this.parseSparqlBaseDirective();
      return true;
    }
    return false;
  }

  flushPendingTriples(out, { includeBefore = true, includeAfter = true } = {}) {
    if (includeBefore && this.pendingTriples.length > 0) {
      out.push(...this.pendingTriples);
      this.pendingTriples = [];
    }
    if (includeAfter && this.pendingTriplesAfter.length > 0) {
      out.push(...this.pendingTriplesAfter);
      this.pendingTriplesAfter = [];
    }
  }

  parseDocument() {
    const triples = [];
    const forwardRules = [];
    const backwardRules = [];
    const logQueries = [];

    while (this.peek().typ !== 'EOF') {
      if (this.parseDirectiveIfPresent({ allowIdentBaseIri: true })) {
        continue;
      }

      const first = this.parseTerm();
      if (this.peek().typ === 'OpImplies') {
        this.next();
        const second = this.parseTerm();
        this.expectDot();
        forwardRules.push(this.makeRule(first, second, true));
      } else if (this.peek().typ === 'OpImpliedBy') {
        this.next();
        const second = this.parseTerm();
        this.expectDot();
        backwardRules.push(this.makeRule(first, second, false));
      } else {
        let more;

        if (this.peek().typ === 'Dot') {
          // N3 grammar allows: triples ::= subject predicateObjectList?
          // So a bare subject followed by '.' is syntactically valid.
          // If the subject was a path / property-list that generated helper triples,
          // we emit those; otherwise this statement contributes no triples.
          more = [];
          this.flushPendingTriples(more);
          this.next(); // consume '.'
        } else {
          more = this.parsePredicateObjectList(first);
          this.expectDot();
        }

        // normalize explicit log:implies / log:impliedBy at top-level
        for (const tr of more) {
          if (isLogImplies(tr.p) && tr.s instanceof GraphTerm && tr.o instanceof GraphTerm) {
            forwardRules.push(this.makeRule(tr.s, tr.o, true));
          } else if (isLogImpliedBy(tr.p) && tr.s instanceof GraphTerm && tr.o instanceof GraphTerm) {
            backwardRules.push(this.makeRule(tr.s, tr.o, false));
          } else if (isLogQuery(tr.p) && tr.s instanceof GraphTerm && tr.o instanceof GraphTerm) {
            // Output-selection directive: { premise } log:query { conclusion }.
            // When present at top-level, eyeling prints only the instantiated conclusion
            // triples (unique) instead of all newly derived facts.
            logQueries.push(this.makeRule(tr.s, tr.o, true));
          } else {
            triples.push(tr);
          }
        }
      }
    }

    return [this.prefixes, triples, forwardRules, backwardRules, logQueries];
  }

  parsePrefixDirective() {
    const tok = this.next();
    if (tok.typ !== 'Ident') {
      this.fail(`Expected prefix name, got ${tok.toString()}`, tok);
    }
    const pref = tok.value || '';
    if (!pref.endsWith(':')) {
      this.fail("Invalid @prefix directive: prefix name must end with ':'", tok);
    }
    const prefName = pref.endsWith(':') ? pref.slice(0, -1) : pref;
    assertValidQNamePrefix(prefName, this.fail.bind(this), tok, '@prefix directive');

    if (this.peek().typ === 'Dot') {
      this.next();
      if (!Object.prototype.hasOwnProperty.call(this.prefixes.map, prefName)) {
        this.prefixes.set(prefName, '');
      }
      return;
    }

    const tok2 = this.next();
    let iri;
    if (tok2.typ === 'IriRef') {
      iri = resolveIriRef(tok2.value || '', this.prefixes.baseIri || '');
    } else if (tok2.typ === 'Ident') {
      iri = this.prefixes.expandQName(tok2.value || '');
    } else {
      this.fail(`Expected IRI after @prefix, got ${tok2.toString()}`, tok2);
    }
    this.expectDot();
    this.prefixes.set(prefName, iri);
  }

  parseBaseDirective() {
    const tok = this.next();
    let iri;
    if (tok.typ === 'IriRef') {
      iri = resolveIriRef(tok.value || '', this.prefixes.baseIri || '');
    } else if (tok.typ === 'Ident') {
      iri = tok.value || '';
    } else {
      this.fail(`Expected IRI after @base, got ${tok.toString()}`, tok);
    }
    this.expectDot();
    this.prefixes.setBase(iri);
  }

  parseSparqlPrefixDirective() {
    // SPARQL/Turtle-style PREFIX directive: PREFIX pfx: <iri>  (no trailing '.')
    const tok = this.next();
    if (tok.typ !== 'Ident') {
      this.fail(`Expected prefix name after PREFIX, got ${tok.toString()}`, tok);
    }
    const pref = tok.value || '';
    if (!pref.endsWith(':')) {
      this.fail("Invalid PREFIX directive: prefix name must end with ':'", tok);
    }
    const prefName = pref.endsWith(':') ? pref.slice(0, -1) : pref;
    assertValidQNamePrefix(prefName, this.fail.bind(this), tok, 'PREFIX directive');

    const tok2 = this.next();
    let iri;
    if (tok2.typ === 'IriRef') {
      iri = resolveIriRef(tok2.value || '', this.prefixes.baseIri || '');
    } else if (tok2.typ === 'Ident') {
      iri = this.prefixes.expandQName(tok2.value || '');
    } else {
      this.fail(`Expected IRI after PREFIX, got ${tok2.toString()}`, tok2);
    }

    // N3/Turtle: PREFIX directives do not have a trailing '.', but accept it permissively.
    if (this.peek().typ === 'Dot') this.next();

    this.prefixes.set(prefName, iri);
  }

  parseSparqlBaseDirective() {
    // SPARQL/Turtle-style BASE directive: BASE <iri>  (no trailing '.')
    const tok = this.next();
    let iri;
    if (tok.typ === 'IriRef') {
      iri = resolveIriRef(tok.value || '', this.prefixes.baseIri || '');
    } else if (tok.typ === 'Ident') {
      iri = tok.value || '';
    } else {
      this.fail(`Expected IRI after BASE, got ${tok.toString()}`, tok);
    }

    // N3/Turtle: BASE directives do not have a trailing '.', but accept it permissively.
    if (this.peek().typ === 'Dot') this.next();

    this.prefixes.setBase(iri);
  }

  parseTerm() {
    let t = this.parsePathItem();

    while (this.peek().typ === 'OpPathFwd' || this.peek().typ === 'OpPathRev') {
      const dir = this.next().typ; // OpPathFwd | OpPathRev
      const pred = this.parsePathItem();

      this.blankCounter += 1;
      const bn = new Blank(`_:b${this.blankCounter}`);

      this.pendingTriples.push(dir === 'OpPathFwd' ? new Triple(t, pred, bn) : new Triple(bn, pred, t));

      t = bn;
    }

    return t;
  }

  parsePathItem() {
    const tok = this.next();
    const typ = tok.typ;
    const val = tok.value;

    if (typ === 'Equals') {
      return internIri(OWL_NS + 'sameAs');
    }

    if (typ === 'IriRef') {
      const base = this.prefixes.baseIri || '';
      return internIri(resolveIriRef(val || '', base));
    }
    if (typ === 'Ident') {
      const name = val || '';
      if (name === 'a') {
        return internIri(RDF_NS + 'type');
      } else if (name.startsWith('_:')) {
        return new Blank(name);
      } else if (name.includes(':')) {
        assertValidQNamePrefix(name.split(':', 1)[0], this.fail.bind(this), tok);
        return internIri(this.prefixes.expandQName(name));
      } else {
        return internIri(name);
      }
    }

    if (typ === 'Literal') {
      let s = val || '';

      // Optional language tag: "..."@en, per N3 LANGTAG production.
      if (this.peek().typ === 'LangTag') {
        // Only quoted string literals can carry a language tag.
        if (!(s.startsWith('"') && s.endsWith('"'))) {
          this.fail('Language tag is only allowed on quoted string literals', this.peek());
        }
        const langTok = this.next();
        const lang = langTok.value || '';
        s = `${s}@${lang}`;

        // N3/Turtle: language tags and datatypes are mutually exclusive.
        if (this.peek().typ === 'HatHat') {
          this.fail('A literal cannot have both a language tag (@...) and a datatype (^^...)', this.peek());
        }
      }

      if (this.peek().typ === 'HatHat') {
        this.next();
        const dtTok = this.next();
        let dtIri;
        if (dtTok.typ === 'IriRef') {
          dtIri = dtTok.value || '';
        } else if (dtTok.typ === 'Ident') {
          const qn = dtTok.value || '';
          if (qn.includes(':')) {
            assertValidQNamePrefix(qn.split(':', 1)[0], this.fail.bind(this), dtTok, 'datatype prefixed name');
            dtIri = this.prefixes.expandQName(qn);
          } else dtIri = qn;
        } else {
          this.fail(`Expected datatype after ^^, got ${dtTok.toString()}`, dtTok);
        }
        s = `${s}^^<${dtIri}>`;
      }
      return internLiteral(s);
    }

    if (typ === 'Var') return new Var(val || '');
    if (typ === 'LParen') return this.parseList();
    if (typ === 'LBracket') return this.parseBlank();
    if (typ === 'LBrace') return this.parseGraph();

    this.fail(`Unexpected term token: ${tok.toString()}`, tok);
  }

  parseList() {
    const elems = [];
    while (this.peek().typ !== 'RParen') {
      elems.push(this.parseTerm());
    }
    this.next(); // consume ')'
    return new ListTerm(elems);
  }

  parseBlank() {
    // [] or [ ... ] property list
    if (this.peek().typ === 'RBracket') {
      this.next();
      this.blankCounter += 1;
      return new Blank(`_:b${this.blankCounter}`);
    }

    // IRI property list: [ id <IRI> predicateObjectList? ]
    // Lets you embed descriptions of an IRI directly in object position.
    if (this.peek().typ === 'Ident' && (this.peek().value || '') === 'id') {
      const iriTok = this.next(); // consume 'id'
      const iriTerm = this.parseTerm();

      // N3 note: 'id' form is not meant to be used with blank node identifiers.
      if (iriTerm instanceof Blank && iriTerm.label.startsWith('_:')) {
        this.fail("Cannot use 'id' keyword with a blank node identifier inside [...]", iriTok);
      }

      // Optional ';' right after the id IRI (tolerated).
      if (this.peek().typ === 'Semicolon') this.next();

      // Empty IRI property list: [ id :iri ]
      if (this.peek().typ === 'RBracket') {
        this.next();
        return iriTerm;
      }

      const localTriples = this.parsePropertyListTriples(iriTerm, 'RBracket', 'IRI property list');

      // Defer the embedded description until after the triple that references the IRI.
      if (localTriples.length) this.pendingTriplesAfter.push(...localTriples);
      return iriTerm;
    }

    // [ predicateObjectList ]
    this.blankCounter += 1;
    const id = `_:b${this.blankCounter}`;
    const subj = new Blank(id);
    const localTriples = this.parsePropertyListTriples(subj, 'RBracket', 'blank node property list');

    // Defer the blank-node description until after the triple that references it.
    if (localTriples.length) this.pendingTriplesAfter.push(...localTriples);
    return new Blank(id);
  }

  parsePropertyVerb() {
    let pred;
    let invert = false;

    if (this.peek().typ === 'Ident' && (this.peek().value || '') === 'a') {
      this.next();
      pred = internIri(RDF_NS + 'type');
    } else if (this.peek().typ === 'OpPredInvert') {
      this.next();
      pred = this.parseTerm();
      invert = true;
    } else {
      pred = this.parseTerm();
    }

    return { pred, invert };
  }

  parsePropertyListTriples(subject, closingTyp, contextLabel) {
    const localTriples = [];

    while (true) {
      const { pred, invert } = this.parsePropertyVerb();

      // If a pathological predicate term produced post-triples, don't let them leak.
      this.flushPendingTriples(localTriples, { includeBefore: false, includeAfter: true });

      const objs = [];
      const readObj = () => {
        const term = this.parseTerm();
        const postTriples = this.pendingTriplesAfter;
        this.pendingTriplesAfter = [];
        objs.push({ term, postTriples });
      };

      readObj();
      while (this.peek().typ === 'Comma') {
        this.next();
        readObj();
      }

      for (const { term: o, postTriples } of objs) {
        // Path helper triples must come before the triple that consumes the path result.
        this.flushPendingTriples(localTriples, { includeBefore: true, includeAfter: false });
        localTriples.push(invert ? new Triple(o, pred, subject) : new Triple(subject, pred, o));
        if (postTriples && postTriples.length) localTriples.push(...postTriples);
      }

      if (this.peek().typ === 'Semicolon') {
        this.next();
        if (this.peek().typ === closingTyp) break;
        continue;
      }
      break;
    }

    if (this.peek().typ !== closingTyp) {
      this.fail(`Expected ']' at end of ${contextLabel}, got ${this.peek().toString()}`);
    }
    this.next();

    return localTriples;
  }

  parseGraph() {
    const triples = [];
    while (this.peek().typ !== 'RBrace') {
      // N3 allows @prefix/@base and SPARQL-style PREFIX/BASE directives anywhere
      // outside of a triple. This includes inside quoted graph terms.
      // These directives affect parsing (prefix/base resolution) but do not emit triples.
      if (this.parseDirectiveIfPresent()) {
        continue;
      }

      const left = this.parseTerm();
      if (this.peek().typ === 'OpImplies') {
        this.next();
        const right = this.parseTerm();
        const pred = internIri(LOG_NS + 'implies');
        triples.push(new Triple(left, pred, right));
        if (this.peek().typ === 'Dot') this.next();
        else if (this.peek().typ === 'RBrace') {
          // ok
        } else {
          this.fail(`Expected '.' or '}', got ${this.peek().toString()}`);
        }
      } else if (this.peek().typ === 'OpImpliedBy') {
        this.next();
        const right = this.parseTerm();
        const pred = internIri(LOG_NS + 'impliedBy');
        triples.push(new Triple(left, pred, right));
        if (this.peek().typ === 'Dot') this.next();
        else if (this.peek().typ === 'RBrace') {
          // ok
        } else {
          this.fail(`Expected '.' or '}', got ${this.peek().toString()}`);
        }
      } else {
        // N3 grammar allows: triples ::= subject predicateObjectList?
        // So a bare subject (optionally producing helper triples) is allowed inside formulas as well.
        if (this.peek().typ === 'Dot' || this.peek().typ === 'RBrace') {
          this.flushPendingTriples(triples);
          if (this.peek().typ === 'Dot') this.next();
          continue;
        }

        triples.push(...this.parsePredicateObjectList(left));
        if (this.peek().typ === 'Dot') this.next();
        else if (this.peek().typ === 'RBrace') {
          // ok
        } else {
          this.fail(`Expected '.' or '}', got ${this.peek().toString()}`);
        }
      }
    }
    this.next(); // consume '}'
    return new GraphTerm(triples);
  }

  parseStatementVerb() {
    let verb;
    let invert = false;

    if (this.peek().typ === 'Ident' && (this.peek().value || '') === 'a') {
      this.next();
      verb = internIri(RDF_NS + 'type');
    } else if (this.peek().typ === 'Ident' && (this.peek().value || '') === 'has') {
      // N3 syntactic sugar: "S has P O." means "S P O."
      this.next();
      verb = this.parseTerm();
    } else if (this.peek().typ === 'Ident' && (this.peek().value || '') === 'is') {
      // N3 syntactic sugar: "S is P of O." means "O P S." (inverse; equivalent to "<-")
      this.next();
      verb = this.parseTerm();
      if (!(this.peek().typ === 'Ident' && (this.peek().value || '') === 'of')) {
        this.fail(`Expected 'of' after 'is <expr>', got ${this.peek().toString()}`);
      }
      this.next();
      invert = true;
    } else if (this.peek().typ === 'OpPredInvert') {
      this.next();
      verb = this.parseTerm();
      invert = true;
    } else {
      verb = this.parseTerm();
    }

    return { verb, invert };
  }

  parsePredicateObjectList(subject) {
    const out = [];

    // If the SUBJECT was a path or property-list, emit its helper triples first.
    this.flushPendingTriples(out);

    while (true) {
      const { verb, invert } = this.parseStatementVerb();
      const objects = this.parseObjectList();

      // If VERB or OBJECTS contained paths, their helper triples must come
      // before the triples that consume the path results (Easter depends on this).
      this.flushPendingTriples(out);

      for (const { term: o, postTriples } of objects) {
        out.push(new Triple(invert ? o : subject, verb, invert ? subject : o));
        if (postTriples && postTriples.length) out.push(...postTriples);
      }

      if (this.peek().typ === 'Semicolon') {
        this.next();
        if (this.peek().typ === 'Dot') break;
        continue;
      }
      break;
    }

    return out;
  }

  parseObjectList() {
    // Capture any trailing property-list triples produced while parsing each
    // object term so we can emit them *after* the triple that references the
    // term. (See pendingTriplesAfter in the constructor.)

    const objs = [];
    const readObj = () => {
      const o = this.parseTerm();
      const post = this.pendingTriplesAfter;
      this.pendingTriplesAfter = [];
      objs.push({ term: o, postTriples: post });
    };

    readObj();
    while (this.peek().typ === 'Comma') {
      this.next();
      readObj();
    }
    return objs;
  }

  makeRule(left, right, isForward) {
    let premiseTerm, conclTerm;

    if (isForward) {
      premiseTerm = left;
      conclTerm = right;
    } else {
      premiseTerm = right;
      conclTerm = left;
    }

    let isFuse = false;
    if (isForward) {
      if (conclTerm instanceof Literal && conclTerm.value === 'false') {
        isFuse = true;
      }
    }

    let rawPremise;
    if (premiseTerm instanceof GraphTerm) {
      rawPremise = premiseTerm.triples;
    } else if (premiseTerm instanceof Literal && premiseTerm.value === 'true') {
      rawPremise = [];
    } else {
      rawPremise = [];
    }

    // In standard N3, the right-hand side of a rule is a formula term.
    // Eyeling primarily supports an explicit quoted formula `{ ... }` (GraphTerm)
    // or the special literals true/false.
    //
    // However, some programs use a *variable* in rule head position to mean:
    // "prove the body, bind ?C to a quoted formula, and then assert that formula".
    // Example:
    //   { :a :b ?C } => ?C.
    //
    // To support this, we allow a forward rule to carry a dynamic head term.
    // The engine will resolve it per-solution and, if it becomes a GraphTerm,
    // will emit its triples as the instantiated head.
    let rawConclusion;
    let dynamicConclusionTerm = null;
    if (conclTerm instanceof GraphTerm) {
      rawConclusion = conclTerm.triples;
    } else if (conclTerm instanceof Literal && conclTerm.value === 'false') {
      rawConclusion = [];
    } else if (conclTerm instanceof Literal && conclTerm.value === 'true') {
      // `=> true.` is a no-op (empty head)
      rawConclusion = [];
    } else {
      rawConclusion = [];
      // Only forward rules can meaningfully "emit" a dynamic head.
      // Backward rules with dynamic heads are not supported.
      if (isForward && conclTerm) dynamicConclusionTerm = conclTerm;
    }

    // Blank nodes that occur explicitly in the head (conclusion)
    const headBlankLabels = collectBlankLabelsInTriples(rawConclusion);

    const [premise0, conclusion] = liftBlankRuleVars(rawPremise, rawConclusion);

    // Keep premise order as written; the engine may defer some builtins in
    // forward rules when they cannot yet run due to unbound variables.
    const premise = premise0;

    const r = new Rule(premise, conclusion, isForward, isFuse, headBlankLabels);

    if (dynamicConclusionTerm) {
      // Non-enumerable to keep AST output stable unless explicitly requested.
      Object.defineProperty(r, '__dynamicConclusionTerm', {
        value: dynamicConclusionTerm,
        enumerable: false,
        writable: false,
        configurable: true,
      });
    }

    return r;
  }
}

module.exports = { Parser };
