# Scientific evidence graph

## Decision

**What should a knowledge graph say when studies disagree?**

This example does not turn every published statement into truth. RDF 1.2 triple terms represent the scientific claims themselves, while study metadata records who produced evidence, study design, sample size, peer review, and whether the result supports or contradicts the claim.

EyeProlog then derives two deliberately different conclusions:

- **marker reduction: supported** — two independent randomized studies with sample size ≥100 agree; a small observational contradiction remains visible as lower-quality counterevidence;
- **survival benefit: contested** — high-quality randomized evidence exists on both sides, so the graph refuses to flatten the disagreement into a single accepted assertion.

## Why this matters

Knowledge graphs are good at storing statements and provenance, but scientific use needs an explicit policy for what those statements justify. The interesting reasoning is about **quality, independence, corroboration, contradiction, and the boundary between evidence and accepted conclusion**.

This is also a natural symbiotic-KG case: machines can extract candidate evidence, RDF preserves the source structure, Prolog makes the acceptance policy inspectable, and humans can challenge either the evidence metadata or the policy itself.

## Files

- [`../scientific-evidence-graph.pl`](../scientific-evidence-graph.pl)
- [`../data/scientific-evidence-graph-input.nq`](../data/scientific-evidence-graph-input.nq)
- [`../data/scientific-evidence-graph-rules.pl`](../data/scientific-evidence-graph-rules.pl)
- [`../data/scientific-evidence-graph-output.nq`](../data/scientific-evidence-graph-output.nq)

## Reproduce

```sh
rdf-to-prolog examples/data/scientific-evidence-graph-input.nq \
  --rules examples/data/scientific-evidence-graph-rules.pl \
  -o examples/scientific-evidence-graph.pl

eyeprolog examples/scientific-evidence-graph.pl

eyeprolog --goal write_results examples/scientific-evidence-graph.pl \
  > examples/data/scientific-evidence-graph-output.pl
prolog-to-rdf examples/data/scientific-evidence-graph-output.pl \
  -o examples/data/scientific-evidence-graph-output.nq
```
