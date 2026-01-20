# Eyeling Manual

This manual is for **users** of the Eyeling Notation3 (N3) reasoner: how to run it, how to write inputs that work well in Eyeling, what the outputs mean, and how to embed Eyeling in your own code.

If you want to understand Eyeling’s implementation internals, see [HANDBOOK](https://github.com/eyereasoner/eyeling/blob/main/HANDBOOK.md).

---

## What Eyeling does

Eyeling reads an N3 document containing:

- **facts** (RDF-like triples), and
- **rules** written using N3 implication operators (`=>` and `<=`),

and derives consequences.

Eyeling mixes two styles:

- **Forward chaining** for `=>` rules (materializes new facts).
- **Backward chaining** for `<=` rules and for many built-in predicates (solves goals to produce bindings; doesn’t necessarily materialize facts).

Eyeling’s command-line output is **only the newly derived forward facts** (not the whole closure, and not your input facts).

---

## Install

### Option A — use `npx` (no install)

```bash
npx eyeling --help
npx eyeling yourfile.n3
```

### Option B — install globally

```bash
npm install -g eyeling
eyeling yourfile.n3
```

### Option C — install in a project

```bash
npm install eyeling
```

Then use either:

```bash
npx eyeling yourfile.n3
```

or run the bundled CLI directly:

```bash
node node_modules/eyeling/eyeling.js yourfile.n3
```

**Requirements:** Node.js **>= 18**.

---

## Quick start

Create a file `demo.n3`:

```n3
@prefix : <http://example.org/> .

{ ?x :parent ?y } => { ?x :ancestor ?y } .

:alice :parent :bob .
```

Run:

```bash
eyeling demo.n3
```

Expected output (prefixes may vary):

```n3
@prefix : <http://example.org/> .

:alice :ancestor :bob .
```

---

## Command line reference

### Synopsis

```bash
eyeling [options] <file.n3>
```

### Options

- `-h, --help`  
  Show help.

- `-v, --version`  
  Print version.

- `-a, --ast`  
  Print the parsed AST as JSON and exit (debugging).

- `-p, --proof-comments`  
  Print a proof/explanation block (as `# ...` comments) before each derived triple.

- `-t, --stream`  
  Stream derived triples as soon as they’re derived (useful for large outputs).

- `-r, --strings`  
  Print the concatenation of all `log:outputString` values (ordered by key) instead of N3 triples.

- `-e, --enforce-https`  
  When dereferencing IRIs for `log:content` / `log:semantics` / `log:semanticsOrError`, rewrite `http://...` to `https://...`.

- `-s, --super-restricted`  
  Disable **all** builtins except `=>` and `<=` (i.e., only `log:implies` and `log:impliedBy` are treated as builtins).  
  This is a “safer” mode: no I/O dereferencing, no time/crypto/string helpers, etc.

- `-d, --deterministic-skolem`  
  Make `log:skolem` stable across separate runs (legacy behavior).  
  See **Skolemization** below.

---

## Input language: what to write

Eyeling supports a practical N3 subset centered around Horn-style rules.

### Prefixes and IRIs

Use Turtle/N3 prefixes:

```n3
@prefix ex: <http://example.org/> .
@base <http://example.org/base/> .
```

### Facts (triples)

A fact is a triple ending with `.`:

```n3
ex:alice ex:knows ex:bob .
ex:alice ex:age 23 .
```

### Variables and blank nodes

- Variables: `?x`, `?person`
- Blank nodes: `_:controller` (or other blank labels)

In forward rules, blank nodes in the **head** act like existentials and are typically skolemized (see below).

### Lists

Eyeling supports N3 list syntax:

```n3
(1 2 3) .
( ?x "hello" ) .
```

Many list-related operations are available via `list:*` builtins.

### Formulas (quoted graphs)

Curly braces denote a quoted graph/formula:

```n3
{ ?x ex:parent ?y } .
```

Rules use formulas on the left/right of `=>` and `<=`.

### Forward rules (`=>`)

Forward rules materialize new facts:

```n3
{ ?x ex:parent ?y . ?y ex:parent ?z } => { ?x ex:grandparent ?z } .
```

### Backward rules (`<=`)

Backward rules are used to *prove* goals (produce bindings), which can then drive forward rules and builtins:

```n3
{ ?x ex:ancestor ?z } <= { ?x ex:parent ?z } .
{ ?x ex:ancestor ?z } <= { ?x ex:parent ?y . ?y ex:ancestor ?z } .
```

A key idea: backward rules may be used during reasoning without necessarily printing anything—only **derived forward facts** are printed.

### `true` and `false` endpoints

Eyeling supports two common N3 idioms:

- **Unconditional rules** using `true` as the premise:

  ```n3
  true => { <http://example.org/> ex:loaded "yes" } .
  ```

- **Inference fuse / constraint** using `false` as the conclusion:

  ```n3
  { ?x ex:age ?n . ?n math:lessThan 0 } => false .
  ```

  If such a rule’s premise becomes provable, Eyeling prints a message and exits with a non-zero code.

---

## Output: what Eyeling prints

### Default mode

Eyeling prints:

1. (Some) `@prefix ...` declarations for readability, and
2. Each **newly derived forward triple** as N3.

It does **not** print your input facts again.

### Proof comments

With `--proof-comments`, each derived triple is preceded by a proof block, for example:

- the rule used,
- the instantiated premises, and
- the variable bindings used.

These are printed as comment lines (`# ...`) so the output remains valid N3.

### Streaming mode

With `--stream`, derived triples are printed immediately as they are found. This is useful if:

- you expect a lot of output,
- you want progressive feedback, or
- you are piping into another tool.

### `log:outputString` mode

With `--strings`, Eyeling:

1. saturates the fact store, then
2. collects all facts of the form:

```n3
<key> log:outputString "some text" .
```

…and prints the concatenation of those strings, ordered by the `<key>`.

This is handy for producing text outputs deterministically from a reasoning run.

> Note: `log:outputString` itself does not print immediately; it’s collected at the end for `--strings`.

---

## Skolemization and `log:skolem`

### Existentials in forward-rule heads

When a forward rule head contains blank nodes, Eyeling skolemizes them so the derived facts are ground.

Example:

```n3
@prefix : <http://example.org/> .
{ :alice :wantsPet true } => { :alice :hasPet _:p . _:p :kind :Cat } .
:alice :wantsPet true .
```

### `log:skolem` behavior

Eyeling’s `log:skolem` builtin maps a **subject term** to a generated Skolem IRI.

Default behavior (recommended):

- Within **one** reasoning run: the same subject → the same Skolem IRI.
- Across **different** reasoning runs: the same subject → a different Skolem IRI (per-run salt).

To force the legacy “stable across runs” behavior:

- Use `--deterministic-skolem` (`-d`).

This can be useful for tests and for workflows that compare outputs across runs.

---

## Builtins

Eyeling implements a set of builtins in the following namespaces:

**See also**
- W3C N3 Built-ins overview (semantics/background): https://w3c.github.io/N3/reports/20230703/builtins.html
- Eyeling implementation notes: https://github.com/eyereasoner/eyeling/blob/main/HANDBOOK.md#ch11

- `log:` — logic/meta, rule operators, dereferencing, tracing, output strings
- `math:` — numeric functions and comparisons
- `string:` — string and regex utilities (including JSON pointer helpers)
- `list:` — list utilities
- `time:` — time helpers
- `crypto:` — hashing helpers
- `rdf:` — RDF list accessors

### Builtin “kinds” (rough guide)

The builtins file classifies builtins roughly as:

- **Test**: succeeds/fails (no new bindings).
- **Function**: computes a value (often binds an output variable).
- **Generator**: produces multiple solutions/bindings.
- **Relation/Meta**: structural/logical helpers (formulas, implication, inclusion).
- **IO**: dereferences and parses remote resources (network / file / URL).
- **SideEffect**: affects traces/output collection.

If you need to lock the system down, use `--super-restricted` to disable all builtins except implication.

### Full builtin list (as shipped)

### `crypto:`

- `crypto:md5` (Function)
- `crypto:sha` (Function)
- `crypto:sha256` (Function)
- `crypto:sha512` (Function)

### `list:`

- `list:append` (Function)
- `list:first` (Function)
- `list:firstRest` (Function)
- `list:in` (Generator)
- `list:iterate` (Generator)
- `list:last` (Function)
- `list:length` (Function)
- `list:map` (Function)
- `list:member` (Generator)
- `list:memberAt` (Generator)
- `list:notMember` (Test)
- `list:remove` (Function)
- `list:rest` (Function)
- `list:reverse` (Function)
- `list:sort` (Function)

### `log:`

- `log:collectAllIn` (Function)
- `log:conclusion` (Meta)
- `log:conjunction` (Meta)
- `log:content` (IO)
- `log:dtlit` (Function)
- `log:equalTo` (Relation)
- `log:forAllIn` (Test)
- `log:impliedBy` (Relation)
- `log:implies` (Relation)
- `log:includes` (Generator)
- `log:langlit` (Function)
- `log:notEqualTo` (Test)
- `log:notIncludes` (Test)
- `log:outputString` (SideEffect)
- `log:parsedAsN3` (Meta)
- `log:rawType` (Meta)
- `log:semantics` (IO)
- `log:semanticsOrError` (IO)
- `log:skolem` (Function)
- `log:trace` (SideEffect)
- `log:uri` (Function)

### `math:`

- `math:absoluteValue` (Function)
- `math:acos` (Function)
- `math:asin` (Function)
- `math:atan` (Function)
- `math:cos` (Function)
- `math:cosh` (Function)
- `math:degrees` (Function)
- `math:difference` (Function)
- `math:equalTo` (Test)
- `math:exponentiation` (Function)
- `math:greaterThan` (Test)
- `math:integerQuotient` (Function)
- `math:lessThan` (Test)
- `math:negation` (Function)
- `math:notEqualTo` (Test)
- `math:notGreaterThan` (Test)
- `math:notLessThan` (Test)
- `math:product` (Function)
- `math:quotient` (Function)
- `math:remainder` (Function)
- `math:rounded` (Function)
- `math:sin` (Function)
- `math:sinh` (Function)
- `math:sum` (Function)
- `math:tan` (Function)
- `math:tanh` (Function)

### `rdf:`

- `rdf:first` (Function)
- `rdf:rest` (Function)

### `string:`

- `string:concatenation` (Function)
- `string:contains` (Test)
- `string:containsIgnoringCase` (Test)
- `string:endsWith` (Test)
- `string:equalIgnoringCase` (Test)
- `string:format` (Function)
- `string:greaterThan` (Test)
- `string:jsonPointer` (Function)
- `string:lessThan` (Test)
- `string:matches` (Test)
- `string:notEqualIgnoringCase` (Test)
- `string:notGreaterThan` (Test)
- `string:notLessThan` (Test)
- `string:notMatches` (Test)
- `string:replace` (Function)
- `string:scrape` (Function)
- `string:startsWith` (Test)

### `time:`

- `time:day` (Function)
- `time:hour` (Function)
- `time:localTime` (Function)
- `time:minute` (Function)
- `time:month` (Function)
- `time:second` (Function)
- `time:timeZone` (Function)
- `time:year` (Function)

---

## Debugging and troubleshooting

### Parse errors

Syntax errors are reported with:

- a message,
- the line text, and
- a caret pointing at the error location.

### Inspect the AST

Use:

```bash
eyeling --ast yourfile.n3
```

to see how Eyeling parsed the input.

### Tracing from rules

Use `log:trace` in rule bodies to emit trace lines to **stderr**. This keeps traces separate from the N3 output on stdout.

### Determinism tips

If you need repeatable outputs:

- avoid `time:*` builtins (time changes),
- avoid dereferencing builtins (`log:content`, `log:semantics`, …) unless inputs are stable,
- use `--deterministic-skolem` if you rely on `log:skolem` being identical across runs.

---

## Embedding Eyeling in JavaScript

### Simple: `reason(opts, input) -> string`

When installed as a dependency:

```js
const { reason } = require('eyeling');

const input = `
@prefix : <http://example.org/> .
{ ?x :p ?y } => { ?y :q ?x } .
:a :p :b .
`;

const out = reason({ args: [] }, input);
console.log(out);
```

This runs the bundled CLI under the hood and returns stdout (derived triples).

You can pass any CLI flags via `opts.args`, for example:

```js
const out = reason({ args: ['--strings'] }, input);
```

### Advanced: `reasonStream(n3Text, opts) -> object`

The bundle also exposes a direct API (no subprocess). In Node:

```js
const { reasonStream } = require('eyeling/eyeling.js');

const res = reasonStream(n3Text, {
  baseIri: null,
  proof: false,                 // like --proof-comments
  enforceHttps: false,          // like --enforce-https
  includeInputFactsInClosure: true,
  onDerived: ({ triple, df }) => {
    // streaming callback
  }
});

console.log(res.closureN3);      // closure as N3 (input + derived by default)
console.log(res.derived.length); // how many new facts
```

Returned fields:

- `prefixes`: parsed prefix environment
- `facts`: saturated closure facts (as Triple objects)
- `derived`: derived facts (as DerivedFact objects)
- `closureN3`: closure serialized as N3

### Browser / Worker

When you load the bundled `eyeling.js` in a browser context, it exposes `self.eyeling` (or `window.eyeling`), including `reasonStream`.

See `demo.html` in the repository for a working example.

---

## Practical tips for writing fast rules

- Prefer **selective predicates** in rule bodies (helps indexing).
- Avoid giant “all-pairs” joins unless you really need them.
- If you’re producing huge output, consider `--stream`.
- Use `--super-restricted` for untrusted inputs (prevents I/O and most side effects).

---

## Where to look next

- **Examples:** see [examples](https://github.com/eyereasoner/eyeling/blob/main/examples/)
- **Builtins file:** [eyeling-builtins](https://github.com/eyereasoner/eyeling/blob/main/eyeling-builtins.ttl)
- **Implementation handbook:** [HANDBOOK](https://github.com/eyereasoner/eyeling/blob/main/HANDBOOK.md)
