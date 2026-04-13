# ARC-style examples in Eyeling

This page points to the ARC-style examples that currently live in [`examples/`](../). The files themselves are one level up; this folder exists as a convenient index for readers who want to browse Eyeling examples that follow the same presentation pattern.

## What ARC is

[ARC](https://josd.github.io/arc/) stands for **Answer • Reason Why • Check**. The idea is to make a program do three things at once: give the result, explain the small reason that matters, and include a check that can fail loudly when an assumption is wrong. In practice, ARC turns a runnable example into a small, auditable artifact rather than a black box.

In Eyeling, ARC fits naturally: facts hold the data, rules derive the result, `log:outputString` can render a human-readable report, and `=> false` rules can act as hard validation fuses.

## What the Insight Economy is

Ruben Verborgh’s [Insight Economy](https://ruben.verborgh.org/blog/2025/08/12/inside-the-insight-economy/) argues that raw data is a bad thing to trade directly. Instead of handing over the source data, a system should refine it into a **specific, purpose-limited, time-bound insight** that is useful in one context, loses value when copied, and can be governed more safely.

That makes the examples below especially relevant: Eyeling can derive those narrow insights explicitly, explain why they hold, and check that the resulting decision respects policy, purpose, and consistency constraints.

## ARC-style examples in `examples/`

Each entry links to both the source example and the corresponding generated output in [`examples/output/`](../output/).

### Insight Economy and governed-data cases

- [`../auroracare.n3`](../auroracare.n3) · [`../output/auroracare.txt`](../output/auroracare.txt) — Purpose-based medical data exchange with explicit allow/deny reasoning and checks around role, purpose, and conditions.
- [`../calidor.n3`](../calidor.n3) · [`../output/calidor.txt`](../output/calidor.txt) — Heatwave-response case where private household signals become a narrow, expiring cooling-support insight.
- [`../delfour.n3`](../delfour.n3) · [`../output/delfour.txt`](../output/delfour.txt) — Shopping-assistance case where a private condition becomes a bounded “prefer lower-sugar products” insight.
- [`../flandor.n3`](../flandor.n3) · [`../output/flandor.txt`](../output/flandor.txt) — Macro-economic coordination case for Flanders that turns sensitive local signals into a regional retooling insight.
- [`../medior.n3`](../medior.n3) · [`../output/medior.txt`](../output/medior.txt) — Post-discharge care-coordination case that derives a minimal continuity-bundle insight without sharing the full record.
- [`../parcellocker.n3`](../parcellocker.n3) · [`../output/parcellocker.txt`](../output/parcellocker.txt) — One-time parcel pickup authorization with a clear permit decision, justification, and misuse checks.

### Core ARC-style walkthroughs

- [`../bmi.n3`](../bmi.n3) · [`../output/bmi.txt`](../output/bmi.txt) — Body Mass Index calculation with normalization, WHO category assignment, and boundary checks.
- [`../control-system.n3`](../control-system.n3) · [`../output/control-system.txt`](../output/control-system.txt) — Small control-system example that derives actuator commands and explains feedforward and feedback contributions.
- [`../easter.n3`](../easter.n3) · [`../output/easter.txt`](../output/easter.txt) — Gregorian Easter computus with a readable explanation and date-window checks.
- [`../french-cities.n3`](../french-cities.n3) · [`../output/french-cities.txt`](../output/french-cities.txt) — Graph reachability over French cities with explicit path reasoning.
- [`../gps.n3`](../gps.n3) · [`../output/gps.txt`](../output/gps.txt) — Tiny route-planning example for western Belgium with route comparison and metric checks.
- [`../resto.n3`](../resto.n3) · [`../output/resto.txt`](../output/resto.txt) — RESTdesc-style service composition from person and date to a concrete restaurant reservation.
- [`../sudoku.n3`](../sudoku.n3) · [`../output/sudoku.txt`](../output/sudoku.txt) — Sudoku solver and report generator with consistency checks over the solved grid.
- [`../wind-turbine.n3`](../wind-turbine.n3) · [`../output/wind-turbine.txt`](../output/wind-turbine.txt) — Predictive-maintenance example that turns sensor readings into an auditable inspection decision.

### Technical and scientific ARC demos

- [`../matrix-mechanics.n3`](../matrix-mechanics.n3) · [`../output/matrix-mechanics.txt`](../output/matrix-mechanics.txt) — Small 2×2 matrix example deriving trace, determinant, products, and a non-zero commutator.
- [`../pn-junction-tunneling.n3`](../pn-junction-tunneling.n3) · [`../output/pn-junction-tunneling.txt`](../output/pn-junction-tunneling.txt) — Semiconductor toy model that explains current-proxy behavior across bias points.
- [`../transistor-switch.n3`](../transistor-switch.n3) · [`../output/transistor-switch.txt`](../output/transistor-switch.txt) — NPN low-side switch model with exact arithmetic and cutoff-versus-saturation checks.

### Deep-classification stress tests

- [`../deep-taxonomy-10.n3`](../deep-taxonomy-10.n3) · [`../output/deep-taxonomy-10.txt`](../output/deep-taxonomy-10.txt) — ARC-style deep-taxonomy benchmark at depth 10.
- [`../deep-taxonomy-100.n3`](../deep-taxonomy-100.n3) · [`../output/deep-taxonomy-100.txt`](../output/deep-taxonomy-100.txt) — ARC-style deep-taxonomy benchmark at depth 100.
- [`../deep-taxonomy-1000.n3`](../deep-taxonomy-1000.n3) · [`../output/deep-taxonomy-1000.txt`](../output/deep-taxonomy-1000.txt) — ARC-style deep-taxonomy benchmark at depth 1000.
- [`../deep-taxonomy-10000.n3`](../deep-taxonomy-10000.n3) · [`../output/deep-taxonomy-10000.txt`](../output/deep-taxonomy-10000.txt) — ARC-style deep-taxonomy benchmark at depth 10000.
- [`../deep-taxonomy-100000.n3`](../deep-taxonomy-100000.n3) · [`../output/deep-taxonomy-100000.txt`](../output/deep-taxonomy-100000.txt) — ARC-style deep-taxonomy benchmark at depth 100000.

## Why these examples fit together

These files all present reasoning in a recognizably ARC-like way: they derive an answer, make the reason visible in a compact report, and include checks that are meant to catch real mistakes. Some are classical logic or numeric examples; others show how Eyeling can express policy-aware, insight-oriented decision flows without collapsing everything into opaque application code.
