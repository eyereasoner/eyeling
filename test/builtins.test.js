'use strict';

const assert = require('node:assert/strict');

const { detail, failResult, info, pass } = require('./report');

const builtins = require('../lib/builtins');
require('../lib/engine');
const { reason } = require('../index');
const { reasonStream } = require('../lib/engine');

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
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

{ "01"^^xsd:integer dt:datatype ?d . } => { :integer :datatype ?d } .
{ "001"^^xsd:integer dt:lexicalForm ?lex . } => { :integer :lexicalForm ?lex } .
{ "hello"@en dt:language ?lang . } => { :language :tag ?lang } .
{ "plain" dt:datatype ?d . } => { :plain :datatype ?d } .
{ "hello"@EN dt:datatype ?d . } => { :langString :datatype ?d } .
{ "hello@en"^^rdf:PlainLiteral dt:datatype ?d . } => { :plainLiteral :datatype ?d } .

{ "1"^^xsd:integer dt:validForDatatype xsd:integer . } => { :valid :integer true } .
{ "hello@en"^^rdf:PlainLiteral dt:validForDatatype rdf:PlainLiteral . } => { :valid :plainLiteral true } .
{ "abc@"^^rdf:PlainLiteral dt:validForDatatype rdf:PlainLiteral . } => { :valid :plainLiteralEmptyTag true } .
{ "<a/>"^^rdf:XMLLiteral dt:validForDatatype rdf:XMLLiteral . } => { :valid :xmlLiteral true } .
{ "anything" dt:validForDatatype rdfs:Literal . } => { :valid :rdfsLiteral true } .
{ "2147483648"^^xsd:int dt:invalidForDatatype xsd:int . } => { :invalid :int true } .
{ "2"^^xsd:boolean dt:invalidForDatatype xsd:boolean . } => { :invalid :boolean true } .
{ "2026-02-31T00:00:00Z"^^xsd:dateTime dt:invalidForDatatype xsd:dateTime . } => { :invalid :dateTime true } .
{ " 1.0 "^^xsd:decimal dt:invalidForDatatype xsd:decimal . } => { :invalid :decimalWhitespace true } .
{ "02026-06-10T12:00:00Z"^^xsd:dateTime dt:invalidForDatatype xsd:dateTime . } => { :invalid :dateTimeYear true } .
{ "http://example.org/a b"^^xsd:anyURI dt:invalidForDatatype xsd:anyURI . } => { :invalid :anyURI true } .
{ ":abc"^^xsd:anyURI dt:invalidForDatatype xsd:anyURI . } => { :invalid :anyURIRelativeColon true } .
{ "3.5E38"^^xsd:float dt:invalidForDatatype xsd:float . } => { :invalid :floatHigh true } .
{ "1.0E-46"^^xsd:float dt:invalidForDatatype xsd:float . } => { :invalid :floatLow true } .
{ "a  b"^^xsd:token dt:invalidForDatatype xsd:token . } => { :invalid :token true } .
{ "hello"^^rdf:PlainLiteral dt:invalidForDatatype rdf:PlainLiteral . } => { :invalid :plainLiteralNoTag true } .
{ "hello@bad_tag"^^rdf:PlainLiteral dt:invalidForDatatype rdf:PlainLiteral . } => { :invalid :plainLiteralBadTag true } .
{ "<a>"^^rdf:XMLLiteral dt:invalidForDatatype rdf:XMLLiteral . } => { :invalid :xmlLiteral true } .

{ "01"^^xsd:integer dt:sameValueAs "1.0"^^xsd:decimal . } => { :same :numeric true } .
{ "hello@EN"^^rdf:PlainLiteral dt:sameValueAs "hello@en"^^rdf:PlainLiteral . } => { :same :plainLiteral true } .
{ "true"^^xsd:boolean dt:sameValueAs "1"^^xsd:boolean . } => { :same :boolean true } .
{ "2026-06-10T12:00:00Z"^^xsd:dateTime dt:sameValueAs "2026-06-10T14:00:00+02:00"^^xsd:dateTime . } => { :same :dateTime true } .
{ "2026-12-31T24:00:00Z"^^xsd:dateTime dt:sameValueAs "2027-01-01T00:00:00Z"^^xsd:dateTime . } => { :same :midnightRollover true } .
{ "AQID"^^xsd:base64Binary dt:sameValueAs "010203"^^xsd:hexBinary . } => { :same :binary true } .
{ "<a/>"^^rdf:XMLLiteral dt:sameValueAs "<a/>"^^rdf:XMLLiteral . } => { :same :xmlLiteral true } .
{ "11"^^xsd:integer dt:differentValueFrom "12"^^xsd:integer . } => { :different :numeric true } .
{ "hello@en"^^rdf:PlainLiteral dt:differentValueFrom "bye@en"^^rdf:PlainLiteral . } => { :different :plainLiteral true } .
{ "a" dt:differentValueFrom "b" . } => { :different :string true } .
{ "a" dt:datatype ?sd . ?sd <http://www.w3.org/2000/10/swap/log#notEqualTo> xsd:string . } => { :string :comparisonDatatype ?sd } .
{ "<a/>"^^rdf:XMLLiteral dt:differentValueFrom "<b/>"^^rdf:XMLLiteral . } => { :different :xmlLiteral true } .

{ ("1"^^xsd:integer xsd:integer) dt:validForDatatype true . } => { :tuple :valid true } .
{ ("abc"^^xsd:integer xsd:integer) dt:validForDatatype false . } => { :tuple :invalidBoolean true } .
{ ("abc"^^xsd:integer xsd:integer) dt:invalidForDatatype ?invalid . } => { :tuple :invalidResult ?invalid } .

{ "01"^^xsd:integer dt:canonicalLiteral ?ci . } => { :canonical :integer ?ci } .
{ "1"^^xsd:boolean dt:canonicalLiteral ?cb . } => { :canonical :boolean ?cb } .
{ "a b"^^xsd:token dt:canonicalLiteral ?ct . } => { :canonical :token ?ct } .
{ "hello@EN"^^rdf:PlainLiteral dt:canonicalLiteral ?cp . } => { :canonical :plainLiteral ?cp } .
{ "<a/>"^^rdf:XMLLiteral dt:canonicalLiteral ?cx . } => { :canonical :xmlLiteral ?cx } .
{ "2026-06-10T14:00:00+02:00"^^xsd:dateTime dt:canonicalLiteral ?cd . } => { :canonical :dateTime ?cd } .
{ "2026-12-31T24:00:00Z"^^xsd:dateTime dt:canonicalLiteral ?cm . } => { :canonical :midnightRollover ?cm } .

:x owl:differentFrom :x .
{ :x owl:sameAs :x . } => { :sameAs :reflexive true } .
`);

      assert.match(out, /:integer :datatype xsd:integer \./);
      assert.match(out, /:integer :lexicalForm "001" \./);
      assert.match(out, /:language :tag "en" \./);
      assert.match(out, /:plain :datatype xsd:string \./);
      assert.match(out, /:langString :datatype rdf:langString \./);
      assert.match(out, /:plainLiteral :datatype rdf:PlainLiteral \./);
      assert.match(out, /:valid :integer true \./);
      assert.match(out, /:valid :plainLiteral true \./);
      assert.match(out, /:valid :plainLiteralEmptyTag true \./);
      assert.match(out, /:valid :xmlLiteral true \./);
      assert.match(out, /:valid :rdfsLiteral true \./);
      assert.match(out, /:invalid :int true \./);
      assert.match(out, /:invalid :boolean true \./);
      assert.match(out, /:invalid :dateTime true \./);
      assert.match(out, /:invalid :decimalWhitespace true \./);
      assert.match(out, /:invalid :dateTimeYear true \./);
      assert.match(out, /:invalid :anyURI true \./);
      assert.match(out, /:invalid :anyURIRelativeColon true \./);
      assert.match(out, /:invalid :floatHigh true \./);
      assert.match(out, /:invalid :floatLow true \./);
      assert.match(out, /:invalid :token true \./);
      assert.match(out, /:invalid :plainLiteralNoTag true \./);
      assert.match(out, /:invalid :plainLiteralBadTag true \./);
      assert.match(out, /:invalid :xmlLiteral true \./);
      assert.match(out, /:same :numeric true \./);
      assert.match(out, /:same :plainLiteral true \./);
      assert.match(out, /:same :boolean true \./);
      assert.match(out, /:same :dateTime true \./);
      assert.match(out, /:same :midnightRollover true \./);
      assert.match(out, /:same :binary true \./);
      assert.match(out, /:same :xmlLiteral true \./);
      assert.match(out, /:different :numeric true \./);
      assert.match(out, /:different :plainLiteral true \./);
      assert.match(out, /:different :string true \./);
      assert.match(out, /:string :comparisonDatatype rdfs:Literal \./);
      assert.match(out, /:different :xmlLiteral true \./);
      assert.match(out, /:tuple :valid true \./);
      assert.match(out, /:tuple :invalidBoolean true \./);
      assert.match(out, /:tuple :invalidResult true \./);
      assert.match(out, /:canonical :integer "1"\^\^xsd:integer \./);
      assert.match(out, /:canonical :boolean true \./);
      assert.match(out, /:canonical :token "a b"\^\^xsd:token \./);
      assert.match(out, /:canonical :plainLiteral "hello@en"\^\^rdf:PlainLiteral \./);
      assert.match(out, /:canonical :xmlLiteral "<a\/>"\^\^rdf:XMLLiteral \./);
      assert.match(out, /:canonical :dateTime "2026-06-10T12:00:00Z"\^\^xsd:dateTime \./);
      assert.match(out, /:canonical :midnightRollover "2027-01-01T00:00:00Z"\^\^xsd:dateTime \./);
      assert.match(out, /:sameAs :reflexive true \./);
    },
  },
  {
    name: 'custom builtin API hides internal blank-node variable prefix',
    run() {
      const iri = 'http://example.org/custom#format';
      builtins.unregisterBuiltin(iri);
      builtins.registerBuiltin(iri, ({ goal, subst, api }) => {
        const formatted = api.termToN3(goal.s);
        assert.doesNotMatch(formatted, /\uE000eyeling_b/);
        assert.match(formatted, /\?_b1/);
        const next = api.unifyTerm(goal.o, api.internLiteral(JSON.stringify(formatted)), subst);
        return next === null ? [] : [next];
      });

      try {
        const out = reasonStream(`
@prefix : <http://example.org/> .
@prefix cb: <http://example.org/custom#> .

{
  { [] a ?class } cb:format ?format .
}
=>
{
  :result :is ?format .
} .
`, { proof: false, includeInputFactsInClosure: false }).closureN3;
        assert.doesNotMatch(out, /\uE000eyeling_b/);
        assert.match(out, /:result :is/);
        assert.match(out, /\?_b1/);
        assert.match(out, /\?class/);
      } finally {
        builtins.unregisterBuiltin(iri);
      }
    },
  },

];

let passed = 0;
let failed = 0;

(function main() {
  const suiteStart = Date.now();
  info(`Running ${cases.length} builtin contract tests`);

  for (const [index, tc] of cases.entries()) {
    const start = Date.now();
    try {
      tc.run();
      pass(index + 1, tc.name, Date.now() - start);
      passed++;
    } catch (e) {
      failResult(index + 1, tc.name, Date.now() - start);
      detail(e && e.stack ? e.stack : String(e));
      failed++;
    }
  }

  console.log('');
  info(`Total elapsed: ${Date.now() - suiteStart} ms`);
  if (failed === 0) {
    info(`All builtin contract tests passed (${passed}/${cases.length})`);
    process.exit(0);
  }
  info(`Some builtin contract tests failed (${passed}/${cases.length})`);
  process.exit(1);
})();
