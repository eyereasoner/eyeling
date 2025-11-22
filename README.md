# eyelite

A small Notation3 (N3) reasoner in Rust.

- Parses a practical subset of the W3C N3 grammar.
- Supports **forward chaining** rules (`=>`) to fixpoint.
- Uses **backward chaining** rules (`<=`) only to help satisfy forward premises (EYE-style hybrid).
- Outputs **only newly forward-derived triples**, in N3.

This is a lightweight, hackable interpreter inspired by EYE / Eyelite, not a full N3 implementation.

## Build and run all examples

```sh
make
```

## Supported N3 subset

* `@prefix`, `@base`
* triples with `;` and `,`
* variables `?x`
* lists `(...)`
* blanks `[]` (simple)
* formulas `{ ... }`
* rules: `{P} => {C}.` and `{C} <= {P}.`
* top-level `log:implies` / `log:impliedBy`

## Builtins (current)

Implemented math/log builtins sufficient for the included examples, e.g.:

* `math:sum`, `math:product` (variadic)
* `math:difference`, `math:quotient`
* `math:exponentiation` (forward + inverse for exponent)
* `math:greaterThan`, `math:lessThan`, `math:notLessThan`
* `math:sin`, `math:cos`, `math:asin`, `math:acos`
* `math:negation`, `math:absoluteValue`
* `log:equalTo`, `log:notEqualTo`

Extending builtins = add cases in `eval_builtin`.

## Limitations

* Not full N3: no path operators (`!`, `^`), no advanced quoting or scoped formula matching.
* Backward chaining is goal-directed and only used while matching forward rules.
* Minimal blank node/property list support.
* Numeric literal handling is pragmatic, not a full RDF term model.

