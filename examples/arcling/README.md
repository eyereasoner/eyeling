# Arcling

This directory holds **Arcling** cases.

An Arcling case sits alongside the declarative N3 cases in `examples/`. Its purpose is to keep the ARC promise visible while making the case easy to read, easy to rerun, and easy to port.

In one line:

> `examples/arcling/` presents ARC cases in mathematical English with reference Go realizations and JSON test vectors.

## Insight Economy context

The `delfour`, `medior`, and `flandor` cases are concrete Arcling readings of Ruben Verborgh’s [Inside the Insight Economy](https://ruben.verborgh.org/blog/2025/08/12/inside-the-insight-economy/). The central move is the same in all three cases: what gets traded is not risky raw data, but a narrow, expiring, purpose-bound insight that is useful enough to trigger action. In Ruben’s phrasing, the goal is to “don’t exchange raw data” and to prefer “meaningful insights, not risky raw data”.

In this directory, the three cases show that pattern across three settings:

- **Delfour** keeps a household-level medical condition private and turns it into a neutral shopping insight such as “prefer lower-sugar products” for shopping assistance.
- **Medior** keeps laboratory, medication, and readmission evidence local and turns it into a minimal post-discharge coordination insight that can justify activating a continuity bundle.
- **Flandor** keeps exporter, labour-market, and grid evidence local and turns it into a regional macro-economic insight that justifies a temporary retooling response.

That progression is intentional: `delfour` is the micro case, `medior` is the care-coordination case, and `flandor` is the macro case. They are easiest to read next to their declarative Eyeling counterparts: `examples/delfour.n3`, `examples/medior.n3`, and `examples/flandor.n3`.

## Why this directory exists

Eyeling already has a strong way to present a case in declarative N3. Arcling adds a second presentation layer for cases that benefit from a normative mathematical-English statement plus a compact reference model.

Each Arcling case gives you:

- a **normative statement** in mathematical English,
- a **reference realization** in Go,
- a **concrete instance** in JSON,
- and an **expected result** for comparison and regression testing.

So Arcling does not replace declarative Eyeling. It complements it.

## The ARC part

ARC means:

- **Answer**
- **Reason Why**
- **Check**

A good Arcling case preserves that trust pattern even though it is not written entirely in N3.

That means:

- the **answer** is clearly identifiable,
- the **reason why** is visible as named clauses or derived predicates,
- and the **check** is real, meaning it could fail for a meaningful reason.

## What belongs here

A case belongs in `examples/arcling/` when:

- there is a useful ARC-style case in `examples/`,
- there is value in giving the case a direct operational form,
- we want the logic to stay explicit and auditable,
- and we want a specification that can be read independently of the code.

Typical uses:

- policy and governance examples,
- privacy-preserving decision examples,
- cases with a stable logical core and a small executable shell,
- cases that benefit from conformance-style testing.

## The four files

Each Arcling case should contain these files.

### 1. `name.spec.md`

The normative case description.

This file should use **mathematical English**. It should define the vocabulary, the inputs, the derived predicates, the decision rule, the governance rule, the checks, and the output contract.

The spec should be written so that a careful reader can understand the case without reading the Go source first.

### 2. `name.data.json`

The concrete instance data.

This file contains the facts for the case: entities, thresholds, observed values, policies, timestamps, candidate actions, and any other case inputs.

### 3. `name.model.go`

The reference Go realization.

This file should implement the case directly and clearly. A good pattern is to map named clauses in the spec to named functions in the model.

For example:

- `clauseR1ExportWeakness`
- `clauseS2RecommendedPackage`
- `clauseG1AuthorizedUse`
- `clauseM2PayloadHash`

The model is not the normative source. It is the **reference realization** of the normative source.

Input validation is part of the reference model. A malformed instance should fail before evaluation rather than requiring a separate schema artifact.

### 4. `name.expected.json`

The expected derived result.

This file is the conformance vector for the case. It should capture the main derived predicates, the selected answer, the visible checks, and any stable integrity values needed for regression testing.

## How to read an Arcling case

A good reading order is:

1. start with `name.spec.md`,
2. inspect `name.data.json`,
3. run `go run name.model.go --json`,
4. compare the result with `name.expected.json`,
5. then relate the case back to its N3 counterpart.

That order keeps the meaning visible before the operational details.

## Relationship to the rest of `examples/`

A useful mental model is:

- `examples/` shows ARC cases in **declarative Eyeling form**,
- `examples/arcling/` shows the same kind of cases in **mathematical-English specification plus reference Go form**.

So the two collections are complementary:

- **N3** is best for seeing the logic in the open,
- **Arcling** is best for stating the case normatively and running a portable reference model.

## Design rules

When adding a case here, prefer the following.

### 1. Keep the spec normative

The spec should say what the case means. It should not merely paraphrase the code.

### 2. Keep the code direct

The Go model should say what it does and do what it says. Avoid unnecessary framework machinery.

### 3. Keep the data separate

Case facts belong in JSON, not hard-coded into the prose.

### 4. Keep checks substantive

A check should add confidence. It should not only restate the answer.

### 5. Keep names aligned

If a case is called `delfour`, `medior`, or `flandor` in `examples/`, the Arcling case should use the same base name.

## Suggested workflow for a new case

1. Start from a strong ARC-style N3 example.
2. Write a mathematical-English specification of the case.
3. Move the concrete instance into JSON.
4. Implement a small Go reference model.
5. Capture the expected result in JSON.
6. Keep the visible output in Answer / Reason Why / Check shape.
7. Link the Arcling case to its N3 counterpart.

## What Arcling is not

Arcling is not:

- a replacement for declarative Eyeling,
- a performance collection,
- a general application framework,
- or a place for prose that cannot be tested.

It exists to make a case simultaneously:

- readable,
- executable,
- checkable,
- and portable.

## In one line

`examples/arcling/` presents ARC cases in mathematical English with reference Go realizations, JSON instances, and expected results, alongside declarative Eyeling examples.
