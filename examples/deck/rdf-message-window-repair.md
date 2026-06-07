# RDF Message window repair — fixing an open/closed door conflict

This deck follows a small RDF Message window where one door is reported both open and closed. The [rules](../rdf-message-window-repair.n3) inspect the replayed [message log input](../input/rdf-message-window-repair.trig), the [golden output](../output/rdf-message-window-repair.md) shows the repaired conclusion, and the [README section](https://eyereasoner.github.io/eyeling/#rdf-message-logs) explains how `-r` exposes message payloads without silently merging them.

The goal is to show how Eyeling can reason over a replayed RDF Message Log, keep message boundaries visible, detect an inconsistency in a sliding window, and materialize a repaired conclusion instead of blindly merging contradictory facts.

---

## The story

A building automation system receives RDF messages about a fire door.

The messages arrive from different devices:

- a corridor camera,
- a hallway latch sensor,
- and a safety controller.

Most of the time they agree. But in the example, the current message window says both of these things:

```text
doorA is open
doorA is closed
```

That is the inconsistency the example is meant to fix.

---

## Why ordinary merging is not enough

If all messages are merged into one graph, the system sees both facts at once.

For safety automation, that is not a useful final state. The system needs a current operational conclusion, such as:

```text
mark the fire compartment as sealed
```

or:

```text
send a technician to inspect and close the fire door
```

The example therefore separates two steps:

1. detect the raw conflict,
2. repair it before producing the final action.

---

## The message log

The input file is a real RDF Message Log:

```trig
VERSION "1.2-messages"
```

Each `MESSAGE` delimiter separates one communication event from the next.

Eyeling parses those delimiters before ordinary reasoning starts and exposes a replay model with `eymsg:` terms:

- one stream,
- one envelope per message,
- ordered envelope links,
- offsets,
- and one payload graph per non-empty message.

The rules reason over that replay model rather than pretending the stream was one big static graph.

---

## The five messages

The log has five messages.

Message 1 is policy and vocabulary:

- the sliding ABox window has size 3,
- the repair policy prefers higher-priority evidence,
- `:open` and `:closed` map to operational action text.

Messages 2 to 5 are door-state assertions.

---

## The sliding windows

The previous window contains messages 2, 3, and 4.

The current window contains messages 3, 4, and 5.

So when the window advances:

- message 2 expires,
- messages 3 and 4 are retained,
- message 5 enters.

This is the small stream-reasoning shape the example demonstrates.

---

## The inconsistency

In the current window:

- message 3 says `doorA` is `:open`,
- message 4 says `doorA` is `:closed`,
- message 5 also says `doorA` is `:closed`.

The raw materialized window therefore contains an open/closed contradiction.

The example records this explicitly as:

```n3
:currentWindow :rawConflict :doorOpenAndClosed .
```

---

## The repair policy

The repair policy is deliberately simple:

> If two current-window assertions conflict, keep the one with the higher priority.

The camera and latch readings have priority 1.

The safety-controller reading has priority 3.

So the repaired state is:

```text
doorA is closed
```

The lower-priority conflicting open assertion is still visible as rejected evidence; it is not silently erased.

---

## The final materialization

After repair, the rules derive the final action from the repaired state, not from the inconsistent raw window.

For this data, the final action is:

```text
mark the fire compartment as sealed
```

That conclusion is only produced after the example has shown all of these things:

- the RDF Message Log was replayed,
- the sliding windows were constructed,
- the raw open/closed conflict was detected,
- the preferred repair selected the higher-priority assertion,
- and the repaired state was materialized.

---

## What this example is useful for

This is a compact pattern for stream-style reasoning with noisy inputs.

It shows that RDF messages can be used as more than a transport format: their boundaries become part of the evidence.

That makes it possible to explain conclusions in terms of:

- which message arrived,
- which window it belonged to,
- whether it expired, was retained, or entered,
- whether it conflicted with another message,
- and why one assertion was preferred over another.
