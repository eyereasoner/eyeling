#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const { pass, failResult, info } = require('./report');
const { Iri, Triple } = require('../lib/prelude');
const { createFactStore } = require('../lib/store');
const { runAsync } = require('../index.js');

const root = path.resolve(__dirname, '..');
const eyelingJsPath = path.join(root, 'eyeling.js');

const EX = 'http://example.org/';
const a = new Iri(EX + 'a');
const p = new Iri(EX + 'p');
const q = new Iri(EX + 'q');
const b = new Iri(EX + 'b');
const c = new Iri(EX + 'c');
const x = new Iri(EX + 'x');
const y = new Iri(EX + 'y');
const r = new Iri(EX + 'r');
const z = new Iri(EX + 'z');

const triples = [
  new Triple(a, p, b),
  new Triple(a, p, c),
  new Triple(a, q, b),
  new Triple(x, p, b),
  new Triple(y, r, z),
];

async function collect(iterable) {
  const out = [];
  for await (const item of iterable) out.push(item);
  return out;
}

async function withStore(factory, fn) {
  const store = await factory();
  try {
    await store.batchAdd(triples, 'explicit');
    await fn(store);
  } finally {
    if (store && typeof store.close === 'function') await store.close();
  }
}

async function expectCount(store, label, args, expected) {
  const out = await collect(store.match(...args));
  if (out.length !== expected) {
    throw new Error(`${label}: expected ${expected} match(es), got ${out.length}`);
  }
}

const tests = [
  {
    name: 'memory store supports all eight triple match shapes',
    fn: async () => withStore(() => createFactStore({ type: 'memory' }), async (store) => {
      await expectCount(store, '(s,p,o)', [a, p, b], 1);
      await expectCount(store, '(s,p,?)', [a, p, null], 2);
      await expectCount(store, '(s,?,o)', [a, null, b], 2);
      await expectCount(store, '(s,?,?)', [a, null, null], 3);
      await expectCount(store, '(?,p,o)', [null, p, b], 2);
      await expectCount(store, '(?,p,?)', [null, p, null], 3);
      await expectCount(store, '(?,?,o)', [null, null, b], 3);
      await expectCount(store, '(?,?,?)', [null, null, null], 5);
    }),
  },
  {
    name: 'persistent store supports all eight triple match shapes and duplicate prevention',
    fn: async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-store-test-'));
      try {
        await withStore(() => createFactStore({ name: 'patterns', path: dir, clear: true }), async (store) => {
          await expectCount(store, '(s,p,o)', [a, p, b], 1);
          await expectCount(store, '(s,p,?)', [a, p, null], 2);
          await expectCount(store, '(s,?,o)', [a, null, b], 2);
          await expectCount(store, '(s,?,?)', [a, null, null], 3);
          await expectCount(store, '(?,p,o)', [null, p, b], 2);
          await expectCount(store, '(?,p,?)', [null, p, null], 3);
          await expectCount(store, '(?,?,o)', [null, null, b], 3);
          await expectCount(store, '(?,?,?)', [null, null, null], 5);
          const added = await store.add(new Triple(a, p, b), 'inferred');
          if (added) throw new Error('duplicate insertion should return false');
          if (typeof store.kindOf === 'function') {
            const mask = await store.kindOf(new Triple(a, p, b));
            if ((mask & 1) === 0 || (mask & 2) === 0) throw new Error('explicit/inferred bitmask should be preserved');
          }
        });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  {
    name: 'runAsync reuses a named persistent store across runs',
    fn: async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-runasync-store-'));
      try {
        const first = await runAsync('@prefix : <http://example.org/> .\n:a :p :b .', { store: { name: 'dataset', path: dir, clear: true } });
        if (first.store) await first.store.close();

        const second = await runAsync('@prefix : <http://example.org/> .\n{ ?s :p ?o } => { ?s :q ?o } .', { store: { name: 'dataset', path: dir } });
        try {
          const text = second.closureN3 || '';
          if (!text.includes(':a :q :b .') && !text.includes(':a :q :b.')) throw new Error(`expected stored fact to feed rule, got:\n${text}`);
          if (!second.store) throw new Error('runAsync should return the opened store');
          const qMatches = await collect(second.store.match(a, q, b));
          if (qMatches.length !== 1) throw new Error('expected inferred fact to be persisted');
        } finally {
          if (second.store) await second.store.close();
        }
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  {
    name: 'CLI auto-creates stores and streams line-based RDF into them',
    fn: async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-cli-store-'));
      try {
        const facts = path.join(dir, 'facts.nt');
        const rules = path.join(dir, 'rules.n3');
        fs.writeFileSync(facts, '<http://example.org/a> <http://example.org/p> <http://example.org/b> .\n', 'utf8');
        fs.writeFileSync(
          rules,
          '@prefix : <http://example.org/> .\n{ ?s :p ?o } => { ?s :q ?o } .\n',
          'utf8',
        );
        const r = cp.spawnSync(
          process.execPath,
          [eyelingJsPath, '-r', '--store', 'auto-created', '--store-path', path.join(dir, 'store'), facts, rules],
          { cwd: root, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 },
        );
        if (r.status !== 0) throw new Error(`eyeling failed:\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`);
        if (!r.stdout.includes(':a :q :b .')) throw new Error(`expected streamed store inference, got:\n${r.stdout}`);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  },
];

(async function main() {
  const startAll = Date.now();
  let passed = 0;
  for (let i = 0; i < tests.length; i += 1) {
    const n = i + 1;
    const t0 = Date.now();
    try {
      await tests[i].fn();
      pass(n, tests[i].name, Date.now() - t0);
      passed += 1;
    } catch (e) {
      failResult(n, tests[i].name, Date.now() - t0);
      console.error(e && e.stack ? e.stack : e);
      process.exitCode = 1;
      break;
    }
  }
  info(`Store tests: ${passed}/${tests.length} passed`, Date.now() - startAll);
})();
