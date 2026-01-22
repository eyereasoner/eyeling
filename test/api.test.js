'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
// Direct eyeling.js API (in-process) for testing reasonStream/onDerived.
// This is the "latest eyeling.js" surface and is used by the browser demo.
const { reasonStream } = require('../eyeling.js');

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
        const n = typeof c === 'number' ? c : (typeof c === 'string' && /^\d+$/.test(c) ? Number(c) : null);
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
    name: '51 --strings: prints log:outputString values ordered by key (subject)',
    opt: ['--strings', '-n'],
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
      this._seen = seen;
      this._result = r;
      return r.closureN3;
    },
    expect: [/http:\/\/example\.org\/q/m],
    notExpect: [/http:\/\/example\.org\/p/m],
    check(out, tc) {
      assert.equal(tc._seen.length, 1, 'Expected onDerived to be called once');
      assert.match(tc._seen[0], /http:\/\/example\.org\/q/, 'Expected streamed triple to be the derived one');
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
    notExpect: [
      /:result\s+:query1\s+\(\(:a\s+:b\)\s+:a\)/,
    ],
  }
  ,
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
  }
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
