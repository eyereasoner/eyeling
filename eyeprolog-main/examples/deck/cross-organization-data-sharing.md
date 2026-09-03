# Cross-organization data sharing

## Decision

**May this dataset be shared with this organization for this purpose, under these safeguards?**

Three requests deliberately exercise different outcomes: an EU research request is **permitted**, a marketing distribution is **denied** by an explicit ODRL prohibition, and an otherwise valid out-of-region research request is sent to **review** because a required transfer safeguard is missing.

## Why this is challenging

A real sharing decision is not one boolean rule. It combines the requested action and purpose, recipient properties, retention, technical safeguards, legal basis, jurisdiction, explicit prohibitions, and obligations that apply after permission.

The example uses RDF as the interoperable data layer, W3C ODRL terms for permissions/prohibitions, DPV terms for purposes/legal basis, and ISO Prolog rules for the decision procedure. The important output is not only `permit/deny/review`, but the exact condition that produced it.

## Files

- [`../cross-organization-data-sharing.pl`](../cross-organization-data-sharing.pl)
- [`../data/cross-organization-data-sharing-input.nq`](../data/cross-organization-data-sharing-input.nq)
- [`../data/cross-organization-data-sharing-rules.pl`](../data/cross-organization-data-sharing-rules.pl)
- [`../data/cross-organization-data-sharing-output.nq`](../data/cross-organization-data-sharing-output.nq)

## Reproduce

```sh
rdf-to-prolog examples/data/cross-organization-data-sharing-input.nq \
  --rules examples/data/cross-organization-data-sharing-rules.pl \
  -o examples/cross-organization-data-sharing.pl

eyeprolog examples/cross-organization-data-sharing.pl

eyeprolog --goal write_results examples/cross-organization-data-sharing.pl \
  > examples/data/cross-organization-data-sharing-output.pl
prolog-to-rdf examples/data/cross-organization-data-sharing-output.pl \
  -o examples/data/cross-organization-data-sharing-output.nq
```
