# Operational incident response

## Decision

**What is the most defensible root cause, what is impacted, and what should operations do next?**

The scenario combines a live service topology with incident symptoms and telemetry. EyeProlog correlates a payment API database-timeout symptom with a primary database at 100% disk usage, confirms that the authentication service is healthy, propagates impact through the dependency graph, and recommends failover only because the replica is independently healthy.

## Why this is harder than alert matching

Production incidents are graph-shaped. The component that alarms is often not the component that failed, downstream business services inherit impact transitively, and a mitigation is safe only under additional conditions. A useful answer therefore needs both **correlation** and **dependency reasoning**.

The example exposes the complete chain as ordinary relations: `root_cause/3`, `impacted_service/2`, `recommended_action/2`, and `evidence_chain/2`.

## Files

- [`../operational-incident-response.pl`](../operational-incident-response.pl)
- [`../data/operational-incident-response-input.nq`](../data/operational-incident-response-input.nq)
- [`../data/operational-incident-response-rules.pl`](../data/operational-incident-response-rules.pl)
- [`../data/operational-incident-response-output.nq`](../data/operational-incident-response-output.nq)

## Reproduce

```sh
rdf-to-prolog examples/data/operational-incident-response-input.nq \
  --rules examples/data/operational-incident-response-rules.pl \
  -o examples/operational-incident-response.pl

eyeprolog examples/operational-incident-response.pl

eyeprolog --goal write_results examples/operational-incident-response.pl \
  > examples/data/operational-incident-response-output.pl
prolog-to-rdf examples/data/operational-incident-response-output.pl \
  -o examples/data/operational-incident-response-output.nq
```
