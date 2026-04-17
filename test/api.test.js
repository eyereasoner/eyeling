'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
// Direct eyeling.js bundle API (in-process) for testing reasonStream/onDerived.
// This is the API surface used by demo.html (browser/worker).
const { reasonStream } = require('../eyeling.js');
const { reason, reasonRdfJs, rdfjs } = require('../index.js');

// Run reason() in a subprocess with stderr captured, so expected parse errors
// don't spam the parent process' stderr (while still being available as e.stderr).
const DEFAULT_MAX_BUFFER = 200 * 1024 * 1024;

function reasonQuiet(opt, input) {
  const payloadB64 = Buffer.from(JSON.stringify({ opt, input }), 'utf8').toString('base64');

  // Allow tests to bump buffers similarly to the in-process API.
  const maxBuffer =
    opt && typeof opt === 'object' && !Array.isArray(opt) && typeof opt.maxBuffer === 'number'
      ? opt.maxBuffer
      : DEFAULT_MAX_BUFFER;

  const childCode = `
    const payload = JSON.parse(Buffer.from(process.argv[1], 'base64').toString('utf8'));
    const mod = require(${JSON.stringify(ROOT)});
    const reason = (mod && mod.reason) || (mod && mod.default && mod.default.reason);

    try {
      const out = reason(payload.opt, payload.input);
      if (out != null) process.stdout.write(String(out));
      process.exit(0);
    } catch (e) {
      let code = 1;
      if (e && typeof e === 'object' && 'code' in e) {
        const c = e.code;
        const n = typeof c === 'number' ? c : (typeof c === 'string' && /^\\d+$/.test(c) ? Number(c) : null);
        if (Number.isInteger(n)) code = n;
      }

      // Forward captured stderr from the inner reason() wrapper (if any),
      // otherwise print the error itself.
      if (e && typeof e === 'object' && e.stderr) process.stderr.write(String(e.stderr));
      else if (e && e.stack) process.stderr.write(String(e.stack));
      else process.stderr.write(String(e));

      process.exit(code);
    }
  `;

  const r = spawnSync(process.execPath, ['-e', childCode, payloadB64], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer,
  });

  if (r.error) throw r.error;
  if (r.status === 0) return r.stdout;

  const err = new Error(`reason() failed with exit ${r.status}`);
  err.code = r.status;
  err.stdout = r.stdout;
  err.stderr = r.stderr;
  throw err;
}

const TTY = process.stdout.isTTY;
const C = TTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', n: '\x1b[0m' }
  : { g: '', r: '', y: '', dim: '', n: '' };

function ok(msg) {
  console.log(`${C.g}OK ${C.n} ${msg}`);
}
function info(msg) {
  console.log(`${C.y}==${C.n} ${msg}`);
}
function fail(msg) {
  console.error(`${C.r}FAIL${C.n} ${msg}`);
}

function msNow() {
  return Date.now();
}

function mustMatch(output, re, label) {
  assert.match(output, re, label || `Expected output to match ${re}`);
}

function mustNotMatch(output, re, label) {
  assert.ok(!re.test(output), label || `Expected output NOT to match ${re}`);
}

function countMatches(output, re) {
  // ensure global counting without mutating caller regex
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const rg = new RegExp(re.source, flags);
  let c = 0;
  while (rg.exec(output)) c++;
  return c;
}

function mustOccurExactly(output, re, n, label) {
  const c = countMatches(output, re);
  assert.equal(c, n, label || `Expected ${n} matches of ${re}, got ${c}`);
}

const EX = 'http://example.org/';
// Helper to build a URI quickly
const U = (path) => `<${EX}${path}>`;

function parentChainN3(n) {
  // n links => n+1 nodes: n0->n1->...->nN
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `${U(`n${i}`)} ${U('parent')} ${U(`n${i + 1}`)}.\n`;
  }
  s += `
{ ?x ${U('parent')} ?y } => { ?x ${U('ancestor')} ?y }.
{ ?x ${U('parent')} ?y. ?y ${U('ancestor')} ?z } => { ?x ${U('ancestor')} ?z }.
`;
  return s;
}

function subclassChainN3(n) {
  let s = '';
  for (let i = 0; i <= n; i++) {
    s += `${U(`C${i}`)} ${U('sub')} ${U(`C${i + 1}`)}.\n`;
  }
  s += `${U('x')} ${U('type')} ${U('C0')}.\n`;
  s += `{ ?s ${U('type')} ?a. ?a ${U('sub')} ?b } => { ?s ${U('type')} ?b }.\n`;
  return s;
}

function ruleChainN3(n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `{ ${U('s')} ${U(`p${i}`)} ${U('o')}. } => { ${U('s')} ${U(`p${i + 1}`)} ${U('o')}. }.\n`;
  }
  s += `${U('s')} ${U('p0')} ${U('o')}.\n`;
  return s;
}

function binaryTreeParentN3(depth) {
  const maxNode = (1 << (depth + 1)) - 2;
  let s = '';

  for (let i = 0; i <= maxNode; i++) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left <= maxNode) s += `${U(`t${i}`)} ${U('parent')} ${U(`t${left}`)}.\n`;
    if (right <= maxNode) s += `${U(`t${i}`)} ${U('parent')} ${U(`t${right}`)}.\n`;
  }

  s += `
{ ?x ${U('parent')} ?y } => { ?x ${U('ancestor')} ?y }.
{ ?x ${U('parent')} ?y. ?y ${U('ancestor')} ?z } => { ?x ${U('ancestor')} ?z }.
`;
  return s;
}

function transitiveClosureN3(pred) {
  return `
{ ?a ${U(pred)} ?b. ?b ${U(pred)} ?c } => { ?a ${U(pred)} ?c }.
`;
}

function reachabilityGraphN3(n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `${U(`g${i}`)} ${U('edge')} ${U(`g${i + 1}`)}.\n`;
  }
  if (n >= 6) {
    s += `${U('g0')} ${U('edge')} ${U('g3')}.\n`;
    s += `${U('g2')} ${U('edge')} ${U('g5')}.\n`;
    s += `${U('g1')} ${U('edge')} ${U('g4')}.\n`;
  }
  s += `
{ ?a ${U('edge')} ?b } => { ?a ${U('reach')} ?b }.
{ ?a ${U('edge')} ?b. ?b ${U('reach')} ?c } => { ?a ${U('reach')} ?c }.
`;
  return s;
}

function diamondSubclassN3() {
  return `
${U('A')} ${U('sub')} ${U('B')}.
${U('A')} ${U('sub')} ${U('C')}.
${U('B')} ${U('sub')} ${U('D')}.
${U('C')} ${U('sub')} ${U('D')}.
${U('x')} ${U('type')} ${U('A')}.

{ ?s ${U('type')} ?a. ?a ${U('sub')} ?b } => { ?s ${U('type')} ?b }.
`;
}

function join3HopN3(k) {
  let s = '';
  for (let i = 0; i < k; i++) {
    s += `${U(`j${i}`)} ${U('p')} ${U(`j${i + 1}`)}.\n`;
  }
  s += `
{ ?x ${U('p')} ?y. ?y ${U('p')} ?z. ?z ${U('p')} ?w } => { ?x ${U('p3')} ?w }.
`;
  return s;
}

function sameAsN3() {
  return `
${U('a')} ${U('sameAs')} ${U('b')}.
${U('a')} ${U('p')} ${U('o')}.

{ ?x ${U('sameAs')} ?y } => { ?y ${U('sameAs')} ?x }.
{ ?x ${U('sameAs')} ?y. ?x ?p ?o } => { ?y ?p ?o }.
`;
}

function ruleBranchJoinN3() {
  return `
${U('s')} ${U('p')} ${U('o')}.

{ ${U('s')} ${U('p')} ${U('o')}. } => { ${U('s')} ${U('q')} ${U('o')}. }.
{ ${U('s')} ${U('p')} ${U('o')}. } => { ${U('s')} ${U('r')} ${U('o')}. }.
{ ${U('s')} ${U('q')} ${U('o')}. ${U('s')} ${U('r')} ${U('o')}. } => { ${U('s')} ${U('qr')} ${U('o')}. }.
`;
}

function bigFactsN3(n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `${U('x')} ${U('p')} ${U(`o${i}`)}.\n`;
  }
  s += `{ ?s ${U('p')} ?o } => { ?s ${U('q')} ?o }.\n`;
  return s;
}

function negativeEntailmentBatchN3(n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `${U('x')} ${U('ok')} ${U(`v${i}`)}.\n`;
  }
  s += `${U('x')} ${U('forbidden')} ${U('boom')}.\n`;
  s += `{ ?s ${U('forbidden')} ?o. } => false.\n`;
  return s;
}

function symmetricTransitiveN3() {
  return `
${U('a')} ${U('friend')} ${U('b')}.
${U('b')} ${U('friend')} ${U('c')}.
${U('c')} ${U('friend')} ${U('d')}.

{ ?x ${U('friend')} ?y } => { ?y ${U('friend')} ?x }.
{ ?a ${U('friend')} ?b } => { ?a ${U('reachFriend')} ?b }.
{ ?a ${U('friend')} ?b. ?b ${U('reachFriend')} ?c } => { ?a ${U('reachFriend')} ?c }.
`;
}

const cases = [
  {
    name: '00 parsing untyped literal ^^',
    opt: { proofComments: false },
    input: `
  @prefix : <http://example.org/> .
  @prefix log: <http://www.w3.org/2000/10/swap/log#>.

  { ?s :p ?o } => { ?s log:outputString ?o } .
  :s :p "^^" .
  `,
    check(out) {
      assert.equal(String(out).trimEnd(), '^^');
    },
  },
  {
    name: '00b parsing typed literal ^^',
    opt: { proofComments: false },
    input: `
  @prefix : <http://example.org/> .
  @prefix log: <http://www.w3.org/2000/10/swap/log#>.
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.

  { ?s :p ?o } => { ?s log:outputString ?o } .
  :s :p "^^"^^xsd:string .
  `,
    check(out) {
      assert.equal(String(out).trimEnd(), '^^');
    },
  },
  {
    name: '01 forward rule: p -> q',
    opt: { proofComments: false },
    input: `
{ ${U('s')} ${U('p')} ${U('o')}. } => { ${U('s')} ${U('q')} ${U('o')}. }.
${U('s')} ${U('p')} ${U('o')}.
`,
    expect: [new RegExp(`${EX}s>\\s+<${EX}q>\\s+<${EX}o>\\s*\\.`)],
  },
  {
    name: '02 two-step: p -> q -> r',
    opt: { proofComments: false },
    input: `
{ ${U('s')} ${U('p')} ${U('o')}. } => { ${U('s')} ${U('q')} ${U('o')}. }.
{ ${U('s')} ${U('q')} ${U('o')}. } => { ${U('s')} ${U('r')} ${U('o')}. }.
${U('s')} ${U('p')} ${U('o')}.
`,
    expect: [new RegExp(`${EX}s>\\s+<${EX}r>\\s+<${EX}o>\\s*\\.`)],
  },
  {
    name: '03 join antecedents: (x p y & y p z) -> (x p2 z)',
    opt: { proofComments: false },
    input: `
{ ?x ${U('p')} ?y. ?y ${U('p')} ?z. } => { ?x ${U('p2')} ?z. }.
${U('a')} ${U('p')} ${U('b')}.
${U('b')} ${U('p')} ${U('c')}.
`,
    expect: [new RegExp(`${EX}a>\\s+<${EX}p2>\\s+<${EX}c>\\s*\\.`)],
  },
  {
    name: '04 inverse relation: (x p y) -> (y invp x)',
    opt: { proofComments: false },
    input: `
{ ?x ${U('p')} ?y. } => { ?y ${U('invp')} ?x. }.
${U('alice')} ${U('p')} ${U('bob')}.
`,
    expect: [new RegExp(`${EX}bob>\\s+<${EX}invp>\\s+<${EX}alice>\\s*\\.`)],
  },
  {
    name: '05 subclass rule: type + sub -> inferred type (two-level chain)',
    opt: { proofComments: false },
    input: `
${U('Human')} ${U('sub')} ${U('Mortal')}.
${U('Mortal')} ${U('sub')} ${U('Being')}.
${U('Socrates')} ${U('type')} ${U('Human')}.

{ ?s ${U('type')} ?a. ?a ${U('sub')} ?b } => { ?s ${U('type')} ?b }.
`,
    expect: [
      new RegExp(`${EX}Socrates>\\s+<${EX}type>\\s+<${EX}Mortal>\\s*\\.`),
      new RegExp(`${EX}Socrates>\\s+<${EX}type>\\s+<${EX}Being>\\s*\\.`),
    ],
  },
  {
    name: '06 transitive closure: sub is transitive',
    opt: { proofComments: false },
    input: `
${U('A')} ${U('sub')} ${U('B')}.
${U('B')} ${U('sub')} ${U('C')}.

{ ?a ${U('sub')} ?b. ?b ${U('sub')} ?c } => { ?a ${U('sub')} ?c }.
`,
    expect: [new RegExp(`${EX}A>\\s+<${EX}sub>\\s+<${EX}C>\\s*\\.`)],
  },
  {
    name: '07 symmetric: knows is symmetric',
    opt: { proofComments: false },
    input: `
{ ?x ${U('knows')} ?y } => { ?y ${U('knows')} ?x }.
${U('a')} ${U('knows')} ${U('b')}.
`,
    expect: [new RegExp(`${EX}b>\\s+<${EX}knows>\\s+<${EX}a>\\s*\\.`)],
  },
  {
    name: '08 recursion: ancestor from parent (2 steps)',
    opt: { proofComments: false },
    input: `
${U('a')} ${U('parent')} ${U('b')}.
${U('b')} ${U('parent')} ${U('c')}.

{ ?x ${U('parent')} ?y } => { ?x ${U('ancestor')} ?y }.
{ ?x ${U('parent')} ?y. ?y ${U('ancestor')} ?z } => { ?x ${U('ancestor')} ?z }.
`,
    expect: [new RegExp(`${EX}a>\\s+<${EX}ancestor>\\s+<${EX}c>\\s*\\.`)],
  },
  {
    name: '09 literals preserved: age -> hasAge',
    opt: { proofComments: false },
    input: `
{ ?s ${U('age')} ?n } => { ?s ${U('hasAge')} ?n }.
${U('x')} ${U('age')} "42".
`,
    expect: [new RegExp(`${EX}x>\\s+<${EX}hasAge>\\s+"42"\\s*\\.`)],
  },
  {
    name: '10 API option: opt can be an args array',
    opt: ['--no-proof-comments'],
    input: `
{ ${U('s')} ${U('p')} ${U('o')}. } => { ${U('s')} ${U('q')} ${U('o')}. }.
${U('s')} ${U('p')} ${U('o')}.
`,
    expect: [new RegExp(`${EX}s>\\s+<${EX}q>\\s+<${EX}o>\\s*\\.`)],
    notExpect: [/^#/m],
  },
  {
    name: '11 negative entailment: rule derives false (expect exit 2 => throws)',
    opt: { proofComments: false },
    input: `
{ ${U('a')} ${U('p')} ${U('b')}. } => false.
${U('a')} ${U('p')} ${U('b')}.
`,
    expectErrorCode: 2,
  },
  {
    name: '12 invalid syntax should throw (non-zero exit)',
    opt: { proofComments: false },
    input: `
@prefix :  # missing dot on purpose
: s :p :o .
`,
    expectError: true,
  },
  {
    name: '12b invalid syntax: prefix names cannot end with a dot',
    opt: { proofComments: false },
    input: `
@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix bad.: <http://bad-example.org/> .

bad.:example a bad.:Person.

{
    ?X a <http://bad-example.org/Person>.
}
=>
{
    :result :has :crash-syntax-1.
}.

{} => {
    :test :contains :crash-syntax-1.
}.

{
    :result :has :crash-syntax-1.
}
=>
{
    :test :is false.
}.
`,
    expectError: true,
  },
  {
    name: '12c invalid syntax: unpaired high surrogate in string literal should throw',
    opt: { proofComments: false },
    input: String.raw`
@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:subject :predicate "\uD800" .

{
    :subject :predicate ?X.
}
=>
{
    :result :has :crash-syntax-2.
}.

{} => {
    :test :contains :crash-syntax-2.
}.

{
    :result :has :crash-syntax-2.
}
=>
{
    :test :is false.
}.
`,
    expectError: true,
  },
  {
    name: '12d invalid syntax: unpaired low surrogate in string literal should throw',
    opt: { proofComments: false },
    input: String.raw`
@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:subject :predicate "\uDFFF" .

{
    :subject :predicate ?X.
}
=>
{
    :result :has :crash-syntax-3.
}.

{} => {
    :test :contains :crash-syntax-3.
}.

{
    :result :has :crash-syntax-3.
}
=>
{
    :test :is false.
}.
`,
    expectError: true,
  },
  {
    name: '12e invalid syntax: NUL in string literal should throw',
    opt: { proofComments: false },
    input: String.raw`
@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:subject :predicate "hello\u0000world".

{
    :subject :predicate ?X.
}
=>
{
    :result :has :crash-syntax-4.
}.

{} => {
    :test :contains :crash-syntax-4.
}.

{
    :result :has :crash-syntax-4.
}
=>
{
    :test :is false.
}.
`,
    expectError: true,
  },
  {
    name: '12f invalid syntax: surrogate pair encoded as two \\u escapes should throw',
    opt: { proofComments: false },
    input: String.raw`
@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:subject :predicate "\uD800\uDC00" .

{
    :subject :predicate ?X.
}
=>
{
    :result :has :crash-syntax-5.
}.

{} => {
    :test :contains :crash-syntax-5.
}.

{
    :result :has :crash-syntax-5.
}
=>
{
    :test :is false.
}.
`,
    expectError: true,
  },
  {
    name: '12g invalid syntax: XML-forbidden noncharacters in string literal should throw',
    opt: { proofComments: false },
    input: String.raw`
@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:subject :predicate "\uFFFF" .
:subject :predicate "\uFFFE" .

{
    :subject :predicate ?X.
}
=>
{
    :result :has :crash-syntax-6.
}.

{} => {
    :test :contains :crash-syntax-6.
}.

{
    :result :has :crash-syntax-6.
}
=>
{
    :test :is false.
}.
`,
    expectError: true,
  },
  {
    name: '12h invalid syntax: space is not allowed inside IRIREF',
    opt: { proofComments: false },
    input: `
@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<http://bad example.org/> a :BadExample.

{
    :subject :predicate ?X.
}
=>
{
    :result :has :crash-syntax-7.
}.

{} => {
    :test :contains :crash-syntax-7.
}.

{
    :result :has :crash-syntax-7.
}
=>
{
    :test :is false.
}.
`,
    expectError: true,
  },
  {
    name: '12i invalid syntax: UCHAR escape is not allowed inside IRIREF',
    opt: { proofComments: false },
    input: String.raw`
@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<http://bad\u0020example.org/> a :BadExample.

{
    :subject :predicate ?X.
}
=>
{
    :result :has :crash-syntax-8.
}.

{} => {
    :test :contains :crash-syntax-8.
}.

{
    :result :has :crash-syntax-8.
}
=>
{
    :test :is false.
}.
`,
    expectError: true,
  },
  {
    name: '12j invalid syntax: control characters are not allowed inside IRIREF',
    opt: { proofComments: false },
    input: `
@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<http://badexample.org> :foo <http://example.org/> .

{
    :subject :predicate ?X.
}
=>
{
    :result :has :crash-syntax-9.
}.

{} => {
    :test :contains :crash-syntax-9.
}.

{
    :result :has :crash-syntax-9.
}
=>
{
    :test :is false.
}.
`,
    expectError: true,
  },
  {
    name: '12k invalid syntax: control-character UCHAR is not allowed inside IRIREF',
    opt: { proofComments: false },
    input: String.raw`
@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<http://bad\u0007example.org> :foo <http://example.org/> .

{
    :subject :predicate ?X.
}
=>
{
    :result :has :crash-syntax-10.
}.

{} => {
    :test :contains :crash-syntax-10.
}.

{
    :result :has :crash-syntax-10.
}
=>
{
    :test :is false.
}.
`,
    expectError: true,
  },
  {
    name: '12l regression: IRIREF \\u escape decodes before log:uri comparison (mismatch stays falsey)',
    opt: { proofComments: false },
    input: String.raw`
@prefix : <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@base <http://example.org/>.

{
    <http://example.org/\u0041> log:uri "http://example.org/\\u0041".
}
=>
{
    :result :has :fail-literal-1.
}.

{ } => {
    :test :contains :fail-literal-1.
}.
`,
    expect: [/:(?:test)\s+:(?:contains)\s+:(?:fail-literal-1)\s*\./],
    notExpect: [/:(?:result)\s+:(?:has)\s+:(?:fail-literal-1)\s*\./, /:(?:test)\s+:(?:is)\s+true\s*\./],
  },
  {
    name: '12m regression: IRIREF \\u escape matches plain-A literal via log:uri',
    opt: { proofComments: false },
    input: String.raw`
@prefix : <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@base <http://example.org/>.

{
    <http://example.org/\u0041> log:uri "http://example.org/A".
}
=>
{
    :result :has :success-literal-5.
}.

{ } => {
    :test :contains :success-literal-5.
}.

{
    :result :has :success-literal-5.
}
=>
{
    :test :is true.
}.
`,
    expect: [
      /:(?:result)\s+:(?:has)\s+:(?:success-literal-5)\s*\./,
      /:(?:test)\s+:(?:contains)\s+:(?:success-literal-5)\s*\./,
      /:(?:test)\s+:(?:is)\s+true\s*\./,
    ],
  },
  {
    name: '12n regression: IRIREF \\u escape matches decoded literal escape via log:uri',
    opt: { proofComments: false },
    input: String.raw`
@prefix : <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@base <http://example.org/>.

{
    <http://example.org/\u0041> log:uri "http://example.org/\u0041".
}
=>
{
    :result :has :success-literal-6.
}.

{ } => {
    :test :contains :success-literal-6.
}.

{
    :result :has :success-literal-6.
}
=>
{
    :test :is true.
}.
`,
    expect: [
      /:(?:result)\s+:(?:has)\s+:(?:success-literal-6)\s*\./,
      /:(?:test)\s+:(?:contains)\s+:(?:success-literal-6)\s*\./,
      /:(?:test)\s+:(?:is)\s+true\s*\./,
    ],
  },
  {
    name: '13 heavier recursion: ancestor closure over 15 links',
    opt: { proofComments: false, maxBuffer: 200 * 1024 * 1024 },
    input: parentChainN3(15),
    expect: [
      new RegExp(`${EX}n0>\\s+<${EX}ancestor>\\s+<${EX}n15>\\s*\\.`),
      new RegExp(`${EX}n3>\\s+<${EX}ancestor>\\s+<${EX}n12>\\s*\\.`),
    ],
  },
  {
    name: '14 heavier taxonomy: 60-step subclass chain',
    opt: { proofComments: false, maxBuffer: 200 * 1024 * 1024 },
    input: subclassChainN3(60),
    expect: [new RegExp(`${EX}x>\\s+<${EX}type>\\s+<${EX}C61>\\s*\\.`)],
  },
  {
    name: '15 heavier chaining: 40-step predicate rewrite chain',
    opt: { proofComments: false, maxBuffer: 200 * 1024 * 1024 },
    input: ruleChainN3(40),
    expect: [new RegExp(`${EX}s>\\s+<${EX}p40>\\s+<${EX}o>\\s*\\.`)],
  },
  {
    name: '16 heavier recursion: binary tree ancestor closure (depth 4)',
    opt: { proofComments: false, maxBuffer: 200 * 1024 * 1024 },
    input: binaryTreeParentN3(4),
    expect: [
      new RegExp(`${EX}t0>\\s+<${EX}ancestor>\\s+<${EX}t30>\\s*\\.`),
      new RegExp(`${EX}t1>\\s+<${EX}ancestor>\\s+<${EX}t22>\\s*\\.`),
    ],
  },
  {
    name: '17 heavier reachability: branching graph reach closure',
    opt: { proofComments: false, maxBuffer: 200 * 1024 * 1024 },
    input: reachabilityGraphN3(12),
    expect: [
      new RegExp(`${EX}g0>\\s+<${EX}reach>\\s+<${EX}g12>\\s*\\.`),
      new RegExp(`${EX}g2>\\s+<${EX}reach>\\s+<${EX}g10>\\s*\\.`),
    ],
  },
  {
    name: '18 heavier taxonomy: diamond subclass inference',
    opt: { proofComments: false },
    input: diamondSubclassN3(),
    expect: [new RegExp(`${EX}x>\\s+<${EX}type>\\s+<${EX}D>\\s*\\.`)],
  },
  {
    name: '19 heavier join: 3-hop path rule over a chain of 25 edges',
    opt: { proofComments: false, maxBuffer: 200 * 1024 * 1024 },
    input: join3HopN3(25),
    expect: [
      new RegExp(`${EX}j0>\\s+<${EX}p3>\\s+<${EX}j3>\\s*\\.`),
      new RegExp(`${EX}j10>\\s+<${EX}p3>\\s+<${EX}j13>\\s*\\.`),
      new RegExp(`${EX}j20>\\s+<${EX}p3>\\s+<${EX}j23>\\s*\\.`),
    ],
  },
  {
    name: '20 heavier branching: p produces q and r, then q+r produces qr',
    opt: { proofComments: false },
    input: ruleBranchJoinN3(),
    expect: [new RegExp(`${EX}s>\\s+<${EX}qr>\\s+<${EX}o>\\s*\\.`)],
  },
  {
    name: '21 heavier equivalence: sameAs propagation (with symmetric sameAs)',
    opt: { proofComments: false },
    input: sameAsN3(),
    expect: [
      new RegExp(`${EX}b>\\s+<${EX}p>\\s+<${EX}o>\\s*\\.`),
      new RegExp(`${EX}b>\\s+<${EX}sameAs>\\s+<${EX}a>\\s*\\.`),
    ],
  },
  {
    name: '22 heavier closure: transitive property via generic rule',
    opt: { proofComments: false },
    input: `
${U('a')} ${U('sub')} ${U('b')}.
${U('b')} ${U('sub')} ${U('c')}.
${U('c')} ${U('sub')} ${U('d')}.
${U('d')} ${U('sub')} ${U('e')}.
${transitiveClosureN3('sub')}
`,
    expect: [
      new RegExp(`${EX}a>\\s+<${EX}sub>\\s+<${EX}e>\\s*\\.`),
      new RegExp(`${EX}b>\\s+<${EX}sub>\\s+<${EX}d>\\s*\\.`),
    ],
  },
  {
    name: '23 heavier social: symmetric + reachFriend closure',
    opt: { proofComments: false, maxBuffer: 200 * 1024 * 1024 },
    input: symmetricTransitiveN3(),
    expect: [
      new RegExp(`${EX}a>\\s+<${EX}reachFriend>\\s+<${EX}d>\\s*\\.`),
      new RegExp(`${EX}d>\\s+<${EX}reachFriend>\\s+<${EX}a>\\s*\\.`),
    ],
  },
  {
    name: '24 heavier volume: 400 facts, simple rewrite rule p -> q',
    opt: { proofComments: false, maxBuffer: 200 * 1024 * 1024 },
    input: bigFactsN3(400),
    expect: [
      new RegExp(`${EX}x>\\s+<${EX}q>\\s+<${EX}o0>\\s*\\.`),
      new RegExp(`${EX}x>\\s+<${EX}q>\\s+<${EX}o399>\\s*\\.`),
    ],
  },
  {
    name: '25 heavier negative entailment: batch + forbidden => false (expect exit 2)',
    opt: { proofComments: false, maxBuffer: 200 * 1024 * 1024 },
    input: negativeEntailmentBatchN3(200),
    expectErrorCode: 2,
  },
  {
    name: '26 sanity: no rules => no newly derived facts',
    opt: { proofComments: false },
    input: `
${U('a')} ${U('p')} ${U('b')}.
`,
    expect: [/^\s*$/],
  },
  {
    name: '27 regression: backward rule (<=) can satisfy a forward rule premise',
    opt: { proofComments: false },
    input: `
${U('a')} ${U('p')} ${U('b')}.

{ ${U('a')} ${U('q')} ${U('b')}. } <= { ${U('a')} ${U('p')} ${U('b')}. }.
{ ${U('a')} ${U('q')} ${U('b')}. } => { ${U('a')} ${U('r')} ${U('b')}. }.
`,
    expect: [new RegExp(`${EX}a>\\s+<${EX}r>\\s+<${EX}b>\\s*\\.`)],
  },
  {
    name: '28 regression: top-level log:implies behaves like a forward rule',
    opt: { proofComments: false },
    input: `
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

{ ${U('a')} ${U('p')} ${U('b')}. } log:implies { ${U('a')} ${U('q')} ${U('b')}. }.
${U('a')} ${U('p')} ${U('b')}.
`,
    expect: [new RegExp(`${EX}a>\\s+<${EX}q>\\s+<${EX}b>\\s*\\.`)],
  },
  {
    name: '29 regression: derived log:implies becomes a live rule during reasoning',
    opt: { proofComments: false },
    input: `
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

{ ${U('a')} ${U('trigger')} ${U('go')}. }
  =>
{ { ${U('a')} ${U('p')} ${U('b')}. } log:implies { ${U('a')} ${U('q2')} ${U('b')}. }. }.

${U('a')} ${U('trigger')} ${U('go')}.
${U('a')} ${U('p')} ${U('b')}.
`,
    expect: [new RegExp(`${EX}a>\\s+<${EX}q2>\\s+<${EX}b>\\s*\\.`)],
  },
  {
    name: '30 sanity: proofComments:true enables proof comments',
    opt: { proofComments: true },
    input: `
{ ${U('s')} ${U('p')} ${U('o')}. } => { ${U('s')} ${U('q')} ${U('o')}. }.
${U('s')} ${U('p')} ${U('o')}.
`,
    expect: [/^#/m, new RegExp(`${EX}s>\\s+<${EX}q>\\s+<${EX}o>\\s*\\.`)],
  },
  {
    name: '31 sanity: -n suppresses proof comments',
    opt: ['-n'],
    input: `
{ ${U('s')} ${U('p')} ${U('o')}. } => { ${U('s')} ${U('q')} ${U('o')}. }.
${U('s')} ${U('p')} ${U('o')}.
`,
    expect: [new RegExp(`${EX}s>\\s+<${EX}q>\\s+<${EX}o>\\s*\\.`)],
    notExpect: [/^#/m],
  },

  // -------------------------
  // Added sanity/regression tests
  // -------------------------

  {
    name: '32 sanity: variable rule fires for multiple matching facts',
    opt: { proofComments: false },
    input: `
${U('a')} ${U('p')} ${U('b')}.
${U('c')} ${U('p')} ${U('d')}.

{ ?s ${U('p')} ?o. } => { ?s ${U('q')} ?o. }.
`,
    expect: [
      new RegExp(`${EX}a>\\s+<${EX}q>\\s+<${EX}b>\\s*\\.`),
      new RegExp(`${EX}c>\\s+<${EX}q>\\s+<${EX}d>\\s*\\.`),
    ],
  },

  {
    name: '33 regression: mutual cycle does not echo already-known facts',
    opt: { proofComments: false },
    input: `
${U('s')} ${U('p')} ${U('o')}.

{ ?x ${U('p')} ?y. } => { ?x ${U('q')} ?y. }.
{ ?x ${U('q')} ?y. } => { ?x ${U('p')} ?y. }.
`,
    expect: [new RegExp(`${EX}s>\\s+<${EX}q>\\s+<${EX}o>\\s*\\.`)],
    notExpect: [new RegExp(`${EX}s>\\s+<${EX}p>\\s+<${EX}o>\\s*\\.`)],
  },

  {
    name: '34 sanity: rule that reproduces same triple produces no output',
    opt: { proofComments: false },
    input: `
${U('s')} ${U('p')} ${U('o')}.
{ ${U('s')} ${U('p')} ${U('o')}. } => { ${U('s')} ${U('p')} ${U('o')}. }.
`,
    expect: [/^\s*$/],
  },

  {
    name: '35 regression: fuse from derived fact',
    opt: { proofComments: false },
    input: `
${U('a')} ${U('p')} ${U('b')}.

{ ${U('a')} ${U('p')} ${U('b')}. } => { ${U('a')} ${U('q')} ${U('b')}. }.
{ ${U('a')} ${U('q')} ${U('b')}. } => false.
`,
    expectErrorCode: 2,
  },

  {
    name: '36 sanity: multiple consequents in one rule',
    opt: { proofComments: false },
    input: `
${U('s')} ${U('p')} ${U('o')}.

{ ${U('s')} ${U('p')} ${U('o')}. } => { ${U('s')} ${U('q')} ${U('o')}. ${U('s')} ${U('r')} ${U('o')}. }.
`,
    expect: [
      new RegExp(`${EX}s>\\s+<${EX}q>\\s+<${EX}o>\\s*\\.`),
      new RegExp(`${EX}s>\\s+<${EX}r>\\s+<${EX}o>\\s*\\.`),
    ],
  },

  {
    name: '37 regression: backward chaining can chain (<= then <= then =>)',
    opt: { proofComments: false },
    input: `
${U('a')} ${U('p')} ${U('b')}.

{ ${U('a')} ${U('q')} ${U('b')}. } <= { ${U('a')} ${U('p')} ${U('b')}. }.
{ ${U('a')} ${U('r')} ${U('b')}. } <= { ${U('a')} ${U('q')} ${U('b')}. }.
{ ${U('a')} ${U('r')} ${U('b')}. } => { ${U('a')} ${U('s')} ${U('b')}. }.
`,
    expect: [new RegExp(`${EX}a>\\s+<${EX}s>\\s+<${EX}b>\\s*\\.`)],
  },

  {
    name: '38 regression: backward rule body can require multiple facts',
    opt: { proofComments: false },
    input: `
${U('a')} ${U('p')} ${U('b')}.
${U('a')} ${U('p2')} ${U('b')}.

{ ${U('a')} ${U('q')} ${U('b')}. } <= { ${U('a')} ${U('p')} ${U('b')}. ${U('a')} ${U('p2')} ${U('b')}. }.
{ ${U('a')} ${U('q')} ${U('b')}. } => { ${U('a')} ${U('r')} ${U('b')}. }.
`,
    expect: [new RegExp(`${EX}a>\\s+<${EX}r>\\s+<${EX}b>\\s*\\.`)],
  },

  {
    name: '39 sanity: backward rule fails when a required fact is missing',
    opt: { proofComments: false },
    input: `
${U('a')} ${U('p')} ${U('b')}.

{ ${U('a')} ${U('q')} ${U('b')}. } <= { ${U('a')} ${U('p')} ${U('b')}. ${U('a')} ${U('p2')} ${U('b')}. }.
{ ${U('a')} ${U('q')} ${U('b')}. } => { ${U('a')} ${U('r')} ${U('b')}. }.
`,
    expect: [/^\s*$/],
  },

  {
    name: '40 sanity: comments and whitespace are tolerated',
    opt: { proofComments: false },
    input: `
# leading comment
{ ${U('s')} ${U('p')} ${U('o')}. } => { ${U('s')} ${U('q')} ${U('o')}. }.  # trailing comment

${U('s')} ${U('p')} ${U('o')}. # another trailing comment
`,
    expect: [new RegExp(`${EX}s>\\s+<${EX}q>\\s+<${EX}o>\\s*\\.`)],
  },

  {
    name: '41 stability: diamond subclass derives D only once',
    opt: { proofComments: false },
    input: diamondSubclassN3(),
    expect: [new RegExp(`${EX}x>\\s+<${EX}type>\\s+<${EX}D>\\s*\\.`)],
    // and ensure it doesn't print the same derived triple twice via the two paths
    check(out) {
      const reD = new RegExp(`${EX}x>\\s+<${EX}type>\\s+<${EX}D>\\s*\\.`, 'm');
      mustOccurExactly(out, reD, 1, 'diamond subclass should not duplicate x type D');
    },
  },

  {
    name: '42 literals: language tags are accepted and preserved',
    opt: { proofComments: false },
    input: ` { ?s ${U('p')} ?o } => { ?s ${U('q')} ?o }. ${U('s')} ${U('p')} "colour"@en-GB.`,
    expect: [new RegExp(`${EX}s>\\s+<${EX}q>\\s+"colour"@en-GB\\s*\\.`)],
  },

  {
    name: '43 literals: long """...""" strings are accepted (with lang tag)',
    opt: { proofComments: false },
    input: ` { ?s ${U('p')} ?o } => { ?s ${U('q')} ?o }. ${U('s')} ${U('p')} """Hello
world"""@en.`,
    expect: [new RegExp(`${EX}s>\\s+<${EX}q>\\s+(?:"""Hello[\\s\\S]*?world"""@en|"Hello\\\\nworld"@en)\\s*\\.`)],
  },

  {
    name: '44 syntax: "<-" in predicate position swaps subject and object',
    opt: { proofComments: false },
    input: ` { ?s ${U('p')} ?o } => { ?s ${U('q')} ?o }.
${U('a')} <-${U('p')} ${U('b')}.`,
    expect: [new RegExp(`${EX}b>\\s+<${EX}q>\\s+<${EX}a>\\s*\\.`)],
  },

  {
    name: '45 syntax: "<-" works inside blank node property lists ([ ... ])',
    opt: { proofComments: false },
    input: ` ${U('s')} ${U('p')} [ <-${U('r')} ${U('o')} ].
{ ${U('o')} ${U('r')} ?x } => { ?x ${U('q')} ${U('k')} }.`,
    expect: [new RegExp(`_:b1\\s+<${EX}q>\\s+<${EX}k>\\s*\\.`)],
  },

  {
    name: '46 syntax: N3 resource paths (! / ^) expand to blank-node triples (forward chain)',
    opt: { proofComments: false },
    input: ` ${U('joe')}!${U('hasAddress')}!${U('hasCity')} ${U('name')} "Metropolis".
{ ${U('joe')} ${U('hasAddress')} ?a } => { ?a ${U('q')} "addr" }.
{ ?a ${U('hasCity')} ?c } => { ?c ${U('q')} "city" }.
`,
    expect: [new RegExp(`_:b1\\s+<${EX}q>\\s+"addr"\\s*\\.`), new RegExp(`_:b2\\s+<${EX}q>\\s+"city"\\s*\\.`)],
  },

  {
    name: '47 syntax: N3 resource paths support reverse steps (^) in the chain',
    opt: { proofComments: false },
    input: ` ${U('joe')}!${U('hasMother')}^${U('hasMother')} ${U('knows')} ${U('someone')}.
{ ?sib ${U('hasMother')} ?mom. ${U('joe')} ${U('hasMother')} ?mom } => { ?sib ${U('q')} ${U('joe')} }.
`,
    expect: [new RegExp(`_:b2\\s+<${EX}q>\\s+<${EX}joe>\\s*\\.`)],
  },

  {
    name: '48 rdf:first: works on list terms (alias of list:first)',
    opt: { proofComments: false },
    input: ` { ( ${U('a')} ${U('b')} ${U('c')} ) rdf:first ?x. } => { ${U('s')} ${U('first')} ?x. }.
`,
    expect: [new RegExp(`${EX}s>\\s+<${EX}first>\\s+<${EX}a>\\s*\\.`)],
  },

  {
    name: '49 rdf:rest: works on list terms (alias of list:rest)',
    opt: { proofComments: false },
    input: ` { ( ${U('a')} ${U('b')} ${U('c')} ) rdf:rest ?r. ?r rdf:first ?y. } => { ${U('s')} ${U('second')} ?y. }.
`,
    expect: [new RegExp(`${EX}s>\\s+<${EX}second>\\s+<${EX}b>\\s*\\.`)],
  },

  {
    name: '49b rdf:nil matches empty list in rdf:rest (issue #7)',
    opt: { proofComments: false },
    input: `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.

${U('o1')} ${U('path')} (${U('c')} ${U('d')}).

{ ?o ${U('path')} ?path. } => { ?path rdf:type ${U('P')}. }.
{ ?p1 rdf:type ${U('P')}. ?p1 rdf:rest ?p2. } => { ?p2 rdf:type ${U('P')}. }.

# query1 uses ()
{ ?p rdf:type ${U('P')}. ?p rdf:rest (). } => { ${U('result')} ${U('query1')} (?p). }.
# query2 uses rdf:nil
{ ?p rdf:type ${U('P')}. ?p rdf:rest rdf:nil. } => { ${U('result')} ${U('query2')} (?p). }.
`,
    expect: [
      new RegExp(`${EX}result>\\s+<${EX}query1>\\s+\\(\\(\\s*<${EX}d>\\s*\\)\\)\\s*\\.`),
      new RegExp(`${EX}result>\\s+<${EX}query2>\\s+\\(\\(\\s*<${EX}d>\\s*\\)\\)\\s*\\.`),
    ],
  },

  {
    name: '50 rdf collection materialization: rdf:first/rdf:rest triples become list terms',
    opt: { proofComments: false },
    input: ` ${U('s')} ${U('p')} _:l1.
_:l1 rdf:first ${U('a')}.
_:l1 rdf:rest _:l2.
_:l2 rdf:first ${U('b')}.
_:l2 rdf:rest rdf:nil.

{ ${U('s')} ${U('p')} ?lst. ?lst rdf:first ?x. } => { ${U('s')} ${U('q')} ?x. }.
{ ${U('s')} ${U('p')} ?lst. ?lst rdf:rest ?r. ?r rdf:first ?y. } => { ${U('s')} ${U('q2')} ?y. }.
{ ${U('s')} ${U('p')} ?lst. ?lst list:rest ?r. ?r list:first ?y. } => { ${U('s')} ${U('q3')} ?y. }.
`,
    expect: [
      new RegExp(`${EX}s>\\s+<${EX}q>\\s+<${EX}a>\\s*\\.`),
      new RegExp(`${EX}s>\\s+<${EX}q2>\\s+<${EX}b>\\s*\\.`),
      new RegExp(`${EX}s>\\s+<${EX}q3>\\s+<${EX}b>\\s*\\.`),
    ],
  },

  // -------------------------
  // Newer eyeling.js features
  // -------------------------

  {
    name: '51 automatic output rendering: prints log:outputString values ordered by key (subject)',
    opt: ['-n'],
    input: `@prefix log: <http://www.w3.org/2000/10/swap/log#>.

<http://example.org/2> log:outputString "B".
<http://example.org/1> log:outputString "A".
`,
    // CLI prints concatenated strings and exits.
    check(out) {
      assert.equal(String(out).trimEnd(), 'AB');
    },
  },

  {
    name: '51b string:format: bound blank nodes in %s placeholders render instead of failing the whole rule',
    opt: ['-n'],
    input: `@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
@prefix : <http://example.org/>.
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix string: <http://www.w3.org/2000/10/swap/string#> .

:policy1
    a odrl:Agreement ;
    odrl:permission [
        odrl:target <http://example.com/asset:9898.movie> ;
        odrl:action odrl:play ;
        odrl:duty [
            odrl:action [
                rdf:value odrl:compensate ;
                odrl:refinement [
                    odrl:leftOperand :payAmount ;
                    odrl:operator odrl:eq ;
                    odrl:rightOperand 5
                ]
            ]
        ]
    ].

{
  ?P a odrl:Agreement .
  ?P odrl:permission [
      odrl:target ?T ;
      odrl:action ?Ignore ;
      odrl:duty [ odrl:action ?A ]
  ].
  ( "%% Duty_(a,t)(action:%s)\n%% => ~Possible_(a,t)(~action:%s)\n" ?A ?A ) string:format ?Str.
}
=>
{
  [] log:outputString ?Str.
}.
`,
    check(out) {
      const m = String(out).match(
        /^% Duty_\(a,t\)\(action:(_:[^)]+)\)\n% => ~Possible_\(a,t\)\(~action:(_:[^)]+)\)\n?$/,
      );
      assert.ok(m, `Expected formatted blank-node output, got: ${String(out)}`);
      assert.equal(m[1], m[2], 'Expected both %s placeholders to render the same blank node id');
    },
  },

  {
    name: '52 --ast: prints parse result as JSON array [prefixes, triples, frules, brules]',
    opt: ['--ast'],
    input: `@prefix ex: <http://example.org/>.
ex:s ex:p ex:o.
`,
    expect: [/^\s*\[/m],
    check(out) {
      const v = JSON.parse(String(out));
      assert.ok(Array.isArray(v), 'AST output should be a JSON array');
      assert.equal(v.length, 4, 'AST output should have 4 top-level elements');
      // The second element is the parsed triples array.
      assert.ok(Array.isArray(v[1]), 'AST[1] (triples) should be an array');
    },
  },

  {
    name: '52b parse: prefixed names allow %HH escapes and Unicode chars (N3 grammar)',
    opt: ['--ast'],
    input: `@prefix res: <http://example.org/res/>.

res:COUNTRY_United%20States rdfs:label "United States".
res:CITY_Chañaral rdfs:label "Chañaral".
`,
    check(out) {
      const v = JSON.parse(String(out));
      assert.ok(
        Array.isArray(v) && v.length === 4,
        'AST output should be a JSON array [prefixes, triples, frules, brules]',
      );
      const triples = v[1];
      assert.ok(Array.isArray(triples), 'AST[1] (triples) should be an array');
      const sIris = triples.map((t) => t.s && t.s.value);
      assert.ok(sIris.includes('http://example.org/res/COUNTRY_United%20States'));
      assert.ok(sIris.includes('http://example.org/res/CITY_Chañaral'));
    },
  },

  {
    name: '53 --stream: prints prefixes used in input (not just derived output) before streaming triples',
    opt: ['--stream', '-n'],
    input: `@prefix ex: <http://example.org/>.
@prefix p: <http://premise.example/>.
@prefix unused: <http://unused.example/>.

ex:a p:trig ex:b.
{ ?s p:trig ?o. } => { ?s ex:q ?o. }.
`,
    expect: [
      /@prefix\s+ex:\s+<http:\/\/example\.org\/>\s*\./m,
      /@prefix\s+p:\s+<http:\/\/premise\.example\/>\s*\./m,
      /(?:ex:a|<http:\/\/example\.org\/a>)\s+(?:ex:q|<http:\/\/example\.org\/q>)\s+(?:ex:b|<http:\/\/example\.org\/b>)\s*\./m,
    ],
    notExpect: [/@prefix\s+unused:/m, /^#/m],
    check(out) {
      const lines = String(out).split(/\r?\n/);
      const firstNonPrefix = lines.findIndex((l) => {
        const t = l.trim();
        return t && !t.startsWith('@prefix');
      });
      assert.ok(firstNonPrefix > 0, 'Expected at least one @prefix line before the first triple');
      for (let i = 0; i < firstNonPrefix; i++) {
        const t = lines[i].trim();
        if (!t) continue;
        assert.ok(t.startsWith('@prefix'), `Non-prefix line found before first triple: ${lines[i]}`);
      }
    },
  },

  {
    name: '54 reasonStream: onDerived callback fires and includeInputFactsInClosure=false excludes input facts',
    run() {
      const input = `
{ <http://example.org/s> <http://example.org/p> <http://example.org/o>. }
  => { <http://example.org/s> <http://example.org/q> <http://example.org/o>. }.

<http://example.org/s> <http://example.org/p> <http://example.org/o>.
`;

      const seen = [];
      const r = reasonStream(input, {
        proof: false,
        includeInputFactsInClosure: false,
        onDerived: ({ triple }) => seen.push(triple),
      });

      // stash for check()
      this.seen = seen;
      this.result = r;
      return r.closureN3;
    },
    expect: [/http:\/\/example\.org\/q/m],
    notExpect: [/http:\/\/example\.org\/p/m],
    check(out, tc) {
      assert.equal(tc.seen.length, 1, 'Expected onDerived to be called once');
      assert.match(tc.seen[0], /http:\/\/example\.org\/q/, 'Expected streamed triple to be the derived one');
      // closureN3 should be exactly the derived triple (no input facts).
      assert.ok(String(out).trim().includes('http://example.org/q'));
      assert.ok(!String(out).includes('http://example.org/p'));
    },
  },
  {
    name: '55 issue #6: RDF list nodes should not be rewritten; list:* builtins should traverse rdf:first/rest',
    opt: {},
    input: `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix list: <http://www.w3.org/2000/10/swap/list#> .
@prefix : <urn:example:> .

:path2 rdf:first :b; rdf:rest rdf:nil.
:path1 rdf:type :P; rdf:first :a; rdf:rest :path2.
:path1-nok rdf:type :P; rdf:first :a; rdf:rest (:b).

{ ?p rdf:type :P. ?p rdf:first ?first. }
=>
{ :result :query1 (?p ?first). }.

{ ?p rdf:type :P. (?p ?i) list:memberAt ?m. }
=>
{ :result :query2 (?p ?i ?m). }.
`,
    expect: [
      /:result\s+:query1\s+\(:path1\s+:a\)\s*\./,
      /:result\s+:query1\s+\(:path1-nok\s+:a\)\s*\./,
      /:result\s+:query2\s+\(:path1\s+0\s+:a\)\s*\./,
      /:result\s+:query2\s+\(:path1\s+1\s+:b\)\s*\./,
      /:result\s+:query2\s+\(:path1-nok\s+0\s+:a\)\s*\./,
      /:result\s+:query2\s+\(:path1-nok\s+1\s+:b\)\s*\./,
    ],
    notExpect: [/:result\s+:query1\s+\(\(:a\s+:b\)\s+:a\)/],
  },
  {
    name: '56 issue #6: duplicate rdf:first/rest statements should not break list:* builtins',
    opt: {},
    input: `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix list: <http://www.w3.org/2000/10/swap/list#> .
@prefix : <urn:example:> .

# block 1
:path2 rdf:first :b; rdf:rest rdf:nil.
:path1 rdf:type :P; rdf:first :a; rdf:rest :path2.

:let :mylist (:c :d).
:let :mylist :path1.

{ :let :mylist ?p. ?p list:length ?l. }
=>
{ :result :query1 (?p ?l). }.

{ :let :mylist ?p. (?p ?i) list:memberAt ?m. }
=>
{ :result :query3 (?p ?i ?m). }.

# duplicated block (exact same statements)
:path2 rdf:first :b; rdf:rest rdf:nil.
:path1 rdf:type :P; rdf:first :a; rdf:rest :path2.

:let :mylist (:c :d).
:let :mylist :path1.

{ :let :mylist ?p. ?p list:length ?l. }
=>
{ :result :query1 (?p ?l). }.

{ :let :mylist ?p. (?p ?i) list:memberAt ?m. }
=>
{ :result :query3 (?p ?i ?m). }.
`,
    expect: [
      /:result\s+:query1\s+\(\(:c\s+:d\)\s+2\)\s*\./,
      /:result\s+:query1\s+\(:path1\s+2\)\s*\./,
      /:result\s+:query3\s+\(\(:c\s+:d\)\s+0\s+:c\)\s*\./,
      /:result\s+:query3\s+\(\(:c\s+:d\)\s+1\s+:d\)\s*\./,
      /:result\s+:query3\s+\(:path1\s+0\s+:a\)\s*\./,
      /:result\s+:query3\s+\(:path1\s+1\s+:b\)\s*\./,
    ],
  },

  {
    name: '57 issue #9: backward cycle with extra type guard should still derive label',
    opt: { proofComments: false },
    input: `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex: <http://example.org/ns#> .

ex:w a ex:Woman .

{
  ?s a ex:Woman .
  ?s ex:label ?label .
} => {
  ?s rdfs:label ?label .
} .

{ ?s a ex:Human } <= { ?s a ex:Woman } .
{ ?s a ex:Animal } <= { ?s a ex:Human } .

{ ?s ex:label "human being" } <= {
  ?s a ex:Human .
  ?s a ex:Animal .
} .
`,
    expect: [
      /(?:ex:w|<http:\/\/example\.org\/ns#w>)\s+(?:rdfs:label|<http:\/\/www\.w3\.org\/2000\/01\/rdf-schema#label>)\s+"human being"\s*\./,
    ],
  },
  {
    name: '58 regression: top-level variable fact can satisfy a ground forward-rule premise',
    opt: { proofComments: false },
    input: `@prefix : <http://example.org/#>.

?X :p :o.

{ :s :p :o } => { :test :is true }.
`,
    expect: [/:(?:test)\s+:(?:is)\s+true\s*\./],
  },

  {
    name: '59 regression: quoted-formula alpha-equivalence must not rename blanks introduced by outer substitution',
    opt: { proofComments: false },
    input: `@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix math: <http://www.w3.org/2000/10/swap/math#> .

_:x :hates { _:foo :making :mess }.

{
    ?A :hates { ?A :making :mess }.
}
=>
{
    ?A :hates :Himself.
}.

{
    ?A :hates :Himself.
}
=>
{
    :test :is false.
}.
`,
    notExpect: [/:(?:test)\s+:(?:is)\s+false\s*\./],
  },

  {
    name: '59b regression: log:includes rejects non-scope literal or term subjects',
    opt: { proofComments: false },
    input: `@prefix : <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@base <http://example.org/> .

{ false log:includes true. } => { :result :has :fail-literal-1. }.
{ "foo" log:includes true. } => { :result :has :fail-literal-2. }.
{ :foo log:includes true. } => { :result :has :fail-literal-3. }.
{ 0 log:includes true. } => { :result :has :fail-literal-4. }.
{ 42.3 log:includes true. } => { :result :has :fail-literal-5. }.
{ (:foo 1 _:x) log:includes true. } => { :result :has :fail-literal-6. }.

{ } => {
  :test :contains :fail-literal-1, :fail-literal-2, :fail-literal-3, :fail-literal-4, :fail-literal-5, :fail-literal-6.
}.
`,
    expect: [
      /:(?:test)\s+:(?:contains)\s+:(?:fail-literal-1)\s*\./,
      /:(?:test)\s+:(?:contains)\s+:(?:fail-literal-2)\s*\./,
      /:(?:test)\s+:(?:contains)\s+:(?:fail-literal-3)\s*\./,
      /:(?:test)\s+:(?:contains)\s+:(?:fail-literal-4)\s*\./,
      /:(?:test)\s+:(?:contains)\s+:(?:fail-literal-5)\s*\./,
      /:(?:test)\s+:(?:contains)\s+:(?:fail-literal-6)\s*\./,
    ],
    notExpect: [
      /:(?:result)\s+:(?:has)\s+:(?:fail-literal-1)\s*\./,
      /:(?:result)\s+:(?:has)\s+:(?:fail-literal-2)\s*\./,
      /:(?:result)\s+:(?:has)\s+:(?:fail-literal-3)\s*\./,
      /:(?:result)\s+:(?:has)\s+:(?:fail-literal-4)\s*\./,
      /:(?:result)\s+:(?:has)\s+:(?:fail-literal-5)\s*\./,
      /:(?:result)\s+:(?:has)\s+:(?:fail-literal-6)\s*\./,
    ],
  },

  {
    name: '59c regression: integer-safe math absoluteValue, negation, and rounded preserve large integers',
    opt: { proofComments: false },
    input: `@prefix : <http://example.org/> .
@prefix math: <http://www.w3.org/2000/10/swap/math#> .
@base <http://example.org/> .

{ 9999999999999999 math:absoluteValue ?X. ?X math:notEqualTo 9999999999999999. } => { :result :has :fail-abs. }.
{ 9999999999999999 math:negation ?X. ?X math:negation ?Y. ?Y math:notEqualTo 9999999999999999. } => { :result :has :fail-neg. }.
{ 9999999999999999 math:rounded ?X. ?X math:notEqualTo 9999999999999999. } => { :result :has :fail-round. }.

{ } => {
  :test :contains :fail-abs, :fail-neg, :fail-round.
}.
`,
    expect: [
      /:(?:test)\s+:(?:contains)\s+:(?:fail-abs)\s*\./,
      /:(?:test)\s+:(?:contains)\s+:(?:fail-neg)\s*\./,
      /:(?:test)\s+:(?:contains)\s+:(?:fail-round)\s*\./,
    ],
    notExpect: [
      /:(?:result)\s+:(?:has)\s+:(?:fail-abs)\s*\./,
      /:(?:result)\s+:(?:has)\s+:(?:fail-neg)\s*\./,
      /:(?:result)\s+:(?:has)\s+:(?:fail-round)\s*\./,
    ],
  },

  {
    name: '60 regression: log:includes must match quoted triples with variable predicates',
    opt: { proofComments: false },
    input: `@prefix : <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@base <http://example.org/>.

{
    { ?X ?Y ?Z. } log:includes { :a :b :c. }.
}
=>
{
    ?X ?Y ?Z.
    {
        :a :b :c.
    }
    =>
    {
        :result :has :success-literal-3.
    }.
}.

{ } => {
    :test :contains :success-literal-3.
}.

{
    :result :has :success-literal-3.
}
=>
{
    :test :is true.
}.
`,
    expect: [/:(?:test)\s+:(?:contains)\s+:(?:success-literal-3)\s*\./, /:(?:test)\s+:(?:is)\s+true\s*\./],
  },

  {
    name: '61 RDF/JS input + rule objects: reason() accepts quads with rules',
    run() {
      const ex = 'http://example.org/';
      const s = rdfjs.namedNode(ex + 's');
      const p = rdfjs.namedNode(ex + 'p');
      const o = rdfjs.namedNode(ex + 'o');
      const out = reason(
        { proofComments: false },
        {
          quads: [rdfjs.quad(s, p, o, rdfjs.defaultGraph())],
          rules: [
            {
              _type: 'Rule',
              premise: [
                {
                  _type: 'Triple',
                  s: { _type: 'Iri', value: ex + 's' },
                  p: { _type: 'Iri', value: ex + 'p' },
                  o: { _type: 'Iri', value: ex + 'o' },
                },
              ],
              conclusion: [
                {
                  _type: 'Triple',
                  s: { _type: 'Iri', value: ex + 's' },
                  p: { _type: 'Iri', value: ex + 'q' },
                  o: { _type: 'Iri', value: ex + 'o' },
                },
              ],
              isForward: true,
              isFuse: false,
              headBlankLabels: [],
            },
          ],
        },
      );
      return out;
    },
    expect: [/http:\/\/example\.org\/q/m],
  },
  {
    name: '62 RDF/JS output: reasonStream can emit quads and closureQuads from rule objects',
    run() {
      const ex = 'http://example.org/';
      const s = rdfjs.namedNode(ex + 's');
      const p = rdfjs.namedNode(ex + 'p');
      const o = rdfjs.namedNode(ex + 'o');
      const seen = [];
      const result = reasonStream(
        {
          quads: [rdfjs.quad(s, p, o, rdfjs.defaultGraph())],
          rules: [
            {
              _type: 'Rule',
              premise: [
                {
                  _type: 'Triple',
                  s: { _type: 'Var', name: 'x' },
                  p: { _type: 'Iri', value: ex + 'p' },
                  o: { _type: 'Var', name: 'y' },
                },
              ],
              conclusion: [
                {
                  _type: 'Triple',
                  s: { _type: 'Var', name: 'x' },
                  p: { _type: 'Iri', value: ex + 'q' },
                  o: { _type: 'Var', name: 'y' },
                },
              ],
              isForward: true,
              isFuse: false,
              headBlankLabels: [],
            },
          ],
        },
        {
          rdfjs: true,
          includeInputFactsInClosure: false,
          onDerived: ({ quad }) => seen.push(quad),
        },
      );
      this.seen = seen;
      this.result = result;
      return result.closureN3;
    },
    expect: [/http:\/\/example\.org\/q/m],
    notExpect: [/http:\/\/example\.org\/p/m],
    check(outputIgnored, tc) {
      assert.equal(tc.seen.length, 1, 'Expected one streamed RDF/JS quad');
      assert.equal(tc.seen[0].termType, 'Quad');
      assert.equal(tc.seen[0].predicate.value, 'http://example.org/q');
      assert.ok(Array.isArray(tc.result.closureQuads), 'Expected closureQuads array');
      assert.equal(tc.result.closureQuads.length, 1);
      assert.equal(tc.result.closureQuads[0].object.value, 'http://example.org/o');
    },
  },
  {
    name: '63 RDF/JS async generator: reasonRdfJs yields derived quads from rule objects',
    async run() {
      const ex = 'http://example.org/';
      const quads = [];
      for await (const quad of reasonRdfJs({
        quads: [rdfjs.quad(rdfjs.namedNode(ex + 'a'), rdfjs.namedNode(ex + 'p'), rdfjs.namedNode(ex + 'b'))],
        rules: [
          {
            _type: 'Rule',
            premise: [
              {
                _type: 'Triple',
                s: { _type: 'Var', name: 'x' },
                p: { _type: 'Iri', value: ex + 'p' },
                o: { _type: 'Var', name: 'y' },
              },
            ],
            conclusion: [
              {
                _type: 'Triple',
                s: { _type: 'Var', name: 'x' },
                p: { _type: 'Iri', value: ex + 'q' },
                o: { _type: 'Var', name: 'y' },
              },
            ],
            isForward: true,
            isFuse: false,
            headBlankLabels: [],
          },
        ],
      })) {
        quads.push(quad);
      }
      this.quads = quads;
      return quads.map((q) => `${q.subject.value} ${q.predicate.value} ${q.object.value}`).join('\n');
    },
    expect: [/http:\/\/example\.org\/q/],
    check(outputIgnored, tc) {
      assert.equal(tc.quads.length, 1, 'Expected one yielded quad');
      assert.equal(tc.quads[0].predicate.value, 'http://example.org/q');
      assert.equal(tc.quads[0].graph.termType, 'DefaultGraph');
    },
  },
  {
    name: '63a RDF/JS export: reasonRdfJs can skip N3-only derived triples',
    async run() {
      const ex = 'http://example.org/';
      const input = `@prefix : <${ex}>.
:a :p :b.
{ :a :p :b. } => { :x :holds { :a :p :b. }. :x :ok :yes. }.`;
      const quads = [];
      for await (const quad of reasonRdfJs(input, { skipUnsupportedRdfJs: true })) {
        quads.push(quad);
      }
      this.quads = quads;
      return quads.map((q) => `${q.subject.value} ${q.predicate.value} ${q.object.value}`).join('\n');
    },
    expect: [/http:\/\/example\.org\/ok/],
    notExpect: [/http:\/\/example\.org\/holds/],
    check(outputIgnored, tc) {
      assert.equal(tc.quads.length, 1, 'Expected one yielded RDF/JS quad after skipping GraphTerm output');
      assert.equal(tc.quads[0].predicate.value, 'http://example.org/ok');
      assert.equal(tc.quads[0].object.value, 'http://example.org/yes');
    },
  },
  {
    name: '63b RDF/JS export: reasonStream keeps N3 closure while omitting unsupported closureQuads',
    run() {
      const ex = 'http://example.org/';
      const input = `@prefix : <${ex}>.
:a :p :b.
{ :a :p :b. } => { :x :holds { :a :p :b. }. :x :ok :yes. }.`;
      const seen = [];
      const result = reasonStream(input, {
        rdfjs: true,
        skipUnsupportedRdfJs: true,
        includeInputFactsInClosure: false,
        onDerived: ({ triple, quad }) => seen.push({ triple, quad }),
      });
      this.seen = seen;
      this.result = result;
      return result.closureN3;
    },
    expect: [/:holds/, /:ok/],
    check(outputIgnored, tc) {
      assert.equal(tc.seen.length, 2, 'Expected both derived facts to reach onDerived');
      assert.equal(tc.seen.filter((x) => x.quad).length, 1, 'Expected only one RDF/JS quad in onDerived');
      assert.ok(Array.isArray(tc.result.closureQuads), 'Expected closureQuads array');
      assert.equal(
        tc.result.closureQuads.length,
        1,
        'Expected unsupported GraphTerm triple to be omitted from closureQuads',
      );
      assert.equal(tc.result.closureQuads[0].predicate.value, 'http://example.org/ok');
      assert.match(tc.result.closureN3, /:holds/, 'Expected N3 closure to retain quoted-formula triple');
    },
  },
  {
    name: '64 RDF/JS validation: named-graph input quads are rejected clearly',
    expectError: true,
    run() {
      const ex = 'http://example.org/';
      return reason(
        {},
        {
          quads: [
            rdfjs.quad(
              rdfjs.namedNode(ex + 's'),
              rdfjs.namedNode(ex + 'p'),
              rdfjs.namedNode(ex + 'o'),
              rdfjs.namedNode(ex + 'g'),
            ),
          ],
        },
      );
    },
  },
  {
    name: '65 Eyeling rule objects: reasonStream accepts Rule-like JSON with RDF/JS quads',
    run() {
      const ex = 'http://example.org/';
      const out = reasonStream(
        {
          quads: [
            rdfjs.quad(rdfjs.namedNode(ex + 'alice'), rdfjs.namedNode(ex + 'parent'), rdfjs.namedNode(ex + 'bob')),
          ],
          rules: [
            {
              _type: 'Rule',
              premise: [
                {
                  _type: 'Triple',
                  s: { _type: 'Var', name: 'x' },
                  p: { _type: 'Iri', value: ex + 'parent' },
                  o: { _type: 'Var', name: 'y' },
                },
              ],
              conclusion: [
                {
                  _type: 'Triple',
                  s: { _type: 'Var', name: 'x' },
                  p: { _type: 'Iri', value: ex + 'ancestor' },
                  o: { _type: 'Var', name: 'y' },
                },
              ],
              isForward: true,
              isFuse: false,
              headBlankLabels: [],
            },
          ],
        },
        { includeInputFactsInClosure: false },
      );
      return out.closureN3;
    },
    expect: [/http:\/\/example\.org\/ancestor/m],
    notExpect: [/http:\/\/example\.org\/parent/m],
  },
  {
    name: '66 Eyeling AST bundle: reason() accepts [prefixes, triples, frules, brules]',
    run() {
      const ex = 'http://example.org/';
      return reason({ proofComments: false }, [
        {
          _type: 'PrefixEnv',
          map: {
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            xsd: 'http://www.w3.org/2001/XMLSchema#',
            log: 'http://www.w3.org/2000/10/swap/log#',
            math: 'http://www.w3.org/2000/10/swap/math#',
            string: 'http://www.w3.org/2000/10/swap/string#',
            list: 'http://www.w3.org/2000/10/swap/list#',
            time: 'http://www.w3.org/2000/10/swap/time#',
            genid: 'https://eyereasoner.github.io/.well-known/genid/',
            '': '',
          },
          baseIri: '',
        },
        [
          {
            _type: 'Triple',
            s: { _type: 'Iri', value: ex + 'alice' },
            p: { _type: 'Iri', value: ex + 'parent' },
            o: { _type: 'Iri', value: ex + 'bob' },
          },
        ],
        [
          {
            _type: 'Rule',
            premise: [
              {
                _type: 'Triple',
                s: { _type: 'Var', name: 'x' },
                p: { _type: 'Iri', value: ex + 'parent' },
                o: { _type: 'Var', name: 'y' },
              },
            ],
            conclusion: [
              {
                _type: 'Triple',
                s: { _type: 'Var', name: 'x' },
                p: { _type: 'Iri', value: ex + 'ancestor' },
                o: { _type: 'Var', name: 'y' },
              },
            ],
            isForward: true,
            isFuse: false,
            headBlankLabels: [],
          },
        ],
        [],
      ]);
    },
    expect: [/http:\/\/example\.org\/ancestor/m],
  },
  {
    name: '67 CLI stdin: accepts piped N3 when no file argument is given',
    run() {
      const input = `@prefix : <http://example.org/> .
:Socrates a :Man .
{ ?x a :Man } => { ?x a :Mortal } .
`;
      const r = spawnSync(process.execPath, [path.join(ROOT, 'eyeling.js')], {
        input,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      if (r.error) throw r.error;
      if (r.status !== 0) {
        const err = new Error(`CLI failed with exit ${r.status}`);
        err.code = r.status;
        err.stdout = r.stdout;
        err.stderr = r.stderr;
        throw err;
      }
      return r.stdout;
    },
    expect: [/:(?:Socrates)\s+a\s+:(?:Mortal)\s*\./],
  },
  {
    name: '68 CLI stdin: accepts explicit - for stdin',
    run() {
      const input = `@prefix : <http://example.org/> .
:Socrates a :Man .
{ ?x a :Man } => { ?x a :Mortal } .
`;
      const r = spawnSync(process.execPath, [path.join(ROOT, 'eyeling.js'), '-'], {
        input,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      if (r.error) throw r.error;
      if (r.status !== 0) {
        const err = new Error(`CLI failed with exit ${r.status}`);
        err.code = r.status;
        err.stdout = r.stdout;
        err.stderr = r.stderr;
        throw err;
      }
      return r.stdout;
    },
    expect: [/:(?:Socrates)\s+a\s+:(?:Mortal)\s*\./],
  },

  {
    name: '240 custom builtin module can be loaded via --builtin',
    run() {
      const tmp = require('node:fs').mkdtempSync(
        require('node:path').join(require('node:os').tmpdir(), 'eyeling-builtin-'),
      );
      const modPath = require('node:path').join(tmp, 'hello-builtin.js');
      require('node:fs').writeFileSync(
        modPath,
        `module.exports = ({ registerBuiltin, internLiteral, unifyTerm, terms }) => {\n` +
          `  const { Var } = terms;\n` +
          `  registerBuiltin("http://example.org/custom#hello", ({ goal, subst }) => {\n` +
          `    const lit = internLiteral("\\"world\\"");\n` +
          `    if (goal.o instanceof Var) { const s2 = { ...subst }; s2[goal.o.name] = lit; return [s2]; }\n` +
          `    const s2 = unifyTerm(goal.o, lit, subst);\n` +
          `    return s2 !== null ? [s2] : [];\n` +
          `  });\n` +
          `};\n`,
        'utf8',
      );
      const out = reasonQuiet(
        { builtinModules: [modPath] },
        `@prefix : <http://example.org/> .\n@prefix cb: <http://example.org/custom#> .\n{ :x cb:hello ?o . } => { :x :value ?o . } .\n:x cb:hello ?o .\n`,
      );
      require('node:fs').rmSync(tmp, { recursive: true, force: true });
      return out;
    },
    expect: [/:x :value "world" \./m],
  },

  {
    name: '241 regression: quoted-formula blanks in rule bodies stay blank through log:conjunction',
    opt: { proofComments: false },
    input: `@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix : <http://example.org/ns#> .

{
  ( { ?S a :Subject } { [] a :Thing } ) log:conjunction ?Z.
}
=>
{
  :result :is ?Z.
}.
`,
    expect: [/:result\s+:is\s+\{[\s\S]*\?S\s+a\s+:Subject\s*\.[\s\S]*_:(?:b\d+)\s+a\s+:Thing\s*\.[\s\S]*\}\s*\./m],
    notExpect: [/\?_b\d+\s+a\s+:Thing\s*\./],
  },
  {
    name: '242 regression: log:includes existentializes blank nodes inside quoted formula patterns',
    opt: { proofComments: false },
    input: `@prefix : <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:doc :graph {
  :perm :duty [
    :action :inform ;
    :constraint [
      :kind :notice ;
      :days 3
    ]
  ]
} .

{
  :doc :graph ?G .
  ?G log:includes {
    :perm :duty [
      :action :inform ;
      :constraint [
        :kind :notice ;
        :days ?D
      ]
    ]
  } .
}
=>
{
  :result :days ?D ;
          :status :matched .
}.
`,
    expect: [
      /:result\s+:days\s+3(?:\s*\^\^<http:\/\/www\.w3\.org\/2001\/XMLSchema#integer>)?\s*\./,
      /:result\s+:status\s+:matched\s*\./,
    ],
  },

  {
    name: '243aa regression: collectAllIn keeps outer blank-node bindings fixed in quoted formulas',
    opt: { proofComments: false },
    input: `@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix ex: <http://example.org/> .

ex:a a ex:Person ; ex:name "A" .
_:b a ex:Person ; ex:name "B" .

{
  ?person a ex:Person .
  (?x { ?person ex:name ?x } ?xs) log:collectAllIn ?SCOPE .
}
=>
{
  ?person ex:names ?xs .
} .
`,
    expect: [/ex:a\s+ex:names\s+\("A"\)\s*\./, /_:[^\s]+\s+ex:names\s+\("B"\)\s*\./],
    notExpect: [/_:[^\s]+\s+ex:names\s+\("A"\s+"B"\)\s*\./, /_:[^\s]+\s+ex:names\s+\("B"\s+"A"\)\s*\./],
  },

  {
    name: '243a regression: collectAllIn treats quoted-formula blanks existentially',
    opt: { proofComments: false },
    input: `@prefix : <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

:a :p [ :q 1 ] .
:b :p [ :q 2 ] .

{
  ( ?s { ?s :p [ :q 1 ] . } ?xs ) log:collectAllIn _:scope .
  ?xs log:equalTo ( :a ) .
}
=>
{
  :test :is true .
}.
`,
    expect: [/:(?:test)\s+:(?:is)\s+true\s*\./],
  },

  {
    name: '243 regression: quoted formulas remain isolated from collectAllIn rule-body rewrites',
    opt: { proofComments: false },
    input: `@prefix :     <http://example.org/jade-eigen-loom#> .
@prefix math: <http://www.w3.org/2000/10/swap/math#> .
@prefix list: <http://www.w3.org/2000/10/swap/list#> .
@prefix log:  <http://www.w3.org/2000/10/swap/log#> .

:PCA1 :points (
  [ :id 1 ; :x 2.0  ; :y 1.0  ]
  [ :id 2 ; :x 3.0  ; :y 2.0  ]
  [ :id 3 ; :x 4.0  ; :y 3.2  ]
  [ :id 4 ; :x 5.0  ; :y 5.1  ]
  [ :id 5 ; :x 6.0  ; :y 7.9  ]
  [ :id 6 ; :x 7.0  ; :y 13.0 ]
  [ :id 7 ; :x 20.0 ; :y -3.0 ]
) .

{
  :PCA1 :points ?pts .
  ?pts list:length ?n .
  ( ?x { ?pts list:member ?p . ?p :x ?x . } ?xs ) log:collectAllIn _:m1 .
  ?xs math:sum ?sumX .
  (?sumX ?n) math:quotient ?meanX .
}
=>
{
  :result :xs ?xs ; :sumX ?sumX ; :meanX ?meanX .
}.
`,
    expect: [
      /:result\s+:xs\s+\(2\.0 3\.0 4\.0 5\.0 6\.0 7\.0 20\.0\)\s*\./,
      /:result\s+:sumX\s+"47"\^\^xsd:decimal\s*\./,
      /:result\s+:meanX\s+"6\.714285714285714"\^\^xsd:decimal\s*\./,
    ],
    notExpect: [/:result\s+:sumX\s+"329"\^\^xsd:decimal\s*\./, /:result\s+:meanX\s+"47"\^\^xsd:decimal\s*\./],
  },
  {
    name: '244 regression: log:dtlit recognizes shorthand numeric and boolean literals',
    opt: { proofComments: false },
    input: `@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix : <http://example.org#> .

:let :term 4, 2.5, 3e1, true, "3"^^xsd:integer .

{
  :let :term ?term .
  (?text ?datatype) log:dtlit ?term .
}
=>
{
  ?term :is (?text ?datatype) .
}.
`,
    expect: [
      /^4\s+:is\s+\("4"\s+xsd:integer\)\s*\./m,
      /^2\.5\s+:is\s+\("2\.5"\s+xsd:decimal\)\s*\./m,
      /^3e1\s+:is\s+\("3e1"\s+xsd:double\)\s*\./m,
      /^true\s+:is\s+\("true"\s+xsd:boolean\)\s*\./m,
      /^"3"\^\^xsd:integer\s+:is\s+\("3"\s+xsd:integer\)\s*\./m,
    ],
  },
  {
    name: '245 regression: log:includes sees quoted log:implies triples as data',
    opt: { proofComments: false },
    input: `@prefix : <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

<> :data {
    {
        ?A a ?B .
        ?B rdfs:subClassOf ?C.
    }
    =>
    {
        ?A a ?C .
    }.
}.

{
    ?W :data ?F.
    ?F log:includes { ?X log:implies ?Y }.
}
=>
{
    :result :is ?X .
}.
`,
    expect: [/^:result\s+:is\s+\{[\s\S]*\?A\s+a\s+\?B\s*\.[\s\S]*\?B\s+rdfs:subClassOf\s+\?C\s*\.[\s\S]*\}\s*\./m],
  },
  {
    name: '246 regression: log:includes sees quoted log:impliedBy triples as data',
    opt: { proofComments: false },
    input: `@prefix : <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

<> :data {
    {
        ?A a ?C .
    }
    <=
    {
        ?A a ?B .
        ?B rdfs:subClassOf ?C.
    }.
}.

{
    ?W :data ?F.
    ?F log:includes { ?Y <= ?X }.
}
=>
{
    :result :is ?X .
}.
`,
    expect: [/^:result\s+:is\s+\{[\s\S]*\?A\s+a\s+\?B\s*\.[\s\S]*\?B\s+rdfs:subClassOf\s+\?C\s*\.[\s\S]*\}\s*\./m],
  },
  {
    name: 'regression: log:rawType accepts quoted variables found via log:includes',
    opt: { proofComments: false },
    input: `@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix : <http://example.org/ns#> .

{ ?X :likes ?Y } <= { ?X :loves ?Y }.

{
  ?X log:impliedBy ?Y .
  ?X log:includes { ?Z1 :likes ?Z2 }.
  ?Z1 log:rawType ?T.
}
=>
{
  :test :is true .
}.
`,
    expect: [/^:test\s+:is\s+true\s*\./m],
  },
  {
    name: 'regression: log:semantics body alpha-renaming does not refire blank-head rule forever',
    async run() {
      const os = require('node:os');
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eyeling-alpha-fire-'));
      const mainPath = path.join(tmp, 'main.n3');
      const examplePath = path.join(tmp, 'example.n3');

      fs.writeFileSync(
        mainPath,
        `@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix : <urn:test#>.

<> :facts <./example.n3> .

{ ?X :load ?S } <= { <> :facts ?F . ?F log:semantics ?S . }.

{ ?This :load ?S . } => { [] a :Test . }.
`,
        'utf8',
      );

      fs.writeFileSync(
        examplePath,
        `@prefix : <urn:test#>.
{ ?A :p ?B } <= { ?A :q ?B }.
`,
        'utf8',
      );

      try {
        const r = spawnSync(process.execPath, [path.join(ROOT, 'bin', 'eyeling.cjs'), mainPath], {
          cwd: ROOT,
          encoding: 'utf8',
          maxBuffer: DEFAULT_MAX_BUFFER,
          timeout: 5000,
        });

        if (r.error) throw r.error;
        assert.equal(r.status, 0, r.stderr || `unexpected exit ${r.status}`);
        mustOccurExactly(r.stdout, /^_:sk_\d+\s+a\s+:Test\s*\.$/gm, 1, 'expected exactly one derived :Test witness');
        return r.stdout;
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    },
  },
  {
    name: 'regression: unrelated blank bindings must not block alpha-equivalent quoted-formula matches',
    opt: { proofComments: false },
    input: `@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix : <http://example.org/ns#> .

{
    _:b1 a :Mortal .
} :because {
    :Socrates a :Human .
    :Human rdfs:subClassOf :Mortal .
} .

<> :step {
  [ a :Mortal ].
}.

{
   ?A :step ?B .
   ?B log:includes { ?S ?P ?O }.
   { _:b2 a :Mortal } :because ?Y.
}
=>
{
  :test :is true .
}.
`,
    expect: [/^:test\s+:is\s+true\s*\./m],
  },
];

let passed = 0;
let failed = 0;

(async function main() {
  const suiteStart = Date.now();
  info(`Running ${cases.length} API tests (independent of examples/)`);

  for (const tc of cases) {
    const start = msNow();
    try {
      const out = typeof tc.run === 'function' ? await tc.run() : reasonQuiet(tc.opt, tc.input);

      if (tc.expectErrorCode != null || tc.expectError) {
        throw new Error(`Expected an error, but reason() returned output:\n${out}`);
      }

      for (const re of tc.expect || []) mustMatch(out, re, `${tc.name}: missing expected pattern ${re}`);
      for (const re of tc.notExpect || []) mustNotMatch(out, re, `${tc.name}: unexpected pattern ${re}`);

      if (typeof tc.check === 'function') tc.check(out, tc);

      const dur = msNow() - start;
      ok(`${tc.name} ${C.dim}(${dur} ms)${C.n}`);
      passed++;
    } catch (e) {
      const dur = msNow() - start;

      if (tc.expectErrorCode != null) {
        if (e && typeof e === 'object' && 'code' in e && e.code === tc.expectErrorCode) {
          ok(`${tc.name} ${C.dim}(expected exit ${tc.expectErrorCode}, ${dur} ms)${C.n}`);
          passed++;
          continue;
        }
        fail(`${tc.name} ${C.dim}(${dur} ms)${C.n}`);
        fail(
          `Expected exit code ${tc.expectErrorCode}, got: ${e && e.code != null ? e.code : 'unknown'}\n${
            e && e.stderr ? e.stderr : e && e.stack ? e.stack : String(e)
          }`,
        );
        failed++;
        continue;
      }

      if (tc.expectError) {
        ok(`${tc.name} ${C.dim}(expected error, ${dur} ms)${C.n}`);
        passed++;
        continue;
      }

      fail(`${tc.name} ${C.dim}(${dur} ms)${C.n}`);
      fail(e && e.stack ? e.stack : String(e));
      failed++;
    }
  }

  console.log('');
  const suiteMs = Date.now() - suiteStart;
  console.log(`${C.y}==${C.n} Total elapsed: ${suiteMs} ms (${(suiteMs / 1000).toFixed(2)} s)`);

  if (failed === 0) {
    ok(`All API tests passed (${passed}/${cases.length})`);
    process.exit(0);
  } else {
    fail(`Some API tests failed (${passed}/${cases.length})`);
    process.exit(1);
  }
})();
