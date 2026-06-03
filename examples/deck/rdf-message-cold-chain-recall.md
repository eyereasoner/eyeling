# RDF Message Cold Chain Recall

This deck follows a cold-chain stream where the cost of a wrong conclusion is concrete: either release a shipment or quarantine it. The [rules](../rdf-message-cold-chain-recall.n3) replay the LDES [message log input](../input/rdf-message-cold-chain-recall.trig), the [golden output](../output/rdf-message-cold-chain-recall.md) records the repaired decision, and the [handbook section](https://eyereasoner.github.io/eyeling/HANDBOOK#rdf-message-log-replay-under--r) explains how `-r` exposes RDF Message boundaries to the rules.

## Why this example exists

A cold-chain monitor receives a long telemetry stream for a medicine batch.

Most readings are old and already materialized.  The consumer has a checkpoint, so reloading and rechecking the whole stream would be wasteful.  But the new tail is not clean: one message says the batch remained in range, while another says it crossed the temperature limit.

The example shows why streaming RDF reasoning needs three things together:

1. message boundaries, so the rules know which facts arrived together;
2. LDES sequence metadata, so the consumer resumes after a checkpoint;
3. a repair policy, so contradictory tail evidence is fixed before an operational decision is emitted.

## The story

`batchA` is moving through a cold-chain route.

The stream contains forty-eight telemetry observations.  The first forty-two were already processed in an earlier synchronization run:

```turtle
:telemetryStream :lastCommittedSequence 42 .
```

That leaves only messages `43..48` for the current incremental repair window.

## The contradiction

The new tail contains both kinds of evidence:

```turtle
:obs-043 :temperatureTenthC 45 .   # 4.5°C, within range
:obs-047 :temperatureTenthC 118 .  # 11.8°C, over the 8.0°C limit
```

Flattening the tail would make the batch look both safe and unsafe.

## The repair

The repair policy is intentionally simple and auditable: for recall decisions, a calibrated cold-chain logger wins over lower-priority telemetry.

```turtle
:obs-047 :source "calibrated-cold-chain-logger" ;
  :priority 5 ;
  :calibrationClass :calibratedLogger .
```

Because that repaired reading is over the limit, the materialized decision is:

> quarantine batchA, notify QA, and hold shipment

## Why this is a good streaming case

The example is not about proving that one temperature number is bigger than another.

It is about the shape of the pipeline:

- the stream can keep growing;
- the consumer can resume from a bookmark;
- old messages do not need to be reprocessed;
- the inconsistent new tail is repaired locally;
- the final output is based on the repaired state, not on the raw noisy merge.

## Run it

```bash
eyeling -r examples/rdf-message-cold-chain-recall.n3 \
  examples/input/rdf-message-cold-chain-recall.trig
```
