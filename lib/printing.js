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

// ---------------------------------------------------------------------------
// log:query output pretty-printing (blank node property lists)
// ---------------------------------------------------------------------------

function isBNodeTerm(t) {
  // Blank() terms, or IRI terms that encode a blank node label like "_:b0".
  if (t instanceof Blank) return true;
  if (t instanceof Iri && typeof t.value === 'string' && t.value.startsWith('_:')) return true;
  return false;
}

function termId(t) {
  // Stable-ish key used only for internal maps.
  if (t instanceof Iri) return `I:${t.value}`;
  if (t instanceof Blank) return `B:${t.label}`;
  if (t instanceof Literal) return `L:${t.value}`;
  if (t instanceof Var) return `V:${t.name}`;
  if (t instanceof ListTerm) return `LIST:${t.elems.map(termId).join(' ')}`;
  if (t instanceof OpenListTerm) return `OLIST:${t.prefix.map(termId).join(' ')}|?${t.tailVar}`;
  if (t instanceof GraphTerm)
    return `G:{${t.triples.map((tr) => `${termId(tr.s)} ${termId(tr.p)} ${termId(tr.o)}`).join('|')}}`;
  return `T:${String(t)}`;
}

function predToN3(p, prefixes) {
  return isRdfTypePred(p) ? 'a' : isOwlSameAsPred(p) ? '=' : termToN3(p, prefixes);
}

/**
 * Pretty-print a set of (ground) query-selected triples, collapsing eligible blank node
 * subjects into Turtle-style property lists ("[ ... ] .") and inlining singly-referenced
 * blank node objects as nested "[ ... ]" blocks.
 *
 * Intended for log:query output when proof comments are disabled.
 */
function prettyPrintQueryTriples(triples, prefixes) {
  const indentStep = '  ';

  // Index by subject (only for blank node subjects).
  const bySubj = new Map(); // id -> { term, triples: [] }
  const bnodeRef = new Map(); // bnodeId -> count as object

  for (const tr of triples) {
    // object ref count
    if (isBNodeTerm(tr.o)) {
      const oid = termId(tr.o);
      bnodeRef.set(oid, (bnodeRef.get(oid) || 0) + 1);
    }
    // subject index
    if (isBNodeTerm(tr.s)) {
      const sid = termId(tr.s);
      let rec = bySubj.get(sid);
      if (!rec) {
        rec = { term: tr.s, triples: [] };
        bySubj.set(sid, rec);
      }
      rec.triples.push(tr);
    }
  }

  const inlineable = new Set();
  for (const [bid, n] of bnodeRef.entries()) {
    if (n === 1 && bySubj.has(bid)) inlineable.add(bid);
  }

  const consumedBNodes = new Set();

  function groupByPredicate(bid) {
    const rec = bySubj.get(bid);
    if (!rec) return [];
    const m = new Map();
    for (const tr of rec.triples) {
      const ps = predToN3(tr.p, prefixes);
      let g = m.get(ps);
      if (!g) {
        g = { predStr: ps, objs: [] };
        m.set(ps, g);
      }
      g.objs.push(tr.o);
    }
    const groups = Array.from(m.values());
    groups.sort((a, b) => a.predStr.localeCompare(b.predStr));
    for (const g of groups) {
      g.objs.sort((x, y) => termToN3(x, prefixes).localeCompare(termToN3(y, prefixes)));
    }
    return groups;
  }

  function renderBNodePredicateObjects(bid, level, visiting) {
    const lines = [];
    const groups = groupByPredicate(bid);
    const indent = indentStep.repeat(level);

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const isLastPred = i === groups.length - 1;

      // Inline a child blank node only when it's the sole object for that predicate.
      if (g.objs.length === 1 && isBNodeTerm(g.objs[0])) {
        const childId = termId(g.objs[0]);
        const canInline = inlineable.has(childId) && !visiting.has(childId);

        if (canInline) {
          visiting.add(childId);
          consumedBNodes.add(childId);

          lines.push(`${indent}${g.predStr} [`);
          lines.push(...renderBNodePredicateObjects(childId, level + 1, visiting));
          lines.push(`${indent}]${isLastPred ? '' : ';'}`);

          visiting.delete(childId);
          continue;
        }
      }

      const objs = g.objs.map((o) => termToN3(o, prefixes)).join(', ');
      lines.push(`${indent}${g.predStr} ${objs}${isLastPred ? '' : ';'}`);
    }

    return lines;
  }

  function renderRootBNode(bid) {
    const visiting = new Set([bid]);
    const lines = ['['];
    lines.push(...renderBNodePredicateObjects(bid, 1, visiting));
    lines.push('] .');
    return lines.join('\n');
  }

  function renderInlineBNodeObjectTriple(tr, bid) {
    // Render: S P [ ... ] .   (multi-line)
    const s = termToN3(tr.s, prefixes);

    // Respect => / <= sugar for log:* if it ever appears here.
    if (isLogImplies(tr.p)) return tripleToN3(tr, prefixes);
    if (isLogImpliedBy(tr.p)) return tripleToN3(tr, prefixes);

    const p = predToN3(tr.p, prefixes);

    const visiting = new Set([bid]);
    const lines = [`${s} ${p} [`];
    lines.push(...renderBNodePredicateObjects(bid, 1, visiting));
    lines.push('] .');
    return lines.join('\n');
  }

  // Root blank nodes: blank node subjects that are never referenced as an object.
  const rootBNodes = [];
  for (const [bid, rec] of bySubj.entries()) {
    const refs = bnodeRef.get(bid) || 0;
    if (refs === 0) rootBNodes.push({ bid, term: rec.term });
  }
  rootBNodes.sort((a, b) => termToN3(a.term, prefixes).localeCompare(termToN3(b.term, prefixes)));

  const blocks = [];
  for (const r of rootBNodes) {
    consumedBNodes.add(r.bid);
    blocks.push(renderRootBNode(r.bid));
  }

  // Remaining triples: keep the traditional one-triple-per-line format.
  const remaining = [];
  for (const tr of triples) {
    const sid = isBNodeTerm(tr.s) ? termId(tr.s) : null;
    // Skip subject-triples for bnodes that will be inlined at their single reference.
    if (sid && (consumedBNodes.has(sid) || inlineable.has(sid))) continue;
    remaining.push(tr);
  }

  // Deterministic order: sort by the fallback single-line serialization.
  remaining.sort((a, b) => tripleToN3(a, prefixes).localeCompare(tripleToN3(b, prefixes)));

  for (const tr of remaining) {
    // Inline blank node *objects* when the bnode is defined and referenced exactly once.
    if (isBNodeTerm(tr.o)) {
      const oid = termId(tr.o);
      if (inlineable.has(oid) && !consumedBNodes.has(oid)) {
        consumedBNodes.add(oid);
        blocks.push(renderInlineBNodeObjectTriple(tr, oid));
        continue;
      }
    }
    blocks.push(tripleToN3(tr, prefixes));
  }

  return blocks.join('\n');
}

module.exports = { termToN3, tripleToN3, prettyPrintQueryTriples };
