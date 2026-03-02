# Mapping two data models (beginner-friendly)

When people say “map two data models,” they mean:

> **Taking data described using one vocabulary (Model A) and expressing the same meaning using another vocabulary (Model B).**

In the Semantic Web / Linked Data world, a “data model” is often a **set of RDF terms** (classes + properties) defined by an ontology or vocabulary—like **schema.org** or **FOAF**.

---

## Why would you map vocabularies?

Even if two vocabularies describe similar things, they may use **different names** and **different structures**.

- **schema.org** is common for publishing data on the web (SEO, structured data).
- **FOAF (Friend of a Friend)** is common for describing people, names, online accounts, and social relationships.

Mapping lets you:

- reuse tools built for another vocabulary,
- integrate datasets that use different terms,
- keep your original data but still answer queries in the target vocabulary.

---

## The core idea: “same meaning, different words”

Example concept:

- In **schema.org**, a person is `schema:Person`
- In **FOAF**, a person is `foaf:Person`

Those two classes can represent the same real-world thing (a person), just in different vocabularies.

Similarly for properties:

- `schema:name` ≈ `foaf:name`
- `schema:givenName` ≈ `foaf:givenName`
- `schema:familyName` ≈ `foaf:familyName`

A mapping is just a **set of rules** that says:

> “If you see X in schema.org, you can also produce Y in FOAF.”

---

## What is N3 (Notation3) and what are N3 rules?

**N3** is a compact RDF syntax that also supports **rules**.

A rule looks like:

- **Left side (condition):** patterns you look for in your data
- **Right side (conclusion):** triples you can _generate_ when the condition matches

General shape:

```n3
{  # IF you find these triples...
  ...patterns...
}
=>
{  # THEN you may add these triples...
  ...new triples...
}.
```

This is sometimes called **forward-chaining**: you start with data you have, and rules _derive_ additional data.

---

## Example data in schema.org (RDF/Turtle)

Imagine your dataset contains:

```turtle
@prefix schema: <https://schema.org/> .
@prefix ex:     <https://example.org/> .

ex:alice a schema:Person ;
  schema:name "Alice Example" ;
  schema:givenName "Alice" ;
  schema:familyName "Example" .
```

This says:

- `ex:alice` is a `schema:Person`
- her full name is `"Alice Example"`
- her given and family names are included too

---

## Mapping to FOAF using N3 rules

Now we write rules that _derive_ FOAF triples.

```n3
@prefix schema: <https://schema.org/> .
@prefix foaf:   <http://xmlns.com/foaf/0.1/> .

# Rule 1: schema:Person -> foaf:Person
{
  ?p a schema:Person .
}
=>
{
  ?p a foaf:Person .
}.

# Rule 2: schema:name -> foaf:name
{
  ?p schema:name ?name .
}
=>
{
  ?p foaf:name ?name .
}.

# Rule 3: schema:givenName -> foaf:givenName
{
  ?p schema:givenName ?gn .
}
=>
{
  ?p foaf:givenName ?gn .
}.

# Rule 4: schema:familyName -> foaf:familyName
{
  ?p schema:familyName ?fn .
}
=>
{
  ?p foaf:familyName ?fn .
}.
```

Read Rule 2 in plain English:

> If a person `?p` has a `schema:name` value `?name`, then we can also say `?p` has a `foaf:name` value `?name`.

---

## What output do you get?

After applying the rules, you still have your original schema.org data, **plus** extra FOAF triples like:

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex:   <https://example.org/> .

ex:alice a foaf:Person ;
  foaf:name "Alice Example" ;
  foaf:givenName "Alice" ;
  foaf:familyName "Example" .
```

So now FOAF-based tools or queries can work, even though your “source of truth” is schema.org.

---

## Important beginner notes

### 1) Mapping usually _adds_ data (it doesn’t delete or replace)

Most rule-based mappings are “non-destructive”:

- Keep the original triples
- Derive additional triples in the target vocabulary

### 2) 1-to-1 mappings are the easy case

`schema:name -> foaf:name` is straightforward.

But sometimes:

- one term in schema.org maps to **multiple** terms in FOAF, or
- the target expects a different structure (blank nodes, split names, etc.)

### 3) “Same meaning” is a judgment call

Two properties might be _similar_ but not truly identical in all contexts. Mapping works best when you understand the intended meaning of each term.

---

## A simple mental checklist for mapping

1. **List the things** you have (classes + properties in schema.org)
2. **Decide what you want** to support (FOAF terms you need)
3. For each target term, ask:
   - “Where can I get this information from in the source?”

4. Write rules:
   - **conditions** match the source triples
   - **conclusions** emit the target triples

5. Run a reasoner/rule engine and test with a few example resources

---

## Next step ideas (optional)

- Map online profiles:
  - `schema:sameAs` could help populate `foaf:page` or related links (careful: semantics differ).

- Add type rules beyond `Person`
- Write rules that create structured nodes (more advanced)

---

## Summary

Mapping two models is about **translating meaning across vocabularies**.

- You start with data described in **schema.org**
- You write **N3 rules** that recognize schema.org patterns
- You **derive FOAF triples**
- The result is data that can be consumed as if it were FOAF, without rewriting your original dataset
