# EyeProlog conformance report

This report combines an executable external conformance gate with the file-based
conformance corpus under `test/conformance/`. The executable result is measured
when this report is generated; it is not inferred from fixture counts.

## Executable conformance status

| Gate | Passed | Total | Status |
|---|---:|---:|---|
| WG17 syntax | 372 | 372 | pass |

The WG17 syntax row executes the vendored 372-case conformity-testing matrix
against EyeProlog's strict ISO reader/writer. A behavior fix such as operator-token
spelling therefore changes this report even when no corpus file is added or removed.

## File-based corpus inventory

| Category | Positive | Errors | Warnings | Proofs | Total |
|---|---:|---:|---:|---:|---:|
| aggregation | 17 | 0 | 0 | 0 | 17 |
| arithmetic | 38 | 0 | 0 | 0 | 38 |
| atoms | 23 | 8 | 0 | 0 | 31 |
| builtins | 11 | 0 | 0 | 0 | 11 |
| context | 11 | 0 | 0 | 0 | 11 |
| control | 15 | 0 | 0 | 0 | 15 |
| explicit-tabling | 6 | 0 | 0 | 0 | 6 |
| iso | 169 | 217 | 0 | 0 | 386 |
| lists | 52 | 3 | 0 | 0 | 55 |
| modules | 2 | 0 | 0 | 0 | 2 |
| negation | 8 | 0 | 19 | 0 | 27 |
| proofs | 0 | 0 | 0 | 21 | 21 |
| query | 8 | 2 | 0 | 0 | 10 |
| rules | 13 | 3 | 0 | 0 | 16 |
| stc | 5 | 6 | 0 | 0 | 11 |
| strings | 40 | 0 | 0 | 0 | 40 |
| syntax | 12 | 23 | 0 | 0 | 35 |
| terms | 26 | 3 | 0 | 0 | 29 |
| unification | 18 | 0 | 0 | 0 | 18 |
| variables | 16 | 7 | 0 | 0 | 23 |
| **Total** | **490** | **272** | **19** | **21** | **802** |
