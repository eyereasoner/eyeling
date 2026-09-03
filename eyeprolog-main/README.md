# EyeProlog

[![npm version](https://img.shields.io/npm/v/eyeprolog.svg)](https://www.npmjs.com/package/eyeprolog)
[![DOI](https://img.shields.io/badge/DOI-10.5281%2Fzenodo.21446308-blue.svg)](https://doi.org/10.5281/zenodo.21446308)

EyeProlog turns portable ISO Prolog programs into answers and inspectable proofs.

<p>
  <a href="https://eyereasoner.github.io/eyeprolog/the-art-of-eyeprolog">
    <img src="book-assets/title-page.svg" alt="Read The Art of EyeProlog" title="Click to read The Art of EyeProlog" width="320">
  </a><br>
  <strong>Click the cover to read <em>The Art of EyeProlog</em>.</strong>
</p>

The single implementation reference is [*The Art of EyeProlog*](the-art-of-eyeprolog.md).
It documents the language, built-ins, libraries, command line, JavaScript API,
examples, proofs, conformance profile, and implementation.

## Quick start

EyeProlog requires Node.js 18 or newer:

```sh
node --version
```

If necessary, upgrade through a Node version manager or the
[official Node.js download](https://nodejs.org/en/download).

Run EyeProlog without installing it globally:

```sh
npx --yes eyeprolog
?- member(X, [prolog, logic]).
   X = prolog
;  X = logic.
?- halt.
```

For a persistent command, use a user-owned npm prefix:

```sh
npm install --global --prefix "$HOME/.local" eyeprolog
export PATH="$HOME/.local/bin:$PATH"
eyeprolog
```

Add the `PATH` export to your shell startup file. Do not use `sudo npm install`;
npm's [EACCES guidance](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally/)
also recommends a Node version manager or a user-owned prefix.

Run a program non-interactively:

```sh
printf 'human(socrates).\nmortal(X) :- human(X).\n' |
  npx --yes eyeprolog --proof --goal 'mortal(socrates)' -
```

## Eyelet forward rules (`:+`)
Normal mode executes top-level `Conclusion :+ Premise` rules through the bundled Prolog `library(eyelet)` driver when no explicit `-g/--goal` is supplied. `true :+ Goal` prints answers and `false :+ Goal` emits a `fuse/1`; JavaScript `run()` follows the same rule. The module exports `:+`, `stable/1`, and `becomes/2`, and implements rule selection, fixed-point rounds, skolemization, state replacement, and duplicate suppression in Prolog. JavaScript retains only syntax recognition, static dependency/autoload planning, driver bootstrap, and private mutability/output adapters; it does not implement the fixed-point semantics. Strict ISO mode disables this extension.

Bundled `src/lib/` predicates autoload in files, CLI/API goals, and the REPL; use `--no-autoload` to require explicit imports, and explicitly import libraries that introduce operators before using their syntax. See [*The Art of EyeProlog*](the-art-of-eyeprolog.md) for the full semantics.

All 33 bundled modules that overlap Scryer's current `src/lib/` surface cover Scryer's exported predicates, and all 26 bundled modules with public-module counterparts in Trealla's current `library/` surface cover those Trealla exports as well. The stricter Trealla/Scryer intersection remains a separate portability profile. Runtime-dependent library primitives follow one ownership rule: `src/lib/<module>.pl` calls private adapters from `src/<module>-host.js`; pure Prolog libraries need no host file. This includes the full Scryer `library(files)` surface, Scryer character-list paths in `library(pio)` with atom-path compatibility, chars/UTF-8/term/Base64 helpers, the completed arithmetic/time/`iso_ext` surfaces, the full Scryer `library(crypto)`, and Scryer-compatible TCP `library(sockets)`. Filesystem, OS, and TCP socket side effects require Node; crypto uses Node's backend where needed, with Web Crypto also used for secure random bytes when available. Non-integral rational conversions remain structural `rdiv(Numerator,Denominator)` terms until rational numbers become processor numeric values.

## Links

- [The Art of EyeProlog](https://eyereasoner.github.io/eyeprolog/the-art-of-eyeprolog) — complete reference
- [Why EyeProlog?](https://eyereasoner.github.io/eyeprolog/why-eyeprolog) — project scope and design
- [Playground](https://eyereasoner.github.io/eyeprolog/playground) — run EyeProlog in a browser
- [Examples](examples) — runnable programs and checked output
- [Example decks](examples/deck/README.md) — explainable RDF/Prolog scenarios with reproducible roundtrips
- [Introduction to EyeProlog](https://eyereasoner.github.io/eyeprolog/examples/deck/introduction-to-eyeprolog) — short presentation deck for first-time audiences
- [Symbiotic Knowledge Graphs](https://eyereasoner.github.io/eyeprolog/examples/deck/symbiotic-knowledge-graphs) — RDF ↔ Prolog heatwave-response demo for human/AI/KG co-evolution
- [rdf-prolog-roundtrip](https://github.com/eyereasoner/rdf-prolog-roundtrip) — standalone RDF 1.2 ↔ ISO Prolog bridge used by the RDF examples
- [ISO conformance audit](test/conformance/ISO-COMPLIANCE.md) — supported Part 1 profile
- [Conformance report](conformance-report.md) — generated executable conformance status and corpus summary
- [OpenRuleBench](openrulebench/README.md) — portable benchmark profile

## RDF, Prolog, and symbiotic knowledge graphs

EyeProlog can sit behind an RDF knowledge graph without inventing a private graph representation. [`rdf-prolog-roundtrip`](https://github.com/eyereasoner/rdf-prolog-roundtrip) converts RDF 1.2 datasets to ordinary `rdf(Subject, Predicate, Object, Graph)` facts, EyeProlog applies portable rules, and ground `rdf/4` results can be converted back to RDF.

The checked [Symbiotic Knowledge Graphs example](examples/symbiotic-knowledge-graph.pl) uses named graphs and RDF 1.2 triple terms to distinguish trusted knowledge, AI-proposed statements, and human review. Its [wide-audience companion](https://eyereasoner.github.io/eyeprolog/examples/deck/symbiotic-knowledge-graphs) explains why this is a useful present-day software model for human/AI/KG co-evolution: RDF supplies shared semantic memory, Prolog supplies explicit deliberation, AI supplies new hypotheses, and people remain participants in meaning and judgment.

The same RDF → Prolog → RDF boundary is exercised by five additional checked scenarios: [cross-organization data sharing](https://eyereasoner.github.io/eyeprolog/examples/deck/cross-organization-data-sharing), [explainable EV-depot configuration](https://eyereasoner.github.io/eyeprolog/examples/deck/explainable-ev-depot-configuration), [operational incident response](https://eyereasoner.github.io/eyeprolog/examples/deck/operational-incident-response), [software supply-chain vulnerability response](https://eyereasoner.github.io/eyeprolog/examples/deck/sbom-vulnerability-response), and a [scientific evidence graph](https://eyereasoner.github.io/eyeprolog/examples/deck/scientific-evidence-graph). Together they cover policy decisions, reversible configuration reasoning, dependency-graph diagnosis, transitive SBOM exposure, and evidence aggregation with explicit disagreement.

## Benchmarks
EyeProlog has 20 checksum-protected wall-clock benchmarks spanning recursion/indexing, constraints, tabling/WFS, DCGs, Eyelet, search, term I/O, attributes, and rewriting. Short workloads are adaptively batched before timing so millisecond-scale noise is not mistaken for a regression. Run `npm run benchmark`; create a machine-local comparison point with `npm run benchmark:baseline`; use `npm run test:benchmark` for harness checks. Details are in [*The Art of EyeProlog*](the-art-of-eyeprolog.md).
## Development

```sh
git clone https://github.com/eyereasoner/eyeprolog.git
cd eyeprolog
npm install
npm test
```

EyeProlog is released under the [MIT License](LICENSE.md).
