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
const { reason } = require('../index');

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

const expectedNsKeys = ['RDF_NS', 'XSD_NS', 'CRYPTO_NS', 'MATH_NS', 'TIME_NS', 'LIST_NS', 'LOG_NS', 'STRING_NS', 'DT_NS'].sort();

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


function runReason(input) {
  return reason({ proof: false }, input);
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
    name: 'custom builtin helper termToN3 uses default prefixes when omitted',
    run() {
      const api = builtins.__testBuildBuiltinApi();
      assert.equal(api.termToN3(api.internIri('http://www.w3.org/2000/10/swap/log#implies')), 'log:implies');
      assert.equal(api.termToN3(api.internLiteral('"abc"')), '"abc"');
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

  {
    name: 'datatype builtins inspect literals, validate XSD value spaces, compare values, and canonicalize',
    run() {
      const out = runReason(`
@prefix : <http://example.org/datatype-tests#> .
@prefix dt: <https://eyereasoner.github.io/eyeling/datatype#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

{ "01"^^xsd:integer dt:datatype ?d . } => { :integer :datatype ?d } .
{ "001"^^xsd:integer dt:lexicalForm ?lex . } => { :integer :lexicalForm ?lex } .
{ "hello"@en dt:language ?lang . } => { :language :tag ?lang } .
{ "plain" dt:datatype ?d . } => { :plain :datatype ?d } .
{ "hello"@EN dt:datatype ?d . } => { :langString :datatype ?d } .

{ "1"^^xsd:integer dt:validForDatatype xsd:integer . } => { :valid :integer true } .
{ "2147483648"^^xsd:int dt:invalidForDatatype xsd:int . } => { :invalid :int true } .
{ "2"^^xsd:boolean dt:invalidForDatatype xsd:boolean . } => { :invalid :boolean true } .
{ "2026-02-31T00:00:00Z"^^xsd:dateTime dt:invalidForDatatype xsd:dateTime . } => { :invalid :dateTime true } .

{ "01"^^xsd:integer dt:sameValueAs "1.0"^^xsd:decimal . } => { :same :numeric true } .
{ "true"^^xsd:boolean dt:sameValueAs "1"^^xsd:boolean . } => { :same :boolean true } .
{ "2026-06-10T12:00:00Z"^^xsd:dateTime dt:sameValueAs "2026-06-10T14:00:00+02:00"^^xsd:dateTime . } => { :same :dateTime true } .
{ "AQID"^^xsd:base64Binary dt:sameValueAs "010203"^^xsd:hexBinary . } => { :same :binary true } .
{ "11"^^xsd:integer dt:differentValueFrom "12"^^xsd:integer . } => { :different :numeric true } .

{ "01"^^xsd:integer dt:canonicalLiteral ?ci . } => { :canonical :integer ?ci } .
{ "1"^^xsd:boolean dt:canonicalLiteral ?cb . } => { :canonical :boolean ?cb } .
{ " a\t b "^^xsd:token dt:canonicalLiteral ?ct . } => { :canonical :token ?ct } .
{ "2026-06-10T14:00:00+02:00"^^xsd:dateTime dt:canonicalLiteral ?cd . } => { :canonical :dateTime ?cd } .
`);

      assert.match(out, /:integer :datatype xsd:integer \./);
      assert.match(out, /:integer :lexicalForm "001" \./);
      assert.match(out, /:language :tag "en" \./);
      assert.match(out, /:plain :datatype xsd:string \./);
      assert.match(out, /:langString :datatype rdf:langString \./);
      assert.match(out, /:valid :integer true \./);
      assert.match(out, /:invalid :int true \./);
      assert.match(out, /:invalid :boolean true \./);
      assert.match(out, /:invalid :dateTime true \./);
      assert.match(out, /:same :numeric true \./);
      assert.match(out, /:same :boolean true \./);
      assert.match(out, /:same :dateTime true \./);
      assert.match(out, /:same :binary true \./);
      assert.match(out, /:different :numeric true \./);
      assert.match(out, /:canonical :integer "1"\^\^xsd:integer \./);
      assert.match(out, /:canonical :boolean true \./);
      assert.match(out, /:canonical :token "a b"\^\^xsd:token \./);
      assert.match(out, /:canonical :dateTime "2026-06-10T12:00:00Z"\^\^xsd:dateTime \./);
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
