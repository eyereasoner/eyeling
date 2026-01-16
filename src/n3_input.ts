// @ts-nocheck
import {
  RDF_NS, RDFS_NS, OWL_NS, XSD_NS, LOG_NS, MATH_NS, STRING_NS, LIST_NS, TIME_NS, SKOLEM_NS, RDF_JSON_DT,
  Term, Iri, Literal, Var, Blank, ListTerm, OpenListTerm, GraphTerm, Triple, Rule,
  internIri, internLiteral,
  stripQuotes, decodeN3StringEscapes,
  collectBlankLabelsInTriples, liftBlankRuleVars, reorderPremiseForConstraints,
  // Predicate helpers used by the parser itself
  isRdfTypePred, isLogImplies, isLogImpliedBy,
} from './reasoner';

function resolveIriRef(ref, base) {
  if (!base) return ref;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) return ref; // already absolute
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}

// LEXER
// ===========================================================================

class Token {
  constructor(typ, value = null, offset = null) {
    this.typ = typ;
    this.value = value;
    // Codepoint offset in the original source (Array.from(text) index).
    this.offset = offset;
  }
  toString() {
    const loc = typeof this.offset === 'number' ? `@${this.offset}` : '';
    if (this.value == null) return `Token(${this.typ}${loc})`;
    return `Token(${this.typ}${loc}, ${JSON.stringify(this.value)})`;
  }
}

class N3SyntaxError extends SyntaxError {
  constructor(message, offset = null) {
    super(message);
    this.name = 'N3SyntaxError';
    this.offset = offset;
  }
}

function isWs(c) {
  return /\s/.test(c);
}

function isNameChar(c) {
  return /[0-9A-Za-z_\-:]/.test(c);
}


function lex(inputText) {
  const chars = Array.from(inputText);
  const n = chars.length;
  let i = 0;
  const tokens = [];

  function peek(offset = 0) {
    const j = i + offset;
    return j >= 0 && j < n ? chars[j] : null;
  }

  while (i < n) {
    let c = peek();
    if (c === null) break;

    // 1) Whitespace
    if (isWs(c)) {
      i++;
      continue;
    }

    // 2) Comments starting with '#'
    if (c === '#') {
      while (i < n && chars[i] !== '\n' && chars[i] !== '\r') i++;
      continue;
    }

    // 3) Two-character operators: => and <=
    if (c === '=') {
      if (peek(1) === '>') {
        tokens.push(new Token('OpImplies', null, i));
        i += 2;
        continue;
      } else {
        // N3 syntactic sugar: '=' means owl:sameAs
        tokens.push(new Token('Equals', null, i));
        i += 1;
        continue;
      }
    }

    if (c === '<') {
      if (peek(1) === '=') {
        tokens.push(new Token('OpImpliedBy', null, i));
        i += 2;
        continue;
      }
      // N3 predicate inversion: "<-" (swap subject/object for this predicate)
      if (peek(1) === '-') {
        tokens.push(new Token('OpPredInvert', null, i));
        i += 2;
        continue;
      }
      // Otherwise IRIREF <...>
      const start = i;
      i++; // skip '<'
      const iriChars = [];
      while (i < n && chars[i] !== '>') {
        iriChars.push(chars[i]);
        i++;
      }
      if (i >= n || chars[i] !== '>') {
        throw new N3SyntaxError('Unterminated IRI <...>', start);
      }
      i++; // skip '>'
      const iri = iriChars.join('');
      tokens.push(new Token('IriRef', iri, start));
      continue;
    }

    // 4) Path + datatype operators: !, ^, ^^
    if (c === '!') {
      tokens.push(new Token('OpPathFwd', null, i));
      i += 1;
      continue;
    }
    if (c === '^') {
      if (peek(1) === '^') {
        tokens.push(new Token('HatHat', null, i));
        i += 2;
        continue;
      }
      tokens.push(new Token('OpPathRev', null, i));
      i += 1;
      continue;
    }

    // 5) Single-character punctuation
    if ('{}()[];,.'.includes(c)) {
      const mapping = {
        '{': 'LBrace',
        '}': 'RBrace',
        '(': 'LParen',
        ')': 'RParen',
        '[': 'LBracket',
        ']': 'RBracket',
        ';': 'Semicolon',
        ',': 'Comma',
        '.': 'Dot',
      };
      tokens.push(new Token(mapping[c], null, i));
      i++;
      continue;
    }

    // String literal: short "..." or long """..."""
    if (c === '"') {
      const start = i;

      // Long string literal """ ... """
      if (peek(1) === '"' && peek(2) === '"') {
        i += 3; // consume opening """
        const sChars = [];
        let closed = false;
        while (i < n) {
          const cc = chars[i];

          // Preserve escapes verbatim (same behavior as short strings)
          if (cc === '\\') {
            i++;
            if (i < n) {
              const esc = chars[i];
              i++;
              sChars.push('\\');
              sChars.push(esc);
            } else {
              sChars.push('\\');
            }
            continue;
          }

          // In long strings, a run of >= 3 delimiter quotes terminates the literal.
          // Any extra quotes beyond the final 3 are part of the content.
          if (cc === '"') {
            let run = 0;
            while (i + run < n && chars[i + run] === '"') run++;

            if (run >= 3) {
              for (let k = 0; k < run - 3; k++) sChars.push('"');
              i += run; // consume content quotes (if any) + closing delimiter
              closed = true;
              break;
            }

            for (let k = 0; k < run; k++) sChars.push('"');
            i += run;
            continue;
          }

          sChars.push(cc);
          i++;
        }
        if (!closed) throw new N3SyntaxError('Unterminated long string literal """..."""', start);
        const raw = '"""' + sChars.join('') + '"""';
        const decoded = decodeN3StringEscapes(stripQuotes(raw));
        const s = JSON.stringify(decoded); // canonical short quoted form
        tokens.push(new Token('Literal', s, start));
        continue;
      }

      // Short string literal " ... "
      i++; // consume opening "
      const sChars = [];
      while (i < n) {
        let cc = chars[i];
        i++;
        if (cc === '\\') {
          if (i < n) {
            const esc = chars[i];
            i++;
            sChars.push('\\');
            sChars.push(esc);
          }
          continue;
        }
        if (cc === '"') break;
        sChars.push(cc);
      }
      const raw = '"' + sChars.join('') + '"';
      const decoded = decodeN3StringEscapes(stripQuotes(raw));
      const s = JSON.stringify(decoded); // canonical short quoted form
      tokens.push(new Token('Literal', s, start));
      continue;
    }

    // String literal: short '...' or long '''...'''
    if (c === "'") {
      const start = i;

      // Long string literal ''' ... '''
      if (peek(1) === "'" && peek(2) === "'") {
        i += 3; // consume opening '''
        const sChars = [];
        let closed = false;
        while (i < n) {
          const cc = chars[i];

          // Preserve escapes verbatim (same behavior as short strings)
          if (cc === '\\') {
            i++;
            if (i < n) {
              const esc = chars[i];
              i++;
              sChars.push('\\');
              sChars.push(esc);
            } else {
              sChars.push('\\');
            }
            continue;
          }

          // In long strings, a run of >= 3 delimiter quotes terminates the literal.
          // Any extra quotes beyond the final 3 are part of the content.
          if (cc === "'") {
            let run = 0;
            while (i + run < n && chars[i + run] === "'") run++;

            if (run >= 3) {
              for (let k = 0; k < run - 3; k++) sChars.push("'");
              i += run; // consume content quotes (if any) + closing delimiter
              closed = true;
              break;
            }

            for (let k = 0; k < run; k++) sChars.push("'");
            i += run;
            continue;
          }

          sChars.push(cc);
          i++;
        }
        if (!closed) throw new N3SyntaxError("Unterminated long string literal '''...'''", start);
        const raw = "'''" + sChars.join('') + "'''";
        const decoded = decodeN3StringEscapes(stripQuotes(raw));
        const s = JSON.stringify(decoded); // canonical short quoted form
        tokens.push(new Token('Literal', s, start));
        continue;
      }

      // Short string literal ' ... '
      i++; // consume opening '
      const sChars = [];
      while (i < n) {
        let cc = chars[i];
        i++;
        if (cc === '\\') {
          if (i < n) {
            const esc = chars[i];
            i++;
            sChars.push('\\');
            sChars.push(esc);
          }
          continue;
        }
        if (cc === "'") break;
        sChars.push(cc);
      }
      const raw = "'" + sChars.join('') + "'";
      const decoded = decodeN3StringEscapes(stripQuotes(raw));
      const s = JSON.stringify(decoded); // canonical short quoted form
      tokens.push(new Token('Literal', s, start));
      continue;
    }

    // Variable ?name
    if (c === '?') {
      const start = i;
      i++;
      const nameChars = [];
      let cc;
      while ((cc = peek()) !== null && isNameChar(cc)) {
        nameChars.push(cc);
        i++;
      }
      const name = nameChars.join('');
      tokens.push(new Token('Var', name, start));
      continue;
    }

    // Directives: @prefix, @base (and language tags after string literals)
    if (c === '@') {
      const start = i;
      const prevTok = tokens.length ? tokens[tokens.length - 1] : null;
      const prevWasQuotedLiteral =
        prevTok && prevTok.typ === 'Literal' && typeof prevTok.value === 'string' && prevTok.value.startsWith('"');

      i++; // consume '@'

      if (prevWasQuotedLiteral) {
        // N3 grammar production LANGTAG:
        //   "@" [a-zA-Z]+ ("-" [a-zA-Z0-9]+)*
        const tagChars = [];
        let cc = peek();
        if (cc === null || !/[A-Za-z]/.test(cc)) {
          throw new N3SyntaxError("Invalid language tag (expected [A-Za-z] after '@')", start);
        }
        while ((cc = peek()) !== null && /[A-Za-z]/.test(cc)) {
          tagChars.push(cc);
          i++;
        }
        while (peek() === '-') {
          tagChars.push('-');
          i++; // consume '-'
          const segChars = [];
          while ((cc = peek()) !== null && /[A-Za-z0-9]/.test(cc)) {
            segChars.push(cc);
            i++;
          }
          if (!segChars.length) {
            throw new N3SyntaxError("Invalid language tag (expected [A-Za-z0-9]+ after '-')", start);
          }
          tagChars.push(...segChars);
        }
        tokens.push(new Token('LangTag', tagChars.join(''), start));
        continue;
      }

      // Otherwise, treat as a directive (@prefix, @base)
      const wordChars = [];
      let cc;
      while ((cc = peek()) !== null && /[A-Za-z]/.test(cc)) {
        wordChars.push(cc);
        i++;
      }
      const word = wordChars.join('');
      if (word === 'prefix') tokens.push(new Token('AtPrefix', null, start));
      else if (word === 'base') tokens.push(new Token('AtBase', null, start));
      else throw new N3SyntaxError(`Unknown directive @${word}`, start);
      continue;
    }

    // 6) Numeric literal (integer or float)
    if (/[0-9]/.test(c) || (c === '-' && peek(1) !== null && /[0-9]/.test(peek(1)))) {
      const start = i;
      const numChars = [c];
      i++;
      while (i < n) {
        const cc = chars[i];
        if (/[0-9]/.test(cc)) {
          numChars.push(cc);
          i++;
          continue;
        }
        if (cc === '.') {
          if (i + 1 < n && /[0-9]/.test(chars[i + 1])) {
            numChars.push('.');
            i++;
            continue;
          } else {
            break;
          }
        }
        break;
      }

      // Optional exponent part: e.g., 1e0, 1.1e-3, 1.1E+0
      if (i < n && (chars[i] === 'e' || chars[i] === 'E')) {
        let j = i + 1;
        if (j < n && (chars[j] === '+' || chars[j] === '-')) j++;
        if (j < n && /[0-9]/.test(chars[j])) {
          numChars.push(chars[i]); // e/E
          i++;
          if (i < n && (chars[i] === '+' || chars[i] === '-')) {
            numChars.push(chars[i]);
            i++;
          }
          while (i < n && /[0-9]/.test(chars[i])) {
            numChars.push(chars[i]);
            i++;
          }
        }
      }

      tokens.push(new Token('Literal', numChars.join(''), start));
      continue;
    }

    // 7) Identifiers / keywords / QNames
    const start = i;
    const wordChars = [];
    let cc;
    while ((cc = peek()) !== null && isNameChar(cc)) {
      wordChars.push(cc);
      i++;
    }
    if (!wordChars.length) {
      throw new N3SyntaxError(`Unexpected char: ${JSON.stringify(c)}`, i);
    }
    const word = wordChars.join('');
    if (word === 'true' || word === 'false') {
      tokens.push(new Token('Literal', word, start));
    } else if ([...word].every((ch) => /[0-9.\-]/.test(ch))) {
      tokens.push(new Token('Literal', word, start));
    } else {
      tokens.push(new Token('Ident', word, start));
    }
  }

  tokens.push(new Token('EOF', null, n));
  return tokens;
}

// ===========================================================================
// PREFIX ENVIRONMENT
// ===========================================================================

class PrefixEnv {
  constructor(map, baseIri) {
    this.map = map || {}; // prefix -> IRI (including "" for @prefix :)
    this.baseIri = baseIri || ''; // base IRI for resolving <relative>
  }

  static newDefault() {
    const m = {};
    m['rdf'] = RDF_NS;
    m['rdfs'] = RDFS_NS;
    m['xsd'] = XSD_NS;
    m['log'] = LOG_NS;
    m['math'] = MATH_NS;
    m['string'] = STRING_NS;
    m['list'] = LIST_NS;
    m['time'] = TIME_NS;
    m['genid'] = SKOLEM_NS;
    m[''] = ''; // empty prefix default namespace
    return new PrefixEnv(m, ''); // base IRI starts empty
  }

  set(pref, base) {
    this.map[pref] = base;
  }

  setBase(baseIri) {
    this.baseIri = baseIri || '';
  }

  expandQName(q) {
    if (q.includes(':')) {
      const [p, local] = q.split(':', 2);
      const base = this.map[p] || '';
      if (base) return base + local;
      return q;
    }
    return q;
  }

  shrinkIri(iri) {
    let best = null; // [prefix, local]
    for (const [p, base] of Object.entries(this.map)) {
      if (!base) continue;
      if (iri.startsWith(base)) {
        const local = iri.slice(base.length);
        if (!local) continue;
        const cand = [p, local];
        if (best === null || cand[1].length < best[1].length) best = cand;
      }
    }
    if (best === null) return null;
    const [p, local] = best;
    if (p === '') return `:${local}`;
    return `${p}:${local}`;
  }

  prefixesUsedForOutput(triples) {
    const used = new Set();
    for (const t of triples) {
      const iris = [];
      iris.push(...collectIrisInTerm(t.s));
      if (!isRdfTypePred(t.p)) {
        iris.push(...collectIrisInTerm(t.p));
      }
      iris.push(...collectIrisInTerm(t.o));
      for (const iri of iris) {
        for (const [p, base] of Object.entries(this.map)) {
          if (base && iri.startsWith(base)) used.add(p);
        }
      }
    }
    const v = [];
    for (const p of used) {
      if (this.map.hasOwnProperty(p)) v.push([p, this.map[p]]);
    }
    v.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return v;
  }
}

function collectIrisInTerm(t) {
  const out = [];
  if (t instanceof Iri) {
    out.push(t.value);
  } else if (t instanceof Literal) {
    const [_lex, dt] = literalParts(t.value);
    if (dt) out.push(dt); // so rdf/xsd prefixes are emitted when only used in ^^...
  } else if (t instanceof ListTerm) {
    for (const x of t.elems) out.push(...collectIrisInTerm(x));
  } else if (t instanceof OpenListTerm) {
    for (const x of t.prefix) out.push(...collectIrisInTerm(x));
  } else if (t instanceof GraphTerm) {
    for (const tr of t.triples) {
      out.push(...collectIrisInTerm(tr.s));
      out.push(...collectIrisInTerm(tr.p));
      out.push(...collectIrisInTerm(tr.o));
    }
  }
  return out;
}

function collectVarsInTerm(t, acc) {
  if (t instanceof Var) {
    acc.add(t.name);
  } else if (t instanceof ListTerm) {
    for (const x of t.elems) collectVarsInTerm(x, acc);
  } else if (t instanceof OpenListTerm) {
    for (const x of t.prefix) collectVarsInTerm(x, acc);
    acc.add(t.tailVar);
  } else if (t instanceof GraphTerm) {
    for (const tr of t.triples) {
      collectVarsInTerm(tr.s, acc);
      collectVarsInTerm(tr.p, acc);
      collectVarsInTerm(tr.o, acc);
    }
  }
}

function varsInRule(rule) {
  const acc = new Set();
  for (const tr of rule.premise) {
    collectVarsInTerm(tr.s, acc);
    collectVarsInTerm(tr.p, acc);
    collectVarsInTerm(tr.o, acc);
  }
  for (const tr of rule.conclusion) {
    collectVarsInTerm(tr.s, acc);
    collectVarsInTerm(tr.p, acc);
    collectVarsInTerm(tr.o, acc);
  }
  return acc;
}

function collectBlankLabelsInTerm(t, acc) {
  if (t instanceof Blank) {
    acc.add(t.label);
  } else if (t instanceof ListTerm) {
    for (const x of t.elems) collectBlankLabelsInTerm(x, acc);
  } else if (t instanceof OpenListTerm) {
    for (const x of t.prefix) collectBlankLabelsInTerm(x, acc);
  } else if (t instanceof GraphTerm) {
    for (const tr of t.triples) {
      collectBlankLabelsInTerm(tr.s, acc);
      collectBlankLabelsInTerm(tr.p, acc);
      collectBlankLabelsInTerm(tr.o, acc);
    }
  }
}

function collectBlankLabelsInTriples(triples) {
  const acc = new Set();
  for (const tr of triples) {
    collectBlankLabelsInTerm(tr.s, acc);
    collectBlankLabelsInTerm(tr.p, acc);
    collectBlankLabelsInTerm(tr.o, acc);
  }
  return acc;
}

// ===========================================================================
// PARSER
// ===========================================================================

class Parser {
  constructor(tokens) {
    this.toks = tokens;
    this.pos = 0;
    this.prefixes = PrefixEnv.newDefault();
    this.blankCounter = 0;
    this.pendingTriples = [];
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

  parseDocument() {
    const triples = [];
    const forwardRules = [];
    const backwardRules = [];

    while (this.peek().typ !== 'EOF') {
      if (this.peek().typ === 'AtPrefix') {
        this.next();
        this.parsePrefixDirective();
      } else if (this.peek().typ === 'AtBase') {
        this.next();
        this.parseBaseDirective();
      } else if (
        // SPARQL-style/Turtle-style directives (case-insensitive, no trailing '.')
        this.peek().typ === 'Ident' &&
        typeof this.peek().value === 'string' &&
        this.peek().value.toLowerCase() === 'prefix' &&
        this.toks[this.pos + 1] &&
        this.toks[this.pos + 1].typ === 'Ident' &&
        typeof this.toks[this.pos + 1].value === 'string' &&
        // Require PNAME_NS form (e.g., "ex:" or ":") to avoid clashing with a normal triple starting with IRI "prefix".
        this.toks[this.pos + 1].value.endsWith(':') &&
        this.toks[this.pos + 2] &&
        (this.toks[this.pos + 2].typ === 'IriRef' || this.toks[this.pos + 2].typ === 'Ident')
      ) {
        this.next(); // consume PREFIX keyword
        this.parseSparqlPrefixDirective();
      } else if (
        this.peek().typ === 'Ident' &&
        typeof this.peek().value === 'string' &&
        this.peek().value.toLowerCase() === 'base' &&
        this.toks[this.pos + 1] &&
        // SPARQL BASE requires an IRIREF.
        this.toks[this.pos + 1].typ === 'IriRef'
      ) {
        this.next(); // consume BASE keyword
        this.parseSparqlBaseDirective();
      } else {
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
            if (this.pendingTriples.length > 0) {
              more = this.pendingTriples;
              this.pendingTriples = [];
            }
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
            } else {
              triples.push(tr);
            }
          }
        }
      }
    }

    return [this.prefixes, triples, forwardRules, backwardRules];
  }

  parsePrefixDirective() {
    const tok = this.next();
    if (tok.typ !== 'Ident') {
      this.fail(`Expected prefix name, got ${tok.toString()}`, tok);
    }
    const pref = tok.value || '';
    const prefName = pref.endsWith(':') ? pref.slice(0, -1) : pref;

    if (this.peek().typ === 'Dot') {
      this.next();
      if (!this.prefixes.map.hasOwnProperty(prefName)) {
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
    const prefName = pref.endsWith(':') ? pref.slice(0, -1) : pref;

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
          if (qn.includes(':')) dtIri = this.prefixes.expandQName(qn);
          else dtIri = qn;
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

      const subj = iriTerm;
      while (true) {
        let pred;
        let invert = false;
        if (this.peek().typ === 'Ident' && (this.peek().value || '') === 'a') {
          this.next();
          pred = internIri(RDF_NS + 'type');
        } else if (this.peek().typ === 'OpPredInvert') {
          this.next(); // "<-"
          pred = this.parseTerm();
          invert = true;
        } else {
          pred = this.parseTerm();
        }

        const objs = [this.parseTerm()];
        while (this.peek().typ === 'Comma') {
          this.next();
          objs.push(this.parseTerm());
        }

        for (const o of objs) {
          this.pendingTriples.push(invert ? new Triple(o, pred, subj) : new Triple(subj, pred, o));
        }

        if (this.peek().typ === 'Semicolon') {
          this.next();
          if (this.peek().typ === 'RBracket') break;
          continue;
        }
        break;
      }

      if (this.peek().typ !== 'RBracket') {
        this.fail(`Expected ']' at end of IRI property list, got ${this.peek().toString()}`);
      }
      this.next();
      return iriTerm;
    }

    // [ predicateObjectList ]
    this.blankCounter += 1;
    const id = `_:b${this.blankCounter}`;
    const subj = new Blank(id);

    while (true) {
      // Verb (can also be 'a')
      let pred;
      let invert = false;
      if (this.peek().typ === 'Ident' && (this.peek().value || '') === 'a') {
        this.next();
        pred = internIri(RDF_NS + 'type');
      } else if (this.peek().typ === 'OpPredInvert') {
        this.next(); // consume "<-"
        pred = this.parseTerm();
        invert = true;
      } else {
        pred = this.parseTerm();
      }

      // Object list: o1, o2, ...
      const objs = [this.parseTerm()];
      while (this.peek().typ === 'Comma') {
        this.next();
        objs.push(this.parseTerm());
      }

      for (const o of objs) {
        this.pendingTriples.push(invert ? new Triple(o, pred, subj) : new Triple(subj, pred, o));
      }

      if (this.peek().typ === 'Semicolon') {
        this.next();
        if (this.peek().typ === 'RBracket') break;
        continue;
      }
      break;
    }

    if (this.peek().typ === 'RBracket') {
      this.next();
    } else {
      this.fail(`Expected ']' at end of blank node property list, got ${this.peek().toString()}`);
    }

    return new Blank(id);
  }

  parseGraph() {
    const triples = [];
    while (this.peek().typ !== 'RBrace') {
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
          if (this.pendingTriples.length > 0) {
            triples.push(...this.pendingTriples);
            this.pendingTriples = [];
          }
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

  parsePredicateObjectList(subject) {
    const out = [];

    // If the SUBJECT was a path, emit its helper triples first
    if (this.pendingTriples.length > 0) {
      out.push(...this.pendingTriples);
      this.pendingTriples = [];
    }

    while (true) {
      let verb;
      let invert = false;

      if (this.peek().typ === 'Ident' && (this.peek().value || '') === 'a') {
        this.next();
        verb = internIri(RDF_NS + 'type');
      } else if (this.peek().typ === 'Ident' && (this.peek().value || '') === 'has') {
        // N3 syntactic sugar: "S has P O." means "S P O."
        this.next(); // consume "has"
        verb = this.parseTerm();
      } else if (this.peek().typ === 'Ident' && (this.peek().value || '') === 'is') {
        // N3 syntactic sugar: "S is P of O." means "O P S." (inverse; equivalent to "<-")
        this.next(); // consume "is"
        verb = this.parseTerm();
        if (!(this.peek().typ === 'Ident' && (this.peek().value || '') === 'of')) {
          this.fail(`Expected 'of' after 'is <expr>', got ${this.peek().toString()}`);
        }
        this.next(); // consume "of"
        invert = true;
      } else if (this.peek().typ === 'OpPredInvert') {
        this.next(); // "<-"
        verb = this.parseTerm();
        invert = true;
      } else {
        verb = this.parseTerm();
      }

      const objects = this.parseObjectList();

      // If VERB or OBJECTS contained paths, their helper triples must come
      // before the triples that consume the path results (Easter depends on this).
      if (this.pendingTriples.length > 0) {
        out.push(...this.pendingTriples);
        this.pendingTriples = [];
      }

      for (const o of objects) {
        out.push(new Triple(invert ? o : subject, verb, invert ? subject : o));
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
    const objs = [this.parseTerm()];
    while (this.peek().typ === 'Comma') {
      this.next();
      objs.push(this.parseTerm());
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

    let rawConclusion;
    if (conclTerm instanceof GraphTerm) {
      rawConclusion = conclTerm.triples;
    } else if (conclTerm instanceof Literal && conclTerm.value === 'false') {
      rawConclusion = [];
    } else {
      rawConclusion = [];
    }

    // Blank nodes that occur explicitly in the head (conclusion)
    const headBlankLabels = collectBlankLabelsInTriples(rawConclusion);

    const [premise0, conclusion] = liftBlankRuleVars(rawPremise, rawConclusion);

    // Reorder constraints for *forward* rules.
    const premise = isForward ? reorderPremiseForConstraints(premise0) : premise0;

    return new Rule(premise, conclusion, isForward, isFuse, headBlankLabels);
  }
}

// ===========================================================================

function materializeRdfLists(triples, forwardRules, backwardRules) {
  const RDF_FIRST = RDF_NS + 'first';
  const RDF_REST = RDF_NS + 'rest';
  const RDF_NIL = RDF_NS + 'nil';

  function nodeKey(t) {
    if (t instanceof Blank) return 'B:' + t.label;
    if (t instanceof Iri) return 'I:' + t.value;
    return null;
  }

  // Collect first/rest arcs from *input triples*
  const firstMap = new Map(); // key(subject) -> Term (object)
  const restMap = new Map(); // key(subject) -> Term (object)
  for (const tr of triples) {
    if (!(tr.p instanceof Iri)) continue;
    const k = nodeKey(tr.s);
    if (!k) continue;
    if (tr.p.value === RDF_FIRST) firstMap.set(k, tr.o);
    else if (tr.p.value === RDF_REST) restMap.set(k, tr.o);
  }
  if (!firstMap.size && !restMap.size) return;

  const cache = new Map(); // key(node) -> ListTerm
  const visiting = new Set(); // cycle guard

  function buildListForKey(k) {
    if (cache.has(k)) return cache.get(k);
    if (visiting.has(k)) return null; // cycle => not a well-formed list
    visiting.add(k);

    // rdf:nil => ()
    if (k === 'I:' + RDF_NIL) {
      const empty = new ListTerm([]);
      cache.set(k, empty);
      visiting.delete(k);
      return empty;
    }

    const head = firstMap.get(k);
    const tail = restMap.get(k);
    if (head === undefined || tail === undefined) {
      visiting.delete(k);
      return null; // not a full cons cell
    }

    const headTerm = rewriteTerm(head);

    let tailListElems = null;
    if (tail instanceof Iri && tail.value === RDF_NIL) {
      tailListElems = [];
    } else {
      const tk = nodeKey(tail);
      if (!tk) {
        visiting.delete(k);
        return null;
      }
      const tailList = buildListForKey(tk);
      if (!tailList) {
        visiting.delete(k);
        return null;
      }
      tailListElems = tailList.elems;
    }

    const out = new ListTerm([headTerm, ...tailListElems]);
    cache.set(k, out);
    visiting.delete(k);
    return out;
  }

  function rewriteTerm(t) {
    // Replace list nodes (Blank/Iri) by their constructed ListTerm when possible
    const k = nodeKey(t);
    if (k) {
      const built = buildListForKey(k);
      if (built) return built;
      // Also rewrite rdf:nil even if not otherwise referenced
      if (t instanceof Iri && t.value === RDF_NIL) return new ListTerm([]);
      return t;
    }
    if (t instanceof ListTerm) {
      let changed = false;
      const elems = t.elems.map((e) => {
        const r = rewriteTerm(e);
        if (r !== e) changed = true;
        return r;
      });
      return changed ? new ListTerm(elems) : t;
    }
    if (t instanceof OpenListTerm) {
      let changed = false;
      const prefix = t.prefix.map((e) => {
        const r = rewriteTerm(e);
        if (r !== e) changed = true;
        return r;
      });
      return changed ? new OpenListTerm(prefix, t.tailVar) : t;
    }
    if (t instanceof GraphTerm) {
      for (const tr of t.triples) rewriteTriple(tr);
      return t;
    }
    return t;
  }

  function rewriteTriple(tr) {
    tr.s = rewriteTerm(tr.s);
    tr.p = rewriteTerm(tr.p);
    tr.o = rewriteTerm(tr.o);
  }

  // Pre-build all reachable list heads
  for (const k of firstMap.keys()) buildListForKey(k);

  // Rewrite input triples + rules in-place
  for (const tr of triples) rewriteTriple(tr);
  for (const r of forwardRules) {
    for (const tr of r.premise) rewriteTriple(tr);
    for (const tr of r.conclusion) rewriteTriple(tr);
  }
  for (const r of backwardRules) {
    for (const tr of r.premise) rewriteTriple(tr);
    for (const tr of r.conclusion) rewriteTriple(tr);
  }
}


export { resolveIriRef, Token, N3SyntaxError, lex, PrefixEnv, Parser, materializeRdfLists };
