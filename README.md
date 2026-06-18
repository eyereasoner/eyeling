# eyeling

[![npm version](https://img.shields.io/npm/v/eyeling.svg)](https://www.npmjs.com/package/eyeling)
[![DOI](https://img.shields.io/badge/DOI-10.5281%2Fzenodo.19068086-blue.svg)](https://doi.org/10.5281/zenodo.19068086)

A compact [Notation3 (N3)](https://notation3.org/) reasoner in **JavaScript**.

<table style="background-color: #eef7ff;">
<tr>
<td bgcolor="#eef7ff" style="background-color: #eef7ff; padding: 16px;">
<p><strong>Mission</strong></p>
<p>Eyeling aims to make knowledge itself computationally accountable, so every conclusion can be derived, checked, and explained. It does this by keeping reasoning close to explicit facts, rules, and proofs rather than hidden assumptions or opaque workflows. As a compact Notation3 reasoner for JavaScript, Eyeling is designed to fit into practical systems while remaining inspectable enough for researchers, engineers, and agents to understand why a result follows. The ambition is not just to process data, but to support a culture of verifiable knowledge: conclusions that can be exchanged, reproduced, challenged, and improved.</p>
</td>
</tr>
</table>

Eyeling is characterized by:

- **Notation3 reasoning in a small JavaScript package** — facts, quoted formulas, and N3 rules are parsed and reasoned over directly.
- **Forward and backward chaining** — `=>` rules derive new facts, while `<=` rules act as goal-directed definitions.
- **Backward proving inside forward rules** — forward-rule bodies are solved with the backward engine, so rules can use derived predicates and built-ins without materializing everything first.
- **Built-ins in rule bodies** — N3 programs can combine logical rules with computations such as math, string, datatype, list, time, and web-oriented predicates.
- **Streaming RDF Messages** — supports RDF Messages streams, enabling Eyeling to fit into streaming RDF pipelines.
- **Node.js, npm, and browser use** — run it from the command line, call it from JavaScript, or use the browser-oriented bundle.
- **RDF-JS interoperability** — use N3 text, RDF-JS quads, datasets, or Eyeling’s own AST-level API, with TypeScript declarations grounded in `@rdfjs/types`.
- **Experimental eyelang engine** — run compact Prolog-style Horn clause programs alongside the N3 engine, giving Eyeling a second reasoning engine without mixing the internals.


This README is the primary guide to using, extending, and maintaining Eyeling.

Eyeling is designed for people who want a small, inspectable reasoner that can run N3 rules in Node.js, the browser, tests, and RDF-oriented data pipelines.

## Project links

- [Playground](https://eyereasoner.github.io/eyeling/playground)
- [Conformance report](https://codeberg.org/phochste/notation3tests/src/branch/main/reports/report.md)
- [eyelang guide](docs/eyelang-guide.md)
- [eyelang language reference](docs/eyelang-language-reference.md)

---

## Table of contents

1. [What Eyeling is](#what-eyeling-is)
2. [Quick start](#quick-start)
3. [Core concepts](#core-concepts)
4. [Command-line interface](#command-line-interface)
5. [JavaScript API](#javascript-api)
6. [RDF-JS integration](#rdf-js-integration)
7. [Eyelang second engine](#eyelang-second-engine)
8. [RDF compatibility mode and RDF 1.2](#rdf-compatibility-mode-and-rdf-12)
9. [RDF Message Logs](#rdf-message-logs)
10. [Built-ins](#built-ins)
11. [Custom built-ins](#custom-built-ins)
12. [Reasoning model](#reasoning-model)
13. [Architecture](#architecture)
14. [Repository layout](#repository-layout)
15. [Examples guide](#examples-guide)
16. [Testing and quality checks](#testing-and-quality-checks)
17. [Development workflow](#development-workflow)
18. [Publishing and release notes](#publishing-and-release-notes)
19. [Troubleshooting](#troubleshooting)
20. [Security and operational notes](#security-and-operational-notes)
21. [Glossary](#glossary)

---

## What Eyeling is

Eyeling is a compact [Notation3](https://notation3.org/) reasoner implemented in JavaScript.

It accepts facts and rules written in N3-style syntax, computes the logical consequences of those rules, and emits newly derived results. It can be used as:

- a command-line tool through `npx eyeling` or the `eyeling` binary;
- a CommonJS API from Node.js through `require('eyeling')`;
- a browser/worker API through `eyeling/browser`;
- an RDF-JS adapter for applications that work with quads and data factories;
- a streaming tool for RDF Message Logs;
- an experimental host for the `eyelang` Prolog-style Horn clause engine.

Eyeling is intentionally small and dependency-light. The source tree is organized as a miniature compiler and inference engine: lexer, parser, term model, rule normalization, built-ins, forward chaining, backward proving, printing, RDF-JS adapters, and CLI wiring.

### What Eyeling is not

Eyeling is not a database, a triple store, or a full web crawler. It is a reasoner. It reads a finite set of sources, reasons over them, and returns derived output. For persistent storage, indexing at scale, access control, or distributed querying, pair Eyeling with the appropriate storage and application layer.

---

## Quick start

### Run without installing

```bash
echo '@prefix : <http://example.org/> .
:Socrates a :Man .
{ ?x a :Man } => { ?x a :Mortal } .' | npx eyeling
```

Expected output:

```n3
@prefix : <http://example.org/> .

:Socrates a :Mortal .
```

By default, the CLI prints newly derived triples, not the original input facts.

### Install in a project

```bash
npm install eyeling
```

Use it from JavaScript:

```js
const { reason } = require('eyeling');

const output = reason({}, `
  @prefix : <http://example.org/> .

  :Socrates a :Man .
  { ?x a :Man } => { ?x a :Mortal } .
`);

console.log(output);
```

### Run an included example

```bash
node eyeling.js examples/socrates.n3
```

For proof output:

```bash
node eyeling.js --proof examples/socrates.n3
```

Run an eyelang program through the second engine:

```bash
eyeling --engine eyelang examples/eyelang/ancestor.pl
```

Or from JavaScript:

```js
const { reason } = require('eyeling');

const output = reason({ engine: 'eyelang' }, `
  materialize(out, 1).
  in(done).
  out(X) :- in(X).
`);

console.log(output);
```

---

## Core concepts

### Facts

A fact is an RDF-like triple:

```n3
:Socrates a :Human .
:Human rdfs:subClassOf :Mortal .
```

Each triple has a subject, predicate, and object. Eyeling supports IRIs, prefixed names, literals, blank nodes, variables, lists, and quoted formulas in the supported N3 subset.

### Forward rules

A forward rule uses `=>`:

```n3
{ ?s a ?class . ?class rdfs:subClassOf ?super . }
=>
{ ?s a ?super . } .
```

Read it as: if the body is provable, derive the head.

### Backward rules

A backward rule uses `<=`:

```n3
{ ?x :moreInterestingThan ?y . }
<=
{ ?x math:greaterThan ?y . } .
```

Read it as: to prove the head, prove the body.

Backward rules are especially useful for derived predicates, reusable definitions, and built-in-backed computations that should not be materialized until needed.

### Built-ins

Built-ins are predicates implemented by the engine. Examples include:

```n3
(2 3 5) math:sum ?total .
"Hello Eyeling" string:contains "Eye" .
(1 2 3) list:length ?n .
```

Built-ins are used in rule bodies to test conditions, bind variables, inspect formulas, format strings, work with lists, perform numeric operations, or dereference content.

### Query output

Eyeling supports `log:query` as an output-selection mechanism. A program can derive a full closure internally and emit only the results selected by query-style rules.

For human-readable text output, use `log:outputString`:

```n3
@prefix : <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

:run :value "hello" .

{ :run :value ?text }
=>
{ :run log:outputString ?text } .
```

The CLI renders the `log:outputString` values directly:

```text
hello
```

---

## Command-line interface

The CLI is exposed as `eyeling` and backed by `bin/eyeling.cjs`, which loads the bundled `eyeling.js` runtime.

```bash
eyeling [options] [file-or-url.n3|- ...]
```

When no file is given and stdin is piped, Eyeling reads from stdin. When multiple inputs are given, Eyeling parses each source separately, merges the ASTs, and reasons once over the merged document.

### Common commands

Run a local file:

```bash
eyeling examples/socrates.n3
```

Pipe a program from stdin:

```bash
cat examples/socrates.n3 | eyeling
```

Use explicit stdin:

```bash
eyeling - < examples/socrates.n3
```

Run facts and rules from separate files:

```bash
eyeling facts.n3 rules.n3
```

Print proof explanations:

```bash
eyeling --proof examples/socrates.n3
```

Print the parsed AST:

```bash
eyeling --ast examples/socrates.n3
```

Enable RDF/TriG compatibility mode:

```bash
eyeling --rdf data.trig rules.n3
```

Process an RDF Message Log one message at a time:

```bash
eyeling --rdf --stream-messages rules.n3 messages.trig
```

Run an eyelang program through the bundled second engine:

```bash
eyeling --engine eyelang examples/eyelang/ancestor.pl
```

### CLI options

| Option | Meaning |
|---|---|
| `-a`, `--ast` | Print the parsed AST as JSON and exit. |
| `--builtin <module.js>` | Load a custom N3 built-in module. Repeatable. |
| `--engine <n3\|eyelang>` | Select the default N3 engine or route the remaining arguments to the eyelang engine. |
| `-d`, `--deterministic-skolem` | Make `log:skolem` stable across reasoning runs. |
| `-e`, `--enforce-https` | Rewrite `http://` IRIs to `https://` for log dereferencing built-ins. |
| `-h`, `--help` | Show help and exit. |
| `-p`, `--proof` | Enable proof explanations. |
| `-r`, `--rdf` | Enable RDF/TriG input and output compatibility. |
| `--stream-messages` | Process RDF Message Logs one message at a time under `--rdf`. |
| `--store <name>` | Use an optional persistent fact store. |
| `--store-clear` | Clear the named persistent store before the run. |
| `--store-path <dir>` | Use a Node.js persistent-store directory. |
| `-s`, `--super-restricted` | Disable all N3 built-ins except implication handling. |
| `-t`, `--stream` | Stream derived triples as soon as they are derived. |
| `-v`, `--version` | Print the package version and exit. |

When `--engine eyelang` is selected, the remaining arguments are handled by the eyelang CLI. Its supported options are `--help`, `--proof`, `--stats`, `--version`, and `--` to stop option parsing. See the [eyelang guide](docs/eyelang-guide.md) for examples.

### Output behavior

The CLI has three important output modes:

1. **Default mode**: derive everything first, then print newly derived triples.
2. **Streaming mode**: with `--stream`, print derived triples as they are found.
3. **Query mode**: when `log:query` rules are present, derive the full closure, then print only query-selected triples.

When `log:outputString` appears in the output set, Eyeling writes the string values directly to stdout. This is useful for examples that generate Markdown, reports, or concise verdicts.

### Exit codes

A rule that derives `false` triggers Eyeling's inference fuse and exits with code `65`. JavaScript API calls expose the same code on thrown errors where applicable.

---

## JavaScript API

Import from the package root for Node.js:

```js
const {
  reason,
  reasonStream,
  runAsync,
  reasonRdfJs,
  rdfjs,
  registerBuiltin,
  unregisterBuiltin,
  registerBuiltinModule,
  loadBuiltinModule,
  listBuiltinIris,
  createFactStore,
  INFERENCE_FUSE_EXIT_CODE,
} = require('eyeling');
```

### `reason(options, input)`

`reason()` is the simplest API. It runs the bundled reasoner in a child process and returns stdout as a string.

```js
const { reason } = require('eyeling');

const out = reason({ proof: false }, `
  @prefix : <http://example.org/> .
  :a :p :b .
  { ?s :p ?o } => { ?s :q ?o } .
`);

console.log(out);
```

Useful options:

| Option | Description |
|---|---|
| `proof` | Include proof explanations when true. Defaults to false for API output. |
| `rdf` | Enable RDF/TriG compatibility mode. |
| `args` | Extra CLI-style arguments. |
| `maxBuffer` | Child-process output buffer limit. |
| `builtinModules` | Custom built-in module path or paths. |
| `store` | Optional persistent store name or options object; passed through to CLI `--store`. |
| `storePath` | Optional Node.js persistent store directory. |
| `storeClear` | Clear the named persistent store before the run. |

`reason()` accepts N3 text, supported RDF-JS input objects, AST bundles, and multi-source inputs.

### Multi-source input

Use `sources` when facts and rules should be parsed as separate documents and then merged:

```js
const { reason } = require('eyeling');

const output = reason({}, {
  sources: [
    '@prefix : <http://example.org/> .\n:Socrates a :Man .\n',
    '@prefix : <http://example.org/> .\n{ ?x a :Man } => { ?x a :Mortal } .\n',
  ],
});
```

Parsing sources separately prevents accidental blank-node label collisions across files.

### `reasonStream(input, options)`

`reasonStream()` runs in process and returns a structured result:

```js
const { reasonStream } = require('eyeling');

const result = reasonStream(`
  @prefix : <http://example.org/> .
  :a :p :b .
  { ?s :p ?o } => { ?s :q ?o } .
`, {
  includeInputFactsInClosure: false,
  onDerived({ triple }) {
    console.log('derived:', triple);
  },
});

console.log(result.closureN3);
```

Result shape:

| Field | Meaning |
|---|---|
| `prefixes` | Prefix environment used for parsing and printing. |
| `facts` | Saturated closure as internal triples. |
| `derived` | Derived facts with explanation metadata. |
| `queryMode` | True when `log:query` output selection was used. |
| `queryTriples` | Query-selected output triples. |
| `queryDerived` | Query-selected derived facts with metadata. |
| `closureN3` | Rendered closure or selected output as N3/TriG-compatible text. |
| `closureQuads` | RDF-JS quads when `rdfjs: true` is used. |
| `queryQuads` | RDF-JS query output quads when available. |

Useful options:

| Option | Description |
|---|---|
| `baseIri` | Base IRI for relative IRI resolution. |
| `proof` | Include proof explanations in `closureN3`. |
| `includeInputFactsInClosure` | Include original facts in `closureN3`. Defaults to true. |
| `onDerived` | Callback called for derived or query-selected output. |
| `enforceHttps` | Apply HTTPS rewriting for dereferencing built-ins. |
| `rdf` | Enable RDF/TriG compatibility mode. |
| `rdfjs` | Also emit RDF-JS quads where conversion is possible. |
| `dataFactory` | Custom RDF-JS DataFactory. |
| `skipUnsupportedRdfJs` | Skip N3-only terms when producing RDF-JS quads. |
| `builtinModules` | Register custom built-ins before reasoning. |

### `runAsync(input, options)`

`runAsync()` is the async execution API. Without a `store` option it keeps the same in-memory behavior as `reasonStream()`, but can also normalize async RDF-JS iterables before reasoning. With `store`, Eyeling opens a named persistent fact store, adds the new explicit facts, reuses facts already present in that store, reasons over the combined closure, and writes newly inferred facts back as inferred facts.

```js
const { runAsync } = require('eyeling');

await runAsync(input); // memory store

await runAsync(input, {
  store: 'my-dataset',
});

await runAsync(input, {
  store: {
    name: 'my-dataset',
    clear: true,
    path: './.eyeling-store', // Node.js path override
  },
});
```

Named persistent stores are created automatically when first opened. Persistent stores use a term dictionary plus `spo`, `pos`, and `osp` triple indexes. Exact lookup and all subject/predicate/object bound-pattern scans are available through the `FactStore` API:

```js
const { createFactStore, rdfjs } = require('eyeling');

const store = await createFactStore({ name: 'my-dataset' });
for await (const triple of store.match(null, rdfjs.namedNode('http://example.org/p'), null)) {
  console.log(triple);
}
await store.close();
```

Node.js uses `classic-level` when it is installed and falls back to a small JSON-file key/value backend for dependency-free use and tests. Browser runtimes use IndexedDB through the same abstraction. The current synchronous `reasonStream()` path remains the default and does not open persistent storage.

CLI equivalents:

```bash
eyeling input.n3
# memory store

eyeling input.n3 --store my-dataset
# persistent store

eyeling input.n3 --store my-dataset --store-clear
# clear persistent store first

eyeling input.n3 --store my-dataset --store-path ./.eyeling-store
# Node.js path override

# Stream line-oriented RDF input into a store without reading one giant string.
eyeling --rdf big.nt --store my-dataset --store-path ./.eyeling-store

# Stream RDF Message Logs one message at a time and persist facts/inferences.
eyeling --rdf --stream-messages rules.n3 messages.trig --store my-dataset
```

### `reasonRdfJs(input, options)`

`reasonRdfJs()` returns an async iterable of derived RDF-JS quads:

```js
const { reasonRdfJs } = require('eyeling');

for await (const quad of reasonRdfJs({
  n3: `
    @prefix : <http://example.org/> .
    :a :p :b .
    { ?s :p ?o } => { ?s :q ?o } .
  `,
})) {
  console.log(quad.subject.value, quad.predicate.value, quad.object.value);
}
```

Use `skipUnsupportedRdfJs: true` when your rules may derive N3-only terms such as quoted formulas that cannot be represented as ordinary RDF-JS quads.

### Browser API

Use the browser entry point in browser or worker runtimes:

```js
import eyeling, { reasonStream } from 'eyeling/browser';

const result = reasonStream(`
  @prefix : <http://example.org/> .
  :a :p :b .
  { ?s :p ?o } => { ?s :q ?o } .
`);

console.log(result.closureN3);
console.log(eyeling.version);
```

The browser entry loads `dist/browser/eyeling.browser.js` and exposes the API through `globalThis.eyeling`.

---

## RDF-JS integration

Eyeling includes a lightweight RDF-JS DataFactory and adapters for supported RDF-JS terms and quads. Its TypeScript declarations reuse the official `@rdfjs/types` interfaces, so Eyeling quads, terms, and data factories can be passed to other RDF-JS libraries without local type casts.

```js
const { reasonStream, rdfjs } = require('eyeling');

const ex = 'http://example.org/';

const input = {
  quads: [
    rdfjs.quad(
      rdfjs.namedNode(`${ex}Socrates`),
      rdfjs.namedNode(`${ex}type`),
      rdfjs.namedNode(`${ex}Man`),
    ),
  ],
  n3: `
    @prefix : <http://example.org/> .
    { ?x :type :Man } => { ?x :type :Mortal } .
  `,
};

const result = reasonStream(input, { rdfjs: true });
console.log(result.closureQuads);
```

TypeScript users can use Eyeling directly with `@rdfjs/types`:

```ts
import type { DataFactory, Quad } from '@rdfjs/types';
import { rdfjs, reasonRdfJs } from 'eyeling';

const ex = 'http://example.org/';
const factory: DataFactory<Quad> = rdfjs;

const facts: Quad[] = [
  factory.quad(
    factory.namedNode(`${ex}Socrates`),
    factory.namedNode(`${ex}type`),
    factory.namedNode(`${ex}Man`),
  ),
];

for await (const quad of reasonRdfJs({
  quads: facts,
  n3: `
    @prefix : <http://example.org/> .
    { ?x :type :Man } => { ?x :type :Mortal } .
  `,
})) {
  const derived: Quad = quad;
  console.log(derived.subject.value, derived.predicate.value, derived.object.value);
}
```

The built-in `rdfjs` factory implements the standard RDF-JS constructors for named nodes, blank nodes, literals, default graph terms, variables, and quads, plus `fromTerm()` and `fromQuad()` clone helpers. `@rdfjs/types` is installed with Eyeling because the public declarations import it.

Supported RDF-JS input terms include named nodes, blank nodes, literals, variables, default graph terms, and default-graph quads. Named-graph input quads are rejected clearly unless handled through N3/TriG compatibility mode.

Use RDF-JS when you want Eyeling to sit inside a JavaScript RDF pipeline. Use raw N3 input when you need N3-only features such as quoted formulas or N3 rules represented directly in source text.

---

## Eyelang second engine

Eyeling can also host the experimental `eyelang` engine. This is deliberately a second engine, not a rewrite of the N3 engine. The package therefore has two eyes:

- the default **N3 engine** for RDF/Notation3 reasoning;
- the **eyelang engine** for compact Prolog-style Horn clause programs.

Use the CLI option when running `.pl` programs:

```bash
eyeling --engine eyelang examples/eyelang/ancestor.pl
```

A paired example shows the same vulnerability-impact scenario in both engines:

```bash
eyeling examples/vulnerability-impact.n3
eyeling --engine eyelang examples/eyelang/vulnerability-impact.pl
```

Use the CommonJS convenience API when the rest of your application already imports `eyeling`:

```js
const { reason, reasonEyelang } = require('eyeling');

const program = `
  materialize(out, 1).
  in(done).
  out(X) :- in(X).
`;

console.log(reason({ engine: 'eyelang' }, program));
console.log(await reasonEyelang(program));
```

Use the subpath export for the full eyelang module API:

```js
import { run, Program, Solver } from 'eyeling/eyelang';

const result = run(program);
console.log(result.stdout);
```

The two engines intentionally keep separate parsers, term models, solvers, and built-ins. Shared package entry points, examples, documentation, and CLI routing make them convenient to use together while keeping their execution models inspectable.

The [eyelang guide](docs/eyelang-guide.md) introduces the CLI, output model, examples, and testing workflow. The [eyelang language reference](docs/eyelang-language-reference.md) defines syntax, terms, clauses, built-ins, declarations, output, and conformance boundaries. Runnable examples live under `examples/eyelang/`. The embedded engine runtime stays under `lib/eyelang/`, while the conformance corpus and test runners live under `test/eyelang/` so runtime code and test assets stay separate:

```bash
npm run test:eyelang        # integration check plus eyelang corpus
npm run test:eyelang:corpus # eyelang corpus only
```

---

## RDF compatibility mode and RDF 1.2

RDF compatibility mode is enabled with `--rdf` on the CLI or `{ rdf: true }` in the API.

Use it when working with RDF/TriG-oriented syntax and RDF 1.2 constructs:

```bash
eyeling --rdf input.trig rules.n3
```

```js
const result = reasonStream(input, { rdf: true });
```

In RDF mode, Eyeling accepts and serializes RDF-compatible forms such as:

- uppercase `PREFIX` and `BASE` directives;
- TriG-style datasets;
- RDF 1.2 triple terms where supported;
- RDF 1.2 annotation syntax after objects;
- RDF Message Log replay syntax under the message-log mode described below.

RDF 1.2 triple terms require explicit RDF compatibility mode. This protects ordinary N3 users from accidentally mixing parser modes.

---

## RDF Message Logs

Eyeling supports RDF Message Logs, including parser-level message delimiters, under RDF compatibility mode.

A message log starts with a message version and separates messages with `MESSAGE`:

```trig
VERSION "1.2-messages"
PREFIX : <https://example.org/messages#>

:obs1 :value 21 .

MESSAGE

# Empty heartbeat message.

MESSAGE

:obs2 :value 22 .
```

Run the message log with rules:

```bash
eyeling --rdf rules.n3 messages.trig
```

For one-message-at-a-time processing:

```bash
eyeling --rdf --stream-messages rules.n3 messages.trig
```

`--stream-messages` can also be combined with `--store` to create/reuse a named store and persist each message's explicit facts and inferred facts while keeping only one replay message in memory at a time:

```bash
eyeling --rdf --stream-messages rules.n3 messages.trig --store my-dataset --store-path ./.eyeling-store
```

Eyeling materializes a replay view under the `eymsg:` vocabulary:

```n3
@prefix eymsg: <https://eyereasoner.github.io/eyeling/vocab/message#> .
```

The replay view includes stream resources, ordered envelopes, offsets, payload kind, and payload graphs. Rules can inspect each payload graph with formula-aware built-ins such as `log:includes`, preserving message boundaries instead of treating all messages as one merged graph.

Important semantics:

- Message boundaries are explicit.
- Empty heartbeat messages are valid.
- Payloads are contextualized by message envelope.
- Blank-node labels are scoped per message.
- Remote text/plain RDF Message Logs can be streamed over HTTP by the CLI.

See the included examples:

```bash
eyeling -r examples/rdf-messages.n3 examples/input/rdf-messages.trig
eyeling -r examples/rdf-message-flow.n3 examples/input/rdf-message-flow.trig
eyeling -r --stream-messages examples/rdf-message-flow.n3 examples/input/rdf-message-flow.trig
eyeling -r --stream-messages examples/alma-rdf-messages.n3 https://ugent-lib-opendata-prd.s3.ugent.be/alma-rdf/rdf-messages.20260404.nt
```

The Alma RDF Message Log example intentionally keeps the message log as a URL, because the source `.nt` file is larger than 9 GB.

---

## Built-ins

Eyeling implements **104 public SWAP-style built-in predicates** for the N3 engine across these namespaces. The authoritative machine-readable catalog is [`eyeling-builtins.ttl`](eyeling-builtins.ttl); this README lists the public names so users do not need to infer support from examples or internal dispatch code.

| Namespace | Count | Built-ins |
|---|---:|---|
| `crypto:` | 4 | `sha`, `md5`, `sha256`, `sha512` |
| `math:` | 26 | `equalTo`, `notEqualTo`, `greaterThan`, `lessThan`, `notLessThan`, `notGreaterThan`, `sum`, `product`, `difference`, `quotient`, `integerQuotient`, `remainder`, `rounded`, `exponentiation`, `absoluteValue`, `acos`, `asin`, `atan`, `sin`, `cos`, `tan`, `sinh`, `cosh`, `tanh`, `degrees`, `negation` |
| `time:` | 8 | `day`, `hour`, `minute`, `month`, `second`, `timeZone`, `year`, `localTime` |
| `list:` | 15 | `append`, `first`, `rest`, `iterate`, `last`, `memberAt`, `remove`, `member`, `in`, `length`, `notMember`, `reverse`, `sort`, `map`, `firstRest` |
| `rdf:` | 2 | `first`, `rest` |
| `log:` | 22 | `equalTo`, `notEqualTo`, `conjunction`, `conclusion`, `content`, `semantics`, `semanticsOrError`, `parsedAsN3`, `rawType`, `dtlit`, `langlit`, `implies`, `impliedBy`, `query`, `includes`, `notIncludes`, `collectAllIn`, `forAllIn`, `skolem`, `uri`, `trace`, `outputString` |
| `string:` | 19 | `concatenation`, `contains`, `containsIgnoringCase`, `endsWith`, `startsWith`, `equalIgnoringCase`, `notEqualIgnoringCase`, `greaterThan`, `lessThan`, `notGreaterThan`, `notLessThan`, `matches`, `notMatches`, `replace`, `scrape`, `format`, `length`, `charAt`, `setCharAt` |
| `dt:` | 8 | `datatype`, `lexicalForm`, `language`, `validForDatatype`, `invalidForDatatype`, `sameValueAs`, `differentValueFrom`, `canonicalLiteral` |
| **Total** | **104** |  |

The catalog marks each built-in with a coarse kind: `ex:Test`, `ex:Function`, `ex:Relation`, `ex:Generator`, `ex:IO`, `ex:Meta`, or `ex:SideEffect`.

### Datatype built-ins

Eyeling provides datatype built-ins in the namespace `https://eyereasoner.github.io/eyeling/datatype#`, usually used with the prefix `dt:`. They are intended for declarative datatype reasoning in N3 rule sets, including OWL 2 RL-style rules that need XSD value-space semantics without hard-coding OWL into the engine.

Supported operations include:

- `dt:datatype`, `dt:lexicalForm`, and `dt:language` for literal inspection. `dt:datatype` returns the literal's actual datatype IRI only, so RDF string literals return `xsd:string`; it does not return `rdfs:Literal`, which is a class of literals rather than a datatype IRI;
- `dt:validForDatatype` and `dt:invalidForDatatype` for lexical validity and datatype membership checks, either as `?literal dt:validForDatatype ?datatype` tests or as tuple-to-boolean checks like `(?literal ?datatype) dt:validForDatatype true`;
- `dt:sameValueAs` and `dt:differentValueFrom` for value-space equality and inequality;
- `dt:canonicalLiteral` for canonical literal production.

The built-ins use strict datatype lexical validation for these checks, including exact dateTime rollover/canonicalization such as `24:00:00` normalizing to the following day. They cover RDF language strings, `rdf:PlainLiteral`, `rdf:XMLLiteral`, `rdfs:Literal`, and the OWL 2 RL-relevant XSD set: `xsd:string`, `xsd:normalizedString`, `xsd:token`, `xsd:language`, `xsd:Name`, `xsd:NCName`, `xsd:NMTOKEN`, `xsd:boolean`, `xsd:decimal`, `xsd:integer` and its bounded integer subtypes, `xsd:float`, `xsd:double`, `xsd:hexBinary`, `xsd:base64Binary`, `xsd:anyURI`, `xsd:dateTime`, and `xsd:dateTimeStamp`. Lexical validation is intentionally strict for conformance: string-derived datatypes with whitespace-collapse facets must already be written in canonical collapsed lexical form, `xsd:float` and `xsd:double` enforce finite value ranges, `xsd:anyURI` rejects spaces, unsafe delimiters, and malformed percent escapes, and XML literals must be well-formed XML fragments.

### Numeric built-ins

Numeric built-ins support common XSD numeric literals. Integer-oriented operations use `BigInt` where possible, with safety limits to avoid accidental memory exhaustion. Date/time comparisons and timestamp arithmetic are supported for relevant operations.

### List built-ins

Eyeling supports both native N3 list terms and materialized RDF collections. Anonymous `rdf:first`/`rdf:rest` collections can be materialized into list terms, while named list nodes keep their identity.

### Formula and log built-ins

Formula-aware built-ins make Eyeling useful for meta-reasoning. `log:includes`, `log:notIncludes`, `log:collectAllIn`, and `log:forAllIn` prove goals inside formula scopes. `log:query` selects output triples, while `log:outputString` writes selected string values directly to stdout.

`log:semantics`, `log:content`, and related built-ins may dereference sources. Use `--enforce-https` or `{ enforceHttps: true }` in environments where HTTP-to-HTTPS rewriting is required.

### eyelang built-ins

The eyelang engine has its own built-in registry under `lib/eyelang/builtins/`. These are separate from the N3 namespaces above and are called as ordinary eyelang predicates. See the [eyelang language reference](docs/eyelang-language-reference.md#9-standard-built-in-predicates) for the portable profile. The bundled implementation currently registers 68 name/arity entries across 66 predicate names:

| Family | Count | Built-ins |
|---|---:|---|
| Core and host | 4 | `eq/2`, `neq/2`, `local_time/1`, `difference/3` |
| Arithmetic and comparison | 21 | `neg/2`, `abs/2`, `sin/2`, `cos/2`, `asin/2`, `acos/2`, `rounded/2`, `log/2`, `add/3`, `sub/3`, `mul/3`, `div/3`, `mod/3`, `min/3`, `pow/3`, `lt/2`, `gt/2`, `le/2`, `ge/2`, `between/3`, `smallest_divisor_from/3` |
| Strings | 5 | `str_concat/3`, `contains/2`, `matches/2`, `matches/3`, `not_matches/2` |
| Lists | 10 | `append/3`, `nth0/3`, `set_nth0/4`, `rest/2`, `member/2`, `select/3`, `not_member/2`, `reverse/2`, `length/2`, `sort/2` |
| Aggregation | 5 | `findall/3`, `countall/2`, `sumall/3`, `aggregate_min/5`, `aggregate_max/5` |
| Control | 2 | `not/1`, `once/1` |
| Context terms | 2 | `holds/2`, `holds/3` |
| Search and optimization helpers | 9 | `n_queens/2`, `weighted_hamiltonian_cycle/4`, `weighted_hamiltonian_path/4`, `hamiltonian_cycle/3`, `fixed_length_cycle/4`, `bounded_path/5`, `cnf_model/3`, `qm_prime_implicants/4`, `qm_minimal_cover/4` |
| Numeric extension helpers | 4 | `extended_gcd/5`, `collatz_trajectory/2`, `kaprekar_steps/2`, `goldbach_pair/3` |
| Matrix helpers | 6 | `matrix_sum/2`, `matrix_multiply/2`, `cholesky_decomposition/2`, `determinant/2`, `matrix_inv_triang/2`, `matrix_inversion/2` |
| **Total** | **68** |  |

## Custom built-ins

Custom built-ins let applications extend Eyeling without modifying the core engine.

### CLI module

Create `hello-builtin.js`:

```js
module.exports = ({ registerBuiltin, internLiteral, unifyTerm, terms }) => {
  const { Var } = terms;

  registerBuiltin('http://example.org/custom#hello', ({ goal, subst }) => {
    const value = internLiteral('"world"');

    if (goal.o instanceof Var) {
      return [{ ...subst, [goal.o.name]: value }];
    }

    const next = unifyTerm(goal.o, value, subst);
    return next === null ? [] : [next];
  });
};
```

Use it:

```bash
eyeling --builtin ./hello-builtin.js program.n3
```

Program:

```n3
@prefix : <http://example.org/> .
@prefix cb: <http://example.org/custom#> .

{ :x cb:hello ?value }
=>
{ :x :value ?value } .
```

Expected derived output:

```n3
:x :value "world" .
```

### API registration

```js
const { registerBuiltin, reason } = require('eyeling');

registerBuiltin('http://example.org/custom#always', ({ subst }) => [subst]);

const out = reason({}, `
  @prefix : <http://example.org/> .
  @prefix cb: <http://example.org/custom#> .

  { :x cb:always true } => { :x :ok true } .
`);
```

### Module shapes

`registerBuiltinModule()` accepts these shapes:

```js
// Function form
module.exports = (api) => {
  api.registerBuiltin('http://example.org/custom#p', handler);
};
```

```js
// Object with register()
module.exports = {
  register(api) {
    api.registerBuiltin('http://example.org/custom#p', handler);
  },
};
```

```js
// Builtin map
module.exports = {
  'http://example.org/custom#p': handler,
};
```

```js
// Builtin map under builtins/default
module.exports = {
  builtins: {
    'http://example.org/custom#p': handler,
  },
};
```

Handlers must return an array of substitution deltas. Return an empty array for failure and `[subst]` for success without new bindings.

---

## Reasoning model

Eyeling combines forward saturation with backward proving.

At a high level:

```text
parse sources
  ↓
normalize terms, rules, and lists
  ↓
initialize fact set
  ↓
repeat until no new facts appear:
  for each forward rule:
    prove the rule body with the backward prover
    for each solution:
      instantiate and add the rule head
  activate any newly derived rules
  stop if false is derived
  ↓
render derived output, query-selected output, proof output, or strings
```

### Forward chaining

Forward rules are the outer control loop. They gradually saturate the fact set by adding ground consequences.

```n3
{ ?x :parent ?y }
=>
{ ?x :ancestor ?y } .

{ ?x :parent ?y . ?y :ancestor ?z }
=>
{ ?x :ancestor ?z } .
```

### Backward proving

The backward prover solves rule bodies. It can match current facts, use backward rules, and invoke built-ins. This lets forward rules depend on predicates that are computed on demand.

```n3
{ ?x :interestingComparedWith ?y }
<=
{ ?x math:greaterThan ?y } .

{ 5 :interestingComparedWith 3 }
=>
{ :example :works true } .
```

### Dynamic rules

Eyeling treats top-level `log:implies` and `log:impliedBy` as rule forms and can activate derived implication facts as live rules during reasoning. This supports programs that derive rules as part of their logic.

### Duplicate control and fixpoints

Derived facts are indexed and deduplicated. Saturation stops when no rule can add a new fact. This avoids echoing already-known facts and keeps recursive programs such as transitive closure finite when the closure is finite.

### Negative entailment and the inference fuse

If a rule derives `false`, Eyeling treats that as a reasoning failure and exits with `INFERENCE_FUSE_EXIT_CODE`, which is `65`.

```n3
{ :policy :violated true } => false .
```

Use this pattern for integrity constraints, policy failures, and tests that should fail when an unwanted condition is provable.

---

## Architecture

Eyeling is organized as a set of small modules under `lib/` plus packaging and browser glue.

### Execution pipeline

```text
input text / RDF-JS / AST
        │
        ▼
lib/lexer.js       tokenization and RDF compatibility normalization
        │
        ▼
lib/parser.js      N3/TriG-ish parser to internal AST
        │
        ▼
lib/multisource.js source-level parsing and AST merging
        │
        ▼
lib/prelude.js     term model, triples, rules, prefixes, namespaces
        │
        ▼
lib/engine.js      forward chain, backward prover, rule activation
        │
        ├── lib/builtins.js  built-in predicates and custom registry
        ├── lib/deref.js     dereferencing helpers
        ├── lib/skolem.js    skolemization helpers
        ├── lib/time.js      date/time helpers
        └── lib/trace.js     tracing support
        │
        ▼
lib/printing.js / lib/explain.js
        │
        ▼
CLI output, API result, proof document, RDF-JS quads, or browser result
```

### Key modules

| Path | Responsibility |
|---|---|
| `index.js` | Public Node package API. Wraps CLI bundle for `reason()` and exports in-process APIs. |
| `bin/eyeling.cjs` | Executable CLI shim. |
| `lib/entry.js` | Bundle entry that exposes public APIs and selected playground internals. |
| `lib/cli.js` | CLI argument handling, source loading, syntax errors, stream message mode. |
| `lib/engine.js` | Core reasoning engine, proof collection, stream APIs, RDF-JS output hooks. |
| `lib/store.js` | Optional async fact-store abstraction with memory and persistent backends. |
| `lib/builtins.js` | Built-in predicates, custom built-in registry, helper API. |
| `lib/lexer.js` | Lexer and compatibility normalization. |
| `lib/parser.js` | Parser for supported N3/RDF syntax. |
| `lib/prelude.js` | Core term classes, namespaces, triples, rules, prefix environment. |
| `lib/multisource.js` | Parse several documents independently and merge their ASTs. |
| `lib/rdfjs.js` | RDF-JS DataFactory and conversion adapters. |
| `lib/printing.js` | N3/TriG-compatible rendering. |
| `lib/explain.js` | Proof and explanation rendering. |
| `lib/deref.js` | Dereferencing support for log built-ins. |
| `lib/skolem.js` | Deterministic skolem term construction. |
| `lib/time.js` | Date/time parsing and formatting helpers. |
| `tools/bundle.js` | Builds `eyeling.js` and the browser bundle. |

### Public surfaces

Eyeling deliberately has a small public API:

- `reason()` for simple Node use;
- `reasonStream()` for structured in-process reasoning;
- `reasonRdfJs()` for async RDF-JS output;
- `rdfjs` for a built-in data factory;
- custom built-in registration functions;
- `INFERENCE_FUSE_EXIT_CODE` for callers that need to distinguish logical failure from ordinary runtime failure.

Everything else should be treated as internal unless explicitly documented.

---

## Repository layout

```text
.
├── README.md                 Project overview, user guide, and maintainer guide
├── LICENSE.md                MIT license
├── package.json              Package metadata, scripts, exports, engine range
├── index.js                  Node API entry
├── index.d.ts                TypeScript declarations
├── eyeling.js                Bundled Node runtime and CLI target
├── eyeling-builtins.ttl      Built-in catalog in RDF
├── bin/                      CLI executable shim
├── lib/                      Source modules
├── dist/browser/             Browser bundle and ESM wrapper
├── docs/                     Project documentation, including the eyelang guide and language reference
├── examples/                 N3 examples, eyelang examples, RDF message inputs, and generated decks
├── spec/                     RDF 1.2 parser test adapter
├── test/                     API, built-in, store, example, package, playground, and stream tests
├── tools/                    Build tooling
├── playground.html           Browser playground
└── demo.html                 Simple browser demo
```

The package publishes the source modules, tests, examples, bundled runtime, browser bundle, declarations, README, license, and built-in catalog.

---

## Examples guide

The repository contains more than two hundred N3 examples under `examples/`, eyelang `.pl` examples under `examples/eyelang/`, RDF Message input files under `examples/input/`, and presentation-oriented Markdown decks under `examples/deck/`. See the [eyelang guide](docs/eyelang-guide.md#example-catalog) for the eyelang example catalog.

### Good first examples

| Example | What it demonstrates |
|---|---|
| `examples/socrates.n3` | Basic class inference. |
| `examples/backward.n3` | Backward rule proving with a math built-in. |
| `examples/age.n3` | Literal propagation. |
| `examples/family-cousins.n3` | Multi-hop relational inference. |
| `examples/dijkstra.n3` | Graph/path reasoning. |
| `examples/vulnerability-impact.n3` and `examples/eyelang/vulnerability-impact.pl` | Paired N3 and eyelang dependency-risk example. |
| `examples/list-map.n3` | List processing. |
| `examples/string-builtins-tests.n3` | String built-ins. |
| `examples/math-builtins-tests.n3` | Numeric built-ins. |
| `examples/rdf-messages.n3` | RDF Message Log replay. |
| `examples/context-schema-audit.n3` | Quoted-context schema validation with `log:includes` and list arity checks. |

### Running all examples through tests

```bash
npm run test:examples
```

Proof-only example checks:

```bash
npm run test:examples:proof
```

### Output-generating examples

Many advanced examples use `log:outputString` to emit Markdown reports. This keeps the logical derivation and presentation in one N3 program. Run them from the CLI and redirect stdout when needed:

```bash
eyeling examples/rdf-message-flow.n3 examples/input/rdf-message-flow.trig > report.md
```

---

## Testing and quality checks

Package scripts are defined in `package.json`.

### Core scripts

| Script | Purpose |
|---|---|
| `npm run build` | Rebuild `eyeling.js` and browser artifacts. |
| `npm run test:packlist` | Verify the package file list. |
| `npm run test:api` | Run API and stream-message API tests. |
| `npm run test:builtins` | Validate custom built-in contracts. |
| `npm run test:examples` | Run example corpus tests. |
| `npm run test:examples:proof` | Run proof-output checks for examples. |
| `npm run test:manifest` | Validate example/test manifest expectations. |
| `npm run test:playground` | Check playground serving headers. |
| `npm run test:package` | Verify package-level behavior. |
| `npm run test:store` | Verify memory and persistent fact-store matching. |
| `npm run test:rdf12` | Run RDF 1.2 Turtle, N-Triples, N-Quads, and TriG syntax suites. |
| `npm test` | Build and run the full suite. |

### Recommended local check before committing

Use the full test suite as the authoritative project check:

```bash
npm test
```

For quick API-level feedback during development:

```bash
npm run build
npm run test:api
npm run test:builtins
```

### What the tests cover

The tests exercise:

- parsing edge cases and syntax errors;
- forward and backward chaining;
- recursion and transitive closure;
- duplicate suppression;
- negative entailment and fuse behavior;
- proof output;
- lists and RDF collection materialization;
- `log:outputString` rendering;
- AST output;
- multi-source parsing;
- RDF-JS input and output;
- custom built-ins;
- RDF 1.2 compatibility mode;
- RDF Message Log parsing and streaming;
- package exports and browser playground behavior.

---

## Development workflow

### Prerequisites

- Node.js 18 or newer.
- npm.

### Install dependencies

```bash
npm install
```

### Build bundles

```bash
npm run build
```

This regenerates:

- `eyeling.js`
- `dist/browser/eyeling.browser.js`
- `dist/browser/index.mjs`

### Edit source

Most logic lives in `lib/`. Prefer small, focused changes:

1. Update or add tests first when fixing behavior.
2. Modify the relevant source module.
3. Rebuild bundles.
4. Run the targeted test script.
5. Run `npm test` before committing or publishing.

### Add a built-in

1. Implement behavior in `lib/builtins.js` or as an external custom built-in.
2. Add contract tests in `test/builtins.test.js` or behavior tests in `test/api.test.js`.
3. Document the built-in in `eyeling-builtins.ttl`.
4. Add at least one runnable example if the built-in is user-facing.

### Add a parser feature

1. Add focused parser tests for accepted and rejected syntax.
2. Update `lib/lexer.js` and/or `lib/parser.js`.
3. Ensure output rendering in `lib/printing.js` remains valid.
4. Add RDF compatibility tests if the feature is RDF/TriG-specific.

### Add an example

A good example should include:

- clear prefixes;
- a short comment block explaining the scenario;
- facts separated from rules when practical;
- deterministic output;
- `log:outputString` only when human-readable report output is intended;
- a test expectation when the example is part of the checked corpus.

---

## Publishing and release notes

The package metadata publishes Eyeling to npm with:

- CommonJS root export;
- browser export;
- TypeScript declarations;
- CLI binary;
- examples, tests, bundles, and built-in catalog.

The repository includes GitHub workflows for pages, npm publishing, RDF 1.2 compliance, and releases.

Before versioning or publishing:

```bash
npm test
npm version patch   # or minor / major
```

The `preversion` script runs the full test suite. The `postversion` script pushes the branch and tags.

---

## Troubleshooting

### The CLI prints help instead of running

Eyeling prints help when no positional input is provided and stdin is interactive. Provide a file, URL, `-`, or pipe data into stdin.

```bash
eyeling examples/socrates.n3
cat examples/socrates.n3 | eyeling
eyeling - < examples/socrates.n3
```

### RDF 1.2 syntax fails to parse

Enable RDF compatibility mode:

```bash
eyeling --rdf input.trig
```

or:

```js
reasonStream(input, { rdf: true });
```

### `--stream-messages` fails immediately

`--stream-messages` requires RDF mode and cannot be combined with `--ast`, `--stream`, or proof output. It can be combined with `--store`.

Use:

```bash
eyeling --rdf --stream-messages rules.n3 messages.trig
```

### A rule did not fire

Check the following:

- Are prefixes identical between facts and rules?
- Did the rule body require a fact that is only available after another rule fires?
- Is a built-in being used in the correct direction?
- Does the rule depend on RDF mode syntax without `--rdf`?
- Are blank nodes scoped as intended across multiple source files?
- Is the desired output an input fact rather than a newly derived fact?

For debugging, try `--proof` or create a smaller reproduction with only the relevant facts and rule.

### Output contains no input facts

Default CLI output prints newly derived facts. Use `reasonStream()` with `includeInputFactsInClosure: true` when you need the complete closure including input facts.

### RDF-JS conversion fails

Some N3 terms cannot be represented as ordinary RDF-JS quads. Use:

```js
reasonStream(input, { rdfjs: true, skipUnsupportedRdfJs: true });
```

or keep the N3 rendering in `closureN3`.

### A program exits with code 65

A rule derived `false`. This is usually an integrity constraint or policy failure, not a parser error.

### Remote dereferencing behaves unexpectedly

Use `--enforce-https` or `{ enforceHttps: true }` when policy requires HTTPS. Also ensure the runtime has network access and that the remote source returns a supported RDF/N3-compatible content type.

---

## Security and operational notes

### Custom built-ins execute JavaScript

Custom built-ins are code. Only load built-in modules you trust. In server environments, do not allow arbitrary users to provide `--builtin` paths or dynamically registered handlers.

### Dereferencing can access remote content

`log:semantics`, `log:content`, and related built-ins may dereference IRIs. Treat this like network I/O:

- use HTTPS where possible;
- avoid dereferencing untrusted URLs in privileged environments;
- apply external network restrictions when running untrusted programs;
- consider `--super-restricted` for highly constrained execution.

### Reasoning can be computationally expensive

Recursive rules, generators, large joins, and high-cardinality facts can produce large closures. Eyeling includes duplicate suppression and safety caps for some operations, but application-level limits are still important for untrusted workloads.

### Proof output may reveal source details

Proof output can include source file labels and line references. Avoid exposing proof documents directly when source paths or input details are sensitive.

---

## Glossary

| Term | Meaning |
|---|---|
| AST | Abstract syntax tree produced by parsing N3/RDF input. |
| Backward chaining | Goal-directed proving: to prove a goal, prove supporting facts/rules/built-ins. |
| Built-in | Predicate implemented by JavaScript code rather than by input facts alone. |
| Closure | The set of facts available after reasoning reaches a fixpoint. |
| Derived fact | A fact added by a rule, not directly present as an input fact. |
| Fact | A triple asserted in the input or derived during reasoning. |
| Forward chaining | Saturation strategy that repeatedly applies rules to derive new facts. |
| Formula | A quoted graph-like N3 term that can be inspected by formula built-ins. |
| IRI | Internationalized Resource Identifier used to identify resources and predicates. |
| N3 | Notation3, an RDF-compatible notation with rules and formulas. |
| Prefix environment | Mapping from short prefixes such as `:` or `math:` to full IRI bases. |
| RDF-JS | JavaScript interface conventions for RDF terms, quads, and data factories. |
| RDF Message Log | Ordered record of RDF messages separated by message delimiters. |
| Skolemization | Replacing existential blank nodes with generated identifiers. |
| Substitution | Mapping from variables to terms during proof search. |
| Triple | Subject-predicate-object statement. |
