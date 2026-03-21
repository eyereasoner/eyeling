# Faltings’ theorem (emulated) in Notation3: a genus‑2 curve over Q

This deck explains the example `faltings-genus2-finiteness.n3` ([Playground][1]).

The goal is to show—at a friendly, “wide audience” level—how an N3 file can *model* a famous mathematical implication:
> “If a curve has genus ≥ 2, then it has only finitely many rational points.”

---

## The problem in plain language

People often ask:
> “Which solutions can an equation have if you only allow fractions?”

A **rational point** means a solution where the coordinates are rational numbers (fractions like 3/7).

Some equations have **infinitely many** rational points.
Others have **only finitely many**.

This example is about expressing the “only finitely many” conclusion as a machine-checkable **rule**.

---

## The concrete curve in this example

We model this curve:

\[
y^2 = x(x+1)(x-2)(x+2)(x-3)
\]

You can spot some obvious rational solutions just by making the right-hand side zero:

- (0, 0)
- (-1, 0)
- (2, 0)
- (-2, 0)
- (3, 0)

The file includes these as example data points.

---

## What is “genus” (without the heavy math)?

A good mental model is:

- **genus 0**: sphere-like (0 holes)
- **genus 1**: donut-like (1 hole)
- **genus 2**: “two-hole donut”
- **genus ≥ 2**: more complicated surfaces

In algebraic geometry, *genus* is a deep invariant, but for this deck you only need:
> genus is a number that measures how “holey” a curve is.

---

## The famous implication (Faltings’ theorem)

Very roughly:

- For genus 0: rational points are “none or infinite”
- For genus 1: rational points can be infinite, but structured (elliptic curves)
- For genus ≥ 2: rational points are **finite**

Faltings proved (in 1983) the last bullet (formerly the Mordell conjecture).

---

## What this N3 example *does*

It does **not** re-prove the theorem.

Instead, it treats “Faltings’ theorem” as a named rule:

- If something is a curve,
- over a number field,
- with genus ≥ 2,
- then infer: “its rational points are finite.”

That’s the kind of modeling you do when you want a reasoner to apply well-known results reliably.

---

## Why this is useful (even though it’s an emulation)

Think of it like a *library function*.

You may not re-derive calculus every time you compute a derivative;
you rely on a trusted rule.

Similarly, you can:

- store curve facts as data,
- encode trusted theorems as rules,
- and let a reasoner apply them consistently.

---

## N3 in one minute

N3 is RDF + rules.

- **Facts** look like triples:
  - `:C :genus 2.`
- **Rules** look like:
  - `{ ... } => { ... } .`

Variables start with `?`, like `?curve`, `?g`.

---

## The data section (what we assert)

The file asserts:

```n3
:C a :Curve ;
   :equation "y^2 = x(x+1)(x-2)(x+2)(x-3)" ;
   :definedOver :Q ;
   :genus 2 .
```

And it also asserts that `:Q` is a `:NumberField`, plus a few sample points.

---

## The rule section (the “theorem” as logic)

Here is the core rule (lightly formatted):

```n3
{
  ?curve a :Curve ;
         :definedOver ?field ;
         :genus ?g .
  ?field a :NumberField .
  ?g math:notLessThan 2 .
}
=>
{
  ?curve :coveredBy :FaltingsTheorem ;
         :hasRationalPointsCardinality :Finite .
} .
```

That `math:notLessThan` is a standard N3 math builtin: it means “≥”.

---

## What gets inferred

Once a reasoner sees the facts:

- `:C a :Curve`
- `:C :definedOver :Q`
- `:C :genus 2`
- `:Q a :NumberField`

…the rule fires and it can derive:

```n3
:C :hasRationalPointsCardinality :Finite .
:C :coveredBy :FaltingsTheorem .
```

There’s also a small follow-on rule that derives a friendlier Boolean:

```n3
:C :doesNotHaveInfinitelyManyRationalPoints true .
```

---

## Important: what it does *not* compute

This file does **not** find all rational points.

Faltings’ theorem is about **finiteness**, not an explicit list.

So the example’s job is:

- represent the curve,
- represent the theorem as a rule,
- and show that the reasoner can draw the finiteness conclusion.

---

## Try it

### In your browser
Use the playground link at the top: [Playground][1].

### On the command line
```bash
eyeling faltings-genus2-finiteness.n3
```

---

## Where you can take this next

Easy extensions:

- Add more example curves with different genera
- Add rules that *classify* genus based on curve families (toy versions)
- Connect this to a small “math knowledge base” of reusable lemmas
- Use the same pattern for other theorems: “if conditions, then property”

[1]: https://eyereasoner.github.io/eyeling/demo?url=https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/examples/faltings-genus2-finiteness.n3 'Playground'
