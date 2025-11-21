# eyelite

A small Notation3 (N3) parser in Rust with a lightweight reasoner.

`eyelite` parses a practical subset of N3 (a superset of Turtle)
and supports forward- and backward-chaining over simple Horn-style rules,
plus a tiny set of N3 built-ins (currently enough for classic tutorial examples).

## Features

### Parsing (subset of N3)
- `@prefix` / `@base` directives
- Triples with `;` and `,` lists
- Blank nodes `[]`, collections `()`
- Variables `?x`
- Quoted formulas `{ ... }`
- Implications:
  - forward rules `{P} => {C}.`
  - backward rules `{C} <= {P}.`
- Practical prefixed names + IRIs (simplified PN_* for now)

### Reasoning
- **Forward chaining** to fixpoint over Horn-like rules
- **Backward chaining** (goal-directed) with simple SLD-style search
- Built-in predicate evaluation:
  - `math:greaterThan` numeric comparison

## Non-goals / limitations (for now)

- Grammar is intentionally simplified vs. the full W3C N3 EBNF.
- No proof objects, no full builtin catalog yet.
- No special semantics for paths `!`/`^`, inverse `<-`, etc. in reasoning.
- Quoted-formula pattern matching in rules is not implemented (premises are treated as normal triples).

This is meant to be small, hackable, and useful for experiments.

## Layout

- `src/n3.pest` — Pest grammar
- `src/parser.rs` — parse tree → AST
- `src/ast.rs` — AST types
- `src/resolve.rs` — prefix env + prefixed-name/IRI expansion
- `src/reasoner.rs` — forward + backward chaining + builtins
- `src/bin/eyelite.rs` — generic CLI (parse + reason + print forward derivations)

## Quick start

### Run eyelite on a file

```bash
cargo run --release --bin eyelite -- path/to/file.n3
# or after building:
target/release/eyelite path/to/file.n3
```

`eyelite` outputs **only forward-rule derivations** (not the original facts),
printed as N3/Turtle with a default `:` prefix when available.
Predicates equal to `rdf:type` are printed using `a`.

### Example: Socrates (forward chaining)

Input:

```n3
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix : <http://example.org/socrates#>.

:Socrates a :Human.
:Human rdfs:subClassOf :Mortal.

{
  ?A rdfs:subClassOf ?B.
  ?S a ?A.
} => {
  ?S a ?B.
}.
```

Run:

```bash
target/release/eyelite input/socrates.n3
```

Output:

```n3
@prefix : <http://example.org/socrates#>.

:Socrates a :Mortal .
```

### Example: Backward rule + builtin seeding

Input:

```n3
@prefix math: <http://www.w3.org/2000/10/swap/math#>.
@prefix : <http://example.org/#>.

# something is more interesting if it is greater
{
    ?X :moreInterestingThan ?Y.
} <= {
    ?X math:greaterThan ?Y.
}.

# derivation
{
    5 :moreInterestingThan 3.
} => {
    5 :isIndeedMoreInterestingThan 3.
}.
```

Run:

```bash
target/release/eyelite input/backward_demo.n3
```

Output:

```n3
@prefix : <http://example.org/#>.

5 :isIndeedMoreInterestingThan 3 .
```

## Under the hood

### Parsing pipeline

1. **Pest grammar (`n3.pest`)** parses N3 into a parse tree.
2. **AST builder (`parser.rs`)** converts it into `ast.rs` structures:

   * expands `;` and `,` lists into individual triples
   * preserves formulas and implications as structured nodes

### Prefix resolution

`resolve.rs` builds a `PrefixEnv` from directives:

* reads explicit `@prefix` / `@base`
* rewrites all `Term::PrefixedName` into full `Term::Iri`
* does **not** invent missing prefix IRIs

### Rule extraction

`reasoner.rs::extract` produces:

* **ground facts**: triples without variables
* **rules**: implications where premises/conclusions are conjunctions of triple patterns
  Backward rules `{C} <= {P}` are flipped to forward orientation internally (`P => C`)
  so both engines can use them.

### Backward seeding for forward runs

The CLI (`src/bin/eyelite.rs`) runs a small preparatory step:

* for each **ground premise** of a forward rule, it tries to prove it using backward chaining
* successful ground premises are added to the fact set
* then forward chaining runs on forward rules only

This is why backward rules + builtins can enable forward derivations.

### Forward chaining

Naive fixpoint:

* match forward-rule premises against current facts
* produce bindings
* instantiate conclusions into new facts
* repeat until no new facts appear

### Backward chaining

Goal-directed solver:

* tries to prove a goal by:

  1. matching an existing fact
  2. matching a rule conclusion, then recursively proving that rule’s premise
* freshens rule variables to avoid collisions
* includes a recursion depth guard

### Builtins

Built-in predicates are recognized by expanded IRI
and evaluated during premise/goal checking instead of being matched to facts.

Current support:

* `math:greaterThan` numeric comparison

## Extending

Easy next steps:

* tighten PN_* / IRIREF rules to spec
* add more built-ins from the N3 Builtins report
* add nicer output formatting with multiple prefixes
* quoted-formula reasoning (`log:includes`, etc.)

