# RDF Message Logs internals

Eyeling handles RDF Message Logs as an RDF-compatibility replay step. A message log is not parsed as one flat graph first; it is split into message chunks and exposed as ordinary N3 facts that describe the stream, its ordered message envelopes, and each message payload graph. Common line-oriented logs use the fast RDF AST builder in `lib/fast_rdf.js`; richer RDF/TriG inputs fall back to the normalization path in `lib/lexer.js`.

There are two replay modes:

- normal RDF mode, where a whole message log becomes one replay document;
- `--stream-messages`, where the CLI reads one message at a time and runs the rules once per replayed message.

Both paths expose the same basic `eymsg:` vocabulary and use N3 quoted formulas for payload graphs.

## Input shape

A log is recognized by a message-version directive:

```trig
VERSION "1.2-messages"
PREFIX : <urn:example#>

:a :value 1 .

MESSAGE

# Empty heartbeat.

MESSAGE

:b :value 2 .
```

The current code accepts message versions matching:

```text
VERSION "1.1-messages"
VERSION "1.2-messages"
VERSION "1.2-basic-messages"
```

Old-style `@version` and `@message` forms are also recognized.

## Normal, whole-log RDF mode

When RDF mode sees a `*-messages` version directive, the common fast path is `parseFastRdfMessageLog()` in `lib/fast_rdf.js`. It directly builds the same Eyeling AST that the replay document would have produced. If the input uses richer RDF/TriG constructs outside the fast subset, Eyeling returns to `normalizeRdfMessageLog()` through the RDF compatibility layer in `lib/lexer.js`.

Both paths:

1. strip the version directive;
2. split the text at top-level `MESSAGE` / `@message` delimiters;
3. create deterministic stream, envelope, and payload IRIs from a hash of the whole source text;
4. keep each message in its own blank-node scope;
5. expose ordinary N3 replay facts.

Conceptually, the input above becomes something like:

```n3
<urn:eyeling:message-log:HASH#stream>
  a eymsg:RDFMessageStream ;
  eymsg:messageCount "3"^^xsd:integer ;
  eymsg:orderedEnvelopes (
    <urn:eyeling:message-log:HASH#m001>
    <urn:eyeling:message-log:HASH#m002>
    <urn:eyeling:message-log:HASH#m003>
  ) ;
  eymsg:firstEnvelope <urn:eyeling:message-log:HASH#m001> ;
  eymsg:lastEnvelope <urn:eyeling:message-log:HASH#m003> ;
  eymsg:envelope <urn:eyeling:message-log:HASH#m001>,
                 <urn:eyeling:message-log:HASH#m002>,
                 <urn:eyeling:message-log:HASH#m003> .

<urn:eyeling:message-log:HASH#m001>
  a eymsg:MessageEnvelope ;
  eymsg:offset "1"^^xsd:integer ;
  eymsg:payloadKind eymsg:nonEmpty ;
  eymsg:nextEnvelope <urn:eyeling:message-log:HASH#m002> ;
  eymsg:payloadGraph <urn:eyeling:message-log:HASH#m001/payload> .

<urn:eyeling:message-log:HASH#m001/payload>
  log:nameOf {
    :a :value 1 .
  } .

<urn:eyeling:message-log:HASH#m002>
  a eymsg:MessageEnvelope ;
  eymsg:offset "2"^^xsd:integer ;
  eymsg:payloadKind eymsg:empty ;
  eymsg:nextEnvelope <urn:eyeling:message-log:HASH#m003> .

<urn:eyeling:message-log:HASH#m003>
  a eymsg:MessageEnvelope ;
  eymsg:offset "3"^^xsd:integer ;
  eymsg:payloadKind eymsg:nonEmpty ;
  eymsg:payloadGraph <urn:eyeling:message-log:HASH#m003/payload> .

<urn:eyeling:message-log:HASH#m003/payload>
  log:nameOf {
    :b :value 2 .
  } .
```

After this replay conversion, the ordinary N3 reasoner handles the result. The fast path avoids printing and reparsing a synthetic N3 replay document, but it intentionally builds the same stream/envelope/payload AST shape.

## Payload graphs

Payloads are represented exactly like other RDF/TriG named graphs in RDF compatibility mode:

```n3
?Payload log:nameOf { ...payload triples... } .
```

The object is an N3 quoted formula. Rules inspect it with formula-aware built-ins such as `log:includes`:

```n3
@prefix eymsg: <https://eyereasoner.github.io/eyeling/vocab/message#> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .

{
  ?Envelope eymsg:payloadGraph ?Payload .
  ?Payload log:nameOf ?Graph .
  ?Graph log:includes { ?Subject :value ?Value . } .
} => {
  ?Envelope :sawValue ?Value .
} .
```

This is the key design choice: message boundaries are preserved by putting each payload in its own quoted graph instead of merging all message triples into the top-level fact set.

## Per-message normalization

Each message body is converted before it is embedded as a payload formula. In the fast path this is intentionally limited to line-oriented RDF statements: IRIs, prefixed names, blank nodes, literals, numeric/boolean literals, simple N-Quads named graphs, and nested RDF/Turtle collections. Richer RDF 1.2/TriG features are handled by the fallback normalization path:

- RDF 1.2 triple terms are converted to singleton N3 graph terms;
- RDF 1.2 annotation syntax is expanded;
- TriG named graphs are converted to `log:nameOf` triples;
- blank-node labels are rewritten with a message-specific prefix.

For example, the same blank-node label in two different messages does not denote the same internal blank node. Message 1 rewrites roughly to:

```n3
_:eyeling_m001_b :value 1 .
```

and message 3 rewrites roughly to:

```n3
_:eyeling_m003_b :value 2 .
```

If the message log appears as the second parsed source, the parser's usual source prefixing may add another source prefix around those labels, for example `_:src2_eyeling_m001_b`.

## Empty heartbeat messages

A message chunk is considered empty when, after directives and comments are ignored, it contains no RDF payload.

Empty messages still get an envelope:

```n3
?Envelope a eymsg:MessageEnvelope ;
  eymsg:offset "2"^^xsd:integer ;
  eymsg:payloadKind eymsg:empty .
```

but they do not get an `eymsg:payloadGraph` triple. This lets rules distinguish heartbeats from non-empty data messages without accidentally reusing a previous payload.

## `--stream-messages` mode

The CLI streaming path lives in `lib/cli.js`.

With:

```bash
eyeling --rdf --stream-messages rules.n3 messages.trig
```

the CLI separates ordinary sources from message-log sources. Ordinary sources are parsed once as the reusable rule/program documents. Message logs are then read chunk by chunk.

For each chunk, `buildSingleMessageReplayDocument()` creates a small replay document containing one stream, one envelope, and optionally one payload graph:

```n3
<urn:eyeling:message-stream:HASH#stream>
  a eymsg:RDFMessageStream ;
  eymsg:envelope <urn:eyeling:message-stream:HASH#m000001> ;
  eymsg:orderedEnvelopes (<urn:eyeling:message-stream:HASH#m000001>) ;
  eymsg:firstEnvelope <urn:eyeling:message-stream:HASH#m000001> ;
  eymsg:lastEnvelope <urn:eyeling:message-stream:HASH#m000001> .

<urn:eyeling:message-stream:HASH#m000001>
  a eymsg:MessageEnvelope ;
  eymsg:offset "1"^^xsd:integer ;
  eymsg:payloadKind eymsg:nonEmpty ;
  eymsg:payloadGraph <urn:eyeling:message-stream:HASH#m000001/payload> .

<urn:eyeling:message-stream:HASH#m000001/payload>
  log:nameOf {
    ...one message payload...
  } .
```

That one-message replay document is merged with the already-parsed program sources and run immediately. The next message gets a fresh replay document and a fresh run.

The streaming replay document intentionally does not expose the whole global message list. It only exposes the current message envelope, because the point of `--stream-messages` is one-message-at-a-time processing without materializing the whole log.

## Remote logs

For local files, `--stream-messages` reads line by line. For HTTP(S) sources, the CLI first checks the prefix to detect a message-version directive. When processing a remote text/plain RDF Message Log, it downloads the source into a temporary file and then streams that local copy line by line.

## Output behavior

RDF Message Logs do not introduce special output syntax. Once replay facts have been produced, output is the normal Eyeling output path:

- `log:outputString` facts are collected and printed as text;
- `log:query` output is printed from query conclusions;
- in RDF mode, triples are printed with RDF-compatible output formatting where possible.

## Practical mental model

RDF Message Log support is best understood as:

```text
message-log syntax
  -> split into message chunks
  -> parse fast line-oriented payloads directly, or fall back to RDF/TriG normalization
  -> wrap each chunk in an eymsg: envelope
  -> expose the payload as log:nameOf { ... }
  -> run the ordinary N3 reasoner
```

So the feature is not a separate streaming RDF reasoner. It is a replay encoding that turns message boundaries into explicit N3 facts and quoted payload graphs, which ordinary Eyeling rules can inspect.
