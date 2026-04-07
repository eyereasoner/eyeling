'use strict';

const assert = require('node:assert/strict');

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

const builtins = require('../lib/builtins');
require('../lib/engine');

const expectedApiKeys = [
  'registerBuiltin',
  'unregisterBuiltin',
  'listBuiltinIris',
  'internIri',
  'internLiteral',
  'literalParts',
  'termToJsString',
  'termToJsStringDecoded',
  'termToN3',
  'iriValue',
  'unifyTerm',
  'applySubstTerm',
  'applySubstTriple',
  'proveGoals',
  'isGroundTerm',
  'computeConclusionFromFormula',
  'skolemIriFromGroundTerm',
  'parseBooleanLiteralInfo',
  'parseNumericLiteralInfo',
  'parseXsdDecimalToBigIntScale',
  'pow10n',
  'normalizeLiteralForFastKey',
  'literalsEquivalentAsXsdString',
  'materializeRdfLists',
  'terms',
  'ns',
].sort();

const expectedTermsKeys = [
  'Literal',
  'Iri',
  'Var',
  'Blank',
  'ListTerm',
  'OpenListTerm',
  'GraphTerm',
  'Triple',
  'Rule',
].sort();

const expectedNsKeys = ['RDF_NS', 'XSD_NS', 'CRYPTO_NS', 'MATH_NS', 'TIME_NS', 'LIST_NS', 'LOG_NS', 'STRING_NS'].sort();

function makeOkMapModule() {
  return {
    'http://example.org/test#ok': ({ subst }) => [subst],
  };
}

function makeOkRegisterModule() {
  return {
    register(api) {
      api.registerBuiltin('http://example.org/test#ok-register', ({ subst }) => [subst]);
    },
  };
}

function makeOkBuiltinsModule() {
  return {
    builtins: {
      'http://example.org/test#ok-builtins': ({ subst }) => [subst],
    },
  };
}

function makeOkDefaultMapModule() {
  return {
    default: {
      'http://example.org/test#ok-default-map': ({ subst }) => [subst],
    },
  };
}

function makeBadExportModule() {
  return 42;
}

const cases = [
  {
    name: 'builtin helper API stays stable and frozen',
    run() {
      const api = builtins.__testBuildBuiltinApi();
      assert.deepEqual(Object.keys(api).sort(), expectedApiKeys);
      assert.equal(Object.isFrozen(api), true);
      assert.equal(Object.isFrozen(api.terms), true);
      assert.equal(Object.isFrozen(api.ns), true);
      assert.deepEqual(Object.keys(api.terms).sort(), expectedTermsKeys);
      assert.deepEqual(Object.keys(api.ns).sort(), expectedNsKeys);
    },
  },
  {
    name: 'registerBuiltinModule accepts supported module export forms',
    run() {
      assert.doesNotThrow(() => builtins.registerBuiltinModule(makeOkMapModule(), 'ok-map'));
      assert.doesNotThrow(() => builtins.registerBuiltinModule(makeOkRegisterModule(), 'ok-register'));
      assert.doesNotThrow(() => builtins.registerBuiltinModule(makeOkBuiltinsModule(), 'ok-builtins'));
      assert.doesNotThrow(() => builtins.registerBuiltinModule(makeOkDefaultMapModule(), 'ok-default-map'));
    },
  },
  {
    name: 'registerBuiltinModule rejects unsupported module exports',
    run() {
      assert.throws(
        () => builtins.registerBuiltinModule(makeBadExportModule(), 'bad-export'),
        /must export a function, a \{ register\(\) \} object, or an object mapping predicate IRIs to handlers/,
      );
    },
  },
  {
    name: 'registered builtin handlers must return substitution arrays',
    run() {
      const wrapped = builtins.registerBuiltin('http://example.org/test#shape-check', () => ({ nope: true }));
      assert.throws(
        () =>
          wrapped({
            iri: 'http://example.org/test#shape-check',
            goal: {},
            subst: {},
            facts: [],
            backRules: [],
            depth: 0,
            varGen: 0,
            maxResults: 1,
            api: builtins.__testBuildBuiltinApi(),
          }),
        /must return an array of substitution deltas/,
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
