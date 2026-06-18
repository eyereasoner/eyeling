# eyelang conformance suite

This directory contains the executable conformance cases for the eyelang language and reference engine. The normative language description is in the [eyelang language reference](../../../docs/eyelang-language-reference.md).

The suite is intentionally file-based so another implementation can run the same programs and compare exact standard output. A case consists of:

- `conformance/cases/<name>.pl` — input program;
- `conformance/expected/<name>.pl` — exact expected standard output, stored as eyelang-readable facts.

The current runner compares standard output from normal execution. Proof explanations are opt-in in the CLI and are not part of these conformance goldens. Standard error, performance, and resource limits are outside this suite.

## Running the suite

Run all tests, including conformance, regression, examples, and style checks:

```sh
npm test
```

Run only the conformance suite:

```sh
node test/eyelang/run-conformance.mjs
```

Run matching conformance cases by passing a filename fragment:

```sh
node test/eyelang/run-conformance.mjs reusable
node test/eyelang/run-conformance.mjs 092_scalar_string_conversions
```

The runner executes materialized programs in-process through the public JavaScript API so small conformance cases avoid measuring Node startup overhead.

## Scope

The conformance corpus is a single eyelang suite. It covers the standard language described by the language reference: lexical syntax, facts, definite clauses, first-order terms, lists, conjunction, structured unification, left-to-right goal-directed proof search, materialized output, read-back printing, standard built-ins, declarations, and standard host behavior.

The suite deliberately does not separate `core` and `extension` profiles. Reusable built-ins such as arithmetic, strings, lists, aggregation, context terms, term inspection, and search control are part of the standard eyelang conformance surface. Implementation-specific built-ins may still exist in downstream hosts, but they should have their own tests outside this corpus unless they are standardized.

## Updating expected output

There is no committed auto-accept mode. To update an expected file, run the matching case with the conformance runner, inspect the result, and replace the corresponding file under `conformance/expected/` deliberately.
