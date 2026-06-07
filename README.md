# eyeling

[![npm version](https://img.shields.io/npm/v/eyeling.svg)](https://www.npmjs.com/package/eyeling)
[![DOI](https://img.shields.io/badge/DOI-10.5281%2Fzenodo.19068086-blue.svg)](https://doi.org/10.5281/zenodo.19068086)

A compact [Notation3 (N3)](https://notation3.org/) reasoner in **JavaScript**.

<table>
<tr>
<td style="background-color: #eef7ff; padding: 16px; border-radius: 6px;">
Eyeling aims to make knowledge itself computationally accountable, so every conclusion can be derived, checked, and explained. It does this by keeping reasoning close to explicit facts, rules, and proofs rather than hidden assumptions or opaque workflows. As a compact Notation3 reasoner for JavaScript, Eyeling is designed to fit into practical systems while remaining inspectable enough for researchers, engineers, and agents to understand why a result follows. The ambition is not just to process data, but to support a culture of verifiable knowledge: conclusions that can be exchanged, reproduced, challenged, and improved.
</td>
</tr>
</table>

Eyeling is characterized by:

- **Notation3 reasoning in a small JavaScript package** — facts, quoted formulas, and N3 rules are parsed and reasoned over directly.
- **Forward and backward chaining** — `=>` rules derive new facts, while `<=` rules act as goal-directed definitions.
- **Backward proving inside forward rules** — forward-rule bodies are solved with the backward engine, so rules can use derived predicates and built-ins without materializing everything first.
- **Built-ins in rule bodies** — N3 programs can combine logical rules with computations such as math, string, list, time, and web-oriented predicates.
- **Streaming RDF Messages** — supports RDF Messages streams, enabling Eyeling to fit into streaming RDF pipelines.
- **Node.js, npm, and browser use** — run it from the command line, call it from JavaScript, or use the browser-oriented bundle.
- **RDF-JS interoperability** — use N3 text, RDF-JS quads, datasets, or Eyeling’s own AST-level API.


This README is the primary guide to using, extending, and maintaining Eyeling.

| Project fact | Value |
|---|---|
| Package | `eyeling` |
| Runtime | Node.js `>=18` |
| License | MIT |
| Main entry point | `index.js` |
| CLI binary | `eyeling` |
| Browser entry point | `eyeling/browser` |

Eyeling is designed for people who want a small, inspectable reasoner that can run N3 rules in Node.js, the browser, tests, and RDF-oriented data pipelines.

## Project links

- [Playground](https://eyereasoner.github.io/eyeling/playground)
- [Conformance report](https://codeberg.org/phochste/notation3tests/src/branch/main/reports/report.md)

---

## Table of contents

1. [What Eyeling is](#what-eyeling-is)
2. [Quick start](#quick-start)
3. [Core concepts](#core-concepts)
4. [Command-line interface](#command-line-interface)
5. [JavaScript API](#javascript-api)
6. [RDF-JS integration](#rdf-js-integration)
7. [RDF compatibility mode and RDF 1.2](#rdf-compatibility-mode-and-rdf-12)
8. [RDF Message Logs](#rdf-message-logs)
9. [Built-ins](#built-ins)
10. [Custom built-ins](#custom-built-ins)
11. [Reasoning model](#reasoning-model)
12. [Architecture](#architecture)
13. [Repository layout](#repository-layout)
14. [Examples guide](#examples-guide)
15. [Testing and quality checks](#testing-and-quality-checks)
16. [Development workflow](#development-workflow)
17. [Publishing and release notes](#publishing-and-release-notes)
18. [Troubleshooting](#troubleshooting)
19. [Security and operational notes](#security-and-operational-notes)
20. [Glossary](#glossary)

---

## What Eyeling is

Eyeling is a compact [Notation3](https://notation3.org/) reasoner implemented in JavaScript.

It accepts facts and rules written in N3-style syntax, computes the logical consequences of those rules, and emits newly derived results. It can be used as:

- a command-line tool through `npx eyeling` or the `eyeling` binary;
- a CommonJS API from Node.js through `require('eyeling')`;
- a browser/worker API through `eyeling/browser`;
- an RDF-JS adapter for applications that work with quads and data factories;
- a streaming tool for RDF Message Logs.

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

### CLI options

| Option | Meaning |
|---|---|
| `-a`, `--ast` | Print the parsed AST as JSON and exit. |
| `--builtin <module.js>` | Load a custom built-in module. Repeatable. |
| `-d`, `--deterministic-skolem` | Make `log:skolem` stable across reasoning runs. |
| `-e`, `--enforce-https` | Rewrite `http://` IRIs to `https://` for log dereferencing built-ins. |
| `-h`, `--help` | Show help and exit. |
| `-p`, `--proof` | Enable proof explanations. |
| `-r`, `--rdf` | Enable RDF/TriG input and output compatibility. |
| `--stream-messages` | Process RDF Message Logs one message at a time under `--rdf`. |
| `-s`, `--super-restricted` | Disable all built-ins except implication handling. |
| `-t`, `--stream` | Stream derived triples as soon as they are derived. |
| `-v`, `--version` | Print the package version and exit. |

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
  reasonRdfJs,
  rdfjs,
  registerBuiltin,
  unregisterBuiltin,
  registerBuiltinModule,
  loadBuiltinModule,
  listBuiltinIris,
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

Eyeling includes a lightweight RDF-JS DataFactory and adapters for supported RDF-JS terms and quads.

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

Supported RDF-JS input terms include named nodes, blank nodes, literals, variables, default graph terms, and default-graph quads. Named-graph input quads are rejected clearly unless handled through N3/TriG compatibility mode.

Use RDF-JS when you want Eyeling to sit inside a JavaScript RDF pipeline. Use raw N3 input when you need N3-only features such as quoted formulas or N3 rules represented directly in source text.

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
```

---

## Built-ins

Eyeling implements SWAP-style built-ins across these namespaces:

| Namespace | Examples | Purpose |
|---|---|---|
| `crypto:` | `sha`, `md5`, `sha256`, `sha512` | Hashing. |
| `math:` | `sum`, `product`, `difference`, `greaterThan`, `sin`, `cos` | Numeric computation and comparison. |
| `time:` | `year`, `month`, `day`, `localTime` | `xsd:dateTime` helpers. |
| `list:` | `first`, `rest`, `member`, `length`, `map`, `sort` | N3 and RDF list operations. |
| `rdf:` | `first`, `rest` | Aliases for list traversal over RDF collections. |
| `log:` | `includes`, `notIncludes`, `semantics`, `conclusion`, `query`, `outputString` | Formula, dereferencing, query, and output operations. |
| `string:` | `contains`, `matches`, `replace`, `format`, `length` | String tests and transformations. |

The authoritative built-in catalog is `eyeling-builtins.ttl`. It documents each built-in as RDF, including its kind:

- `ex:Test`: succeeds or fails without necessarily binding variables;
- `ex:Function`: computes an output and may bind variables;
- `ex:Relation`: unification-based relation;
- `ex:Generator`: may yield multiple solutions;
- `ex:IO`: may dereference or parse external content;
- `ex:Meta`: operates on formulas or types;
- `ex:SideEffect`: produces output.

### Numeric built-ins

Numeric built-ins support common XSD numeric literals. Integer-oriented operations use `BigInt` where possible, with safety limits to avoid accidental memory exhaustion. Date/time comparisons and timestamp arithmetic are supported for relevant operations.

Example:

```n3
@prefix : <http://example.org/> .
@prefix math: <http://www.w3.org/2000/10/swap/math#> .

{
  (2 3 5) math:sum ?total .
}
=>
{
  :calculation :total ?total .
} .
```

### List built-ins

Eyeling supports both native N3 list terms and materialized RDF collections. Anonymous `rdf:first`/`rdf:rest` collections can be materialized into list terms, while named list nodes keep their identity.

Example:

```n3
@prefix : <http://example.org/> .
@prefix list: <http://www.w3.org/2000/10/swap/list#> .

{
  ("red" "green" "blue") list:length ?n .
}
=>
{
  :palette :size ?n .
} .
```

### Formula and log built-ins

Formula-aware built-ins make Eyeling useful for meta-reasoning:

```n3
@prefix : <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

:doc :graph { :alice :knows :bob } .

{
  :doc :graph ?g .
  ?g log:includes { :alice :knows ?person } .
}
=>
{
  :doc :mentions ?person .
} .
```

`log:semantics`, `log:content`, and related built-ins may dereference sources. Use `--enforce-https` or `{ enforceHttps: true }` in environments where HTTP-to-HTTPS rewriting is required.

---

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
├── examples/                 N3 examples, RDF message inputs, and generated decks
├── spec/                     RDF 1.2 parser test adapter
├── test/                     API, built-in, example, package, playground, and stream tests
├── tools/                    Build tooling
├── playground.html           Browser playground
└── demo.html                 Simple browser demo
```

The package publishes the source modules, tests, examples, bundled runtime, browser bundle, declarations, README, license, and built-in catalog.

---

## Examples guide

The repository contains more than two hundred N3 examples under `examples/`, plus RDF Message input files under `examples/input/` and presentation-oriented Markdown decks under `examples/deck/`.

### Good first examples

| Example | What it demonstrates |
|---|---|
| `examples/socrates.n3` | Basic class inference. |
| `examples/backward.n3` | Backward rule proving with a math built-in. |
| `examples/age.n3` | Literal propagation. |
| `examples/family-cousins.n3` | Multi-hop relational inference. |
| `examples/dijkstra.n3` | Graph/path reasoning. |
| `examples/list-map.n3` | List processing. |
| `examples/string-builtins-tests.n3` | String built-ins. |
| `examples/math-builtins-tests.n3` | Numeric built-ins. |
| `examples/rdf-messages.n3` | RDF Message Log replay. |

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
| `npm run rdf12` | Run RDF 1.2 Turtle, N-Triples, N-Quads, and TriG syntax suites. |
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

`--stream-messages` requires RDF mode and cannot be combined with `--ast`, `--stream`, or proof output.

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
