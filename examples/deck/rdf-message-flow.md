# RDF Message Logs in Eyeling — from stream to reasoning

This deck explains the example `rdf-message-flow.n3` and its input file `input/rdf-message-flow.trig`.

Example files: [rules](../rdf-message-flow.n3) · [message log input](../input/rdf-message-flow.trig) · [golden output](../output/rdf-message-flow.md).

Handbook reference: [https://eyereasoner.github.io/eyeling/HANDBOOK#rdf-message-log-replay-under--r](https://eyereasoner.github.io/eyeling/HANDBOOK#rdf-message-log-replay-under--r).

The goal is to show, in plain language, how Eyeling can now read an RDF Message Log directly instead of asking the example data to describe its own message envelopes by hand.

---

## The everyday problem

Many real systems do not receive one big dataset.

They receive a stream of small updates:

- a sensor reading,
- a command,
- a status heartbeat,
- an alert,
- another sensor reading.

Each update matters as a separate communication event.

If we simply merge everything into one graph, we lose the order and the boundary between messages.

---

## A message is a sealed packet

Think of an RDF Message as a sealed packet of RDF data.

Inside the packet there may be triples or named graphs.

Outside the packet there is the stream order: first message, second message, third message, and so on.

The important idea is:

> The reasoner should know when one message ends and the next one begins.

---

## What an RDF Message Log adds

An RDF Message Log is a replayable record of a message stream.

Instead of saying “subscribe to this live channel”, the file says:

> Here are the messages that arrived, in order.

That makes it useful for examples, tests, audits, debugging, reproducible reasoning, and explanations.

---

## The new syntax in the input file

The input begins with:

```trig
VERSION "1.2-messages"
```

That tells Eyeling:

> This file contains message boundaries.

Then each boundary is written as:

```trig
MESSAGE
```

So the file can look like this:

```trig
# message 1 data
:temperatureFlow :highThreshold 26 .
_:obs sosa:hasSimpleResult 21 .

MESSAGE

# message 2 data
_:obs sosa:hasSimpleResult 22 .

MESSAGE

# message 3: empty heartbeat
MESSAGE

# message 4 data
_:obs sosa:hasSimpleResult 28 .
```

---

## What Eyeling does internally

Eyeling does not treat `MESSAGE` as an ordinary RDF term.

It handles it before normal N3 reasoning starts.

Internally, Eyeling turns the log into a replay view:

- one stream resource,
- one envelope per message,
- an offset for each envelope,
- a link to the next envelope,
- a payload graph for each non-empty message,
- and an explicit marker for empty messages.

The rules then reason over that replay view.

---

## Why this is better than hand-written envelopes

Before this change, the example input had to describe the stream manually:

- message `:m001`,
- message `:m002`,
- payload graph `in:payload001`,
- next message links,
- payload kind markers,
- offsets.

That worked, but it made the example bulky.

It also mixed two concerns:

1. the message-log machinery, and
2. the domain logic of routing temperature observations.

Now Eyeling handles the message-log machinery.

The N3 file can focus on the logic.

---

## What the temperature-flow example does

The example models a small stream processor.

Messages move through these stages:

1. ingest,
2. validate,
3. interpret,
4. route,
5. sink.

The stream contains temperature readings and one empty heartbeat.

The rules route normal readings to an archive sink and high readings to an alert sink.

---

## The empty heartbeat matters

One message in the example contains no RDF triples.

That is not an error.

It represents a heartbeat:

> “The stream is still alive, even though there is no new observation payload.”

Eyeling still creates an envelope for it.

That means the empty message keeps its place in the ordered replay.

---

## Blank nodes stay message-local

The input deliberately reuses the same blank-node label in several messages:

```trig
_:obs sosa:hasSimpleResult 21 .

MESSAGE

_:obs sosa:hasSimpleResult 22 .
```

That does not mean both messages talk about the same blank node.

In a message log, blank-node labels are scoped to the message.

Eyeling rewrites them internally so each message gets its own blank nodes.

---

## How the N3 rules see the replay

The N3 rules do not see `MESSAGE` directly.

They see Eyeling’s replay vocabulary, `eymsg:`.

For example, a rule can ask:

```n3
?Stream a eymsg:RDFMessageStream;
  eymsg:firstEnvelope ?Envelope.
```

Another rule can inspect a payload:

```n3
?Envelope eymsg:payloadGraph ?Payload.
?Payload log:nameOf ?PayloadContext.
?PayloadContext log:includes {
  ?Observation sosa:hasSimpleResult ?Result.
}.
```

That keeps each message payload inside its own context.

---

## Back pressure in one sentence

The example releases only the first envelope at the start.

Each envelope must reach the sink before the next envelope is released.

That gives a simple form of ordered replay or back pressure:

> process this message, then release the next one.

---

## What the final answer says

When the example succeeds, Eyeling reports that five parser-replayed envelopes moved through the flow.

With a threshold of 26:

- 21 is archived,
- 22 is archived,
- the empty heartbeat is accepted,
- 28 becomes an alert,
- 29 becomes an alert.

The important part is not only the routing result.

The important part is that the result was derived while preserving message boundaries.

---

## Why a wide audience should care

This pattern is useful wherever data arrives over time:

- sensors,
- event logs,
- audit trails,
- clinical systems,
- energy systems,
- pub/sub channels,
- digital twins,
- provenance streams.

You can replay the stream, reason over each message atomically, and explain what happened without flattening the whole history into one graph.

---

## The takeaway

`MESSAGE` is the boundary.

Eyeling turns those boundaries into ordered replay envelopes.

The N3 rules consume the replay and focus on the domain logic.

That makes the example shorter, clearer, and closer to how a real pub/sub channel would be processed.
