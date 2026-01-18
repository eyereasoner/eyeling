# eyeling

A compact [Notation3 (N3)](https://notation3.org/) reasoner in **JavaScript**.

- Single self-contained bundle (`eyeling.js`), no external runtime deps
- Forward (`=>`) + backward (`<=`) chaining over Horn-style rules
- Outputs only **newly derived** forward facts (optionally with compact proof comments)
- Works in Node.js and fully client-side (browser/worker)

## Links

- **Handbook:** [https://eyereasoner.github.io/eyeling/HANDBOOK](https://eyereasoner.github.io/eyeling/HANDBOOK)
- **Playground:** [https://eyereasoner.github.io/eyeling/demo](https://eyereasoner.github.io/eyeling/demo)
- **Notation3 test suite:** [https://codeberg.org/phochste/notation3tests](https://codeberg.org/phochste/notation3tests)
- **Eyeling conformance report:** [https://codeberg.org/phochste/notation3tests/src/branch/main/reports/report.md](https://codeberg.org/phochste/notation3tests/src/branch/main/reports/report.md)

Eyeling is regularly checked against the community Notation3 test suite; the report above tracks current pass/fail results.

If you want to understand how the parser, unifier, proof search, skolemization, scoped closure, and builtins are implemented, start with the handbook.

## Quick start

### Requirements

- Node.js >= 18

### Install

```bash
npm i eyeling
```

### CLI

Run on a file:

```bash
npx eyeling examples/socrates.n3
```

See all options:

```bash
npx eyeling --help
```

### JavaScript API

CommonJS:

```js
const { reason } = require("eyeling");

const input = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix : <http://example.org/socrates#>.

:Socrates a :Human.
:Human rdfs:subClassOf :Mortal.

{ ?S a ?A. ?A rdfs:subClassOf ?B } => { ?S a ?B }.
`;

console.log(reason({ proofComments: false }, input));
```

ESM:

```js
import eyeling from "eyeling";
console.log(eyeling.reason({ proofComments: false }, input));
```

Streaming / in-process reasoning (browser/worker, direct `eyeling.js`):

```js
const { closureN3 } = eyeling.reasonStream(input, {
  proof: false,
  onDerived: ({ triple }) => console.log(triple),
});
```

> Note: the npm `reason()` helper shells out to the bundled `eyeling.js` CLI for simplicity and robustness.

## Builtins

Builtins are defined in [eyeling-builtins.ttl](https://github.com/eyereasoner/eyeling/blob/main/eyeling-builtins.ttl)
and described in the [HANDBOOK](https://eyereasoner.github.io/eyeling/HANDBOOK#ch11).

## Testing (repo checkout)

```bash
npm test
```

## License

MIT (see [LICENSE](https://github.com/eyereasoner/eyeling/blob/main/LICENSE.md)).
