#!/usr/bin/env node
'use strict';

// SEE, Specialized Eyeling Executables, compiles a small, practical Notation3
// subset into standalone JavaScript examples.  The compiler runs once at
// generation time: it extracts source facts into formal TriG evidence and bakes
// the supported rules, queries, and fuses into the generated runner.
//
// The generated examples intentionally do not call Eyeling or another reasoner
// at runtime.  They read their .trig evidence directly and perform a local
// fixpoint derivation, which makes the resulting programs easy to inspect,
// snapshot, and publish as self-contained executable explanations.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// All SEE-owned artefacts stay below /see/examples so the directory can be
// generated, tested, and documented from the eyeling repository root.
const ROOT = __dirname;
const EXAMPLES_DIR = path.join(ROOT, 'examples');
const INPUT_DIR = path.join(EXAMPLES_DIR, 'input');
const OUTPUT_DIR = path.join(EXAMPLES_DIR, 'output');
const DOC_DIR = path.join(EXAMPLES_DIR, 'doc');

function usage() {
  return `SEE Notation3-to-JavaScript compiler

Usage:
  node see.js generate <example.n3> [--name <slug>] [--force]
  node see.js render <example.n3>
  node see.js inspect <example.n3>

What generate writes:
  examples/<name>.js              Specialized JavaScript derivation program
  examples/input/<name>.trig      RDF 1.2 TriG input evidence dataset
  examples/output/<name>.md       Snapshot produced by the specialized JS
  examples/doc/<name>.md          Human-readable compilation notes

This is intentionally not a reasoner bridge. see.js parses the program N3 once,
emits its source facts as formal TriG evidence, compiles the supported
rule/query/fuse subset into JavaScript, and the resulting examples/<name>.js
loads the TriG evidence directly and performs the forward derivation itself.`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
function readText(file) {
  return fs.readFileSync(file, 'utf8');
}
function writeText(file, text, force) {
  if (!force && fs.existsSync(file)) {
    throw new Error(`${path.relative(ROOT, file)} already exists; pass --force to overwrite`);
  }
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, text, 'utf8');
}
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}
function js(value) {
  return JSON.stringify(value, null, 2);
}

function slugify(value) {
  const base = String(value || 'example')
    .replace(/\.[^.]+$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'example';
}
function titleFromSlug(slug) {
  return slug
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// A leading comment block in each source .n3 file becomes the public example
// title and description used in generated documentation and metadata.
function stripComment(line) {
  return line.replace(/^\s*#\s?/, '').trimEnd();
}
function isSeparator(line) {
  const t = line.trim();
  return /^[-=]{3,}$/.test(t) || t === '';
}
function parseHeader(n3, fallbackTitle) {
  const raw = [];
  for (const line of n3.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) {
      raw.push(stripComment(line));
      continue;
    }
    if (/^\s*$/.test(line) && raw.length) {
      raw.push('');
      continue;
    }
    if (/^\s*$/.test(line)) continue;
    break;
  }
  const useful = raw.map((line) => line.trim()).filter((line) => !isSeparator(line));
  return {
    title: useful[0] || fallbackTitle,
    description: useful
      .slice(1)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    headerComments: raw,
  };
}

function removeComments(n3) {
  return n3
    .split(/\r?\n/)
    .map((line) => {
      let inString = false,
        escaped = false,
        inIri = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\' && inString) {
          escaped = true;
          continue;
        }
        if (ch === '"' && !inIri) inString = !inString;
        if (ch === '<' && !inString) inIri = true;
        if (ch === '>' && inIri) inIri = false;
        if (ch === '#' && !inString && !inIri) return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}

function decodeEscapes(value) {
  return value.replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[nrtbf"'\\])/g, (all, esc) => {
    if (esc === 'n') return '\n';
    if (esc === 'r') return '\r';
    if (esc === 't') return '\t';
    if (esc === 'b') return '\b';
    if (esc === 'f') return '\f';
    if (esc === '"') return '"';
    if (esc === "'") return "'";
    if (esc === '\\') return '\\';
    if (esc.startsWith('u')) return String.fromCharCode(Number.parseInt(esc.slice(1), 16));
    if (esc.startsWith('U')) return String.fromCodePoint(Number.parseInt(esc.slice(1), 16));
    return all;
  });
}

// Internal terms use a tiny AST shared by the compiler and the generated
// runtime.  Variables are stored without the leading '?'; IRIs and compact
// QNames are preserved as source-facing strings for readable snapshots.
function t(kind, value) {
  return { kind, value };
}
function I(value) {
  return t('iri', value);
}
function V(value) {
  return t('var', value);
}
function L(value) {
  return t('lit', value);
}
function List(items) {
  return { kind: 'list', items };
}
function Blank(id) {
  return { kind: 'blank', value: id };
}

// This tokenizer/parser is deliberately smaller than a complete N3 parser.  It
// accepts the SEE example subset: triples, lists, blank-node property lists,
// quoted formulas, implication arrows, variables, literals, and prefix lines.
function tokenize(source) {
  const s = removeComments(source);
  const tokens = [];
  let i = 0;
  const isWs = (ch) => /\s/.test(ch);
  const one = new Set(['{', '}', '[', ']', '(', ')', ';', ',', '.']);
  while (i < s.length) {
    const ch = s[i];
    if (isWs(ch)) {
      i += 1;
      continue;
    }
    if (s.startsWith('=>', i) || s.startsWith('<=', i) || s.startsWith('^^', i)) {
      tokens.push({ type: s.slice(i, i + 2), value: s.slice(i, i + 2) });
      i += 2;
      continue;
    }
    if (/^[+-]?(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/.test(s.slice(i)) && /[+\-0-9.]/.test(ch)) {
      const m = s.slice(i).match(/^[+-]?(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/)[0];
      // Do not steal the dot that terminates a previous integer triple; this branch starts at the number itself.
      tokens.push(classifyToken(m));
      i += m.length;
      continue;
    }
    if (one.has(ch)) {
      tokens.push({ type: ch, value: ch });
      i += 1;
      continue;
    }
    if (ch === '"') {
      let out = '',
        escaped = false;
      i += 1;
      while (i < s.length) {
        const c = s[i++];
        if (escaped) {
          out += `\\${c}`;
          escaped = false;
          continue;
        }
        if (c === '\\') {
          escaped = true;
          continue;
        }
        if (c === '"') break;
        out += c;
      }
      tokens.push({ type: 'string', value: decodeEscapes(out) });
      continue;
    }
    if (ch === '<') {
      let out = '';
      i += 1;
      while (i < s.length && s[i] !== '>') out += s[i++];
      if (s[i] !== '>') throw new Error('Unterminated IRI');
      i += 1;
      tokens.push({ type: 'iri', value: `<${out}>` });
      continue;
    }
    let out = '';
    while (i < s.length && !isWs(s[i]) && !one.has(s[i])) {
      if (s.startsWith('=>', i) || s.startsWith('<=', i) || s.startsWith('^^', i)) break;
      out += s[i++];
    }
    if (out.length) tokens.push(classifyToken(out));
  }
  return tokens;
}

function classifyToken(raw) {
  if (raw === '@prefix') return { type: '@prefix', value: raw };
  if (raw === 'a') return { type: 'qname', value: 'rdf:type' };
  if (raw.startsWith('?')) return { type: 'var', value: raw.slice(1) };
  if (/^(true|false)$/i.test(raw)) return { type: 'boolean', value: /^true$/i.test(raw) };
  if (/^[+-]?\d+$/.test(raw)) return { type: 'number', value: Number.parseInt(raw, 10) };
  if (/^[+-]?(?:\d+\.\d*|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) || /^[+-]?\d+[eE][+-]?\d+$/.test(raw))
    return { type: 'number', value: Number(raw) };
  return { type: 'qname', value: raw };
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.blankCounter = 0;
  }
  eof() {
    return this.pos >= this.tokens.length;
  }
  peek(value = undefined) {
    const tok = this.tokens[this.pos];
    if (value === undefined) return tok;
    return tok && tok.type === value;
  }
  next() {
    if (this.eof()) throw new Error('Unexpected end of input');
    return this.tokens[this.pos++];
  }
  accept(type) {
    if (this.peek(type)) return this.next();
    return null;
  }
  expect(type) {
    const tok = this.next();
    if (tok.type !== type) throw new Error(`Expected ${type}, got ${tok.type} (${tok.value})`);
    return tok;
  }
  freshBlank(prefix = 'b') {
    this.blankCounter += 1;
    return `_${prefix}${this.blankCounter}`;
  }
  skipPrefix() {
    this.expect('@prefix');
    // Prefix declaration is irrelevant after QName compaction; skip until final dot.
    while (!this.eof() && !this.accept('.')) this.next();
  }
  parseProgram() {
    const facts = [],
      rules = [],
      queries = [],
      prefixes = {};
    while (!this.eof()) {
      if (this.accept('@prefix')) {
        this.pos -= 1;
        const start = this.pos;
        this.skipPrefix();
        const slice = this.tokens
          .slice(start, this.pos)
          .map((tok) => tok.value)
          .join(' ');
        const m = slice.match(/@prefix\s+([^\s]*)\s+<([^>]+)>/);
        if (m) prefixes[(m[1] || ':').replace(/:$/, '')] = m[2];
        continue;
      }
      if (this.peek('{')) {
        const lhs = this.parseFormula('body');
        if (this.accept('=>')) {
          if (
            (this.peek('qname') && this.tokens[this.pos].value === 'false') ||
            (this.peek('boolean') && this.tokens[this.pos].value === false)
          ) {
            this.next();
            this.accept('.');
            rules.push({ kind: 'fuse', id: rules.length + 1, body: lhs });
          } else {
            const head = this.parseFormula('head');
            this.accept('.');
            rules.push({ kind: 'rule', id: rules.length + 1, body: lhs, head });
          }
        } else if (this.accept('<=')) {
          if (
            (this.peek('qname') && this.tokens[this.pos].value === 'true') ||
            (this.peek('boolean') && this.tokens[this.pos].value === true)
          ) {
            this.next();
            this.accept('.');
            rules.push({ kind: 'backward', id: rules.length + 1, body: [], head: lhs });
          } else {
            const rhs = this.parseFormula('body');
            this.accept('.');
            rules.push({ kind: 'backward', id: rules.length + 1, body: rhs, head: lhs });
          }
        } else {
          const subject = { kind: 'formula', atoms: lhs };
          const triples = this.parseStatementRest('fact', subject);
          this.accept('.');
          for (const triple of triples) {
            if (
              triple.s?.kind === 'formula' &&
              triple.p?.kind === 'iri' &&
              triple.p.value === 'log:query' &&
              triple.o?.kind === 'formula'
            ) {
              queries.push({ id: queries.length + 1, premise: triple.s.atoms, conclusion: triple.o.atoms });
            } else {
              facts.push(triple);
            }
          }
        }
      } else {
        facts.push(...this.parseStatement('fact'));
        this.accept('.');
      }
    }
    return { facts, rules, queries, prefixes };
  }
  parseFormula(mode) {
    this.expect('{');
    const atoms = [];
    while (!this.accept('}')) {
      if (this.eof()) throw new Error('Unclosed formula');
      atoms.push(...this.parseStatement(mode));
      this.accept('.');
    }
    return atoms;
  }
  parseStatement(mode) {
    const triples = [];
    const subject = this.parseTerm(mode, triples);
    return this.parseStatementRest(mode, subject, triples);
  }
  parseStatementRest(mode, subject, triples = []) {
    while (!this.eof() && !['.', '}'].includes(this.peek()?.type)) {
      if (this.accept(';')) {
        if (['.', '}'].includes(this.peek()?.type)) break;
      }
      const predicate = this.parsePredicate();
      while (true) {
        const object = this.parseTerm(mode, triples);
        triples.push({ s: subject, p: predicate, o: object });
        if (!this.accept(',')) break;
      }
      if (!this.accept(';')) break;
      if (['.', '}'].includes(this.peek()?.type)) break;
    }
    return triples;
  }
  parsePredicate() {
    const tok = this.next();
    if (tok.type === 'var') return V(tok.value);
    if (tok.type !== 'qname' && tok.type !== 'iri') throw new Error(`Expected predicate, got ${tok.type}`);
    if (tok.value === '=') return I('owl:sameAs');
    return I(tok.value);
  }
  parseTerm(mode, sink) {
    const tok = this.next();
    if (tok.type === 'var') return V(tok.value);
    if (tok.type === 'string') {
      if (this.accept('^^')) this.next();
      return L(tok.value);
    }
    if (tok.type === 'number' || tok.type === 'boolean') return L(tok.value);
    if (tok.type === 'iri' || tok.type === 'qname') return I(tok.value);
    if (tok.type === '(') {
      const items = [];
      while (!this.accept(')')) items.push(this.parseTerm(mode, sink));
      return List(items);
    }
    if (tok.type === '{') {
      const atoms = [];
      while (!this.accept('}')) {
        if (this.eof()) throw new Error('Unclosed nested formula');
        atoms.push(...this.parseStatement(mode));
        this.accept('.');
      }
      return { kind: 'formula', atoms };
    }
    if (tok.type === '[') {
      const id =
        mode === 'body'
          ? V(this.freshBlank('bodyBlank'))
          : Blank(this.freshBlank(mode === 'head' ? 'headBlank' : 'blank'));
      if (!this.accept(']')) {
        while (true) {
          const predicate = this.parsePredicate();
          while (true) {
            const object = this.parseTerm(mode, sink);
            sink.push({ s: id, p: predicate, o: object });
            if (!this.accept(',')) break;
          }
          if (this.accept(']')) break;
          this.expect(';');
        }
      }
      return id;
    }
    throw new Error(`Expected term, got ${tok.type}`);
  }
}

// parseN3 separates the source file into four compiler inputs:
//   facts   -> serialized as examples/input/<name>.trig
//   rules   -> compiled into JavaScript fixpoint code
//   queries -> rendered as selected output checks
//   prefixes -> carried into generated TriG evidence
function parseN3(n3) {
  const parser = new Parser(tokenize(n3));
  return parser.parseProgram();
}

function termToJsComment(term) {
  if (term.kind === 'iri') return term.value;
  if (term.kind === 'lit') return JSON.stringify(term.value);
  if (term.kind === 'var') return `?${term.value}`;
  if (term.kind === 'blank') return term.value;
  if (term.kind === 'list') return `(${term.items.map(termToJsComment).join(' ')})`;
  if (term.kind === 'formula') return `{ ${term.atoms.map(atomToComment).join(' . ')} }`;
  return String(term.value ?? term);
}
function atomToComment(atom) {
  return `${termToJsComment(atom.s)} ${termToJsComment(atom.p)} ${termToJsComment(atom.o)}`;
}

function compilationStats(program) {
  const predicates = new Set();
  const builtins = new Set();
  for (const atom of [
    ...program.facts,
    ...program.rules.flatMap((r) => [...(r.body || []), ...(r.head || [])]),
    ...(program.queries || []).flatMap((q) => [...(q.premise || []), ...(q.conclusion || [])]),
  ]) {
    const p = atom.p?.value;
    if (p) predicates.add(p);
    if (/^(math|string|list|log|crypto):/.test(p)) builtins.add(p);
  }
  return {
    facts: program.facts.length,
    rules: program.rules.filter((r) => r.kind === 'rule').length,
    backwardRules: program.rules.filter((r) => r.kind === 'backward').length,
    fuses: program.rules.filter((r) => r.kind === 'fuse').length,
    queries: (program.queries || []).length,
    predicates: predicates.size,
    builtins: [...builtins].sort(),
  };
}

// Source facts are emitted as RDF 1.2 TriG.  Formulas that appear as objects are
// lifted into named graphs so the generated runner can load evidence directly
// from .trig without going through an intermediate n3gen conversion step.
function trigString(value) {
  return JSON.stringify(String(value));
}
function trigNumber(value) {
  if (Object.is(value, -0)) return '0';
  if (Number.isInteger(value)) return String(value);
  return Number(value.toPrecision(15)).toString();
}
function inputLiteralToN3(value) {
  if (typeof value === 'string') return trigString(value);
  if (typeof value === 'number') return trigNumber(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return trigString(value);
}
function inputTermToN3(term) {
  if (!term) return 'undefined';
  if (term.kind === 'iri') return term.value;
  if (term.kind === 'lit') return inputLiteralToN3(term.value);
  if (term.kind === 'var') return '?' + term.value;
  if (term.kind === 'blank') return term.value.startsWith('_:') ? term.value : '_:' + term.value.replace(/^_+/, '');
  if (term.kind === 'list') return '(' + term.items.map(inputTermToN3).join(' ') + ')';
  if (term.kind === 'formula') return '{ ' + term.atoms.map(inputAtomToN3).join(' . ') + ' }';
  return String(term.value ?? term);
}
function inputAtomToN3(atom) {
  return inputTermToN3(atom.s) + ' ' + inputTermToN3(atom.p) + ' ' + inputTermToN3(atom.o);
}
function formulaBlock(label, atoms) {
  const lines = [label + ' {'];
  for (const atom of atoms) lines.push('  ' + inputAtomToN3(atom) + ' .');
  lines.push('}');
  return lines.join('\n');
}
function atomToTrig(atom, state) {
  if (atom.o && atom.o.kind === 'formula') {
    if (atom.p && atom.p.kind === 'iri' && atom.p.value === 'log:nameOf') {
      state.graphs.push(formulaBlock(inputTermToN3(atom.s), atom.o.atoms));
      return null;
    }
    state.formulaCounter += 1;
    const label = `in:formula${state.formulaCounter}`;
    state.graphs.push(formulaBlock(label, atom.o.atoms));
    return inputTermToN3(atom.s) + ' ' + inputTermToN3(atom.p) + ' ' + label + ' .';
  }
  return inputAtomToN3(atom) + ' .';
}
function inputFactsToTrig(facts) {
  const state = { formulaCounter: 0, graphs: [] };
  const triples = [];
  for (const atom of facts) {
    const line = atomToTrig(atom, state);
    if (line) triples.push(line);
  }
  return { triples, graphs: state.graphs };
}
function prefixLines(prefixes) {
  const merged = { ...(prefixes || {}) };
  if (!Object.hasOwn(merged, 'log')) merged.log = 'http://www.w3.org/2000/10/swap/log#';
  if (!Object.hasOwn(merged, 'see')) merged.see = 'https://example.org/see#';
  if (!Object.hasOwn(merged, 'in')) merged.in = 'https://example.org/see/input#';
  return Object.entries(merged).map(([prefix, iri]) => `@prefix ${prefix ? prefix + ':' : ':'} <${iri}> .`);
}
function generateInputTrig(n3Path, name, title, header, stats, program) {
  const { triples, graphs } = inputFactsToTrig(program.facts);
  const metadata = [
    'in:metadata {',
    '  in:run a see:InputDataset .',
    `  in:run see:name ${trigString(name)} .`,
    `  in:run see:title ${trigString(title)} .`,
    `  in:run see:sourceFile ${trigString(path.relative(ROOT, path.resolve(n3Path)))} .`,
    `  in:run see:sourceSHA256 ${trigString(stats.sourceHash)} .`,
    `  in:run see:description ${trigString(header.description || '')} .`,
    '  in:run see:compiler "see.js N3-to-JS compiler" .',
    `  in:run see:inputFacts ${stats.facts} .`,
    `  in:run see:compiledRules ${stats.rules} .`,
    `  in:run see:compiledBackwardRules ${stats.backwardRules} .`,
    `  in:run see:compiledFuses ${stats.fuses} .`,
    `  in:run see:compiledQueries ${stats.queries} .`,
    '}',
  ].join('\n');
  const sections = [
    ...prefixLines(program.prefixes),
    '',
    '# Formal SEE input evidence in RDF 1.2 TriG.',
    '# The generated runner reads this TriG evidence directly.',
    '',
    triples.length ? triples.join('\n') : '# No source facts were present in the N3 program.',
  ];
  if (graphs.length) sections.push('', graphs.join('\n\n'));
  sections.push('', metadata, '');
  return sections.join('\n');
}
// The runtime below is copied verbatim into each generated example.  Keep it
// dependency-light: generated examples should be executable with Node alone plus
// the local examples/_see.js TriG loader.
function runtimeSource() {
  return String.raw`
const crypto = require('crypto');

function canonical(term) {
  if (term.kind === 'list') return ['list', term.items.map(canonical)];
  if (term.kind === 'formula') return ['formula', term.atoms.map((a) => [canonical(a.s), canonical(a.p), canonical(a.o)])];
  return [term.kind, term.value];
}
function factKey(f) { return JSON.stringify([canonical(f.s), canonical(f.p), canonical(f.o)]); }
function termIndexKey(t) { return JSON.stringify(canonical(t)); }
function compoundIndexKey() { return Array.from(arguments).map(termIndexKey).join('\u001f'); }
function termIsConcrete(t) {
  if (!t || t.kind === 'var') return false;
  if (t.kind === 'list') return t.items.every(termIsConcrete);
  if (t.kind === 'formula') return t.atoms.every((a) => termIsConcrete(a.s) && termIsConcrete(a.p) && termIsConcrete(a.o));
  return true;
}
function isVar(t) { return t && t.kind === 'var'; }
function isIri(t, iri) { return t && t.kind === 'iri' && t.value === iri; }
function lit(value) { return { kind: 'lit', value }; }
function blank(value) { return { kind: 'blank', value }; }
function list(items) { return { kind: 'list', items }; }
function cloneTerm(t) { return JSON.parse(JSON.stringify(t)); }
function primitive(t) {
  if (!t) return undefined;
  if (t.kind === 'lit') return t.value;
  if (t.kind === 'iri') return t.value.replace(/^:/, '');
  if (t.kind === 'blank') return t.value;
  if (t.kind === 'list') return t.items.map(primitive);
  if (t.kind === 'formula') return termToN3(t);
  return undefined;
}
function literalToN3(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (Object.is(value, -0)) return '0';
    if (Number.isInteger(value)) return String(value);
    return Number(value.toPrecision(15)).toString();
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return JSON.stringify(value);
}
function termToN3(t) {
  if (!t) return 'undefined';
  if (t.kind === 'iri') return t.value;
  if (t.kind === 'lit') return literalToN3(t.value);
  if (t.kind === 'var') return '?' + t.value;
  if (t.kind === 'blank') return t.value.startsWith('_:') ? t.value : '_:' + t.value.replace(/^_+/, '');
  if (t.kind === 'list') return '(' + t.items.map(termToN3).join(' ') + ')';
  if (t.kind === 'formula') return '{ ' + t.atoms.map(atomToN3).join(' . ') + ' }';
  return String(t.value ?? t);
}
function atomToN3(f) { return termToN3(f.s) + ' ' + termToN3(f.p) + ' ' + termToN3(f.o); }
function display(t) {
  const value = primitive(t);
  if (Array.isArray(value)) return value.map(String).join(' ');
  return String(value);
}
function deepEqual(a, b) {
  if (a?.kind === 'lit' && b?.kind === 'lit' && typeof a.value === 'number' && typeof b.value === 'number') {
    return Math.abs(a.value - b.value) < 1e-12;
  }
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
function resolve(term, env, seen = new Set()) {
  if (term.kind === 'var' && Object.hasOwn(env, term.value)) {
    if (seen.has(term.value)) return term;
    seen.add(term.value);
    return resolve(env[term.value], env, seen);
  }
  if (term.kind === 'list') return list(term.items.map((item) => resolve(item, env, seen)));
  if (term.kind === 'formula') return { kind: 'formula', atoms: term.atoms.map((a) => ({ s: resolve(a.s, env), p: resolve(a.p, env), o: resolve(a.o, env) })) };
  return term;
}
function unify(a, b, env) {
  a = resolve(a, env);
  b = resolve(b, env);
  if (a.kind === 'var') return { ...env, [a.value]: b };
  if (b.kind === 'var') return { ...env, [b.value]: a };
  if (a.kind === 'list' || b.kind === 'list') {
    if (a.kind !== 'list' || b.kind !== 'list' || a.items.length !== b.items.length) return null;
    let out = env;
    for (let i = 0; i < a.items.length; i += 1) {
      out = unify(a.items[i], b.items[i], out);
      if (!out) return null;
    }
    return out;
  }
  return deepEqual(a, b) ? env : null;
}
function bind(pattern, value, env) { return unify(pattern, value, env); }
function matchFact(atom, fact, env) {
  let out = unify(atom.p, fact.p, env); if (!out) return null;
  out = unify(atom.s, fact.s, out); if (!out) return null;
  return unify(atom.o, fact.o, out);
}
function atomIsGround(atom, env) {
  return termIsGround(atom.s, env) && termIsGround(atom.p, env) && termIsGround(atom.o, env);
}
function termIsGround(t, env) {
  const r = resolve(t, env);
  if (r.kind === 'var') return false;
  if (r.kind === 'list') return r.items.every((item) => termIsGround(item, env));
  if (r.kind === 'formula') return r.atoms.every((atom) => atomIsGround(atom, env));
  return true;
}
function stringValue(t) {
  const r = t;
  if (!r) return null;
  if (r.kind === 'lit') return String(r.value);
  if (r.kind === 'iri') return r.value.replace(/[<>]/g, '');
  if (r.kind === 'blank' || r.kind === 'var') return null;
  return termToN3(r);
}
function xsdDurationSeconds(value) {
  const m = String(value || '').match(/^(-)?P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) return null;
  const sign = m[1] ? -1 : 1;
  const years = Number(m[2] || 0);
  const months = Number(m[3] || 0);
  const weeks = Number(m[4] || 0);
  const days = Number(m[5] || 0);
  const hours = Number(m[6] || 0);
  const minutes = Number(m[7] || 0);
  const seconds = Number(m[8] || 0);

  // xsd:duration years/months are calendar-relative. SEE uses Gregorian averages
  // for standalone numeric comparisons such as "age above P80Y".
  return sign * (
    years * 365.2425 * 86400 +
    months * (365.2425 / 12) * 86400 +
    weeks * 7 * 86400 +
    days * 86400 +
    hours * 3600 +
    minutes * 60 +
    seconds
  );
}

function toNumberMaybe(t) {
  const v = primitive(t);
  if (typeof v === 'number') return Number.isFinite(v) || Number.isNaN(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v !== 'string') return null;
  const dur = xsdDurationSeconds(v);
  if (dur !== null) return dur;
  const d = Date.parse(v);
  if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(v) && Number.isFinite(d)) return d / 1000;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function toNumber(t) {
  const n = toNumberMaybe(t);
  if (n === null || !Number.isFinite(n)) throw new Error('Expected numeric value, got ' + JSON.stringify(primitive(t)));
  return n;
}
function toIntegerMaybe(t) {
  const n = toNumberMaybe(t);
  if (n === null || !Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}
function parseDate(t) {
  const v = primitive(t);
  if (typeof v !== 'string') return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms) : null;
}
function dateTimeLiteral(date) { return lit(date.toISOString().replace(/\.000Z$/, 'Z')); }
function durationLiteral(seconds) { return lit('PT' + Number(seconds.toPrecision(15)).toString() + 'S'); }
function termFrom(value) {
  if (Array.isArray(value)) return list(value.map(termFrom));
  if (value && typeof value === 'object' && value.kind) return value;
  return lit(value);
}
function allBoundList(term, env) {
  const r = resolve(term, env);
  if (r.kind !== 'list') throw new Error('Expected N3 list');
  if (r.items.some((item) => resolve(item, env).kind === 'var')) return null;
  return r.items.map((item) => resolve(item, env));
}
function bindResult(pattern, value, env) {
  return bind(pattern, termFrom(value), env);
}
function bindTermResult(pattern, term, env) {
  const out = bind(pattern, term, env);
  return out ? [out] : [];
}
function succeedIf(ok, env) { return ok ? [env] : []; }
function compareNumericTerms(a, b) {
  const na = toNumberMaybe(a), nb = toNumberMaybe(b);
  if (na === null || nb === null) return null;
  if (Number.isNaN(na) || Number.isNaN(nb)) return NaN;
  return na < nb ? -1 : na > nb ? 1 : 0;
}
function comparisonOperands(s, o, env) {
  const left = resolve(s, env), right = resolve(o, env);
  if (left.kind === 'list' && left.items.length === 2 && (right.kind === 'lit' ? right.value === true : right.kind === 'iri' && right.value === 'true')) {
    return [resolve(left.items[0], env), resolve(left.items[1], env)];
  }
  return [left, right];
}
function bindNumericOutput(pattern, value, env) {
  if (!Number.isFinite(value)) return [];
  const normalized = Number.isInteger(value) ? value : Number(value.toPrecision(15));
  return bindTermResult(pattern, lit(normalized), env);
}
function unaryMath(name, s, o, env, fwd, inv) {
  const left = resolve(s, env), right = resolve(o, env);
  if (left.kind !== 'var') return bindNumericOutput(o, fwd(toNumber(left)), env);
  if (right.kind !== 'var' && inv) return bindNumericOutput(s, inv(toNumber(right)), env);
  if (left.kind === 'var' && right.kind === 'var') return [env];
  return [];
}
function builtinMath(name, s, o, env) {
  const left = resolve(s, env);
  const right = resolve(o, env);
  const testCmp = (pred) => {
    const [a, b] = comparisonOperands(s, o, env);
    if (a.kind === 'var' || b.kind === 'var') return [];
    const cmp = compareNumericTerms(a, b);
    if (cmp === null || Number.isNaN(cmp)) return [];
    return succeedIf(pred(cmp), env);
  };
  if (name === 'math:lessThan') return testCmp((c) => c < 0);
  if (name === 'math:notLessThan') return testCmp((c) => c >= 0);
  if (name === 'math:greaterThan') return testCmp((c) => c > 0);
  if (name === 'math:notGreaterThan') return testCmp((c) => c <= 0);
  if (name === 'math:equalTo') return testCmp((c) => c === 0);
  if (name === 'math:notEqualTo') {
    const [a, b] = comparisonOperands(s, o, env);
    if (a.kind === 'var' || b.kind === 'var') return [];
    const cmp = compareNumericTerms(a, b);
    if (cmp !== null) return succeedIf(Number.isNaN(cmp) || cmp !== 0, env);
    return succeedIf(!deepEqual(a, b), env);
  }
  if (name === 'math:negation') return unaryMath(name, s, o, env, (x) => -x, (x) => -x);
  if (name === 'math:absoluteValue') {
    if (left.kind === 'var' && right.kind === 'var') return [env];
    if (left.kind !== 'var') return bindNumericOutput(o, Math.abs(toNumber(left)), env);
    const n = toNumber(right);
    const outs = [];
    for (const v of n === 0 ? [0] : [n, -n]) {
      const out = bind(s, lit(v), env); if (out) outs.push(out);
    }
    return outs;
  }
  if (name === 'math:degrees') return unaryMath(name, s, o, env, (x) => x * 180 / Math.PI, (x) => x * Math.PI / 180);
  const unary = {
    'math:sin': [Math.sin, Math.asin], 'math:cos': [Math.cos, Math.acos], 'math:tan': [Math.tan, Math.atan],
    'math:asin': [Math.asin, Math.sin], 'math:acos': [Math.acos, Math.cos], 'math:atan': [Math.atan, Math.tan],
    'math:sinh': [Math.sinh, Math.asinh], 'math:cosh': [Math.cosh, Math.acosh], 'math:tanh': [Math.tanh, Math.atanh],
    'math:rounded': [Math.round, null], 'math:floor': [Math.floor, null]
  };
  if (Object.hasOwn(unary, name)) {
    const [fwd, inv] = unary[name];
    if (typeof fwd !== 'function') return [];
    return unaryMath(name, s, o, env, fwd, typeof inv === 'function' ? inv : null);
  }
  if (name === 'math:exponentiation') {
    const l = resolve(s, env);
    if (l.kind !== 'list' || l.items.length !== 2) return [];
    const base = resolve(l.items[0], env);
    const exponent = resolve(l.items[1], env);
    const result = resolve(o, env);
    if (base.kind !== 'var' && exponent.kind !== 'var') return bindNumericOutput(o, Math.pow(toNumber(base), toNumber(exponent)), env);
    if (base.kind !== 'var' && result.kind !== 'var') {
      const b = toNumber(base), r = toNumber(result);
      if (b > 0 && b !== 1 && r > 0) return bindNumericOutput(l.items[1], Math.log(r) / Math.log(b), env);
      return [];
    }
    if (exponent.kind !== 'var' && result.kind !== 'var') {
      const e = toNumber(exponent), r = toNumber(result);
      if (e !== 0) return bindNumericOutput(l.items[0], Math.pow(r, 1 / e), env);
      return [];
    }
    return [];
  }
  if (name === 'math:product' || name === 'math:sum') {
    const vals = allBoundList(s, env); if (!vals) return [];
    if (vals.length === 2) {
      const [aT, bT] = vals;
      const aD = parseDate(aT);
      if (name === 'math:sum' && aD) {
        const secs = toNumberMaybe(bT);
        if (secs !== null && Number.isFinite(secs)) return bindTermResult(o, dateTimeLiteral(new Date(aD.getTime() + secs * 1000)), env);
      }
    }
    const value = name === 'math:product' ? vals.reduce((a, x) => a * toNumber(x), 1) : vals.reduce((a, x) => a + toNumber(x), 0);
    return bindNumericOutput(o, value, env);
  }
  if (name === 'math:difference' || name === 'math:quotient' || name === 'math:integerQuotient' || name === 'math:remainder') {
    const vals = allBoundList(s, env); if (!vals || vals.length !== 2) return [];
    const aD = parseDate(vals[0]), bD = parseDate(vals[1]);
    if (name === 'math:difference' && aD && bD) return bindTermResult(o, durationLiteral((aD.getTime() - bD.getTime()) / 1000), env);
    if (name === 'math:difference' && aD && !bD) {
      const secs = toNumberMaybe(vals[1]);
      if (secs !== null && Number.isFinite(secs)) return bindTermResult(o, dateTimeLiteral(new Date(aD.getTime() - secs * 1000)), env);
    }
    const a = toNumber(vals[0]), b = toNumber(vals[1]);
    if ((name === 'math:quotient' || name === 'math:integerQuotient' || name === 'math:remainder') && b === 0) return [];
    if (name === 'math:difference') return bindNumericOutput(o, a - b, env);
    if (name === 'math:quotient') return bindNumericOutput(o, a / b, env);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return [];
    if (name === 'math:integerQuotient') return bindNumericOutput(o, Math.trunc(a / b), env);
    return bindNumericOutput(o, a % b, env);
  }
  return null;
}
function applyFormat(fmt, args) {
  let i = 0;
  return String(fmt).replace(/%([-0]?\d+)?(?:\.(\d+))?([%sdiufFeEgGc])/g, (m, width, precision, conv) => {
    if (conv === '%') return '%';
    const arg = args[i++];
    if (conv === 's') return String(arg ?? '');
    if (conv === 'c') return String.fromCodePoint(Number(arg));
    if ('diu'.includes(conv)) return String(Math.trunc(Number(arg)));
    const n = Number(arg);
    if (conv === 'f' || conv === 'F') return n.toFixed(precision == null ? 6 : Number(precision));
    if (conv === 'e' || conv === 'E') return n.toExponential(precision == null ? 6 : Number(precision));
    if (conv === 'g' || conv === 'G') return n.toPrecision(precision == null ? 6 : Number(precision)).replace(/\.0+(e|$)/i, '$1');
    return m;
  });
}
function compileRegex(pattern, flags = '') {
  try { return new RegExp(String(pattern), flags); }
  catch { return null; }
}
function builtinString(name, s, o, env) {
  const left = resolve(s, env), right = resolve(o, env);
  function output(value) { return bindTermResult(o, lit(String(value)), env); }
  const str = (term) => stringValue(resolve(term, env));
  if (name === 'string:concatenation') {
    const vals = allBoundList(s, env); if (!vals) return [];
    return output(vals.map(stringValue).join(''));
  }
  if (name === 'string:format') {
    const vals = allBoundList(s, env); if (!vals || vals.length === 0) return [];
    return output(applyFormat(stringValue(vals[0]), vals.slice(1).map(stringValue)));
  }
  if (name === 'string:length') { const a = str(s); return a === null ? [] : bindTermResult(o, lit(a.length), env); }
  if (name === 'string:charAt') {
    const vals = allBoundList(s, env); if (!vals || vals.length !== 2) return [];
    const a = stringValue(vals[0]); const idx = Math.trunc(toNumber(vals[1]));
    return output(idx < 0 || idx >= a.length ? '' : a.charAt(idx));
  }
  if (name === 'string:setCharAt') {
    const vals = allBoundList(s, env); if (!vals || vals.length !== 3) return [];
    const a = stringValue(vals[0]); const idx = Math.trunc(toNumber(vals[1])); const ch = String(stringValue(vals[2]) || '').charAt(0);
    if (idx < 0 || idx >= a.length) return output(a);
    return output(a.slice(0, idx) + ch + a.slice(idx + 1));
  }
  const a = str(s), b = str(o);
  if (name === 'string:contains') return a === null || b === null ? [] : succeedIf(a.includes(b), env);
  if (name === 'string:containsIgnoringCase') return a === null || b === null ? [] : succeedIf(a.toLowerCase().includes(b.toLowerCase()), env);
  if (name === 'string:startsWith') return a === null || b === null ? [] : succeedIf(a.startsWith(b), env);
  if (name === 'string:endsWith') return a === null || b === null ? [] : succeedIf(a.endsWith(b), env);
  if (name === 'string:equalIgnoringCase') return a === null || b === null ? [] : succeedIf(a.toLowerCase() === b.toLowerCase(), env);
  if (name === 'string:notEqualIgnoringCase') return a === null || b === null ? [] : succeedIf(a.toLowerCase() !== b.toLowerCase(), env);
  if (name === 'string:greaterThan') return a === null || b === null ? [] : succeedIf(a > b, env);
  if (name === 'string:lessThan') return a === null || b === null ? [] : succeedIf(a < b, env);
  if (name === 'string:notGreaterThan') return a === null || b === null ? [] : succeedIf(a <= b, env);
  if (name === 'string:notLessThan') return a === null || b === null ? [] : succeedIf(a >= b, env);
  if (name === 'string:matches' || name === 'string:notMatches') {
    if (a === null || b === null) return [];
    const re = compileRegex(b); if (!re) return [];
    const ok = re.test(a);
    return succeedIf(name === 'string:matches' ? ok : !ok, env);
  }
  if (name === 'string:replace') {
    const vals = allBoundList(s, env); if (!vals || vals.length !== 3) return [];
    const data = stringValue(vals[0]), pattern = stringValue(vals[1]), replacement = stringValue(vals[2]);
    const re = compileRegex(pattern, 'g'); if (!re) return [];
    return output(data.replace(re, replacement));
  }
  if (name === 'string:scrape') {
    const vals = allBoundList(s, env); if (!vals || vals.length !== 2) return [];
    const data = stringValue(vals[0]), pattern = stringValue(vals[1]);
    const re = compileRegex(pattern); if (!re) return [];
    const m = data.match(re); if (!m || m.length < 2) return [];
    return output(m[1]);
  }
  return null;
}
function builtinCrypto(name, s, o, env) {
  const algos = { 'crypto:sha': 'sha1', 'crypto:md5': 'md5', 'crypto:sha256': 'sha256', 'crypto:sha512': 'sha512' };
  if (!Object.hasOwn(algos, name)) return null;
  if (!termIsGround(s, env)) return [];
  const digest = crypto.createHash(algos[name]).update(String(primitive(resolve(s, env))), 'utf8').digest('hex');
  return bindTermResult(o, lit(digest), env);
}
function formulaContains(graph, patternAtoms, env, rules, depth) {
  const localGraph = graph && graph.facts ? graph : makeGraph(graph?.atoms || graph?.facts || []);
  return evalBody(patternAtoms, [env], localGraph, rules, depth + 1).length > 0;
}
function builtinLog(name, s, o, env, graph, rules, depth) {
  if (name === 'log:equalTo') return bindTermResult(s, resolve(o, env), env);
  if (name === 'log:notEqualTo') {
    const out = unify(resolve(s, env), resolve(o, env), env);
    return out ? [] : [env];
  }
  if (name === 'log:conjunction') {
    const vals = allBoundList(s, env); if (!vals) return [];
    const merged = [], seen = new Set();
    for (const part of vals) {
      if (part.kind === 'lit' && part.value === true) continue;
      if (part.kind !== 'formula') return [];
      for (const atom of part.atoms) { const k = factKey(atom); if (!seen.has(k)) { seen.add(k); merged.push(atom); } }
    }
    return bindTermResult(o, { kind: 'formula', atoms: merged }, env);
  }
  if (name === 'log:includes' || name === 'log:notIncludes') {
    const scope = resolve(s, env), pattern = resolve(o, env);
    if (pattern.kind !== 'formula') return [];
    const local = scope.kind === 'formula' ? makeGraph(scope.atoms) : graph;
    const ok = evalBody(pattern.atoms, [env], local, rules, depth + 1).length > 0;
    return succeedIf(name === 'log:includes' ? ok : !ok, env);
  }
  if (name === 'log:rawType') {
    const rt = resolve(s, env);
    if (rt.kind === 'var') return [];
    const ty = rt.kind === 'formula' ? 'log:Formula' : rt.kind === 'lit' ? 'log:Literal' : rt.kind === 'list' ? 'rdf:List' : 'log:Other';
    return bindTermResult(o, { kind: 'iri', value: ty }, env);
  }
  if (name === 'log:dtlit') {
    const l = resolve(s, env), obj = resolve(o, env);
    if (l.kind === 'list' && l.items.length === 2) {
      const lex = stringValue(resolve(l.items[0], env));
      const dt = resolve(l.items[1], env);
      if (lex === null || dt.kind !== 'iri') return [];
      return bindTermResult(o, lit(lex), env);
    }
    if (obj.kind === 'var') return [];
    return stringValue(obj) === null ? [] : [env];
  }
  if (name === 'log:outputString') return [env];
  if (name === 'log:collectAllIn') {
    const l = resolve(s, env); if (l.kind !== 'list' || l.items.length !== 3) return [];
    const [valueTemplate, clause, outList] = l.items;
    const scope = resolve(o, env);
    const local = scope.kind === 'formula' ? makeGraph(scope.atoms) : graph;
    if (clause.kind !== 'formula') return [];
    const sols = evalBody(clause.atoms, [env], local, rules, depth + 1);
    return bindTermResult(outList, list(sols.map((sol) => resolve(valueTemplate, sol))), env);
  }
  if (name === 'log:forAllIn') {
    const l = resolve(s, env); if (l.kind !== 'list' || l.items.length !== 2) return [];
    const [where, then] = l; if (where.kind !== 'formula' || then.kind !== 'formula') return [];
    const scope = resolve(o, env);
    const local = scope.kind === 'formula' ? makeGraph(scope.atoms) : graph;
    const sols = evalBody(where.atoms, [{}], local, rules, depth + 1);
    for (const sol of sols) if (!evalBody(then.atoms, [sol], local, rules, depth + 1).length) return [];
    return [env];
  }
  if (['log:content', 'log:semantics', 'log:semanticsOrError', 'log:parsedAsN3'].includes(name)) {
    throw new Error(name + ' requires dereferencing or parsing at runtime and is intentionally not available in offline specialized SEE output');
  }
  return null;
}
function splitList(items, parts, env, start = 0, idx = 0) {
  if (idx === parts.length) return start === items.length ? [env] : [];
  const outs = [];
  const last = idx === parts.length - 1;
  for (let end = start; end <= items.length; end += 1) {
    if (last && end !== items.length) continue;
    const out = bind(parts[idx], list(items.slice(start, end)), env);
    if (out) outs.push(...splitList(items, parts, out, end, idx + 1));
  }
  return outs;
}
function termSortKey(t) {
  if (t.kind === 'lit') { const n = Number(t.value); return Number.isNaN(n) ? '1:' + String(t.value) : '0:' + n.toString().padStart(20, '0'); }
  if (t.kind === 'iri') return '2:' + t.value;
  if (t.kind === 'list') return '3:' + t.items.map(termSortKey).join('|');
  return '9:' + JSON.stringify(canonical(t));
}
function builtinList(name, s, o, env, graph, rules, depth) {
  const predName = name === 'rdf:first' ? 'list:first' : name === 'rdf:rest' ? 'list:rest' : name;
  const left = resolve(s, env);
  const right = resolve(o, env);
  const listItems = (term) => term.kind === 'list' ? term.items.map((x) => resolve(x, env)) : null;
  if (predName === 'list:first') {
    const xs = listItems(left); if (!xs || !xs.length) return [];
    return bindTermResult(o, xs[0], env);
  }
  if (predName === 'list:rest') {
    const xs = listItems(left); if (!xs || !xs.length) return [];
    return bindTermResult(o, list(xs.slice(1)), env);
  }
  if (predName === 'list:firstRest') {
    const outs = [];
    if (left.kind === 'list' && left.items.length > 0 && !left.items.some((x) => resolve(x, env).kind === 'var')) {
      const items = left.items.map((x) => resolve(x, env));
      const out = bind(o, list([items[0], list(items.slice(1))]), env); if (out) outs.push(out);
    }
    if (right.kind === 'list' && right.items.length === 2) {
      const rest = resolve(right.items[1], env);
      const first = resolve(right.items[0], env);
      if (rest.kind === 'list') { const out = bind(s, list([first, ...rest.items]), env); if (out) outs.push(out); }
    }
    return outs;
  }
  if (predName === 'list:append') {
    if (left.kind !== 'list') return [];
    if (right.kind === 'list') return splitList(right.items, left.items, env);
    const outElems = [];
    for (const part of left.items) { const p = resolve(part, env); if (p.kind !== 'list') return []; outElems.push(...p.items); }
    return bindTermResult(o, list(outElems), env);
  }
  if (predName === 'list:iterate') {
    const xs = listItems(left); if (!xs) return [];
    const outs = [];
    for (let i = 0; i < xs.length; i += 1) { const out = bind(o, list([lit(i), xs[i]]), env); if (out) outs.push(out); }
    return outs;
  }
  if (predName === 'list:last') {
    const xs = listItems(left); if (!xs || !xs.length) return [];
    return bindTermResult(o, xs[xs.length - 1], env);
  }
  if (predName === 'list:memberAt') {
    if (left.kind !== 'list' || left.items.length !== 2) return [];
    const arr = resolve(left.items[0], env), idx = resolve(left.items[1], env);
    if (arr.kind !== 'list') return [];
    const outs = [];
    for (let i = 0; i < arr.items.length; i += 1) {
      let out = idx.kind === 'var' ? bind(left.items[1], lit(i), env) : (Number(idx.value) === i ? env : null);
      if (out) out = bind(o, arr.items[i], out);
      if (out) outs.push(out);
    }
    return outs;
  }
  if (predName === 'list:remove') {
    if (left.kind !== 'list' || left.items.length !== 2) return [];
    const arr = resolve(left.items[0], env), item = resolve(left.items[1], env);
    if (arr.kind !== 'list' || item.kind === 'var') return [];
    return bindTermResult(o, list(arr.items.filter((x) => !deepEqual(resolve(x, env), item))), env);
  }
  if (predName === 'list:member') {
    const xs = listItems(left); if (!xs) return [];
    return xs.map((x) => bind(o, x, env)).filter(Boolean);
  }
  if (predName === 'list:in') {
    const xs = listItems(right); if (!xs) return [];
    return xs.map((x) => bind(s, x, env)).filter(Boolean);
  }
  if (predName === 'list:length') {
    const xs = listItems(left); if (!xs) return [];
    return bindTermResult(o, lit(xs.length), env);
  }
  if (predName === 'list:notMember') {
    const xs = listItems(left); if (!xs) return [];
    return xs.some((x) => unify(o, x, env)) ? [] : [env];
  }
  if (predName === 'list:reverse') {
    if (left.kind === 'list') return bindTermResult(o, list([...left.items].reverse()), env);
    if (right.kind === 'list') return bindTermResult(s, list([...right.items].reverse()), env);
    return [];
  }
  if (predName === 'list:sort') {
    const source = left.kind === 'list' ? left : right.kind === 'list' ? right : null;
    if (!source || source.items.some((x) => resolve(x, env).kind === 'var')) return [];
    const sorted = [...source.items].sort((a, b) => termSortKey(a).localeCompare(termSortKey(b)));
    return left.kind === 'list' ? bindTermResult(o, list(sorted), env) : bindTermResult(s, list(sorted), env);
  }
  if (predName === 'list:map') {
    if (left.kind !== 'list' || left.items.length !== 2) return [];
    const arr = resolve(left.items[0], env), pred = resolve(left.items[1], env);
    if (arr.kind !== 'list' || pred.kind !== 'iri') return [];
    const values = [];
    for (let i = 0; i < arr.items.length; i += 1) {
      const valueVar = { kind: 'var', value: '__map_' + depth + '_' + i };
      const matches = evalAtom({ s: arr.items[i], p: pred, o: valueVar }, env, graph, rules, depth + 1);
      for (const m of matches) { const v = resolve(valueVar, m); if (v.kind !== 'var') values.push(v); }
    }
    return bindTermResult(o, list(values), env);
  }
  return null;
}
function parseDateTimeParts(t) {
  const v = primitive(t);
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})?$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), hour: Number(m[4]), minute: Number(m[5]), second: Number(m[6]), timeZone: m[7] || '' };
}
function builtinTime(name, s, o, env) {
  if (name === 'time:localTime') return bindTermResult(o, lit(new Date().toISOString().replace(/\.000Z$/, 'Z')), env);
  const parts = parseDateTimeParts(resolve(s, env)); if (!parts) return [];
  const key = name.slice('time:'.length);
  if (['year','month','day','hour','minute','second'].includes(key)) return bindTermResult(o, lit(parts[key]), env);
  if (key === 'timeZone') return bindTermResult(o, lit(parts.timeZone || 'Z'), env);
  return null;
}
function evalBuiltin(atom, env, graph, rules, depth) {
  const pred = resolve(atom.p, env);
  if (pred.kind !== 'iri') return null;
  const name = pred.value;
  if (name.startsWith('math:')) return builtinMath(name, atom.s, atom.o, env);
  if (name.startsWith('string:')) return builtinString(name, atom.s, atom.o, env);
  if (name.startsWith('crypto:')) return builtinCrypto(name, atom.s, atom.o, env);
  if (name.startsWith('list:') || name === 'rdf:first' || name === 'rdf:rest') return builtinList(name, atom.s, atom.o, env, graph, rules, depth);
  if (name.startsWith('time:')) return builtinTime(name, atom.s, atom.o, env);
  if (name.startsWith('log:')) return builtinLog(name, atom.s, atom.o, env, graph, rules, depth);
  return null;
}
function renameTerm(term, suffix) {
  if (term.kind === 'var') return { kind: 'var', value: term.value + suffix };
  if (term.kind === 'list') return list(term.items.map((item) => renameTerm(item, suffix)));
  if (term.kind === 'formula') return { kind: 'formula', atoms: term.atoms.map((a) => renameAtom(a, suffix)) };
  return cloneTerm(term);
}
function renameAtom(atom, suffix) {
  return { s: renameTerm(atom.s, suffix), p: renameTerm(atom.p, suffix), o: renameTerm(atom.o, suffix) };
}
let renameCounter = 0;
function evalBackward(atom, env, graph, rules, depth) {
  if (depth > 200) throw new Error('Backward rule recursion limit exceeded');
  const outs = [];
  for (const rule of rules) {
    if (rule.kind !== 'backward') continue;
    for (const headAtom of rule.head) {
      const suffix = '__rule' + rule.id + '_' + depth + '_' + (++renameCounter);
      const renamedHead = renameAtom(headAtom, suffix);
      let out = unify(atom.p, renamedHead.p, env); if (!out) continue;
      out = unify(atom.s, renamedHead.s, out); if (!out) continue;
      out = unify(atom.o, renamedHead.o, out); if (!out) continue;
      const renamedBody = rule.body.map((bodyAtom) => renameAtom(bodyAtom, suffix));
      outs.push(...evalBody(renamedBody, [out], graph, rules, depth + 1));
    }
  }
  return outs;
}
function evalAtom(atom, env, graph, rules, depth = 0) {
  const builtin = evalBuiltin(atom, env, graph, rules, depth);
  if (builtin !== null) return builtin;
  const outs = [];
  for (const fact of candidateFactsForAtom(atom, env, graph)) {
    const out = matchFact(atom, fact, env);
    if (out) outs.push(out);
  }
  outs.push(...evalBackward(atom, env, graph, rules, depth + 1));
  return outs;
}
function evalBody(atoms, envs, graph, rules, depth = 0) {
  let out = envs;
  for (const atom of atoms) {
    const next = [];
    for (const env of out) next.push(...evalAtom(atom, env, graph, rules, depth));
    out = next;
    if (!out.length) break;
  }
  return out;
}
function envSignature(env) {
  return crypto.createHash('sha1').update(JSON.stringify(Object.keys(env).sort().map((k) => [k, canonical(env[k])]))).digest('hex').slice(0, 12);
}
function instantiate(term, env, ruleId) {
  if (term.kind === 'var') {
    if (!Object.hasOwn(env, term.value)) throw new Error('Unbound variable in rule head: ?' + term.value);
    return cloneTerm(resolve(env[term.value], env));
  }
  if (term.kind === 'blank') return blank('_:r' + ruleId + '_' + envSignature(env) + '_' + term.value.replace(/^_/, ''));
  if (term.kind === 'list') return list(term.items.map((item) => instantiate(item, env, ruleId)));
  if (term.kind === 'formula') return { kind: 'formula', atoms: term.atoms.map((a) => ({ s: instantiate(a.s, env, ruleId), p: instantiate(a.p, env, ruleId), o: instantiate(a.o, env, ruleId) })) };
  return cloneTerm(term);
}
function supportFactsForBody(body, env, graph) {
  const seen = new Set();
  const out = [];
  for (const atom of body || []) {
    const pred = resolve(atom.p, env);
    if (pred.kind === 'iri') {
      const builtin = pred.value.startsWith('math:') || pred.value.startsWith('string:') || pred.value.startsWith('crypto:') ||
        pred.value.startsWith('list:') || pred.value.startsWith('time:') || pred.value.startsWith('log:') ||
        pred.value === 'rdf:first' || pred.value === 'rdf:rest';
      if (builtin) continue;
    }
    for (const fact of candidateFactsForAtom(atom, env, graph)) {
      if (!matchFact(atom, fact, env)) continue;
      const key = factKey(fact);
      if (!seen.has(key)) { seen.add(key); out.push(fact); }
    }
  }
  return out;
}
function makeIndex() { return { p: new Map(), spByP: new Map(), poByP: new Map(), s: null, o: null }; }
function pushIndex(map, key, fact) {
  let bucket = map.get(key);
  if (!bucket) { bucket = []; map.set(key, bucket); }
  bucket.push(fact);
}
function makeGraph(facts) {
  const graph = { facts: [], keys: new Set(), index: makeIndex() };
  for (const fact of facts) addFact(graph, fact);
  return graph;
}
function ensureFlatIndex(graph, kind, termSelector) {
  if (!graph.index[kind]) {
    const map = new Map();
    for (const fact of graph.facts) pushIndex(map, termIndexKey(termSelector(fact)), fact);
    graph.index[kind] = map;
  }
  return graph.index[kind];
}
function ensurePredicateTermIndex(graph, byPredicate, pKey, pFacts, termSelector) {
  let map = graph.index[byPredicate].get(pKey);
  if (!map) {
    map = new Map();
    for (const fact of pFacts) pushIndex(map, termIndexKey(termSelector(fact)), fact);
    graph.index[byPredicate].set(pKey, map);
  }
  return map;
}
function addFact(graph, fact) {
  const key = factKey(fact);
  if (graph.keys.has(key)) return false;
  graph.keys.add(key);
  graph.facts.push(fact);
  const pKey = termIndexKey(fact.p);
  pushIndex(graph.index.p, pKey, fact);
  if (graph.index.s) pushIndex(graph.index.s, termIndexKey(fact.s), fact);
  if (graph.index.o) pushIndex(graph.index.o, termIndexKey(fact.o), fact);
  const sp = graph.index.spByP.get(pKey);
  if (sp) pushIndex(sp, termIndexKey(fact.s), fact);
  const po = graph.index.poByP.get(pKey);
  if (po) pushIndex(po, termIndexKey(fact.o), fact);
  return true;
}
function candidateFactsForAtom(atom, env, graph) {
  if (!graph || !graph.index) return graph && graph.facts ? graph.facts : [];
  const s = resolve(atom.s, env), p = resolve(atom.p, env), o = resolve(atom.o, env);
  const sg = termIsConcrete(s), pg = termIsConcrete(p), og = termIsConcrete(o);
  if (pg) {
    const pKey = termIndexKey(p);
    const pFacts = graph.index.p.get(pKey) || [];
    if (sg) return ensurePredicateTermIndex(graph, 'spByP', pKey, pFacts, (f) => f.s).get(termIndexKey(s)) || [];
    if (og) return ensurePredicateTermIndex(graph, 'poByP', pKey, pFacts, (f) => f.o).get(termIndexKey(o)) || [];
    return pFacts;
  }
  if (sg) return ensureFlatIndex(graph, 's', (f) => f.s).get(termIndexKey(s)) || [];
  if (og) return ensureFlatIndex(graph, 'o', (f) => f.o).get(termIndexKey(o)) || [];
  return graph.facts;
}

function isBuiltinPredicateValue(name) {
  return typeof name === 'string' && (name.startsWith('math:') || name.startsWith('string:') || name.startsWith('crypto:') ||
    name.startsWith('list:') || name.startsWith('time:') || name.startsWith('log:') || name === 'rdf:first' || name === 'rdf:rest');
}
function collectFormulaDependencyKeys(term, keys) {
  if (!term) return true;
  if (term.kind === 'formula') {
    for (const atom of term.atoms || []) {
      if (!collectAtomDependencyKeys(atom, keys)) return false;
    }
    return true;
  }
  if (term.kind === 'list') {
    for (const item of term.items || []) if (!collectFormulaDependencyKeys(item, keys)) return false;
  }
  return true;
}
function collectAtomDependencyKeys(atom, keys) {
  const pred = atom && atom.p;
  if (!pred || pred.kind === 'var') return false;
  if (pred.kind === 'iri') {
    if (!isBuiltinPredicateValue(pred.value)) keys.add(termIndexKey(pred));
    else if (pred.value.startsWith('log:')) {
      if (!collectFormulaDependencyKeys(atom.s, keys)) return false;
      if (!collectFormulaDependencyKeys(atom.o, keys)) return false;
    }
  }
  return true;
}
function ruleDependencyPredicateKeys(rule) {
  const keys = new Set();
  for (const atom of rule.body || []) {
    if (!collectAtomDependencyKeys(atom, keys)) return null;
  }
  return keys;
}
function producedFactsCanAffectRules(producedPredicates, ruleDependencies) {
  if (!producedPredicates || !producedPredicates.size) return false;
  for (const deps of ruleDependencies) {
    if (deps === null) return true;
    for (const key of producedPredicates) if (deps.has(key)) return true;
  }
  return false;
}
function saturate(initialFacts, rules) {
  const graph = makeGraph(initialFacts);
  const trace = [];
  const maxIterations = 10000;
  const activeRules = (rules || []).filter((rule) => rule.kind !== 'backward');
  const ruleDependencies = activeRules.map(ruleDependencyPredicateKeys);
  for (let iter = 0; iter < maxIterations; iter += 1) {
    let changed = false;
    const producedPredicates = new Set();
    for (const rule of activeRules) {
      const matches = evalBody(rule.body, [{}], graph, rules);
      if (rule.kind === 'fuse') {
        if (matches.length) throw new Error('N3 fuse failed in compiled rule #' + rule.id);
        continue;
      }
      for (const env of matches) {
        const supportFacts = supportFactsForBody(rule.body, env, graph);
        const produced = [];
        for (const atom of rule.head) {
          const fact = { s: instantiate(atom.s, env, rule.id), p: instantiate(atom.p, env, rule.id), o: instantiate(atom.o, env, rule.id) };
          if (addFact(graph, fact)) {
            changed = true;
            produced.push(fact);
            producedPredicates.add(termIndexKey(fact.p));
          }
        }
        if (produced.length) {
          trace.push({
            rule: rule.id,
            produced: produced.length,
            producedFacts: produced.map(codeFact).map((x) => x.replace(/ \.$/, '')),
            supportFacts: supportFacts.map(codeFact).map((x) => x.replace(/ \.$/, ''))
          });
        }
      }
    }
    if (!changed) break;
    if (!producedFactsCanAffectRules(producedPredicates, ruleDependencies)) break;
    if (iter === maxIterations - 1) throw new Error('Compiled derivation did not reach a fixpoint');
  }
  return { graph, trace };
}
function queryFacts(graph, queries, rules) {
  const out = [];
  const seen = new Set();
  for (const query of queries || []) {
    const matches = evalBody(query.premise || [], [{}], graph, rules);
    for (const env of matches) {
      for (const atom of query.conclusion || []) {
        const fact = { s: instantiate(atom.s, env, 'q' + query.id), p: instantiate(atom.p, env, 'q' + query.id), o: instantiate(atom.o, env, 'q' + query.id) };
        if (!atomIsGround(fact, {})) throw new Error('Unbound variable in log:query projection');
        const key = factKey(fact);
        if (!seen.has(key)) { seen.add(key); out.push(fact); }
      }
    }
  }
  return out;
}
function outputStrings(graph) {
  return graph.facts
    .filter((f) => isIri(f.p, 'log:outputString'))
    .sort((a, b) => display(a.s).localeCompare(display(b.s)))
    .map((f) => String(primitive(f.o)));
}
function initialKeys(initialFacts) {
  if (!initialFacts) return new Set();
  if (initialFacts.__seeKeySet) return initialFacts.__seeKeySet;
  const keys = new Set((initialFacts || []).map(factKey));
  try { Object.defineProperty(initialFacts, '__seeKeySet', { value: keys, enumerable: false }); } catch (_) {}
  return keys;
}
function derivedFacts(graph, initialFacts) {
  const base = initialKeys(initialFacts);
  return graph.facts.filter((f) => !base.has(factKey(f)));
}
function codeFact(f) { return atomToN3(f) + ' .'; }
function unquoteLiteral(text) {
  const m = String(text || '').match(/^\"([\s\S]*)\"$/);
  if (!m) return String(text || '');
  return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}
function readablePredicateName(term) {
  return String(term || '')
    .replace(/^[:<#]*/, '')
    .replace(/[>#]*$/g, '')
    .replace(/^./, (ch) => ch.toLowerCase());
}
function compactValidationValue(value) {
  return String(value || '').replace(/^OK\s*-\s*/i, '').trim();
}
function compactSupportFactText(fact) {
  const text = String(fact || '')
    .replace(/===\s*Reason\s+Why\s*===/gi, '=== Explanation ===')
    .replace(/===\s*Review\s*===/gi, '=== Explanation ===');
  const report = text.match(/^(.*?\blog:outputString)\s+/);
  if (report) return report[1] + ' "[authored report]"';

  return text.replace(/\s{2,}/g, ' ').trim();
}
function compactRuleComment(comment) {
  return compactSupportFactText(comment);
}
function shortTerm(t) { return termToN3(t); }
function factSentence(f) {
  const s = shortTerm(f.s), p = shortTerm(f.p), o = shortTerm(f.o);
  if (isIri(f.p, 'rdf:type')) return s + ' is a ' + o + '.';
  if (isIri(f.p, 'rdfs:subClassOf')) return s + ' is a subclass of ' + o + '.';
  if (isIri(f.p, ':is') || /(^|:)is$/.test(p)) return s + ' is ' + o + '.';
  return s + ' ' + p + ' ' + o + '.';
}
function previewItems(items, limit = 2) {
  const list = Array.isArray(items) ? items.filter(Boolean).map(compactRuleComment) : [];
  const shown = list.slice(0, limit).join('; ');
  const more = list.length > limit ? '; … +' + (list.length - limit) + ' more' : '';
  return shown + more;
}
function describeRule(rule) {
  if (!rule) return 'compiled rule';
  const body = rule.bodyComment || [];
  const head = rule.headComment || [];
  if (rule.kind === 'fuse') {
    const preview = previewItems(body, 2) || 'forbidden pattern';
    return 'Fuse ' + rule.id + ' guards against ' + preview;
  }
  const bodyCount = body.length;
  const headCount = head.length;
  if (bodyCount <= 2 && headCount <= 2) {
    return 'Rule ' + rule.id + ': ' + (previewItems(body, 2) || 'true') + ' => ' + (previewItems(head, 2) || 'false');
  }
  return 'Rule ' + rule.id + ' (' + bodyCount + ' premise pattern(s) => ' + headCount + ' conclusion pattern(s))';
}
function traceApplications(trace, rules, limit = 6) {
  const byId = new Map((rules || []).map((r) => [r.id, r]));
  const grouped = new Map();
  for (const step of trace || []) {
    const facts = Array.isArray(step.producedFacts) ? step.producedFacts : [];
    if (!facts.length) continue;
    const key = String(step.rule);
    if (!grouped.has(key)) grouped.set(key, { rule: byId.get(step.rule), facts: [], supportFacts: [] });
    const entry = grouped.get(key);
    for (const fact of facts) if (!entry.facts.includes(fact)) entry.facts.push(fact);
    for (const fact of Array.isArray(step.supportFacts) ? step.supportFacts : []) {
      if (!entry.supportFacts.includes(fact)) entry.supportFacts.push(fact);
    }
  }
  return Array.from(grouped.values()).slice(0, limit);
}
function supportIndex(trace) {
  const index = new Map();
  for (const step of trace || []) {
    const facts = Array.isArray(step.producedFacts) ? step.producedFacts : [];
    for (const fact of facts) {
      if (!index.has(fact)) {
        index.set(fact, { rule: step.rule, supportFacts: Array.isArray(step.supportFacts) ? step.supportFacts : [] });
      }
    }
  }
  return index;
}
function supportTreeLines(fact, supportMap, sourceKeys, ruleMap, opts = {}) {
  const lines = [];
  const maxDepth = opts.maxDepth ?? 4;
  const maxChildren = opts.maxChildren ?? 4;
  const maxLines = opts.maxLines ?? 40;
  function walk(item, depth, seen) {
    if (lines.length >= maxLines) return;
    const indent = '  '.repeat(depth);
    if (/\blog:outputString\b/.test(String(item || ''))) {
      const support = supportMap.get(item);
      const rule = support ? ruleMap.get(support.rule) : null;
      const label = support ? (rule ? 'Rule ' + rule.id : 'compiled rule #' + support.rule) : 'no recorded rule support';
      lines.push(indent + '- ' + compactSupportFactText(item) + ' . _(authored report, ' + label + ')_');
      return;
    }
    if (sourceKeys.has(item)) {
      lines.push(indent + '- ' + compactSupportFactText(item) + ' . _(source)_');
      return;
    }
    const support = supportMap.get(item);
    if (!support) {
      lines.push(indent + '- ' + compactSupportFactText(item) + ' . _(no recorded rule support)_');
      return;
    }
    const rule = ruleMap.get(support.rule);
    const label = rule ? 'Rule ' + rule.id : 'compiled rule #' + support.rule;
    lines.push(indent + '- ' + compactSupportFactText(item) + ' . _(derived by ' + label + ')_');
    if (depth >= maxDepth) {
      if (support.supportFacts && support.supportFacts.length) lines.push(indent + '  - support omitted beyond depth ' + maxDepth);
      return;
    }
    const children = (support.supportFacts || []).slice(0, maxChildren);
    const childIndent = indent + '  ';
    if (!children.length) {
      lines.push(childIndent + '- no graph premises; built-ins/constants satisfied the rule.');
      return;
    }
    for (const child of children) {
      if (seen.has(child)) {
        lines.push(childIndent + '- ' + compactSupportFactText(child) + ' . _(already shown)_');
        continue;
      }
      const nextSeen = new Set(seen);
      nextSeen.add(child);
      walk(child, depth + 1, nextSeen);
      if (lines.length >= maxLines) break;
    }
    if ((support.supportFacts || []).length > children.length) {
      lines.push(childIndent + '- ... ' + ((support.supportFacts || []).length - children.length) + ' more premise fact(s)');
    }
  }
  walk(fact, 0, new Set([fact]));
  if (lines.length >= maxLines) lines.push('- … support tree truncated after ' + maxLines + ' line(s)');
  return lines;
}
function conclusionSupportSection(selected, trace, rules, initialFacts, limit = 6) {
  const supportMap = supportIndex(trace);
  const sourceKeys = new Set((initialFacts || []).map((f) => codeFact(f).replace(/ \.$/, '')));
  const ruleMap = new Map((rules || []).map((r) => [r.id, r]));
  const facts = [];
  const seen = new Set();
  for (const f of selected || []) {
    const key = codeFact(f).replace(/ \.$/, '');
    if (!seen.has(key)) { seen.add(key); facts.push(key); }
  }
  const focus = facts.slice(-limit).reverse();
  if (!focus.length) return [];
  const lines = [];
  lines.push('Selected explanation support:');
  for (const fact of focus) {
    lines.push(...supportTreeLines(fact, supportMap, sourceKeys, ruleMap).map((line) => '  ' + line));
  }
  return lines;
}
function evidenceSummaryLine(mode) {
  if (mode === 'query') return 'The query-selected facts are serialized in the Formal TriG Output section.';
  if (mode === 'formula') return 'The formula-valued facts are serialized in the Formal TriG Output section.';
  return 'The selected facts are serialized in the Formal TriG Output section.';
}
function renderStructuredOutput({ title, graph, queries = [], rules = [], initialFacts = [], trace = [], mode = 'derived' }) {
  let selected = [];
  if (mode === 'query') selected = queryFacts(graph, queries, rules);
  else if (mode === 'formula') selected = graph.facts.filter((f) => f.o && f.o.kind === 'formula');
  else selected = derivedFacts(graph, initialFacts);
  if (!selected.length) selected = graph.facts.slice(0, 30);

  const derived = derivedFacts(graph, initialFacts);
  const keyFact = selected[selected.length - 1];
  const lines = [];
  lines.push('# ' + title);
  lines.push('');
  lines.push('## Conclusion');
  if (mode === 'query') {
    lines.push('The compiled query selected ' + selected.length + ' fact(s) after the rule closure was computed.');
  } else if (mode === 'formula') {
    lines.push('The derivation produced ' + selected.length + ' formula-valued conclusion(s).');
  } else {
    lines.push('The derivation produced ' + derived.length + ' new fact(s) from ' + initialFacts.length + ' stated fact(s).');
  }
  if (keyFact) lines.push('Main conclusion: **' + factSentence(keyFact) + '**');
  const bullets = selected.slice(-6).reverse();
  if (bullets.length) {
    lines.push('');
    lines.push('Selected conclusions:');
    for (const fact of bullets) lines.push('- ' + codeFact(fact));
  }
  lines.push('');
  lines.push('## Explanation');
  const ordinaryRules = (rules || []).filter((r) => r.kind !== 'fuse').length;
  const fuses = (rules || []).filter((r) => r.kind === 'fuse').length;
  lines.push('Starts with ' + initialFacts.length + ' source fact(s), applies ' + ordinaryRules + ' rule(s), and reaches a fixpoint.');
  if (queries.length) lines.push('The log:query projection then keeps only the matching fact(s) shown above.');
  if (fuses) lines.push('The run also validates ' + fuses + ' fuse(s) for forbidden patterns.');
  const apps = traceApplications(trace, rules);
  if (apps.length) {
    lines.push('');
    lines.push('Derivation steps:');
    const sourceKeys = new Set((initialFacts || []).map((f) => codeFact(f).replace(/ \.$/, '')));
    for (const app of apps) {
      const produced = app.facts.slice(0, 4).map((f) => compactSupportFactText(f) + ' .').join(', ');
      const more = app.facts.length > 4 ? ', … +' + (app.facts.length - 4) + ' more' : '';
      lines.push('- ' + describeRule(app.rule) + ' derives ' + produced + more);
      if (app.supportFacts && app.supportFacts.length) {
        const used = app.supportFacts.slice(0, 4).map((fact) => compactSupportFactText(fact) + ' . ' + (sourceKeys.has(fact) ? '_(source)_' : '_(derived)_')).join('; ');
        const omitted = app.supportFacts.length > 4 ? '; … +' + (app.supportFacts.length - 4) + ' more premise fact(s)' : '';
        lines.push('  - Uses: ' + used + omitted);
      } else {
        lines.push('  - Uses: no graph premises; built-ins/constants satisfied the rule.');
      }
    }
  }
  const supportLines = conclusionSupportSection(selected, trace, rules, initialFacts);
  if (supportLines.length) {
    lines.push('');
    lines.push(...supportLines);
  }
  lines.push('');
  lines.push(evidenceSummaryLine(mode));
  return lines.join('\n') + '\n';
}
function renderRawOutput(graph, queries = [], rules = [], initialFacts = []) {
  const outs = outputStrings(graph);
  if (outs.length) return outs.join('');
  if (queries && queries.length) {
    const selected = queryFacts(graph, queries, rules);
    if (selected.length) return selected.map((f) => codeFact(f)).join('\n') + '\n';
    return '';
  }
  const formulaFacts = graph.facts.filter((f) => f.o && f.o.kind === 'formula');
  if (formulaFacts.length) return formulaFacts.map((f) => codeFact(f)).join('\n') + '\n';
  const derived = derivedFacts(graph, initialFacts);
  const selected = derived.length ? derived : graph.facts.slice(0, 30);
  return selected.map((f) => codeFact(f)).join('\n') + '\n';
}
function dedupeExplanationHeadings(text) {
  let seen = false;
  return String(text || '').replace(/^##\s+Explanation\s*$/gmi, () => {
    if (seen) return '';
    seen = true;
    return '## Explanation';
  });
}
function normalizePublicReport(markdown, title) {
  let text = String(markdown || '').trimEnd();
  if (!/^\s*#\s+/m.test(text)) text = '# ' + title + '\n\n' + text;
  if (!/^##\s+Conclusion\s*$/mi.test(text) && !/^##\s+Insight\s*$/mi.test(text)) {
    text = text.replace(/^(#\s+[^\n]+\n*)/, '$1\n## Conclusion\n');
  }
  if (!/^##\s+Explanation\s*$/mi.test(text)) {
    text += '\n\n## Explanation\nNo additional explanation was provided by the generated output.';
  }
  text = text.replace(/^##\s+([^\n]+?)\s*$/gm, (line, heading) => {
    const normalized = heading.trim().toLowerCase();
    if (normalized === 'insight' || normalized === 'conclusion') return '## Conclusion';
    if (normalized === 'explanation') return '## Explanation';
    return '**' + heading.trim() + '**';
  });
  text = dedupeExplanationHeadings(text);
  return text.trimEnd() + '\n';
}
function markdownize(raw, title) {
  let text = String(raw || '');
  text = text
    .replace(/===\s*Answer\s*===/g, '## Conclusion')
    .replace(/===\s*Reason\s+Why\s*===/gi, '## Explanation')
    .replace(/===\s*Explanation\s*===/gi, '## Explanation')
    .replace(/===\s*([^=]+?)\s*===/g, (_, h) => '**' + h.trim() + '**');
  text = text.replace(/^C(\d+)\s+OK\s*-\s*/gm, 'C$1: ');
  text = dedupeExplanationHeadings(text);
  if (!text.trim()) text = '## Conclusion\nNo log:outputString facts were derived.\n\n## Explanation\nThe compiled derivation did not produce authored report text.';
  return normalizePublicReport(text, title);
}
function authoredSupportAppendix(graph, queries, rules, initialFacts, trace) {
  const derived = derivedFacts(graph, initialFacts);
  let selected = [];
  if (queries && queries.length) selected = queryFacts(graph, queries, rules);
  else if (graph.facts.some((f) => f.o && f.o.kind === 'formula')) selected = graph.facts.filter((f) => f.o && f.o.kind === 'formula');
  else selected = derived;
  const lines = [];
  const ordinaryRules = (rules || []).filter((r) => r.kind !== 'fuse').length;
  const apps = traceApplications(trace, rules, 6);
  const supportLines = conclusionSupportSection(selected, trace, rules, initialFacts, 4);
  if (!apps.length && !supportLines.length) return '';
  lines.push('**Generated derivation support**');
  lines.push('');
  lines.push('Compiled support: ' + initialFacts.length + ' source fact(s), ' + ordinaryRules + ' rule(s), fixpoint reached before rendering.');
  if (apps.length) {
    lines.push('');
    lines.push('Derivation steps:');
    const sourceKeys = new Set((initialFacts || []).map((f) => codeFact(f).replace(/ \.$/, '')));
    for (const app of apps) {
      const produced = app.facts.slice(0, 4).map((f) => compactSupportFactText(f) + ' .').join(', ');
      const more = app.facts.length > 4 ? ', … +' + (app.facts.length - 4) + ' more' : '';
      lines.push('- ' + describeRule(app.rule) + ' derives ' + produced + more);
      if (app.supportFacts && app.supportFacts.length) {
        const used = app.supportFacts.slice(0, 4).map((fact) => compactSupportFactText(fact) + ' . ' + (sourceKeys.has(fact) ? '_(source)_' : '_(derived)_')).join('; ');
        const omitted = app.supportFacts.length > 4 ? '; … +' + (app.supportFacts.length - 4) + ' more premise fact(s)' : '';
        lines.push('  - Uses: ' + used + omitted);
      } else {
        lines.push('  - Uses: no graph premises; built-ins/constants satisfied the rule.');
      }
    }
  }
  if (supportLines.length) {
    lines.push('');
    lines.push(...supportLines);
  }
  return lines.join('\n');
}
function appendAuthoredExplanation(markdown, graph, queries, rules, initialFacts, trace) {
  const appendix = authoredSupportAppendix(graph, queries, rules, initialFacts, trace);
  if (!appendix) return markdown;
  return markdown.trimEnd() + '\n\n' + appendix + '\n';
}
function renderPresentation(graph, queries, rules, initialFacts, title, trace) {
  const outs = outputStrings(graph);
  if (outs.length) return appendAuthoredExplanation(markdownize(outs.join(''), title), graph, queries, rules, initialFacts, trace);
  if (queries && queries.length) return renderStructuredOutput({ title, graph, queries, rules, initialFacts, trace, mode: 'query' });
  if (graph.facts.some((f) => f.o && f.o.kind === 'formula')) return renderStructuredOutput({ title, graph, queries, rules, initialFacts, trace, mode: 'formula' });
  return renderStructuredOutput({ title, graph, queries, rules, initialFacts, trace, mode: 'derived' });
}
`;
}

function generateExampleJs(name, title, program, stats, doc) {
  const rulesWithComments = program.rules.map((rule) => ({
    ...rule,
    bodyComment: (rule.body || []).map(atomToComment),
    headComment: (rule.head || []).map(atomToComment),
  }));
  const queriesWithComments = (program.queries || []).map((query) => ({
    ...query,
    premiseComment: (query.premise || []).map(atomToComment),
    conclusionComment: (query.conclusion || []).map(atomToComment),
  }));
  return `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { fail, loadInput } = require('./_see');
${runtimeSource()}
const NAME = ${JSON.stringify(name)};
const TITLE = ${JSON.stringify(title)};
const EXPECTED_INPUT_FACTS = ${stats.facts};
const RULES = ${js(rulesWithComments)};
const QUERIES = ${js(queriesWithComments)};
const DOC_MARKDOWN = ${JSON.stringify(doc)};
function seeMetadata(data) { return (data && data.__see) || {}; }
function trustedDerivation(data) { const meta = seeMetadata(data); const facts = data && Array.isArray(data.facts) ? data.facts : []; const expectedFacts = EXPECTED_INPUT_FACTS || Number(meta.InputFacts || 0); if (meta.SourceSHA256 && meta.SourceSHA256 !== ${JSON.stringify(stats.sourceHash)}) throw new Error('input evidence does not match the N3 source compiled into this example'); const result = saturate(facts, RULES); const rawOutput = renderRawOutput(result.graph, QUERIES, RULES, facts); fail('Compiled N3 derivation failed', { 'input evidence metadata is present and matches compiled source': meta.SourceSHA256 === ${JSON.stringify(stats.sourceHash)}, 'input evidence facts were loaded': expectedFacts > 0 ? facts.length === expectedFacts : facts.length >= 0, 'compiled rules were loaded': RULES.length === ${stats.rules + stats.backwardRules + stats.fuses}, 'compiled query directives were loaded': QUERIES.length === ${stats.queries}, 'a derivation fixpoint was reached': result.graph.facts.length >= facts.length, 'query or output facts were produced': rawOutput.length > 0 }); return { ...result, rawOutput, inputFacts: facts }; }
function snapshotMarkdown(markdown) { return markdown.split(/\\n/).map((line) => line ? line + '  \\n' : '\\n').join(''); }
function prefixLinesFromTrig(trig) {
  const out = [];
  const seen = new Set();
  for (const rawLine of String(trig || '').split(String.fromCharCode(10))) {
    const trimmed = rawLine.replace(String.fromCharCode(13), '').trim();
    if (!trimmed.toLowerCase().startsWith('@prefix ')) continue;
    if (!seen.has(trimmed)) { seen.add(trimmed); out.push(trimmed); }
  }
  if (!out.some((line) => line.toLowerCase().startsWith('@prefix rdf:'))) out.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
  return out;
}
function formalOutputFacts(graph, queries, rules, initialFacts) {
  const base = initialKeys(initialFacts);
  const out = [];
  const seen = new Set();
  const add = (fact) => {
    if (!fact) return;
    const key = factKey(fact);
    if (!seen.has(key)) { seen.add(key); out.push(fact); }
  };
  if (queries && queries.length) {
    for (const fact of queryFacts(graph, queries, rules)) add(fact);
    return out;
  }
  for (const fact of derivedFacts(graph, initialFacts)) add(fact);
  if (!out.length) {
    for (const fact of graph.facts) if (fact.o && fact.o.kind === 'formula' && !base.has(factKey(fact))) add(fact);
  }
  return out;
}
function trigGraphBlock(label, atoms) {
  const lines = [label + ' {'];
  for (const atom of atoms || []) lines.push('  ' + atomToN3(atom) + ' .');
  lines.push('}');
  return lines;
}
function formalFactToTrigLines(fact, state) {
  if (fact.o && fact.o.kind === 'formula') {
    if (isIri(fact.p, 'log:nameOf')) return trigGraphBlock(termToN3(fact.s), fact.o.atoms);
    state.formulaCounter += 1;
    state.needOutPrefix = true;
    const label = 'out:formula' + state.formulaCounter;
    return [termToN3(fact.s) + ' ' + termToN3(fact.p) + ' ' + label + ' .', '', ...trigGraphBlock(label, fact.o.atoms)];
  }
  return [codeFact(fact)];
}
function trigMetadataBlock(trig) {
  const lines = String(trig || '').split(String.fromCharCode(10));
  const out = [];
  let depth = 0;
  let active = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!active && !trimmed.startsWith('in:metadata')) continue;
    active = true;
    out.push(line.replace(String.fromCharCode(13), ''));
    depth += (line.match(/\{/g) || []).length;
    depth -= (line.match(/\}/g) || []).length;
    if (active && depth <= 0) break;
  }
  return out.length ? out.join(String.fromCharCode(10)).trimEnd() : '';
}
function formalOutputToTrig(facts, trig) {
  const state = { formulaCounter: 0, needOutPrefix: false };
  const body = [];
  for (const fact of facts || []) {
    body.push(...formalFactToTrigLines(fact, state));
  }
  const metadata = trigMetadataBlock(trig);
  if (metadata) {
    if (body.length) body.push('');
    body.push(metadata);
  }
  if (!body.length) return '';
  const prefixes = prefixLinesFromTrig(trig);
  if (state.needOutPrefix && !prefixes.some((line) => line.toLowerCase().startsWith('@prefix out:'))) prefixes.push('@prefix out: <https://example.org/see/output#> .');
  const nl = String.fromCharCode(10);
  return prefixes.join(nl) + nl + nl + body.join(nl);
}
function appendFormalTrigOutput(markdown, graph, queries, rules, initialFacts, data) {
  const trig = formalOutputToTrig(formalOutputFacts(graph, queries, rules, initialFacts), data && data.trig);
  if (!trig) return markdown;
  const nl = String.fromCharCode(10);
  const fence = String.fromCharCode(96).repeat(3);
  const fenced = trig.trimEnd().replace(new RegExp(fence, 'g'), '\` \` \`');
  return markdown.trimEnd() + nl + nl + '## Formal TriG Output' + nl + nl + fence + 'trig' + nl + fenced + nl + fence + nl;
}
function outputMarkdown() { const data = loadInput(NAME); const result = trustedDerivation(data); const markdown = renderPresentation(result.graph, QUERIES, RULES, result.inputFacts, TITLE, result.trace); return snapshotMarkdown(appendFormalTrigOutput(markdown, result.graph, QUERIES, RULES, result.inputFacts, data)); }
function documentationMarkdown() { return DOC_MARKDOWN; }
function writeArtefacts() { const outputDir = path.join(__dirname, 'output'); const docDir = path.join(__dirname, 'doc'); fs.mkdirSync(outputDir, { recursive: true }); fs.mkdirSync(docDir, { recursive: true }); fs.writeFileSync(path.join(outputDir, NAME + '.md'), outputMarkdown(), 'utf8'); fs.writeFileSync(path.join(docDir, NAME + '.md'), documentationMarkdown(), 'utf8'); }
function main(argv = process.argv.slice(2)) { if (argv.includes('--write') || argv.includes('--write-files') || argv.includes('--snapshot')) { writeArtefacts(); return; } if (argv.includes('--doc')) { process.stdout.write(documentationMarkdown()); return; } process.stdout.write(outputMarkdown()); }
if (require.main === module) main();
module.exports = { trustedDerivation, outputMarkdown, documentationMarkdown, writeArtefacts };
`;
}

// Documentation is generated from compilation metadata rather than hand-written
// per example, keeping examples/output and examples/doc reproducible snapshots.
function generateDoc(name, title, header, stats) {
  const description = header.description
    ? `
${header.description}
`
    : '';
  const builtins = stats.builtins.length ? stats.builtins.map((b) => `- \`${b}\``).join('\n') : '- none';
  return `# ${title}\n\nGenerated by \`see.js\` from a Notation3 source file.\n${description}\n## Compilation summary\n\n- Example name: \`${name}\`\n- Input facts emitted: ${stats.facts}\n- Forward rules compiled: ${stats.rules}\n- Backward predicate rules compiled: ${stats.backwardRules}\n- Fuses compiled: ${stats.fuses}\n- Predicate count: ${stats.predicates}\n\n## Built-ins used\n\n${builtins}\n\n## Runtime model\n\nThe generated \`examples/${name}.js\` is a specialized JavaScript derivation program. For ordinary sources, \`see.js\` emits the source facts as \`examples/input/${name}.trig\`. For rules-only sources, generation can reuse an existing external evidence file such as \`examples/input/${name.replace(/_/g, '-')}.trig\` or \`examples/input/${name}.trig\`. The runner reads that TriG evidence directly and performs a local fixpoint derivation; it does not parse the program source or call an external reasoner.\n\n## Output model\n\nRunning \`node examples/${name}.js\` produces a SEE-style Markdown report with a **Conclusion** section, an **Explanation** section, and a **Formal TriG Output** section containing the selected derived/query facts.\n`;
}

function runNode(file, cwd = ROOT, args = []) {
  const result = spawnSync(process.execPath, [file, ...args], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0)
    throw new Error(`generated example failed:
${result.stderr || result.stdout}`);
  return result.stdout;
}

// compile is pure with respect to the repository: it reads one source .n3 file
// and returns all generated text.  The generate/render commands decide whether
// those artefacts are written to disk or executed from a temporary directory.
function compile(n3Path, options = {}) {
  const absolute = path.resolve(n3Path);
  const n3 = readText(absolute);
  const name = options.name || slugify(path.basename(absolute));
  const title = parseHeader(n3, titleFromSlug(name)).title;
  const header = parseHeader(n3, titleFromSlug(name));
  const program = parseN3(n3);
  const stats = compilationStats(program);
  stats.sourceHash = sha256(n3);
  const inputTrig = generateInputTrig(absolute, name, title, header, stats, program);
  const doc = generateDoc(name, title, header, stats);
  const exampleJs = generateExampleJs(name, title, program, stats, doc);
  return { name, title, program, stats, inputTrig, exampleJs, doc };
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
// Rules-only examples can reuse an externally authored TriG evidence file.  The
// scoring prefers the candidate that advertises the most input facts, then the
// larger file, so dashed public datasets such as path-discovery.trig win over
// empty generated placeholders.
function existingExternalInputName(name) {
  const candidates = inputNameCandidates(name)
    .map((base, order) => ({ base, order, file: path.join(INPUT_DIR, `${base}.trig`) }))
    .filter((c) => fs.existsSync(c.file))
    .map((c) => ({ ...c, score: inputCandidateScore(c.file) }));
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score.facts - a.score.facts || b.score.size - a.score.size || a.order - b.order);
  return candidates[0].base;
}
// generate writes the checked-in artefacts and immediately executes the new
// example with --write so examples/output and examples/doc remain in sync.
function generate(n3Path, options = {}) {
  const compiled = compile(n3Path, options);
  const jsFile = path.join(EXAMPLES_DIR, `${compiled.name}.js`);
  const externalInputName = compiled.stats.facts === 0 ? existingExternalInputName(compiled.name) : null;
  const inputBaseName = externalInputName || compiled.name;
  const inputTrigFile = path.join(INPUT_DIR, `${inputBaseName}.trig`);
  const outputFile = path.join(OUTPUT_DIR, `${compiled.name}.md`);
  const docFile = path.join(DOC_DIR, `${compiled.name}.md`);
  if (!options.force) {
    const protectedInputs = externalInputName ? [] : [inputTrigFile];
    for (const file of [outputFile, docFile, ...protectedInputs]) {
      if (fs.existsSync(file))
        throw new Error(`${path.relative(ROOT, file)} already exists; pass --force to overwrite`);
    }
  }
  writeText(jsFile, compiled.exampleJs, options.force);
  fs.chmodSync(jsFile, 0o755);
  if (!externalInputName) writeText(inputTrigFile, compiled.inputTrig, true);
  runNode(jsFile, ROOT, ['--write']);
  const output = readText(outputFile);
  return { ...compiled, files: { jsFile, inputTrigFile, outputFile, docFile }, output };
}

// render is the non-mutating companion to generate.  It compiles into a small
// temporary /see-shaped tree, runs the generated example, and returns Markdown.
function render(n3Path) {
  const tmpName = `_see_tmp_${process.pid}`;
  const compiled = compile(n3Path, { name: tmpName });
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'see-compile-'));
  const tmpSeeDir = path.join(tmpDir, 'see');
  const examplesDir = path.join(tmpSeeDir, 'examples');
  ensureDir(path.join(examplesDir, 'input'));
  fs.copyFileSync(path.join(EXAMPLES_DIR, '_see.js'), path.join(examplesDir, '_see.js'));
  fs.copyFileSync(path.join(ROOT, 'see.js'), path.join(tmpSeeDir, 'see.js'));
  const jsFile = path.join(examplesDir, `${tmpName}.js`);
  const trigFile = path.join(examplesDir, 'input', `${tmpName}.trig`);
  fs.writeFileSync(jsFile, compiled.exampleJs, 'utf8');
  fs.writeFileSync(trigFile, compiled.inputTrig, 'utf8');
  try {
    return runNode(jsFile, tmpSeeDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const args = [...argv];
  const opts = { force: false };
  const command = args.shift();
  const file = args.shift();
  while (args.length) {
    const arg = args.shift();
    if (arg === '--force') opts.force = true;
    else if (arg === '--name') opts.name = slugify(args.shift());
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return { command, file, opts };
}

function main() {
  const { command, file, opts } = parseArgs(process.argv.slice(2));
  if (!command || command === 'help' || command === '--help') {
    console.log(usage());
    return;
  }
  if (!file) throw new Error(`Missing <example.n3>\n\n${usage()}`);
  if (command === 'generate') {
    const result = generate(file, opts);
    console.log(`generated ${path.relative(ROOT, result.files.jsFile)}`);
    if (result.files.inputTrigFile) console.log(`generated ${path.relative(ROOT, result.files.inputTrigFile)}`);
    console.log(`generated ${path.relative(ROOT, result.files.outputFile)}`);
    console.log(`generated ${path.relative(ROOT, result.files.docFile)}`);
    console.log(
      `compiled ${result.stats.facts} facts, ${result.stats.rules} forward rules, ${result.stats.backwardRules} backward rules, ${result.stats.fuses} fuses, ${result.stats.queries} queries`,
    );
  } else if (command === 'render') {
    process.stdout.write(render(file));
  } else if (command === 'inspect') {
    const result = compile(file, opts);
    console.log(
      `OK ${result.name}: ${result.stats.facts} facts, ${result.stats.rules} forward rules, ${result.stats.backwardRules} backward rules, ${result.stats.fuses} fuses, ${result.stats.queries} queries`,
    );
  } else {
    throw new Error(`Unknown command: ${command}\n\n${usage()}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.stack || err.message);
    process.exit(1);
  }
}

module.exports = { compile, generate, parseN3, render, tokenize };
