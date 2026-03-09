# High-trust RDF graph lookup with a decimal certificate

This deck explains the example `high-trust-rdf-bloom-envelope.n3` ([Playground][1]).

The goal is to show that **advanced engineering claims can be expressed and checked in N3**, even when the claim involves a **transcendental quantity** such as `exp(-k*n/m)`.

The example is about a **formally specified RDF graph library targeting high-trust environments**.

---

## The problem in plain language

Imagine a software component that stores an RDF graph and answers a basic question very quickly:

> “Does this triple exist?”

In a high-trust setting—critical infrastructure, regulated systems, scientific pipelines, or security-sensitive software—you do not just want the answer to be fast.

You also want to know:

- what the component is allowed to do,
- what it is **not** allowed to do,
- which parts are exact,
- which parts are approximate,
- and why the approximation is still safe.

That is the spirit of this example.

---

## The engineering story

The file models a graph artifact with three parts:

1. a **canonical RDF graph snapshot**,
2. a verified **SPO index** for exact lookup,
3. a **Bloom filter** used only as a fast prefilter.

The important trust rule is simple:

- **Exact correctness comes from the canonical graph**.
- The Bloom filter is used only to avoid unnecessary exact checks.
- A “maybe present” result from the Bloom filter is **never trusted on its own**.
- It must be confirmed against the canonical graph.

So the Bloom filter is treated as a performance tool, not as the source of truth.

---

## Why Bloom filters matter here

A Bloom filter is a compact data structure that can answer:

- **definitely not present**, or
- **maybe present**.

That makes it useful for speeding up negative lookups.

The trade-off is that Bloom filters can produce **false positives**:

> they may say “maybe present” even when the triple is actually absent.

That is acceptable in this design, because every maybe-positive answer is checked exactly afterwards.

So the real question becomes:

> Can we prove that the number of extra exact checks stays within an acceptable budget?

---

## Why this is interesting mathematically

The usual false-positive approximation for a Bloom filter involves the term:

```text
exp(-k*n/m)
```

where:

- `n` = number of stored items,
- `m` = number of bits in the filter,
- `k` = number of hash functions.

This is where the example becomes interesting.

The expression uses **`exp`**, and values involving `exp(...)` are generally **not exact rational numbers**. They are transcendental-style quantities that cannot usually be represented exactly with finite symbolic data inside an ordinary rule engine.

---

## The “decimal-first” idea

Instead of trying to represent the exact real number, the file stores a **certified decimal interval**:

```text
0.5988792348 <= exp(-0.5126953125) <= 0.5988792349
```

That interval is written using ordinary finite decimal values.

This is the key idea:

> Use `xsd:decimal` as a practical carrier for trustworthy approximations.

A decimal value is still finite, explicit, auditable, and machine-checkable. In that sense it behaves like structured data, not like a vague floating-point guess.

---

## Why `xsd:decimal` is a good fit

It helps to think of `xsd:decimal` as:

> a number you can write down exactly in base 10.

Examples:

- `0.5126953125`
- `0.5988792348`
- `0.002`

These are not “approximate because the computer happened to use binary floating point.”
They are **explicit decimal facts** inside the RDF/N3 world.

That makes them easier to inspect, easier to serialize, and easier to certify.

---

## What the file proves

The example uses these concrete values:

- `n = 1200` triples
- `m = 16384` Bloom-filter bits
- `k = 7` hash functions
- `50,000` negative lookups per batch

From those, it derives:

- the load factor `lambda = k*n/m = 0.5126953125`
- a certified decimal interval for `exp(-lambda)`
- a lower and upper bound for the Bloom false-positive rate
- an upper bound on the number of extra exact lookups

Then it checks whether those results satisfy the deployment policy.

---

## The trust contract, in plain English

The file is not just doing arithmetic. It is expressing a **contract**.

The contract says:

1. the canonical graph and the SPO index must agree,
2. the decimal interval for the transcendental term must be well-formed,
3. the false-positive rate must stay below a specified budget,
4. the expected number of extra exact confirmations must stay below another budget,
5. and exact correctness must still come from the canonical graph.

Only if all of those hold does the file conclude:

```n3
:artifact :deploymentDecision :AcceptForHighTrustUse.
```

That is a nice example of **policy + math + data structure behavior** meeting in one rule system.

---

## Why this counts as “high-trust”

High-trust does **not** mean “no approximation anywhere.”

Instead, it means something closer to this:

- approximations are clearly identified,
- their effect is bounded,
- their use is restricted,
- and the final correctness claim does not depend on unjustified assumptions.

In this example:

- the Bloom filter may introduce extra work,
- but it does not introduce wrong positive answers into the final result,
- because maybe-positive cases are verified against the exact graph.

So the approximation affects **performance**, not **truth**.

---

## Why the decimal interval is the essence of the example

Many systems are comfortable with exact integers.
Fewer are comfortable with real analysis.

This example shows a practical middle path:

- keep the reasoning engine in a finite symbolic world,
- represent a transcendental quantity by a certified decimal interval,
- and propagate that interval through the rest of the computation.

That is powerful because many engineering systems depend on quantities that are not naturally exact integers:

- probabilities,
- exponential decay,
- control-system envelopes,
- signal attenuation,
- error margins,
- and performance budgets.

Using decimal envelopes lets you reason about them without pretending they are exact closed-form objects inside the rule engine.

---

## What is happening rule by rule

At a high level, the N3 file does five things.

### 1. Check structural agreement

It verifies that the canonical graph and the SPO index report the same triple count.

That gives confidence that the exact index structure is aligned with the exact data source.

### 2. Compute the Bloom load factor

It computes:

```text
lambda = k*n/m
```

using exact arithmetic over finite numeric literals.

### 3. Accept a decimal certificate for the transcendental term

It checks that the stored lower and upper bounds for `exp(-lambda)` make sense:

- lower < upper,
- both are between 0 and 1.

This is a simple but important certificate validity check.

### 4. Derive an envelope for the false-positive rate

Using monotonicity, the file turns bounds on `exp(-lambda)` into bounds on:

```text
(1 - exp(-lambda))^k
```

That produces a lower and upper bound for the false-positive rate.

### 5. Compare against operational budgets

Finally, it checks:

- the false-positive rate is below the configured rate budget,
- the expected number of extra exact lookups is below the configured workload budget.

If all checks pass, the artifact is accepted.

---

## Why this matters beyond Bloom filters

This example is really about something bigger:

> Can an RDF/N3 specification describe not just data, but also quantified engineering guarantees?

Here the answer is yes.

The same style can be reused for other advanced settings:

- approximate indexes,
- cache hit/miss guarantees,
- network reliability envelopes,
- control loops with bounded error,
- cryptographic or security budget checks,
- data quality thresholds,
- probabilistic screening steps followed by exact confirmation.

The Bloom-filter story is just a very concrete and easy-to-recognize case.

---

## A good mental model

You can think of the example like an airport security line:

- the Bloom filter is the fast first screen,
- the canonical graph is the careful manual check,
- and the decimal certificate says how often the fast screen may send someone to manual inspection unnecessarily.

The design is acceptable because the fast screen does not get the final say.

---

## What makes this example special in N3

A lot of Semantic Web examples focus on:

- class hierarchies,
- vocabulary mappings,
- policy matching,
- or graph transformations.

This one goes further.

It combines:

- RDF structure,
- exact graph invariants,
- operational policy,
- decimal arithmetic,
- and a transcendental approximation certificate.

So it is a good illustration of N3 as a language for **machine-readable engineering arguments**, not just for linked data publishing.

---

## Takeaway

This example shows that a formally specified RDF graph component can make a strong claim like:

> “Our fast prefilter is approximate, but its approximation is explicitly bounded, and final correctness still comes from an exact graph.”

That is exactly the kind of statement people care about in high-trust software.

And the neat part is that the statement is not only written in prose—it is represented as data and rules that a reasoner can check.

[1]: https://eyereasoner.github.io/eyeling/demo?url=https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/examples/high-trust-rdf-bloom-envelope.n3 'Playground'
