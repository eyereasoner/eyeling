# Explainable EV-depot configuration

## Questions, not just filtering

A depot needs a charger compatible with its **60 kW available site power**, **22 kW minimum charging rate**, **CCS2 connector**, and **three-phase supply**.

EyeProlog does four useful things with the same rules:

1. finds the compatible option (`fleet22`);
2. recommends it;
3. explains why each rejected option fails; and
4. answers the reverse question: **what would have to change to make this option viable?**

Examples include `increase_site_power_to(80)`, `choose_charger_at_least_kw(22)`, and `use_connector(ccs2)`.

That reversibility is a practical difference between a relational rule model and a one-way scoring/filtering pipeline. The rules describe the relationships that must hold, so they can support selection, diagnosis, and what-if questions without creating three separate business-rule implementations.

## Files

- [`../explainable-ev-depot-configuration.pl`](../explainable-ev-depot-configuration.pl)
- [`../data/explainable-ev-depot-configuration-input.nq`](../data/explainable-ev-depot-configuration-input.nq)
- [`../data/explainable-ev-depot-configuration-rules.pl`](../data/explainable-ev-depot-configuration-rules.pl)
- [`../data/explainable-ev-depot-configuration-output.nq`](../data/explainable-ev-depot-configuration-output.nq)

## Reproduce

```sh
rdf-to-prolog examples/data/explainable-ev-depot-configuration-input.nq \
  --rules examples/data/explainable-ev-depot-configuration-rules.pl \
  -o examples/explainable-ev-depot-configuration.pl

eyeprolog examples/explainable-ev-depot-configuration.pl

eyeprolog --goal write_results examples/explainable-ev-depot-configuration.pl \
  > examples/data/explainable-ev-depot-configuration-output.pl
prolog-to-rdf examples/data/explainable-ev-depot-configuration-output.pl \
  -o examples/data/explainable-ev-depot-configuration-output.nq
```
