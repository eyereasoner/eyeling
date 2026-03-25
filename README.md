# eyeling

[![npm version](https://img.shields.io/npm/v/eyeling.svg)](https://www.npmjs.com/package/eyeling) [![DOI](https://zenodo.org/badge/581706557.svg)](https://doi.org/10.5281/zenodo.19068086)

A compact [Notation3 (N3)](https://notation3.org/) reasoner in **JavaScript**.

- Single self-contained bundle (`eyeling.js`), no external runtime dependencies
- Forward (`=>`) and backward (`<=`) chaining over Horn-style rules
- **CLI / npm `reason()` output is mode-dependent by default**: it prints **newly derived forward facts** in normal mode, or (when top-level `{ ... } log:query { ... }.` directives are present) the **unique instantiated conclusion triples** of those queries, optionally with compact proof comments
- Works in Node.js and fully client-side (browser/worker)

## Links

- **Handbook:** [https://eyereasoner.github.io/eyeling/HANDBOOK](https://eyereasoner.github.io/eyeling/HANDBOOK)
- **Semantics:** [https://eyereasoner.github.io/eyeling/SEMANTICS](https://eyereasoner.github.io/eyeling/SEMANTICS)
- **Playground:** [https://eyereasoner.github.io/eyeling/demo](https://eyereasoner.github.io/eyeling/demo)
- **Conformance report:** [https://codeberg.org/phochste/notation3tests/src/branch/main/reports/report.md](https://codeberg.org/phochste/notation3tests/src/branch/main/reports/report.md)
- **ARCtifacts:** [https://eyereasoner.github.io/eyeling/arctifacts/](https://eyereasoner.github.io/eyeling/arctifacts/)

Eyeling is regularly checked against the community Notation3 test suite. If you want implementation details (parser, unifier, proof search, skolemization, scoped closure, builtins), start with the handbook.

## Quick start

### Requirements

- Node.js >= 18

### Install

```bash
npm i eyeling
```

## CLI usage

Run on a file:

```bash
npx eyeling examples/socrates.n3
```

Show all options:

```bash
npx eyeling --help
```

Useful flags include `--proof-comments`, `--stream`, `--strings`, and `--enforce-https`.

## What gets printed?

### Normal mode (default)

Without top-level `log:query` directives, Eyeling prints **newly derived forward facts** by default.

### `log:query` mode (output selection)

If the input contains one or more **top-level** directives of the form:

```n3
{ ?x a :Human. } log:query { ?x a :Mortal. }.
```

Eyeling still computes the saturated forward closure, but it **prints only** the **unique instantiated conclusion triples** of those `log:query` directives (instead of all newly derived forward facts).

## JavaScript API

### npm helper: `reason()`

CommonJS:

```js
const { reason } = require('eyeling');

const input = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix : <http://example.org/socrates#>.

:Socrates a :Human.
:Human rdfs:subClassOf :Mortal.

{ ?s a ?A. ?A rdfs:subClassOf ?B. } => { ?s a ?B. }.
`;

console.log(reason({ proofComments: false }, input));
```

ESM:

```js
import eyeling from 'eyeling';

console.log(eyeling.reason({ proofComments: false }, input));
```

Notes:

- `reason()` returns the same textual output you would get from the CLI for the same input/options.
- By default, the npm helper keeps output machine-friendly (`proofComments: false`).
- The npm helper shells out to the bundled `eyeling.js` CLI for simplicity and robustness.

### RDF/JS and Eyeling rule-object interop

The JavaScript APIs now accept three input styles:

1. plain N3 text
2. RDF/JS facts (`quads`, `facts`, or `dataset`)
3. Eyeling rule objects / AST bundles (the same shapes you get from `eyeling --ast`)

If you want to use N3 source text, pass the whole input as a plain N3 string.

For RDF/JS facts, the graph must be the default graph. Named-graph quads are rejected.

For structured inputs, `rules` is supplied as current Eyeling rule objects:

```js
const { reason, rdfjs } = require('eyeling');

const ex = 'http://example.org/';

const rule = {
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
};

const out = reason(
  { proofComments: false },
  {
    quads: [rdfjs.quad(rdfjs.namedNode(ex + 'alice'), rdfjs.namedNode(ex + 'parent'), rdfjs.namedNode(ex + 'bob'))],
    rules: [rule],
  },
);
```

You can also pass a full AST bundle directly:

```js
const ast = [prefixes, triples, forwardRules, backwardRules];
const out2 = reason({ proofComments: false }, ast);
```

### Direct bundle / browser-worker API: `reasonStream()`

For in-process reasoning (browser, worker, or direct use of `eyeling.js`):

```js
const result = eyeling.reasonStream(input, {
  proof: false,
  onDerived: ({ triple }) => console.log(triple),
  // includeInputFactsInClosure: false,
});

console.log(result.closureN3);
```

`eyeling.js` now also exposes `eyeling.rdfjs` and `eyeling.reasonRdfJs(...)` for RDF/JS workflows.

#### `reasonStream()` output behavior

`closureN3` is also mode-dependent:

- **Normal mode:** by default, `closureN3` is the closure (**input facts + derived facts**)
- **`log:query` mode:** `closureN3` is the **query-selected triples**

To exclude input facts from the normal-mode closure, pass:

```js
includeInputFactsInClosure: false;
```

When `rdfjs: true` is passed, `onDerived` also receives a `quad` field and the result may include `closureQuads` / `queryQuads`.

The returned object also includes `queryMode`, `queryTriples`, and `queryDerived` (and in normal mode, `onDerived` fires for newly derived facts; in `log:query` mode it fires for the query-selected derived triples).

### `reasonRdfJs()`

`reasonRdfJs(input, opts)` exposes derived results as an async iterable of RDF/JS quads as they are produced:

```js
const { reasonRdfJs, rdfjs } = require('eyeling');

for await (const quad of reasonRdfJs({
  quads: [rdfjs.quad(rdfjs.namedNode(ex + 'alice'), rdfjs.namedNode(ex + 'parent'), rdfjs.namedNode(ex + 'bob'))],
  rules: [rule],
})) {
  console.log(quad.subject.value, quad.predicate.value, quad.object.value);
}
```

## Builtins

Builtins are defined in [eyeling-builtins.ttl](https://github.com/eyereasoner/eyeling/blob/main/eyeling-builtins.ttl) and described in the [Handbook (Chapter 11)](https://eyereasoner.github.io/eyeling/HANDBOOK#ch11).

## Development and testing (repo checkout)

```bash
npm test
```

You can also inspect the `examples/` directory for many small and large N3 programs.

## License

MIT — see [LICENSE.md](https://github.com/eyereasoner/eyeling/blob/main/LICENSE.md).
