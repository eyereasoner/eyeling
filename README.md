# eyeling

[![npm version](https://img.shields.io/npm/v/eyeling.svg)](https://www.npmjs.com/package/eyeling)
[![DOI](https://img.shields.io/badge/DOI-10.5281%2Fzenodo.19068086-blue.svg)](https://doi.org/10.5281/zenodo.19068086)

A compact [Notation3 (N3)](https://notation3.org/) reasoner in **JavaScript**.

## Quick start

```bash
echo '@prefix : <http://example.org/> .
:Socrates a :Man .
{ ?x a :Man } => { ?x a :Mortal } .' | npx eyeling
```

## Read more

- [Handbook](https://eyereasoner.github.io/eyeling/HANDBOOK)
- [Playground](https://eyereasoner.github.io/eyeling/playground)
- [Conformance report](https://codeberg.org/phochste/notation3tests/src/branch/main/reports/report.md)
