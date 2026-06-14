#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const path = require('node:path');

const { reason } = require('../index.js');
const { C, failResult, pass } = require('./report');

const ROOT = path.resolve(__dirname, '..');
const EYELING = path.join(ROOT, 'eyeling.js');

function runCli(input, args = ['--rdf-surfaces']) {
  return cp.spawnSync(process.execPath, [EYELING, ...args, '-'], {
    input,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function runExample(name) {
  return cp.spawnSync(
    process.execPath,
    [EYELING, '--rdf-surfaces', path.join(ROOT, 'examples', 'input', `${name}.ttl`), path.join(ROOT, 'examples', `${name}.n3`)],
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
}

const inlineCases = [
  {
    name: 'slide32-style surface derives subclass instance',
    input: `
@prefix ex: <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

ex:Brussels a ex:City .

%not[ _:x
_:x a ex:City .
%not[
_:x a ex:HumanCommunity .
%]
%]

{ ?s a ex:HumanCommunity . } log:query { ?s a ex:HumanCommunity . } .
`,
    expect: '@prefix ex: <http://example.org/> .\n\nex:Brussels a ex:HumanCommunity .',
  },
  {
    name: 'slide33 range-style surface derives object type',
    input: `
@prefix ex: <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

ex:alice ex:parent ex:bob .

%not[ _:x _:y
_:x ex:parent _:y .
%not[
_:y a ex:Person .
%]
%]

{ ?s a ex:Person . } log:query { ?s a ex:Person . } .
`,
    expect: '@prefix ex: <http://example.org/> .\n\nex:bob a ex:Person .',
  },
  {
    name: 'slide33 allValuesFrom forward surface derives filler type',
    input: `
@prefix ex: <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

ex:box a ex:AllowedContainer .
ex:box ex:contains ex:item42 .

%not[ _:x _:y
_:x a ex:AllowedContainer .
_:x ex:contains _:y .
%not[
_:y a ex:AllowedItem .
%]
%]

{ ?s a ex:AllowedItem . } log:query { ?s a ex:AllowedItem . } .
`,
    expect: '@prefix ex: <http://example.org/> .\n\nex:item42 a ex:AllowedItem .',
  },
  {
    name: 'slide33 allValuesFrom reverse surface derives restricted class',
    input: `
@prefix ex: <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

ex:box ex:contains ex:item42 .
ex:item42 a ex:AllowedItem .

%not[ _:x
%not[ _:y
_:x ex:contains _:y .
%not[
_:y a ex:AllowedItem .
%]
%]
%not[
_:x a ex:AllowedContainer .
%]
%]

{ ?s a ex:AllowedContainer . } log:query { ?s a ex:AllowedContainer . } .
`,
    expect: '@prefix ex: <http://example.org/> .\n\nex:box a ex:AllowedContainer .',
  },
];

const exampleCases = [
  ['rdf-surfaces-city', '@prefix ex: <http://example.org/> .\n\nex:Brussels a ex:HumanCommunity .'],
  ['rdf-surfaces-range', '@prefix ex: <http://example.org/> .\n\nex:bob a ex:Person .'],
  ['rdf-surfaces-domain', '@prefix ex: <http://example.org/> .\n\nex:alice a ex:Member .'],
  ['rdf-surfaces-property-chain', '@prefix ex: <http://example.org/> .\n\nex:alice ex:grandparent ex:carol .'],
  [
    'rdf-surfaces-ancestor',
    '@prefix ex: <http://example.org/> .\n\nex:ann ex:ancestor ex:bob .\nex:bob ex:ancestor ex:cat .\nex:ann ex:ancestor ex:cat .',
  ],
  ['rdf-surfaces-multi-premise', '@prefix ex: <http://example.org/> .\n\nex:case123 a ex:PriorityCase .'],
  ['rdf-surfaces-all-values-from', '@prefix ex: <http://example.org/> .\n\nex:item42 a ex:AllowedItem .'],
  ['rdf-surfaces-all-values-from-reverse', '@prefix ex: <http://example.org/> .\n\nex:box a ex:AllowedContainer .'],
  ['rdf-surfaces-rdfs-range-codex', '@prefix ex: <http://example.org/> .\n\nex:bob a ex:Person .'],
  ['rdf-surfaces-rdfs-subclass-codex', '@prefix ex: <http://example.org/> .\n\nex:Brussels a ex:HumanCommunity .'],
  [
    'rdf-surfaces-owl-all-values-from-codex',
    '@prefix ex: <http://example.org/> .\n\nex:item43 a ex:AllowedItem .\nex:item42 a ex:AllowedItem .\nex:box a ex:AllowedContainer .\nex:crate a ex:AllowedContainer .',
  ],
  [
    'rdf-surfaces-strong-negation-access',
    '@prefix ex: <http://example.org/> .\n\nex:bob ex:decision ex:Permit .\nex:alice ex:decision ex:Deny .',
  ],
  ['rdf-surfaces-disjunction-route-filter', '@prefix ex: <http://example.org/> .\n\nex:shipment17 ex:viableRoute ex:Rail .'],
  ['rdf-surfaces-explicit-disjunction', '@prefix ex: <http://example.org/> .\n\nex:shipment23 ex:selectedRoute ex:Rail .'],
  [
    'rdf-surfaces-disjunction-elimination',
    '@prefix ex: <http://example.org/> .\n\nex:caseSplit ex:disjunctionEntails ex:NeedsHumanAttention .',
  ],
];

let seq = 0;
let failed = 0;

for (const tc of inlineCases) {
  const n = ++seq;
  const t0 = Date.now();
  try {
    const r = runCli(tc.input);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.equal(r.stdout.trim(), tc.expect);
    pass(n, tc.name, Date.now() - t0);
  } catch (e) {
    failed++;
    failResult(n, tc.name, Date.now() - t0);
    console.error(`${C.dim}${e && e.stack ? e.stack : String(e)}${C.n}`);
  }
}

for (const [name, expect] of exampleCases) {
  const n = ++seq;
  const t0 = Date.now();
  try {
    const r = runExample(name);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.equal(r.stdout.trim(), expect);
    pass(n, `example split input/query ${name}`, Date.now() - t0);
  } catch (e) {
    failed++;
    failResult(n, `example split input/query ${name}`, Date.now() - t0);
    console.error(`${C.dim}${e && e.stack ? e.stack : String(e)}${C.n}`);
  }
}

{
  const n = ++seq;
  const t0 = Date.now();
  try {
    const out = reason({ rdfSurfaces: true }, inlineCases[0].input).trim();
    assert.equal(out, inlineCases[0].expect);
    pass(n, 'API rdfSurfaces option implies RDF compatibility', Date.now() - t0);
  } catch (e) {
    failed++;
    failResult(n, 'API rdfSurfaces option implies RDF compatibility', Date.now() - t0);
    console.error(`${C.dim}${e && e.stack ? e.stack : String(e)}${C.n}`);
  }
}

{
  const n = ++seq;
  const t0 = Date.now();
  try {
    const r = runCli(`
@prefix ex: <http://example.org/> .
ex:bad a ex:Impossible .
%not[ _:x
_:x a ex:Impossible .
%]
`);
    assert.equal(r.status, 65, r.stderr || r.stdout);
    pass(n, 'top-level negative surface without child is an inference fuse', Date.now() - t0);
  } catch (e) {
    failed++;
    failResult(n, 'top-level negative surface without child is an inference fuse', Date.now() - t0);
    console.error(`${C.dim}${e && e.stack ? e.stack : String(e)}${C.n}`);
  }
}

if (failed) process.exit(1);
