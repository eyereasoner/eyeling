# RDF Message LDES Incremental Repair

[Follow the rules](../rdf-message-ldes-incremental.n3), [replay the message log input](../input/rdf-message-ldes-incremental.trig), compare the [golden output](../output/rdf-message-ldes-incremental.md), and see the [handbook](https://eyereasoner.github.io/eyeling/HANDBOOK#rdf-message-log-replay-under--r) for RDF Message replay under `-r`.

## Why this example exists

A long-running stream should not force a reasoner to reload and re-check all past data every time a new event arrives.

This example shows the intended shape:

1. publish events as an append-only **LDES**;
2. serialize each emitted member as an **RDF Message**;
3. remember a sequence bookmark from the previous synchronization run;
4. reason only over the new tail;
5. repair a noisy inconsistency before materializing the operational result.

## The story

A building monitors a fire door, `doorA`.

The stream contains forty door observations.  Most are boring historical facts that were already processed.  The consumer has stored this checkpoint:

```turtle
:doorStream :lastCommittedSequence 34 .
```

So when the log is replayed, the reasoner can classify:

- sequences `1..34` as committed history;
- sequences `35..40` as newly emitted LDES members;
- the new tail as the current repair window.

## Why RDF Messages help

The input file is a real RDF Message Log:

```turtle
VERSION "1.2-messages"
...
MESSAGE
...
MESSAGE
...
```

Eyeling's `-r` mode preserves those message boundaries as `eymsg:` envelopes and payload graphs.  The rules inspect payloads with `log:includes`, so each member remains scoped to the message that emitted it.

Handbook: <https://eyereasoner.github.io/eyeling/HANDBOOK#rdf-message-log-replay-under--r>

## Why LDES helps

LDES contributes the stream shape:

```turtle
:doorStream a ldes:EventStream ;
  ldes:timestampPath :observedAt ;
  ldes:sequencePath :sequence ;
  tree:member :obs-040 .
```

The stream is append-only, and each member has a sequence number.  That sequence number is the incremental bookmark: a consumer that already committed `34` does not need to re-run the repair over members `1..34`.

LDES spec: <https://semiceu.github.io/LinkedDataEventStreams/releases/1.0.0-alpha/index.html>

## The inconsistency

The new tail contains contradictory evidence:

- the camera says `doorA` is `:open`;
- the latch says `doorA` is `:closed`;
- the safety controller also says `doorA` is `:closed`, with higher priority.

Raw materialization would say the same door is both open and closed.

## The repair

The preferred repair keeps the highest-priority tail assertion:

```turtle
:obs-040 :doorState :closed ;
  :priority 5 ;
  :source "safety-controller" .
```

The materialized action is therefore:

> keep the compartment sealed and continue monitoring

## Run it

```bash
eyeling -r examples/rdf-message-ldes-incremental.n3 \
  examples/input/rdf-message-ldes-incremental.trig
```
