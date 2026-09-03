# EyeProlog profile conformance suite

This directory contains executable tests for the EyeProlog implementation and
reasoner.
[*The Art of EyeProlog*](../../the-art-of-eyeprolog.md) is the reference for the
supported ISO Prolog profile, built-ins, extensions, and reasoner behavior.

The suite is intentionally file-based. Exact standard output, errors, warnings,
and proof output test the behavior of the JavaScript implementation.
[ISO-COMPLIANCE.md](ISO-COMPLIANCE.md) is the high-level Part 1 audit and coverage map. [ISO-BUILTIN-MODE-ERROR-MATRIX.md](ISO-BUILTIN-MODE-ERROR-MATRIX.md)
tracks the row-by-row built-in audit,
[ISO-TERM-SEMANTICS-MATRIX.md](ISO-TERM-SEMANTICS-MATRIX.md) closes 7.1-7.3,
[ISO-PROLOG-TEXT-EXECUTION-MATRIX.md](ISO-PROLOG-TEXT-EXECUTION-MATRIX.md)
closes 7.4-7.8, [ISO-EVALUABLE-FUNCTOR-MATRIX.md](ISO-EVALUABLE-FUNCTOR-MATRIX.md)
closes 7.9/Clause 9, and [ISO-PROCESSOR-REQUIREMENTS.md](ISO-PROCESSOR-REQUIREMENTS.md)
decomposes the Clause 5 processor obligations.
The exit checklist is embedded in [ISO-COMPLIANCE.md](ISO-COMPLIANCE.md). [WG17-SYNTAX-STATUS.md](WG17-SYNTAX-STATUS.md) records the
complete one-to-one trace for the vendored active upstream WG17 syntax cases.
[STC-DRAFT-STATUS.md](STC-DRAFT-STATUS.md) separately tracks executable
implementation questions from the post-N289 working draft (reviewed through the 2026-08-23 items #73-#76); those cases are
review evidence, not normative ISO claims.

“Conformance” here means conformance to EyeProlog's documented ISO compatibility
profile and implementation extensions. The default registry covers the exact
predicate indicators listed in Appendix B of the book across the Part 1 strict-core
target and the normal-mode module/DCG compatibility families. [ISO-COMPLIANCE.md](ISO-COMPLIANCE.md) is the explicit
release-facing ledger for the Part 1 strict-core audit. This suite is not an independent certification. The release-facing Part 1
ledger now has explicit dispositions for Clause 5 processor obligations, Clause 6
syntax/rejection, Clause 7 semantics, the complete 8.2-8.17 built-in family, and
Clause 9 evaluable functors. Public comparison material remains supporting review
evidence rather than a duplicated vendored corpus. Cases under `iso/`
identify standards-derived behavior; other directories cover EyeProlog host
contracts and extensions. EyeProlog-only execution features such as explicit
tabling and `tnot/1` well-founded negation are outside the Part 1 strict-core
claim. Their focused semantic coverage lives primarily in regression tests;
`tnot/1` is absent from the strict ISO registry. The processor character set is documented as the Unicode scalar repertoire with
scalar-value collation in both normal and strict profiles; `--iso-strict`
therefore changes only implementation-specific language facilities, not this
implementation-defined processor choice.

All conformance files live under topic directories such as `arithmetic/`, `lists/`, `syntax/`, or `variables/`; new top-level numbered files should not be added. The report uses those directories as coverage categories.

A normal positive case consists of:

- `conformance/cases/<name>.pl` — input program;
- `conformance/expected/<name>.pl` — exact expected standard output, stored as EyeProlog-readable facts.

Expected-error cases consist of:

- `conformance/errors/<name>.pl` — input program that must fail during parsing or execution;
- `conformance/expected-errors/<name>.txt` — exact expected error message followed by a newline.

Expected-warning cases consist of:

- `conformance/warnings/<name>.pl` — input program run through the CLI with `--warnings`;
- `conformance/expected-warnings/<name>.pl` — exact expected standard output;
- `conformance/expected-warnings/<name>.txt` — exact expected standard error.

Expected-proof cases consist of:

- `conformance/proofs/<name>.pl` — input program run through the CLI with `--proof`;
- `conformance/expected-proofs/<name>.pl` — exact expected standard output, including both answer facts and `why/2` proof facts.

Case names may be nested in category directories such as `arithmetic/`, `strings/`, `lists/`, `terms/`, `atoms/`, `variables/`, `negation/`, or `syntax/`. Expected files mirror the same relative path.

## Running the suite

Run all tests, including conformance, regression, documentation sync, API,
examples, and book examples:

```sh
npm test
```

Run only the conformance suite:

```sh
node test/run-conformance.mjs
```

Run the Part 1 + Corrigenda strict-core processor gate:

```sh
npm run test:iso-strict
```

Run the vendored WG17 conformity matrix independently:

```sh
npm run test:wg17
```

Refresh the WG17 snapshot from the TU Wien conformity tables before a release
or whenever upstream changes:

```sh
npm run wg17:upgrade
npm run test:wg17
```

`wg17:upgrade` reconciles the upstream inventory by identifier: unchanged cases
may keep their reviewed exact outcomes as an additional regression lock,
removed cases disappear, and new or semantically changed cases initially have
no local snapshot. **Every case is always checked independently against the
upstream Codex expectation**, so a reviewed EyeProlog outcome can never make a
non-conforming result pass (the failure mode that previously hid WG17 #227).
The runner follows the upstream `read(G), G` input protocol, including the
terminating newline, so stream-sensitive cases such as #270 and #271 exercise
the characters left after `read/1`. Normal `npm test` remains offline and uses
only the committed upstream snapshot.

Regenerate the public conformance report, including the executable WG17 syntax status and the file-based category inventory:

```sh
node test/run-conformance-report.mjs
node test/run-conformance-report.mjs conformance-report.md
```

Run matching conformance cases by passing a filename or directory fragment:

```sh
node test/run-conformance.mjs reusable
node test/run-conformance.mjs 092_scalar_string_conversions
node test/run-conformance.mjs variables/
node test/run-conformance.mjs error/variables
```

The runner executes normal programs with queries in-process through the public JavaScript API so small conformance cases avoid measuring Node startup overhead. Warning and proof cases intentionally use the CLI because warning output and `why/2` proof output are host-interface contracts.

## Scope

The corpus covers accepted syntax, typed scalar identity and explicit scalar conversions, query answers,
read-back printing, built-ins, directives, warnings, errors, proof output,
and host behavior. It verifies the book's descriptions and is not a separate
language specification.

The `iso/` category follows the mode, success/failure, and error rows in
ISO/IEC 13211-1 clauses 7 and 8. In particular, isolated negative cases keep
instantiation, type, domain, permission, representation, and evaluation errors
independently observable.

Selected cases are adapted from the ISO and standard-core suites of Logtalk,
Scryer Prolog, Trealla Prolog, and SWI-Prolog. Their upstream identifiers and licenses
are recorded in [THIRD_PARTY.md](THIRD_PARTY.md).

The corpus has 386 cases in `iso/` and 802 file-based conformance cases in
total. Of those, 11 cases in `stc/` are explicitly labelled working-draft
review evidence rather than normative ISO claims. The separate strict-reader WG17 matrix has 372 executable dispositions.
The generated `conformance-report.md` is the authoritative source for the current
executable WG17 syntax result and file-based category totals. Together with regression, documentation-sync, API, example,
and book-example checks, `npm test` is the release gate.

## Updating expected output

There is no committed auto-accept mode. To update an expected file, run the matching case with the conformance runner, inspect the result, and replace the corresponding file under `conformance/expected/`, `conformance/expected-errors/`, `conformance/expected-warnings/`, or `conformance/expected-proofs/` deliberately.
