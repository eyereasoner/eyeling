'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

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

const fixtures = path.join(__dirname, 'fixtures', 'builtins');
const builtins = require('../lib/builtins');
const { CONTRACT } = require('../lib/builtin-contract');
require('../lib/engine');

const expectedApiKeys = [...Object.keys(CONTRACT.api.functions), ...Object.keys(CONTRACT.api.namespaces)].sort();

const expectedFunctionArities = Object.fromEntries(
  Object.entries(CONTRACT.api.functions).map(([name, spec]) => [name, spec]),
);

const cases = [
  {
    name: 'builtin API exact helper surface is stable',
    run() {
      const api = builtins.__testBuildBuiltinApi();
      assert.deepEqual(Object.keys(api).sort(), expectedApiKeys);
      assert.equal(Object.isFrozen(api), true);
      assert.equal(Object.isFrozen(api.terms), true);
      assert.equal(Object.isFrozen(api.ns), true);
      for (const [name, spec] of Object.entries(expectedFunctionArities)) {
        assert.equal(typeof api[name], 'function', `${name} must be a function`);
        if (Number.isInteger(spec.arity)) assert.equal(api[name].length, spec.arity, `${name} arity drifted`);
        if (Number.isInteger(spec.arityMin)) assert.ok(api[name].length >= spec.arityMin, `${name} arity drifted`);
      }
      assert.deepEqual(Object.keys(api.terms).sort(), CONTRACT.api.namespaces.terms.slice().sort());
      assert.deepEqual(Object.keys(api.ns).sort(), CONTRACT.api.namespaces.ns.slice().sort());
      assert.equal(api.getBuiltinApiVersion(), CONTRACT.version);
    },
  },
  {
    name: 'registerBuiltinModule accepts all declared module export forms',
    run() {
      assert.doesNotThrow(() => builtins.registerBuiltinModule(require(path.join(fixtures, 'ok-map.js')), 'ok-map'));
      assert.doesNotThrow(() =>
        builtins.registerBuiltinModule(require(path.join(fixtures, 'ok-register.js')), 'ok-register'),
      );
      assert.doesNotThrow(() =>
        builtins.registerBuiltinModule(require(path.join(fixtures, 'ok-builtins.js')), 'ok-builtins'),
      );
      assert.doesNotThrow(() =>
        builtins.registerBuiltinModule(require(path.join(fixtures, 'ok-default-map.js')), 'ok-default-map'),
      );
    },
  },
  {
    name: 'registerBuiltinModule rejects unsupported module exports',
    run() {
      assert.throws(
        () => builtins.registerBuiltinModule(require(path.join(fixtures, 'bad-export.js')), 'bad-export'),
        /must export a function, a \{ register\(\) \} object, or an object mapping predicate IRIs to handlers/,
      );
    },
  },
  {
    name: 'registered builtin handlers must return substitution-delta arrays',
    run() {
      builtins.registerBuiltinModule(require(path.join(fixtures, 'bad-return.js')), 'bad-return');
      assert.throws(() => {
        const h = builtins.registerBuiltin('http://example.org/test#shape-check', () => ({ nope: true }));
        h({
          iri: 'http://example.org/test#shape-check',
          goal: {},
          subst: {},
          facts: [],
          backRules: [],
          depth: 0,
          varGen: 0,
          maxResults: 1,
          api: builtins.__testBuildBuiltinApi(),
        });
      }, /must return an array of substitution deltas/);
    },
  },
  {
    name: 'registered builtin handlers receive the exact stable ctx shape',
    run() {
      const wrapped = builtins.registerBuiltin('http://example.org/test#ctx-shape', ({ subst }) => [subst]);
      assert.throws(
        () =>
          wrapped({
            iri: 'http://example.org/test#ctx-shape',
            goal: {},
            subst: {},
            facts: [],
            backRules: [],
            depth: 0,
            varGen: 0,
            maxResults: 1,
            api: builtins.__testBuildBuiltinApi(),
            extra: true,
          }),
        /Builtin handler ctx keys changed|Builtin handler ctx shape changed/,
      );
    },
  },
];

let passed = 0;
let failed = 0;

(function main() {
  const suiteStart = Date.now();
  info(`Running ${cases.length} builtin contract tests`);

  for (const tc of cases) {
    const start = Date.now();
    try {
      tc.run();
      ok(`${tc.name} ${C.dim}(${Date.now() - start} ms)${C.n}`);
      passed++;
    } catch (e) {
      fail(`${tc.name} ${C.dim}(${Date.now() - start} ms)${C.n}`);
      fail(e && e.stack ? e.stack : String(e));
      failed++;
    }
  }

  console.log('');
  console.log(`${C.y}==${C.n} Total elapsed: ${Date.now() - suiteStart} ms`);
  if (failed === 0) {
    ok(`All builtin contract tests passed (${passed}/${cases.length})`);
    process.exit(0);
  }
  fail(`Some builtin contract tests failed (${passed}/${cases.length})`);
  process.exit(1);
})();
