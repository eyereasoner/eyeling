# eyeling

[![npm version](https://img.shields.io/npm/v/eyeling.svg)](https://www.npmjs.com/package/eyeling) [![DOI](https://zenodo.org/badge/581706557.svg)](https://doi.org/10.5281/zenodo.19068086)

A compact [Notation3 (N3)](https://notation3.org/) reasoner in **JavaScript**.

## Quick start

```bash
npm i eyeling
npx eyeling examples/socrates.n3
```

Custom builtins are loaded explicitly:

```bash
npx eyeling --builtin lib/builtin-sudoku.js examples/sudoku.n3
```

## Read more

- **Handbook:** [eyereasoner.github.io/eyeling/HANDBOOK](https://eyereasoner.github.io/eyeling/HANDBOOK)
- **Semantics:** [eyereasoner.github.io/eyeling/SEMANTICS](https://eyereasoner.github.io/eyeling/SEMANTICS)
- **Playground:** [eyereasoner.github.io/eyeling/demo](https://eyereasoner.github.io/eyeling/demo)
- **Conformance report:** [codeberg.org/phochste/notation3tests/.../report.md](https://codeberg.org/phochste/notation3tests/src/branch/main/reports/report.md)

