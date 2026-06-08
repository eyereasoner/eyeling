# RDF/JS integration in Eyeling

## Short version

Eyeling still reasons over its normal N3 data model. RDF/JS support is an adapter layer:

```text
RDF/JS quads, RDF/JS Quad terms, N3 text, or Eyeling rule objects
        ↓
lib/rdfjs.js input normalization
        ↓
Eyeling N3 triples/rules, including GraphTerm and log:nameOf encodings
        ↓
normal parser + reasoner
        ↓
N3 output and, when requested, RDF/JS quads
```

The important RDF 1.2 mappings are:

```text
RDF/JS Quad term in subject/object position
        ↔ singleton N3 GraphTerm
        ↔ RDF 1.2 triple term

RDF/JS named graph quad
        ↔ graph log:nameOf { ... }
        ↔ TriG-style named graph output/input
```

So RDF/JS is now aligned with the same internal representation used by Eyeling's RDF 1.2/TriG compatibility mode.

## Public API pieces

```js
const {
  reason,
  reasonStream,
  reasonRdfJs,
  rdfjs,
} = require('eyeling');
```

- `rdfjs` is Eyeling's lightweight RDF/JS-style `DataFactory`.
- `reasonStream(input, { rdfjs: true })` returns the normal structured result plus RDF/JS quad arrays.
- `reasonRdfJs(input, opts)` returns an async iterable of derived RDF/JS quads.
- `dataFactory` can be supplied in options to use another RDF/JS factory.

## Lightweight DataFactory

`lib/rdfjs.js` defines small RDF/JS-compatible term classes:

- `NamedNode`
- `BlankNode`
- `Literal`
- `Variable`
- `DefaultGraph`
- `Quad`

Example:

```js
const { rdfjs } = require('eyeling');

const ex = 'http://example.org/';
const s = rdfjs.namedNode(ex + 's');
const p = rdfjs.namedNode(ex + 'p');
const o = rdfjs.literal('hello');
const q = rdfjs.quad(s, p, o, rdfjs.defaultGraph());
```

Each term has `termType`, `value`, and `equals(other)`. Literals also carry `language` and `datatype`. `defaultGraph()` returns a singleton default graph term.

## RDF/JS input forms

Eyeling accepts RDF/JS quads through any of these object keys:

```js
{ quads: iterableOfQuads }
{ facts: iterableOfQuads }
{ dataset: iterableOfQuads }
```

The iterable may be synchronous for `reasonStream()` and may be synchronous or asynchronous for `reasonRdfJs()`.

Accepted RDF/JS term types are:

- `NamedNode`
- `BlankNode`
- `Literal`
- `Variable`
- `Quad` in subject or object position
- `DefaultGraph` only as a quad graph

`Quad` terms are rejected in predicate position, because RDF triple terms are not valid RDF predicates. A `Quad` term used as a quoted triple term must itself have the default graph.

## Default graph input quads

A normal RDF/JS quad:

```js
rdfjs.quad(
  rdfjs.namedNode('http://example.org/s'),
  rdfjs.namedNode('http://example.org/p'),
  rdfjs.literal('hello'),
)
```

becomes the N3 fact:

```n3
<http://example.org/s> <http://example.org/p> "hello" .
```

and internally:

```js
Triple(
  Iri('http://example.org/s'),
  Iri('http://example.org/p'),
  Literal('"hello"')
)
```

Language and datatype literals are preserved:

```n3
"hello"@en
"42"^^<http://www.w3.org/2001/XMLSchema#integer>
```

## Named graph input quads

Named graph RDF/JS quads are now accepted.

Input:

```js
rdfjs.quad(
  rdfjs.namedNode('http://example.org/s'),
  rdfjs.namedNode('http://example.org/p'),
  rdfjs.namedNode('http://example.org/o'),
  rdfjs.namedNode('http://example.org/g'),
)
```

is represented internally as the same shape used for TriG compatibility:

```n3
<http://example.org/g> log:nameOf {
  <http://example.org/s> <http://example.org/p> <http://example.org/o> .
} .
```

Multiple input quads with the same graph are grouped into one `log:nameOf` graph term:

```n3
:g log:nameOf {
  :s1 :p :o1 .
  :s2 :p :o2 .
} .
```

On RDF/JS output, this `log:nameOf` representation expands back to RDF/JS quads with the corresponding `graph` term.

## RDF/JS `Quad` terms as RDF 1.2 triple terms

RDF/JS `Quad` terms in subject or object position are now accepted as RDF 1.2 quoted triple terms.

Input:

```js
const quoted = rdfjs.quad(
  rdfjs.namedNode('http://example.org/s'),
  rdfjs.namedNode('http://example.org/p'),
  rdfjs.namedNode('http://example.org/o'),
);

rdfjs.quad(
  rdfjs.namedNode('http://example.org/obs'),
  rdfjs.namedNode('http://example.org/about'),
  quoted,
);
```

is normalized to a singleton N3 graph term:

```n3
<http://example.org/obs> <http://example.org/about> {
  <http://example.org/s> <http://example.org/p> <http://example.org/o> .
} .
```

With RDF compatibility output enabled, the same structure can print as RDF 1.2 triple-term syntax:

```turtle
<http://example.org/obs> <http://example.org/about> <<(
  <http://example.org/s> <http://example.org/p> <http://example.org/o>
)>> .
```

Internally, the object is:

```js
GraphTerm([
  Triple(Iri(s), Iri(p), Iri(o))
])
```

This is the same representation used by the lexer when `<<( s p o )>>` is parsed in RDF compatibility mode.

## Mixing `{ quads, n3 }`

The object form implied by the README is now supported: RDF/JS quads and N3 text are merged before reasoning.

Example:

```js
const { reasonStream, rdfjs } = require('eyeling');
const ex = 'http://example.org/';

const result = reasonStream(
  {
    n3: `
      @prefix : <http://example.org/> .
      { ?x :p ?y } => { ?x :q ?y } .
    `,
    quads: [
      rdfjs.quad(
        rdfjs.namedNode(ex + 'a'),
        rdfjs.namedNode(ex + 'p'),
        rdfjs.namedNode(ex + 'b'),
      ),
    ],
  },
  {
    rdfjs: true,
    includeInputFactsInClosure: false,
  },
);

console.log(result.closureN3);
console.log(result.closureQuads);
```

The RDF/JS fact supplies `:a :p :b`; the N3 rule derives `:a :q :b`.

The merge also works with Eyeling rule objects and RDF/JS facts. In that path, `normalizeParsedReasonerInputSync()` or `normalizeParsedReasonerInputAsync()` builds an Eyeling document and appends the RDF/JS quads as facts.

## RDF/JS output from `reasonStream()`

When `rdfjs: true` is passed to `reasonStream()`, the result can include:

```js
result.closureQuads
result.queryQuads
```

The `onDerived` callback receives RDF/JS quads too:

```js
reasonStream(input, {
  rdfjs: true,
  onDerived({ triple, quad, quads, df }) {
    console.log(triple); // N3 or RDF-compatible text form
    console.log(quad);   // first RDF/JS quad when exactly/conveniently available
    console.log(quads);  // all RDF/JS quads emitted for this derived fact
  },
});
```

A single internal triple can produce more than one RDF/JS quad when it is a `log:nameOf` named-graph wrapper, so the plural `quads` payload is the complete form. `quad` is present when there is exactly one emitted quad.

## Output conversion rules

The normal output path now uses `internalTripleToRdfJsQuads()`.

Ordinary terms map directly:

```text
Iri      → NamedNode
Blank    → BlankNode
Literal  → Literal
Var      → Variable
```

Singleton graph terms in subject or object position map to RDF/JS `Quad` terms:

```n3
:x :holds { :s :p :o } .
```

becomes an RDF/JS quad whose object is:

```js
rdfjs.quad(
  rdfjs.namedNode('http://example.org/s'),
  rdfjs.namedNode('http://example.org/p'),
  rdfjs.namedNode('http://example.org/o'),
  rdfjs.defaultGraph(),
)
```

Named graph wrappers map back to named-graph RDF/JS quads:

```n3
:g log:nameOf {
  :s :p :o .
} .
```

becomes:

```js
rdfjs.quad(s, p, o, g)
```

## Remaining N3-only cases

`skipUnsupportedRdfJs` is still useful, but the previous RDF 1.2 cases no longer require it.

Still unsupported as ordinary RDF/JS output:

- non-singleton `GraphTerm` in subject/object position;
- `GraphTerm` in predicate or graph position;
- `ListTerm` and `OpenListTerm`;
- other N3-only terms that do not have an RDF/JS representation.

By default, unsupported output raises a conversion error. With:

```js
skipUnsupportedRdfJs: true
```

Eyeling keeps the N3 result and omits the unsupported RDF/JS quads from `closureQuads`, `queryQuads`, and `onDerived` payloads.

## `reasonRdfJs()`

`reasonRdfJs(input, opts)` returns an async iterable of derived RDF/JS quads:

```js
const { reasonRdfJs, rdfjs } = require('eyeling');

for await (const quad of reasonRdfJs({
  quads: [
    rdfjs.quad(
      rdfjs.namedNode('http://example.org/a'),
      rdfjs.namedNode('http://example.org/p'),
      rdfjs.namedNode('http://example.org/b'),
    ),
  ],
  n3: `
    @prefix : <http://example.org/> .
    { ?x :p ?y } => { ?x :q ?y } .
  `,
})) {
  console.log(quad.subject.value, quad.predicate.value, quad.object.value);
}
```

Internally, `reasonRdfJs()`:

1. normalizes the input, collecting async RDF/JS input if necessary;
2. runs `reasonStream()` on the normalized N3/Eyeling document;
3. converts each derived fact with `internalTripleToRdfJsQuads()`;
4. yields all resulting RDF/JS quads.

It is an async output interface, not a streaming RDF parser. Async input quads are collected before reasoning starts.

## Practical summary

Use RDF/JS integration when Eyeling needs to sit inside a JavaScript RDF pipeline:

- feed default-graph or named-graph RDF/JS quads as facts;
- use RDF/JS `Quad` terms for RDF 1.2 triple terms in subject/object positions;
- mix RDF/JS facts with N3 text using `{ quads, n3 }`;
- request RDF/JS output with `rdfjs: true` or `reasonRdfJs()`;
- keep `skipUnsupportedRdfJs: true` only for genuinely N3-only terms such as lists or non-singleton formulas.
