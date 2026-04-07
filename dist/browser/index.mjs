import './eyeling.browser.js';

function getBrowserApi() {
  const api = typeof globalThis !== 'undefined' ? globalThis.eyeling : undefined;
  if (!api) {
    throw new Error(
      'Eyeling browser bundle is not initialized. Import "eyeling/browser" only in a browser or worker runtime.',
    );
  }
  return api;
}

export function reasonStream(input, opts) {
  return getBrowserApi().reasonStream(input, opts);
}

export function reasonRdfJs(input, opts) {
  return getBrowserApi().reasonRdfJs(input, opts);
}

export function registerBuiltin(iri, handler) {
  return getBrowserApi().registerBuiltin(iri, handler);
}

export function unregisterBuiltin(iri) {
  return getBrowserApi().unregisterBuiltin(iri);
}

export function registerBuiltinModule(mod, origin) {
  return getBrowserApi().registerBuiltinModule(mod, origin);
}

export function listBuiltinIris() {
  return getBrowserApi().listBuiltinIris();
}

export function collectOutputStringsFromFacts(facts, prefixes) {
  return getBrowserApi().collectOutputStringsFromFacts(facts, prefixes);
}

export function prettyPrintQueryTriples(triples, prefixes) {
  return getBrowserApi().prettyPrintQueryTriples(triples, prefixes);
}

export const rdfjs = new Proxy(Object.create(null), {
  get(_target, prop) {
    return Reflect.get(getBrowserApi().rdfjs, prop);
  },
  set(_target, prop, value) {
    return Reflect.set(getBrowserApi().rdfjs, prop, value);
  },
  has(_target, prop) {
    return prop in getBrowserApi().rdfjs;
  },
  ownKeys() {
    return Reflect.ownKeys(getBrowserApi().rdfjs);
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(getBrowserApi().rdfjs, prop);
  },
});

const eyeling = {
  get version() {
    return getBrowserApi().version;
  },
  reasonStream,
  reasonRdfJs,
  rdfjs,
  registerBuiltin,
  unregisterBuiltin,
  registerBuiltinModule,
  listBuiltinIris,
  collectOutputStringsFromFacts,
  prettyPrintQueryTriples,
};

export default eyeling;
