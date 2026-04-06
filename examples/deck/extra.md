# ARC specializations in `examples/extra/`

For the general ARC pattern in Eyeling, start with **Appendix F** of the handbook:

<https://eyereasoner.github.io/eyeling/HANDBOOK#app-f>

That appendix explains the core shape:

**Answer • Reason Why • Check**

This page is about something more specific.

The programs in `examples/extra/` are **high-performance specializations** of selected ARC-style N3 cases from `examples/`.

So the main collection in `examples/` shows the ARC approach in its most declarative Eyeling form:

- data and logic written in N3,
- a precise question,
- a visible answer,
- a readable reason why,
- and an explicit check.

The `examples/extra/` collection keeps that same trust contract, but packages part of the work into compact JavaScript drivers intended for fast execution.

---

## The idea

ARC is not only about getting an answer.

It is about producing a result that can be:

- read,
- rerun,
- checked,
- and audited.

That remains true here.

What changes in `examples/extra/` is the execution strategy.

These cases begin from the same broad ARC mindset as the N3 examples in `examples/`, but they are shaped as specialized programs so that repeated execution is small, direct, and efficient.

In other words, they are not a different philosophy.
They are a different operational form.

---

## From declarative case to specialized driver

A useful way to think about the relationship is this:

- **`examples/`** presents ARC cases in declarative Eyeling form.
- **`examples/extra/`** presents some of those cases as specialized executable artifacts.

The declarative version is ideal for seeing the logic in the open.
The specialized version is ideal when the logical structure is already known and you want a compact program that runs very quickly while still delivering the same ARC-style shape of result.

So `examples/extra/` should be read as a performance-oriented companion to part of the N3 collection, not as a replacement for it.

---

## In the spirit of Ershov’s mixed computation

This collection is in the spirit of **Ershov’s mixed computation**.

The central intuition is that some parts of a computation are stable enough to be fixed ahead of time, while the remaining part should stay lightweight and ready for fast execution.

Applied here, that means:

- the logical structure of a case is treated as something that can be specialized,
- the resulting program becomes smaller and more direct,
- and runtime focuses on carrying out the already-shaped computation efficiently.

That gives these examples a useful balance:

- they remain recognizable as ARC cases,
- but they also behave like efficient specialized programs.

So the emphasis is not only on declarative clarity, but on **declarative clarity carried into fast operational form**.

---

## What is preserved

Although these cases are specialized for speed, the important ARC promises remain the same.

A good case in `examples/extra/` still aims to provide:

### 1. A clear answer

The program should make the main result easy to identify.

### 2. A visible reason why

The run should expose the key explanation, witness, derivation, or summary that tells the reader why the result follows.

### 3. A real check

The case should validate something substantial, not merely restate the conclusion.
A check should be capable of failing for a meaningful reason.

### 4. Repeatability

The program should be easy to run again, inspect again, and compare again.

That is why these examples belong with the ARC material rather than merely beside it.
They preserve the same trust pattern while changing the performance profile.

---

## Why keep both forms

There is value in having both the declarative N3 cases and the specialized JavaScript cases in one project.

The N3 versions are excellent for:

- understanding the logic,
- reviewing the rules,
- teaching the method,
- and seeing the Eyeling style directly.

The specialized versions are excellent for:

- fast execution,
- compact deployment,
- repeated reruns,
- and performance-oriented demonstration.

Taken together, they show two complementary strengths:

1. **Eyeling as a declarative reasoning system**, and
2. **ARC cases as candidates for efficient specialization**.

---

## How to read this collection

A good way to approach `examples/extra/` is:

1. Read the general ARC introduction in the handbook appendix.
2. View the N3 examples in `examples/` as the declarative source style.
3. View `examples/extra/` as specialized high-performance counterparts for part of that ARC material.

That perspective makes the role of the collection clear.

It is not a random set of auxiliary programs.
It is a demonstration that ARC-style cases can remain auditable while also being pushed toward compact, high-speed execution.

---

## Running the collection

Run the suite with:

```sh
node test/extra.test.js
```

Or through the package script:

```sh
npm run test:extra
```

This executes the programs in `examples/extra/` and writes their standard output to `examples/extra/output/`.

The saved outputs make the collection easy to rerun, review, and compare over time.

---

## In one line

`examples/extra/` presents **high-performance specialized versions of selected ARC-style N3 cases from `examples/`, in the spirit of Ershov’s mixed computation, while preserving the ARC promise: answer the question, show why, and check the result.**
