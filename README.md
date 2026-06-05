# eyeling

[![npm version](https://img.shields.io/npm/v/eyeling.svg)](https://www.npmjs.com/package/eyeling)
[![DOI](https://img.shields.io/badge/DOI-10.5281%2Fzenodo.19068086-blue.svg)](https://doi.org/10.5281/zenodo.19068086)

A compact [Notation3 (N3)](https://notation3.org/) reasoner in **JavaScript**.

Eyeling is characterized by:

* **Notation3 reasoning in a small JavaScript package** — facts, quoted formulas, and N3 rules are parsed and reasoned over directly.
* **Forward and backward chaining** — `=>` rules derive new facts, while `<=` rules act as goal-directed definitions.
* **Backward proving inside forward rules** — forward-rule bodies are solved with the backward engine, so rules can use derived predicates and built-ins without materializing everything first.
* **Built-ins in rule bodies** — N3 programs can combine logical rules with computations such as math, string, list, time, and web-oriented predicates.
* **Node.js, npm, and browser use** — run it from the command line, call it from JavaScript, or use the browser-oriented bundle.
* **RDF-JS interoperability** — use N3 text, RDF-JS quads, datasets, or Eyeling’s own AST-level API.

## Quick start

```bash
echo '@prefix : <http://example.org/> .
:Socrates a :Man .
{ ?x a :Man } => { ?x a :Mortal } .' | npx eyeling
```

## JavaScript API

```js
const { reason } = require('eyeling');

const output = reason({}, `
  @prefix : <http://example.org/> .

  :Socrates a :Man .
  { ?x a :Man } => { ?x a :Mortal } .
`);

console.log(output);
```

For streaming-style use and RDF-JS integration, see `reasonStream` and `reasonRdfJs`.

## Read more

* [Handbook](https://eyereasoner.github.io/eyeling/HANDBOOK)
* [Playground](https://eyereasoner.github.io/eyeling/playground)
* [Conformance report](https://codeberg.org/phochste/notation3tests/src/branch/main/reports/report.md)
