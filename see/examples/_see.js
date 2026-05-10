const fs = require('fs');
const path = require('path');
const INPUT_DIR = path.join(__dirname, 'input');

function iri(value) { return { kind: 'iri', value }; }
function lit(value) { return { kind: 'lit', value }; }
function blank(value) { return { kind: 'blank', value }; }
function list(items) { return { kind: 'list', items }; }
function formula(atoms) { return { kind: 'formula', atoms }; }
function triple(s, p, o) { return { kind: 'triple', s, p, o }; }

function readTermToken(text, start = 0) {
  let i = start;
  while (/\s/.test(text[i])) i += 1;
  const begin = i;
  if (text.startsWith('<<(', i)) {
    let depth = 0;
    while (i < text.length) {
      if (text[i] === '"') {
        const [, next] = readTermToken(text, i);
        i = next;
        continue;
      }
      if (text.startsWith('<<(', i)) { depth += 1; i += 3; continue; }
      if (text.startsWith(')>>', i)) {
        depth -= 1;
        i += 3;
        if (depth === 0) break;
        continue;
      }
      i += 1;
    }
    return [text.slice(begin, i), i];
  }
  if (text[i] === '"') {
    i += 1;
    let escaped = false;
    while (i < text.length) {
      const ch = text[i++];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') break;
    }
    return [text.slice(begin, i), i];
  }
  if (text[i] === '<') {
    i += 1;
    while (i < text.length && text[i] !== '>') i += 1;
    if (text[i] === '>') i += 1;
    return [text.slice(begin, i), i];
  }
  if (text[i] === '(') {
    let depth = 0;
    while (i < text.length) {
      if (text[i] === '"') {
        const [, next] = readTermToken(text, i);
        i = next;
        continue;
      }
      if (text[i] === '(') depth += 1;
      else if (text[i] === ')') {
        depth -= 1;
        i += 1;
        if (depth === 0) break;
        continue;
      }
      i += 1;
    }
    return [text.slice(begin, i), i];
  }
  while (i < text.length && !/\s/.test(text[i])) i += 1;
  return [text.slice(begin, i), i];
}

function stripDot(text) { return String(text || '').replace(/\s*\.\s*$/, '').trim(); }
function splitListItems(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    while (/\s/.test(text[i])) i += 1;
    if (i >= text.length) break;
    const start = i;
    if (text.startsWith('<<(', i)) {
      const [, next] = readTermToken(text, i);
      i = next;
    } else if (text[i] === '"') {
      i += 1;
      let escaped = false;
      while (i < text.length) {
        const ch = text[i++];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"') break;
      }
    } else if (text[i] === '(') {
      let depth = 1; i += 1;
      while (i < text.length && depth) {
        if (text[i] === '(') depth += 1;
        else if (text[i] === ')') depth -= 1;
        i += 1;
      }
    } else {
      while (i < text.length && !/\s/.test(text[i])) i += 1;
    }
    out.push(text.slice(start, i));
  }
  return out;
}
function parseTripleTermBody(text) {
  const [s, i1] = readTermToken(text, 0);
  const [p, i2] = readTermToken(text, i1);
  const [o, i3] = readTermToken(text, i2);
  if (!s || !p || !o || text.slice(i3).trim()) throw new Error('bad triple term: ' + text);
  return triple(parseTerm(s), parseTerm(p), parseTerm(o));
}
function parseTerm(text) {
  const t = String(text || '').trim();
  if (!t) throw new Error('empty term');
  if (t.startsWith('<<(') && t.endsWith(')>>')) return parseTripleTermBody(t.slice(3, -3).trim());
  const first = t[0];
  if (first === '"') return lit(JSON.parse(t));
  if (first === '(' && t[t.length - 1] === ')') return list(splitListItems(t.slice(1, -1)).map(parseTerm));
  if (t.startsWith('_:')) return blank(t);
  if (first !== '+' && first !== '-' && (first < '0' || first > '9')) {
    if (t === 'true') return lit(true);
    if (t === 'false') return lit(false);
    return iri(t);
  }
  if (/^[+-]?\d+$/.test(t)) return lit(Number.parseInt(t, 10));
  if (/^[+-]?(?:\d+\.\d*|\d*\.\d+|\d+[eE][+-]?\d+)$/.test(t)) return lit(Number(t));
  return iri(t);
}
function parseTripleLine(line) {
  const body = stripDot(line);
  const [s, i1] = readTermToken(body, 0);
  const [p, i2] = readTermToken(body, i1);
  const rest = body.slice(i2).trim();
  if (!s || !p || !rest) throw new Error('bad triple: ' + line);
  return { s: parseTerm(s), p: parseTerm(p), o: parseTerm(rest) };
}
function parseInputTrigFast(trig) {
  const facts = [];
  const lines = String(trig || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.toLowerCase().startsWith('@prefix ') || /^(@version|version)\s+/i.test(line)) continue;
    const graphStart = line.match(/^(\S+)\s*\{\s*$/);
    if (graphStart) {
      const atoms = [];
      for (i += 1; i < lines.length; i += 1) {
        const inner = lines[i].trim();
        if (!inner || inner.startsWith('#')) continue;
        if (/^}\s*\.?\s*$/.test(inner)) break;
        atoms.push(parseTripleLine(inner));
      }
      facts.push({ s: parseTerm(graphStart[1]), p: iri('log:nameOf'), o: formula(atoms) });
      continue;
    }
    if (line.includes('{') || line.includes('}')) throw new Error('unsupported inline formula');
    facts.push(parseTripleLine(line));
  }
  return facts;
}
function extractMetadata(facts) {
  const meta = {}, rem = [];
  const map = {
    'see:name': 'Name', 'see:title': 'Title', 'see:sourceFile': 'SourceFile',
    'see:sourceSHA256': 'SourceSHA256', 'see:description': 'Description',
    'see:compiler': 'Compiler', 'see:inputFacts': 'InputFacts',
    'see:compiledRules': 'CompiledRules', 'see:compiledBackwardRules': 'CompiledBackwardRules',
    'see:compiledFuses': 'CompiledFuses', 'see:compiledQueries': 'CompiledQueries'
  };
  for (const f of facts) {
    if (f.s?.value === 'in:metadata' && f.p?.value === 'log:nameOf' && f.o?.kind === 'formula') {
      for (const a of f.o.atoms || []) {
        const k = map[a.p?.value];
        if (k && a.o?.kind === 'lit') meta[k] = a.o.value;
      }
      continue;
    }
    rem.push(f);
  }
  return { meta, facts: rem };
}
function inflateFormulaLinks(facts) {
  const by = new Map();
  for (const f of facts) if (/^in:formula\d+$/.test(f.s?.value || '') && f.p?.value === 'log:nameOf' && f.o?.kind === 'formula') by.set(f.s.value, f.o);
  if (!by.size) return facts;
  const out = [];
  for (const f of facts) {
    if (by.has(f.s?.value || '') && f.p?.value === 'log:nameOf') continue;
    if (by.has(f.o?.value || '')) { out.push({ ...f, o: by.get(f.o.value) }); continue; }
    out.push(f);
  }
  return out;
}
function inputNameCandidates(name) {
  const out = [name];
  const dashed = name.replace(/_/g, '-');
  if (!out.includes(dashed)) out.push(dashed);
  return out;
}
function inputFactsFromTrigText(trig) {
  const m = String(trig || '').match(/\bsee:inputFacts\s+([0-9]+)\s*\./);
  return m ? Number.parseInt(m[1], 10) : null;
}
function inputCandidateScore(file) {
  try {
    const stat = fs.statSync(file);
    const text = fs.readFileSync(file, 'utf8');
    const facts = inputFactsFromTrigText(text);
    return { facts: facts ?? -1, size: stat.size };
  } catch (_) {
    return { facts: -1, size: -1 };
  }
}
function inputBase(name) {
  const candidates = inputNameCandidates(name)
    .map((base, order) => ({ base, order, file: path.join(INPUT_DIR, `${base}.trig`) }))
    .filter((c) => fs.existsSync(c.file))
    .map((c) => ({ ...c, score: inputCandidateScore(c.file) }));
  if (!candidates.length) return name;
  candidates.sort((a, b) =>
    (b.score.facts - a.score.facts) ||
    (b.score.size - a.score.size) ||
    (a.order - b.order)
  );
  return candidates[0].base;
}
function parseInput(trig) { return parseInputTrigFast(trig); }
function loadInput(name) {
  const base = inputBase(name);
  const trigFile = path.join(INPUT_DIR, `${base}.trig`);
  const trig = fs.readFileSync(trigFile, 'utf8');
  const ex = extractMetadata(parseInput(trig));
  return { __see: ex.meta, facts: inflateFormulaLinks(ex.facts), trig };
}
function emit(l = '') { process.stdout.write(l ? `${l}  \n` : '\n'); }
function emitLines(ls) { for (const l of ls) emit(l); }
function fail(p, o) { const f = Object.entries(o).filter(([, ok]) => !ok).map(([n]) => n); if (f.length) throw new Error(`${p}: ${f.join(', ')}`); }
function sum(v) { return v.reduce((a, b) => a + b, 0); }
function compareKeys(a, b) { const aa = Array.isArray(a) ? a : [a], bb = Array.isArray(b) ? b : [b], n = Math.min(aa.length, bb.length); for (let i = 0; i < n; i += 1) { if (aa[i] < bb[i]) return -1; if (aa[i] > bb[i]) return 1; } return aa.length - bb.length; }
function minBy(v, k) { let best = v[0], bk = k(best); for (let i = 1; i < v.length; i += 1) { const kk = k(v[i]); if (compareKeys(kk, bk) < 0) { best = v[i]; bk = kk; } } return best; }
function maxBy(v, k) { let best = v[0], bk = k(best); for (let i = 1; i < v.length; i += 1) { const kk = k(v[i]); if (compareKeys(kk, bk) > 0) { best = v[i]; bk = kk; } } return best; }
function range(start, stop, step = 1) { if (stop === undefined) { stop = start; start = 0; } const o = []; for (let i = start; step > 0 ? i < stop : i > stop; i += step) o.push(i); return o; }
function roundTo(v, d = 0) { const f = 10 ** d; return Math.round((v + Number.EPSILON) * f) / f; }
function boolText(v) { return v ? 'true' : 'false'; }

module.exports = { loadInput, emit, emitLines, fail, sum, minBy, maxBy, compareKeys, range, roundTo, boolText };
