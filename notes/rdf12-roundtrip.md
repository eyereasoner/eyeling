# Eyeling RDF 1.2 Compatibility Mode and Roundtripping

## Summary

Eyeling does **not** implement RDF 1.2 as a separate internal data model. RDF/TriG compatibility is an opt-in **syntax-normalization layer** in `lib/lexer.js`.

When parsing with RDF mode enabled, Eyeling rewrites RDF 1.2/TriG surface syntax into ordinary N3 syntax. The normal parser and reasoner then operate on Eyeling's existing N3 AST. On output, `lib/printing.js` can print some N3 graph terms back as RDF 1.2 triple terms.

The flow is:

```text
RDF 1.2 / TriG input
  -- lex(input, { rdf: true }) / normalizeRdfCompatibility() -->
normalized N3 text
  -- Parser -->
Eyeling N3 AST
  -- reasoner -->
derived N3 facts
  -- tripleToRdfCompatible() -->
RDF-compatible output
```

## Main internal representation

RDF 1.2 triple terms are represented as **singleton N3 graph terms**.

Input:

```turtle
:obs rdf:reifies <<( :s :p :o )>> .
```

Normalized N3:

```n3
:obs rdf:reifies { :s :p :o } .
```

Conceptual AST shape:

```js
Triple(
  Iri(':obs'),
  Iri('rdf:reifies'),
  GraphTerm([
    Triple(Iri(':s'), Iri(':p'), Iri(':o'))
  ])
)
```

So the core mapping is:

```text
<<( S P O )>>  <=>  { S P O }
```

But internally, Eyeling keeps only the N3 side: a `GraphTerm` containing one `Triple`.

## Reifier sugar

RDF 1.2 reifier syntax is desugared by `convertTripleTerms()` in `lib/lexer.js`.

Input:

```turtle
<< :s :p :o ~ :r >> :source :doc .
```

Normalized shape:

```n3
{ :s :p :o } :source :doc .
:r <http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies> { :s :p :o } .
```

So the reifier is preserved structurally, but not as a special AST node. It becomes an ordinary `rdf:reifies` triple whose object is the singleton graph term.

## Annotation syntax

Annotation syntax is handled by `convertAnnotations()` in `lib/lexer.js`.

Input:

```turtle
:s :p :o ~ :r {| :source :doc |} .
```

Normalized N3:

```n3
:s :p :o .
:r <http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies> { :s :p :o } .
:r :source :doc .
```

If an annotation block exists without an explicit reifier, the lexer generates a blank node such as `_:rdfAnnotation1`.

## TriG named graphs

TriG-style named graph blocks are normalized by `normalizeNamedGraphs()`.

Input:

```trig
:g {
  :s :p :o .
}
```

Normalized N3:

```n3
:g <http://www.w3.org/2000/10/swap/log#nameOf> {
  :s :p :o .
} .
```

A top-level default graph block is unwrapped:

```trig
{
  :s :p :o .
}
```

becomes:

```n3
:s :p :o .
```

## Reasoning model

After normalization, RDF 1.2 constructs are ordinary N3 terms. For example, this rule can match reified RDF 1.2 triples:

```n3
{ ?r rdf:reifies { ?s ?p ?o } }
=>
{ ?r :mentionsSubject ?s } .
```

That works because the RDF triple term has already become an N3 graph term.

## Output and roundtrip

RDF-compatible output is implemented in `lib/printing.js` by:

- `termToRdfCompatible()`
- `tripleToRdfCompatible()`
- `rdfCompatibleGraphBlock()`

A `GraphTerm` is printed back as an RDF 1.2 triple term only if it is a singleton graph containing one RDF-compatible triple:

```js
GraphTerm([
  Triple(subject, predicate, object)
])
```

with:

```text
subject   = IRI or blank node
predicate = IRI
object    = IRI, blank node, or literal
```

Then:

```n3
:obs rdf:reifies { :s :p :o } .
```

can print as:

```turtle
:obs rdf:reifies <<( :s :p :o )>> .
```

And:

```n3
:g log:nameOf {
  :s :p :o .
} .
```

can print as:

```trig
:g {
    :s :p :o .
}
```

## What roundtrip means

The roundtrip is **structural**, not lexical.

Eyeling can roundtrip the meaning of RDF 1.2 triple terms through its N3 representation:

```text
RDF 1.2 triple term
  <<( :s :p :o )>>

N3 internal representation
  { :s :p :o }

RDF-compatible output
  <<( :s :p :o )>>
```

But it does not preserve exact source spelling, whitespace, prefix layout, or whether the user originally wrote explicit `rdf:reifies`, triple-term sugar, or annotation syntax.

## Limitations

Only singleton graph terms that are RDF-compatible are printed back as `<<( ... )>>`.

These remain ordinary N3 graph terms on output:

```n3
{ :s :p :o . :x :y :z . }
```

because the graph has more than one triple.

Also, graph terms containing N3-only constructs, variables, or nested formula objects are not valid RDF 1.2 triple terms and therefore remain N3.

## One-line takeaway

Eyeling maps RDF 1.2 triple terms to singleton N3 `GraphTerm`s, maps TriG named graphs to `log:nameOf` triples, reasons over the normal N3 AST, and prints singleton RDF-compatible graph terms back as `<<( ... )>>` when possible.
