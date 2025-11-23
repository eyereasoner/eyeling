# eyelite

A small Notation3 (N3) parser and lightweight reasoner in Rust.

`eyelite` aims to be tiny, hackable, and useful for experiments. It parses a practical subset of N3 (a superset of Turtle) and performs forward- and backward-chaining over simple Horn-style rules, with a growing set of N3 built-ins.

---

## Features

### Parsing (practical subset of N3)

Supported:

- `@prefix` / `@base` directives
- Triples with `;` and `,` predicate/object lists
- Variables `?x`
- Blank nodes `[]` (anonymous bnodes)
- Collections `(...)`
- Quoted formulas `{ ... }`
- Implications:
  - forward rules `{P} => {C}.`
  - backward rules `{C} <= {P}.`
- Datatyped literals using `^^` (e.g., `"1944-08-21"^^xsd:date`)
- Comments starting with `#`

Non-goals / limitations (for now):

- The full W3C N3 grammar is larger than what we implement (PN_* edge cases, property lists, paths, quantifiers, etc.).
- Quoted-formula **pattern matching** in rules is not implemented (formulas behave like opaque terms unless fully grounded).
- No proof objects.
- Builtins are intentionally incomplete.

---

## Reasoning

- **Forward chaining** to fixpoint over Horn-like rules.
- **Backward chaining** (goal-directed) with simple SLD-style search.
- **Backward rules** can “seed” forward runs: forward premises are proven using backward rules + builtins to produce extra ground facts, then forward chaining continues.

---

## Builtins

Builtins are recognized by expanded IRIs and evaluated during premise/goal checking.

Currently supported math/log/time builtins include (see N3 Builtins report for definitions):

### `math:`

- `math:sum` (list form)
- `math:product` (list form)
- `math:difference` (list form)
- `math:quotient` (list form)
- `math:exponentiation` (list form; includes inverse exponent solve)
- Comparisons:
  - `math:greaterThan`
  - `math:lessThan`
  - `math:notLessThan` (>=)

**Extensions beyond the report (pragmatic):**
- If the list to `math:difference` contains `xsd:date`/`xsd:dateTime`, the result is an `xsd:duration`.
- Comparisons accept `xsd:duration` by converting to an approximate number of seconds (years/months are approximated).

### `log:`

- `log:equalTo`
- `log:notEqualTo`

### `time:`

- `time:localTime` (legacy CWM/SWAP builtin):  
  `"" time:localTime ?D.` binds `?D` to the current local time as an `xsd:dateTime`.

---

## Layout

This crate is deliberately small and self-contained:

- `src/main.rs` — lexer, parser, AST, builtins, backward prover, forward fixpoint, CLI

Dependency note:
- Uses `chrono` for `time:localTime` and date/duration math.

---

## Quick start

### Run eyelite on a file

```bash
cargo run --release -- path/to/file.n3
# or after building:
target/release/eyelite path/to/file.n3
```

`eyelite` outputs **only forward-rule derivations** (not the input facts), printed as N3/Turtle.
Predicates equal to `rdf:type` are printed as `a`.

---

## Examples

### Socrates (forward chaining)

Input:

```n3
@prefix rdfs: .
@prefix : .

:Socrates a :Human.
:Human rdfs:subClassOf :Mortal.

{ ?A rdfs:subClassOf ?B. ?S a ?A. } => { ?S a ?B. }.
```

Run:

```bash
target/release/eyelite input/socrates.n3
```

Output:

```n3
@prefix : .
:Socrates a :Mortal .
```

---

### Backward rule + builtin seeding

Input:

```n3
@prefix math: .
@prefix : .

# something is more interesting if it is greater
{ ?X :moreInterestingThan ?Y. } <= { ?X math:greaterThan ?Y. }.

# derivation
{ 5 :moreInterestingThan 3. } => { 5 :isIndeedMoreInterestingThan 3. }.
```

Output:

```n3
@prefix : .
5 :isIndeedMoreInterestingThan 3 .
```

---

### Age checker (dates + durations + time)

Input:

```n3
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix time: <http://www.w3.org/2000/10/swap/time#>.
@prefix math: <http://www.w3.org/2000/10/swap/math#>.
@prefix : <https://example.org/#>.

:patH :birthDay "1944-08-21"^^xsd:date.

{ ?S :ageAbove ?A } <= {
    ?S :birthDay ?B.
    "" time:localTime ?D.
    (?D ?B) math:difference ?F.
    ?F math:greaterThan ?A.
}.

{
    ?S :ageAbove "P80Y"^^xsd:duration.
} => {
    :test :is true.
}.
```

Expected derivation:

```n3
@prefix : <https://example.org/#> .
:test :is true .
```

