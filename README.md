# eyeling

A [Notation3 (N3)](https://notation3.org/) reasoner in **JavaScript**.

`eyeling` is:

- a single self-contained file (`eyeling.js`, no external deps)
- a practical N3/Turtle superset (enough for lots of real rulesets)
- supports forward (`=>`) + backward (`<=`) chaining over Horn-style rules
- prints only newly derived forward facts, optionally preceded by compact proof comments
- can report derived triples as they are produced (streaming callback via `reasonStream`)
- “pass-only-new” style output (we never want to leak raw input data; backward rules can act like “functions” over raw data)
- works fully client-side (browser) and in Node.js

## Playground

Try it here:

- [Eyeling playground](https://eyereasoner.github.io/eyeling/demo)
- [Eyeling streaming playground](https://eyereasoner.github.io/eyeling/stream)

The playground runs `eyeling` client-side. You can:

- edit an N3 program directly
- load an N3 program from a URL (in the "Load N3 from URL" box or as ?url=...)
- share a link with the program encoded in the URL fragment (`#...`)

## Quick start

### Requirements

- Node.js >= 18 (anything modern with `BigInt` support is fine)

### Install

```bash
npm i eyeling
```

### CLI

Run on a file:

```bash
npx eyeling examples/socrates.n3
```

(Or install globally: `npm i -g eyeling` and run `eyeling ...`.)

### JavaScript API

```js
const { reason } = require("eyeling");

const input = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix : <http://example.org/socrates#>.

:Socrates a :Human.
:Human rdfs:subClassOf :Mortal.

{ ?S a ?A. ?A rdfs:subClassOf ?B } => { ?S a ?B }.
`;

const output = reason({ proofComments: false }, input);
console.log(output);
```

ESM:

```js
import eyeling from "eyeling";
const output = eyeling.reason({ proofComments: false }, input);
console.log(output);
```

Streaming (browser/worker, direct `eyeling.js`):

```js
const { closureN3 } = eyeling.reasonStream(input, {
  proof: false,
  onDerived: ({ triple }) => console.log(triple),
});
```

Note: the API currently shells out to the bundled `eyeling.js` CLI under the hood (simple + robust).

## Testing

From a repo checkout:

```bash
npm test
```

Or run individual suites:

```bash
npm run test:api
npm run test:examples
npm run test:package
npm run test:packlist
```

- `test:api` runs an independent JS API test suite (does not rely on `examples/`).
- `test:examples` runs the examples in the `examples` directory and compares against the golden outputs in `examples/output`.
- `test:package` does a “real consumer” smoke test: `npm pack` → install tarball into a temp project → run API + CLI + examples.
- `test:packlist` sanity-checks what will be published in the npm tarball (and the CLI shebang/bin wiring).

### Usage

```
Usage: eyeling [options] <file.n3>

Options:
  -h, --help              Show this help and exit.
  -v, --version           Print version and exit.
  -p, --proof-comments    Enable proof explanations.
  -n, --no-proof-comments Disable proof explanations (default).
  -s, --super-restricted  Disable all builtins except => and <=.
  -a, --ast               Print parsed AST as JSON and exit.
  --strings               Print log:outputString strings (ordered by key) instead of N3 output.
```

By default, `eyeling`:

1. parses the input (facts + rules)
2. runs **forward chaining to a fixpoint**
3. prints only **newly derived forward facts** (not the original input facts)
4. prints a compact per-triple explanation as `#` comments (can be disabled)

## What output do I get?

For each newly derived triple, `eyeling` prints:

1. a proof-style comment block explaining why the triple holds (unless `-n`), and then
2. the triple itself in N3/Turtle syntax.

The proof comments are compact “local justifications” per derived triple (not a single exported global proof tree).

## Reasoning model

### Forward + backward chaining

- **Forward chaining to fixpoint** for forward rules written as `{ P } => { C } .`
- **Backward chaining (SLD-style)** for backward rules written as `{ H } <= { B } .` and for built-ins.

Forward rule premises are proved using:

- ground facts (input + derived)
- backward rules
- built-ins

The CLI prints only newly derived forward facts.

### Performance notes

`eyeling` includes a few key performance mechanisms:

- facts are indexed for matching:
  - by predicate, and (when possible) by **(predicate, object)** (important for type-heavy workloads)
- IRIs/literals are interned to reduce allocations and speed up comparisons/lookups
- parsed numeric literals are cached, and rule standardization reuses unchanged subterms to cut repeated parsing/allocation
- duplicate detection uses a fast key path when a triple is fully IRI/Literal-shaped
- backward rules are indexed by head predicate
- the backward prover is **iterative** (explicit stack), so deep chains won’t blow the JS call stack
- for very deep backward chains, substitutions may be compactified (semantics-preserving) to avoid quadratic “copy a growing substitution object” behavior

## Blank nodes and quantification

`eyeling` follows the usual N3 intuition:

1. blank nodes in facts are normal RDF blanks (`_:b1`, `_:b2`, … within a run)
2. blank nodes in rule premises behave like rule-scoped universals (similar to variables)
3. blank nodes only in rule conclusions behave like existentials: each rule firing generates fresh Skolem blanks (`_:sk_0`, `_:sk_1`, …)

Equal facts up to renaming of Skolem IDs are treated as duplicates and are not re-added.

## Rule-producing rules aka meta-rules

`eyeling` understands the `log:implies` / `log:impliedBy` idiom.

Top level:

- `{ P } log:implies { C } .` becomes a forward rule `{ P } => { C } .`
- `{ H } log:impliedBy { B } .` becomes a backward rule `{ H } <= { B } .`

During reasoning:

- any **derived** `log:implies` / `log:impliedBy` triple with formula subject/object is turned into a new live forward/backward rule.

## Inference fuse

Rules whose conclusion is `false` are treated as hard failures:

```n3
:stone :color :black .
:stone :color :white .

{ ?X :color :black . ?X :color :white . } => false.
```

As soon as the premise is provable, `eyeling` exits with status code `2`.

## Syntax + built-ins

`eyeling`’s parser targets (nearly) the full *Notation3 Language* grammar from the [W3C N3 Community Group spec](https://w3c.github.io/N3/spec/).

In practice this means: it’s a Turtle superset that also accepts quoted formulas, rules, paths, and the N3 “syntax shorthand”
operators (`=`, `=>`, `<=`) described in the spec.

Commonly used N3/Turtle features:

- Prefix/base directives (`@prefix` / `@base`, and SPARQL-style `PREFIX` / `BASE`)
- Triples with `;` and `,`
- Variables (`?x`)
- Blank nodes (`[]`, and `[ :p :o; :q :r ]`)
- Collections `( ... )`
- Quoted formulas `{ ... }`
- Implications (`=>`, `<=`)
- Datatyped literals (`^^`) and language tags (`"..."@en`)
- Inverse predicate sugar (`<-` and keyword forms like `is ... of`)
- Resource paths (`!` and `^`)
- `#` line comments

`eyeling` implements a pragmatic subset of common N3 builtin families and evaluates them during backward goal proving:

- **crypto**: `crypto:md5` `crypto:sha` `crypto:sha256` `crypto:sha512`
- **list**: `list:append` `list:first` `list:firstRest` `list:in` `list:iterate` `list:last` `list:length` `list:map` `list:member` `list:memberAt` `list:notMember` `list:remove` `list:rest` `list:reverse` `list:sort`
- **log**: `log:collectAllIn` `log:content` `log:dtlit` `log:equalTo` `log:forAllIn` `log:impliedBy` `log:implies` `log:includes` `log:langlit` `log:notEqualTo` `log:notIncludes` `log:outputString` `log:parsedAsN3` `log:rawType` `log:semantics` `log:semanticsOrError` `log:skolem` `log:trace` `log:uri`
- **math**: `math:absoluteValue` `math:acos` `math:asin` `math:atan` `math:cos` `math:cosh` `math:degrees` `math:difference` `math:equalTo` `math:exponentiation` `math:greaterThan` `math:integerQuotient` `math:lessThan` `math:negation` `math:notEqualTo` `math:notGreaterThan` `math:notLessThan` `math:product` `math:quotient` `math:remainder` `math:rounded` `math:sin` `math:sinh` `math:sum` `math:tan` `math:tanh`
- **string**: `string:concatenation` `string:contains` `string:containsIgnoringCase` `string:endsWith` `string:equalIgnoringCase` `string:format` `string:greaterThan` `string:jsonPointer` `string:lessThan` `string:matches` `string:notEqualIgnoringCase` `string:notGreaterThan` `string:notLessThan` `string:notMatches` `string:replace` `string:scrape` `string:startsWith`
- **time**: `time:day` `time:hour` `time:localTime` `time:minute` `time:month` `time:second` `time:timeZone` `time:year`

## License

MIT (see [LICENSE](https://github.com/eyereasoner/eyeling/blob/main/LICENSE.md)).

