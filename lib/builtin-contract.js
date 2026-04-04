'use strict';

const CONTRACT = {
  version: 1,
  moduleExportForms: [
    'function',
    'object.register',
    'object.builtins',
    'plain-object-map',
    'object.default-object-map',
  ],
  api: {
    functions: {
      getBuiltinApiVersion: { arity: 0, required: true },
      registerBuiltin: { arity: 2, required: true },
      unregisterBuiltin: { arity: 1, required: true },
      listBuiltinIris: { arity: 0, required: true },
      internIri: { arity: 1, required: true },
      internLiteral: { arity: 1, required: true },
      literalParts: { arity: 1, required: true },
      termToJsString: { arity: 1, required: true },
      termToJsStringDecoded: { arity: 1, required: true },
      termToN3: { arity: 2, required: true },
      iriValue: { arity: 1, required: true },
      unifyTerm: { arity: 3, required: true },
      applySubstTerm: { arity: 2, required: true },
      applySubstTriple: { arity: 2, required: true },
      proveGoals: { arity: 9, required: true },
      isGroundTerm: { arity: 1, required: true },
      computeConclusionFromFormula: { arity: 1, required: true },
      skolemIriFromGroundTerm: { arity: 1, required: true },
      parseBooleanLiteralInfo: { arity: 1, required: true },
      parseNumericLiteralInfo: { arity: 1, required: true },
      parseXsdDecimalToBigIntScale: { arity: 1, required: true },
      pow10n: { arity: 1, required: true },
      normalizeLiteralForFastKey: { arity: 1, required: true },
      literalsEquivalentAsXsdString: { arity: 2, required: true },
      materializeRdfLists: { arity: 3, required: true },
    },
    namespaces: {
      terms: ['Literal', 'Iri', 'Var', 'Blank', 'ListTerm', 'OpenListTerm', 'GraphTerm', 'Triple', 'Rule'],
      ns: ['RDF_NS', 'XSD_NS', 'CRYPTO_NS', 'MATH_NS', 'TIME_NS', 'LIST_NS', 'LOG_NS', 'STRING_NS'],
    },
  },
  handler: {
    ctxKeys: ['iri', 'goal', 'subst', 'facts', 'backRules', 'depth', 'varGen', 'maxResults', 'api'],
    return: 'array-of-substitution-deltas',
  },
};

const EXACT_API_KEYS = new Set([...Object.keys(CONTRACT.api.functions), ...Object.keys(CONTRACT.api.namespaces)]);

function assertExactKeys(obj, expectedKeys, label) {
  const got = Object.keys(obj).sort();
  const exp = Array.from(expectedKeys).sort();
  if (got.length !== exp.length || got.some((k, i) => k !== exp[i])) {
    throw new Error(`${label} keys changed. expected: ${exp.join(', ')}; got: ${got.join(', ')}`);
  }
}

function assertFunctionArity(name, fn, spec) {
  if (typeof fn !== 'function') throw new TypeError(`Builtin API member ${name} must be a function`);
  if (Number.isInteger(spec.arity) && fn.length !== spec.arity) {
    throw new Error(`Builtin API member ${name} arity changed: expected ${spec.arity}, got ${fn.length}`);
  }
  if (Number.isInteger(spec.arityMin) && fn.length < spec.arityMin) {
    throw new Error(`Builtin API member ${name} arity too small: expected >= ${spec.arityMin}, got ${fn.length}`);
  }
}

function deepFreezeBuiltinApi(api) {
  Object.freeze(api.terms);
  Object.freeze(api.ns);
  return Object.freeze(api);
}

function assertBuiltinApiShape(api) {
  assertExactKeys(api, EXACT_API_KEYS, 'Builtin registration API');

  for (const [name, spec] of Object.entries(CONTRACT.api.functions)) {
    assertFunctionArity(name, api[name], spec);
  }

  for (const name of CONTRACT.api.namespaces.terms) {
    if (!api.terms || typeof api.terms[name] !== 'function') {
      throw new TypeError(`Builtin API terms.${name} missing or invalid`);
    }
  }

  for (const name of CONTRACT.api.namespaces.ns) {
    if (!api.ns || typeof api.ns[name] !== 'string') {
      throw new TypeError(`Builtin API ns.${name} missing or invalid`);
    }
  }

  return api;
}

function assertBuiltinCtxShape(ctx) {
  assertExactKeys(ctx, new Set(CONTRACT.handler.ctxKeys), 'Builtin handler ctx');
}

function assertBuiltinResultShape(out, iri) {
  if (out == null) return;
  if (!Array.isArray(out)) {
    throw new TypeError(`Custom builtin ${iri} must return an array of substitution deltas`);
  }
  for (const delta of out) {
    if (delta === null || typeof delta !== 'object' || Array.isArray(delta)) {
      throw new TypeError(`Custom builtin ${iri} returned a non-object substitution delta`);
    }
  }
}

module.exports = {
  CONTRACT,
  assertBuiltinApiShape,
  assertBuiltinCtxShape,
  assertBuiltinResultShape,
  deepFreezeBuiltinApi,
};
