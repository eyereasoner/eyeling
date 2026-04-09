# ARC Bridge

This directory holds **ARC Bridge** cases.

An ARC Bridge case sits between two existing forms in Eyeling:

- the **declarative N3** case in `examples/`, and
- the **specialized executable** case in `examples/extra/`.

Its purpose is to keep the ARC promise visible while making the case easy to read, easy to rerun, and easy to port.

In one line:

> `examples/arc-bridge/` presents controlled-English ARC specifications with reference ECMAScript realizations and JSON test vectors.

## Why this directory exists

Eyeling already has two valuable ways to present a case.

The files in `examples/` are ideal for seeing the logic in open declarative form. The files in `examples/extra/` are ideal when a case has already been shaped and we want a compact executable artifact that runs quickly.

ARC Bridge exists for the middle layer. It gives each case:

- a **normative statement** in controlled mathematical English,
- a **reference realization** in ECMAScript,
- a **concrete instance** in JSON, and
- an **expected result** for comparison and regression testing.

So ARC Bridge is not a replacement for either of the existing collections. It is a bridge between them.

## The ARC part

ARC means:

- **Answer**
- **Reason Why**
- **Check**

A good ARC Bridge case should preserve that trust pattern even though it is not written directly in N3.

That means:

- the **answer** is clearly identifiable,
- the **reason why** is visible as named clauses or derived predicates,
- and the **check** is real, meaning it could fail for a meaningful reason.

## What belongs here

A case belongs in `examples/arc-bridge/` when:

- there is a useful ARC-style case in `examples/`,
- there is value in giving the case a more direct operational form,
- but we still want the logic to stay explicit and auditable,
- with a specification that can be read independently of the code.

Typical uses:

- policy and governance examples,
- privacy-preserving decision examples,
- cases with a stable logical core and a small executable shell,
- cases that benefit from conformance-style testing.

## Directory shape

Each case should live in its own subdirectory.

For example:

```text
examples/arc-bridge/
  delfour/
    delfour.spec.md
    delfour.data.json
    delfour.model.mjs
    delfour.expected.json
    delfour.instance.schema.json
  flandor/
    flandor.spec.md
    flandor.data.json
    flandor.model.mjs
    flandor.expected.json
    flandor.instance.schema.json
```

## The five files

Each ARC Bridge case should contain these files.

### 1. `name.spec.md`

The normative case description.

This file should use **controlled mathematical English**. It should define the vocabulary, the inputs, the derived predicates, the decision rule, the governance rule, the checks, and the output contract.

The spec should be written so that a careful reader can understand the case without reading the ECMAScript source first.

### 2. `name.data.json`

The concrete instance data.

This file contains the facts for the case: entities, thresholds, observed values, policies, timestamps, candidate actions, and any other case inputs.

### 3. `name.model.mjs`

The reference ECMAScript realization.

This file should implement the case directly and clearly. A good pattern is to map named clauses in the spec to named functions in the model.

For example:

- `clauseR1_exportWeakness`
- `clauseS2_recommendedPackage`
- `clauseG1_authorizedUse`
- `clauseM2_payloadHash`

The model is not the normative source. It is the **reference realization** of the normative source.

### 4. `name.expected.json`

The expected derived result.

This file is the conformance vector for the case. It should capture the main derived predicates, the selected answer, the visible checks, and any stable integrity values needed for regression testing.

### 5. `name.instance.schema.json`

The instance schema.

This file defines the required structure of the input JSON. It should be strict enough to catch malformed case instances before evaluation.

## How to read an ARC Bridge case

A good reading order is:

1. start with `name.spec.md`,
2. inspect `name.data.json`,
3. run `name.model.mjs`,
4. compare the result with `name.expected.json`,
5. then relate the case back to its N3 and specialized counterparts.

That order keeps the meaning visible before the operational details.

## Relationship to the rest of `examples/`

A useful mental model is:

- `examples/` shows ARC cases in **declarative Eyeling form**,
- `examples/arc-bridge/` shows the same kind of cases in **specification-plus-reference form**,
- `examples/extra/` shows selected cases in **specialized executable form**.

So the three collections are complementary:

- **N3** is best for seeing the logic in the open,
- **ARC Bridge** is best for stating the case normatively and running a portable reference model,
- **extra** is best for fast specialized execution.

## Design rules

When adding a case here, prefer the following.

### 1. Keep the spec normative

The spec should say what the case means. It should not merely paraphrase the code.

### 2. Keep the code direct

The ECMAScript model should say what it does and do what it says. Avoid unnecessary framework machinery.

### 3. Keep the data separate

Case facts belong in JSON, not hard-coded into the prose.

### 4. Keep checks substantive

A check should add confidence. It should not only restate the answer.

### 5. Keep names aligned

If a case is called `delfour` in `examples/` and `examples/extra/`, the ARC Bridge case should use the same base name.

## Suggested workflow for a new case

1. Start from a strong ARC-style N3 example.
2. Write a controlled-English specification of the case.
3. Move the concrete instance into JSON.
4. Implement a small ECMAScript reference model.
5. Capture the expected result in JSON.
6. Keep the visible output in Answer / Reason Why / Check shape.
7. Link the bridge case to its N3 and specialized counterparts.

## What ARC Bridge is not

ARC Bridge is not:

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

`examples/arc-bridge/` presents controlled-English ARC case specifications with reference ECMAScript realizations, JSON instances, and expected results, as a bridge between declarative Eyeling examples and specialized executable companions.
