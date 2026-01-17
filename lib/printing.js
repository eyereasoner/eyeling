/**
 * Eyeling Reasoner — printing
 *
 * Pretty-printing / serialization helpers for terms, triples, and formulas.
 * Used by the CLI, demo, and explanations.
 */

'use strict';

const {
  XSD_NS,
  Iri,
  Literal,
  Var,
  Blank,
  ListTerm,
  OpenListTerm,
  GraphTerm,
  literalParts,
  isRdfTypePred,
  isOwlSameAsPred,
  isLogImplies,
  isLogImpliedBy,
} = require('./prelude');

function stripQuotes(lex) {
  if (typeof lex !== 'string') return lex;
  // Handle both short ('...' / "...") and long ('''...''' / """...""") forms.
  if (lex.length >= 6) {
    if (lex.startsWith('"""') && lex.endsWith('"""')) return lex.slice(3, -3);
    if (lex.startsWith("'''") && lex.endsWith("'''")) return lex.slice(3, -3);
  }
  if (lex.length >= 2) {
    const a = lex[0];
    const b = lex[lex.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) return lex.slice(1, -1);
  }
  return lex;
}

function termToN3(t, pref) {
  if (t instanceof Iri) {
    const i = t.value;
    const q = pref.shrinkIri(i);
    if (q !== null) return q;
    if (i.startsWith('_:')) return i;
    return `<${i}>`;
  }
  if (t instanceof Literal) {
    const [lex, dt] = literalParts(t.value);

    // Pretty-print xsd:boolean as bare true/false
    if (dt === XSD_NS + 'boolean') {
      const v = stripQuotes(lex);
      if (v === 'true' || v === 'false') return v;
      // optional: normalize 1/0 too
      if (v === '1') return 'true';
      if (v === '0') return 'false';
    }

    if (!dt) return t.value; // keep numbers, booleans, lang-tagged strings, etc.
    const qdt = pref.shrinkIri(dt);
    if (qdt !== null) return `${lex}^^${qdt}`; // e.g. ^^rdf:JSON
    return `${lex}^^<${dt}>`; // fallback
  }
  if (t instanceof Var) return `?${t.name}`;
  if (t instanceof Blank) return t.label;
  if (t instanceof ListTerm) {
    const inside = t.elems.map((e) => termToN3(e, pref));
    return '(' + inside.join(' ') + ')';
  }
  if (t instanceof OpenListTerm) {
    const inside = t.prefix.map((e) => termToN3(e, pref));
    inside.push('?' + t.tailVar);
    return '(' + inside.join(' ') + ')';
  }
  if (t instanceof GraphTerm) {
    const indent = '    ';
    const indentBlock = (str) =>
      str
        .split(/\r?\n/)
        .map((ln) => (ln.length ? indent + ln : ln))
        .join('\n');

    let s = '{\n';
    for (const tr of t.triples) {
      const block = tripleToN3(tr, pref).trimEnd();
      if (block) s += indentBlock(block) + '\n';
    }
    s += '}';
    return s;
  }
  return JSON.stringify(t);
}

function tripleToN3(tr, prefixes) {
  // log:implies / log:impliedBy as => / <= syntactic sugar everywhere
  if (isLogImplies(tr.p)) {
    const s = termToN3(tr.s, prefixes);
    const o = termToN3(tr.o, prefixes);
    return `${s} => ${o} .`;
  }

  if (isLogImpliedBy(tr.p)) {
    const s = termToN3(tr.s, prefixes);
    const o = termToN3(tr.o, prefixes);
    return `${s} <= ${o} .`;
  }

  const s = termToN3(tr.s, prefixes);
  const p = isRdfTypePred(tr.p) ? 'a' : isOwlSameAsPred(tr.p) ? '=' : termToN3(tr.p, prefixes);
  const o = termToN3(tr.o, prefixes);

  return `${s} ${p} ${o} .`;
}

module.exports = { termToN3, tripleToN3 };
