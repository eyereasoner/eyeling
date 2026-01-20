/**
 * Eyeling Reasoner — prelude
 *
 * Core data model and shared utilities: Term/Triple/Formula types, namespaces,
 * and prefix environment helpers used throughout the project.
 */

'use strict';

// ===========================================================================
// Namespace constants
// ===========================================================================

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';
const CRYPTO_NS = 'http://www.w3.org/2000/10/swap/crypto#';
const MATH_NS = 'http://www.w3.org/2000/10/swap/math#';
const TIME_NS = 'http://www.w3.org/2000/10/swap/time#';
const LIST_NS = 'http://www.w3.org/2000/10/swap/list#';
const LOG_NS = 'http://www.w3.org/2000/10/swap/log#';
const STRING_NS = 'http://www.w3.org/2000/10/swap/string#';
const SKOLEM_NS = 'https://eyereasoner.github.io/.well-known/genid/';
const RDF_JSON_DT = RDF_NS + 'JSON';

function resolveIriRef(ref, base) {
  if (!base) return ref;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) return ref; // already absolute
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}

// -----------------------------------------------------------------------------
// Literal helpers
// -----------------------------------------------------------------------------

// Hot cache used by literalParts().
const __literalPartsCache = new Map(); // lit string -> [lex, dt]

function literalParts(lit) {
  const cached = __literalPartsCache.get(lit);
  if (cached) return cached;

  // Split a literal into lexical form and datatype IRI (if any).
  // Also strip an optional language tag from the lexical form:
  //   "\"hello\"@en"  -> "\"hello\""
  //   "\"hello\"@en^^<...>" is rejected earlier in the parser.
  const idx = lit.indexOf('^^');
  let lex = lit;
  let dt = null;

  if (idx >= 0) {
    lex = lit.slice(0, idx);
    dt = lit.slice(idx + 2).trim();
    if (dt.startsWith('<') && dt.endsWith('>')) {
      dt = dt.slice(1, -1);
    }
  }

  // Strip LANGTAG from the lexical form when present.
  if (lex.length >= 2 && lex[0] === '"') {
    const lastQuote = lex.lastIndexOf('"');
    if (lastQuote > 0 && lastQuote < lex.length - 1 && lex[lastQuote + 1] === '@') {
      const lang = lex.slice(lastQuote + 2);
      if (/^[A-Za-z]+(?:-[A-Za-z0-9]+)*$/.test(lang)) {
        lex = lex.slice(0, lastQuote + 1);
      }
    }
  }

  const res = [lex, dt];
  __literalPartsCache.set(lit, res);
  return res;
}

// ===========================================================================
// AST (Abstract Syntax Tree)
// ===========================================================================

class Term {}

class Iri extends Term {
  constructor(value) {
    super();
    this.value = value;
  }
}

class Literal extends Term {
  constructor(value) {
    super();
    this.value = value; // raw lexical form, e.g. "foo", 12, true, or "\"1944-08-21\"^^..."
  }
}

class Var extends Term {
  constructor(name) {
    super();
    this.name = name; // without leading '?'
  }
}

class Blank extends Term {
  constructor(label) {
    super();
    this.label = label; // _:b1, etc.
  }
}

class ListTerm extends Term {
  constructor(elems) {
    super();
    this.elems = elems; // Term[]
  }
}

class OpenListTerm extends Term {
  constructor(prefix, tailVar) {
    super();
    this.prefix = prefix; // Term[]
    this.tailVar = tailVar; // string
  }
}

class GraphTerm extends Term {
  constructor(triples) {
    super();
    this.triples = triples; // Triple[]
  }
}

class Triple {
  constructor(s, p, o) {
    this.s = s;
    this.p = p;
    this.o = o;
  }
}

class Rule {
  constructor(premise, conclusion, isForward, isFuse, headBlankLabels) {
    this.premise = premise; // Triple[]
    this.conclusion = conclusion; // Triple[]
    this.isForward = isForward; // boolean
    this.isFuse = isFuse; // boolean
    // Set<string> of blank-node labels that occur explicitly in the rule head
    this.headBlankLabels = headBlankLabels || new Set();
  }
}

class DerivedFact {
  constructor(fact, rule, premises, subst) {
    this.fact = fact; // Triple
    this.rule = rule; // Rule
    this.premises = premises; // Triple[]
    this.subst = subst; // { varName: Term }
  }
}

// ===========================================================================
// Term interning
// ===========================================================================

// Intern IRIs and literals by their raw lexical string.
// This reduces allocations when the same terms repeat and can improve performance.
//
// NOTE: Terms are treated as immutable. Do NOT mutate .value on interned objects.
const __iriIntern = new Map();
const __literalIntern = new Map();

/** @param {string} value */
function internIri(value) {
  let t = __iriIntern.get(value);
  if (!t) {
    t = new Iri(value);
    __iriIntern.set(value, t);
  }
  return t;
}

/** @param {string} value */
function internLiteral(value) {
  let t = __literalIntern.get(value);
  if (!t) {
    t = new Literal(value);
    __literalIntern.set(value, t);
  }
  return t;
}

// ===========================================================================
// Special predicate helpers (kept here because PrefixEnv needs them)
// ===========================================================================

function isRdfTypePred(p) {
  return p instanceof Iri && p.value === RDF_NS + 'type';
}

function isOwlSameAsPred(p) {
  return p instanceof Iri && p.value === OWL_NS + 'sameAs';
}

function isLogImplies(p) {
  return p instanceof Iri && p.value === LOG_NS + 'implies';
}

function isLogImpliedBy(p) {
  return p instanceof Iri && p.value === LOG_NS + 'impliedBy';
}


// ===========================================================================
// PREFIX ENVIRONMENT
// ===========================================================================


// Conservative check for whether a candidate local part can be safely serialized as a prefixed name.
// If false, we fall back to <IRI> to guarantee syntactically valid N3/Turtle output.
function isValidQNameLocal(local) {
  if (typeof local !== 'string' || local.length === 0) return false;
  // Disallow characters that would break PN_LOCAL unless escaped (we keep this conservative).
  if (/[#:\/\?\s]/.test(local)) return false;
  // Allow a safe ASCII subset.
  if (/[^A-Za-z0-9._-]/.test(local)) return false;
  // Avoid edge cases that typically require escaping.
  if (local.endsWith('.')) return false;
  if (/^[.-]/.test(local)) return false;
  return true;
}

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
        // Only emit a QName when the local part is safe to serialize without escaping.
        if (!isValidQNameLocal(local)) continue;
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
      if (Object.prototype.hasOwnProperty.call(this.map, p)) v.push([p, this.map[p]]);
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

module.exports = {
  RDF_NS,
  RDFS_NS,
  OWL_NS,
  XSD_NS,
  CRYPTO_NS,
  MATH_NS,
  TIME_NS,
  LIST_NS,
  LOG_NS,
  STRING_NS,
  SKOLEM_NS,
  RDF_JSON_DT,
  resolveIriRef,
  literalParts,
  Term,
  Iri,
  Literal,
  Var,
  Blank,
  ListTerm,
  OpenListTerm,
  GraphTerm,
  Triple,
  Rule,
  DerivedFact,
  internIri,
  internLiteral,
  isRdfTypePred,
  isOwlSameAsPred,
  isLogImplies,
  isLogImpliedBy,
  PrefixEnv,
  collectIrisInTerm,
  varsInRule,
  collectBlankLabelsInTriples,
};
