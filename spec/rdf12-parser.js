'use strict';

const { lex, Parser } = require('../lib/engine');
const { internalTripleToRdfJsQuad } = require('../lib/rdfjs');

// Implements the IParser interface from rdf-test-suite.
// https://github.com/rubensworks/rdf-test-suite.js/blob/master/lib/testcase/rdfsyntax/IParser.ts
module.exports = {
  parse(data, baseIRI) {
    const text = typeof data === 'string' ? data : String(data || '');

    // Run lexer in RDF compatibility mode for RDF 1.2 syntax tests.
    const tokens = lex(text, { rdf: true });
    const parser = new Parser(tokens);

    if (typeof baseIRI === 'string' && baseIRI) {
      parser.prefixes.setBase(baseIRI);
    }

    const [, triples] = parser.parseDocument();

    // rdf-test-suite expects Promise<Quad[]>.
    return Promise.resolve(triples.map((triple) => internalTripleToRdfJsQuad(triple)));
  },
};
