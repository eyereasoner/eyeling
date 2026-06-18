# eyelang conformance suite

This directory contains the executable conformance cases for the eyelang language and reference engine. The normative language description is in the [eyelang language reference](../../../docs/eyelang-language-reference.md).

The suite is intentionally file-based so another implementation can run the same programs and compare exact standard output. A case consists of:

- `conformance/cases/<profile>/<name>.pl` — input program;
- `conformance/expected/<profile>/<name>.out` — exact expected standard output.

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

Run a single conformance profile directly:

```sh
node test/eyelang/run-conformance.mjs core
node test/eyelang/run-conformance.mjs extension
```

The runner executes materialized programs in-process through the public JavaScript API so small conformance cases avoid measuring Node startup overhead.

## Profiles

`core` covers the portable core language profile from the [eyelang language reference](../../../docs/eyelang-language-reference.md): lexical syntax, facts, definite clauses, first-order terms, lists, conjunction, structured unification through user predicates, left-to-right goal-directed proof search, materialized output, and read-back printing.

`extension` covers the standard built-in and host behavior exercised by the current reference implementation: arithmetic, comparison, strings, list relations, aggregation, context-term helpers, term-inspection helpers, search-control helpers, `memoize/2`, `materialize/2`, and default derived output.

The profile name `extension` is a test-suite grouping name. It does not mean that these cases are outside the eyelang language reference; most of them correspond to the standard built-in profile and standard host profile in the [eyelang language reference](../../../docs/eyelang-language-reference.md).

## Updating expected output

There is no committed auto-accept mode. To update an expected file, run the matching case with the conformance runner, inspect the result, and replace the corresponding file under `conformance/expected/<profile>/` deliberately.
