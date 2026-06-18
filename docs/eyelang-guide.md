# eyelang Guide

This guide introduces eyelang, the small Prolog-style Horn-clause engine bundled with Eyeling. eyelang works over ordinary terms, lists, arithmetic, strings, and finite search. Run it through the main Eyeling CLI with `eyeling --engine eyelang`, or use `node lib/eyelang/bin.js` when working directly from a source checkout.

Programs write relations directly, for example `ancestor(pat, emma)` or `status(case1, accepted)`. eyelang output is ordinary eyelang syntax: by default, the CLI materializes selected answer facts and prints those facts only. Pass `--proof` (or `-p`) when you also want each answer followed by a `why/2` explanation fact that records the proof. Programs may add `materialize(Name, Arity).` declarations to focus output on selected predicates.


Try it in the [Eyeling browser playground](https://eyereasoner.github.io/eyeling/playground). The playground includes run options equivalent to CLI `--stats` and `--proof` when the eyelang engine is selected.

For the normative language definition, including lexical syntax, terms, clauses, goals, built-ins, `memoize/2`, `materialize/2`, and conformance boundaries, read the [eyelang language reference](eyelang-language-reference.md).

## Contents

1. [Quick start](#quick-start)
2. [Running eyelang](#running-eyelang)
3. [Default output](#default-output)
4. [Writing programs](#writing-programs)
5. [Aggregation helpers](#aggregation-helpers)
6. [Context data](#context-data)
7. [Example catalog](#example-catalog)
8. [Golden outputs, tests, and conformance](#golden-outputs-tests-and-conformance)
9. [Development and release](#development-and-release)
10. [Relationship to Eyeling](#relationship-to-eyeling)
11. [Performance notes](#performance-notes)
12. [Implementation limits](#implementation-limits)

## Quick start

Install dependencies, then run the eyelang engine through the main CLI:

```sh
npm install
```

There is no build step for the source-checkout CLI path. Run examples, multiple inputs, stdin, or a URL:

```sh
eyeling --engine eyelang --version
eyeling --engine eyelang examples/eyelang/ancestor.pl
eyeling --engine eyelang facts.pl rules.pl
printf 'works(stdin, true) :- eq(ok, ok).\n' | eyeling --engine eyelang -
eyeling --engine eyelang https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/examples/eyelang/ancestor.pl
```

The CLI runs directly on Node.js 18 or newer. From a source checkout, `node lib/eyelang/bin.js` exposes the same eyelang-specific options without going through the `--engine` router.

Serve the playground locally:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/playground.html
```

## Running eyelang

Show the package version:

```sh
eyeling --engine eyelang --version
eyeling --engine eyelang -v
```

Run a program and let eyelang print derived binary facts:

```sh
eyeling --engine eyelang examples/eyelang/ancestor.pl
```

Enable proof explanations when you want machine-readable provenance:

```sh
eyeling --engine eyelang --proof examples/eyelang/ancestor.pl
eyeling --engine eyelang -p examples/eyelang/ancestor.pl
```

eyelang-readable explanations are opt-in proof output. Each `why/2` fact contains a nested abstract proof term, and a blank line separates consecutive explanations. Using eyelang syntax for explanations keeps them in the same language as the answers themselves: they are readable by humans, parseable by eyelang, easy to test, and can be transformed or explained further like any other eyelang data. For example:

```prolog
type(socrates, mortal).
why(
  type(socrates, mortal),
  proof(
    goal(type(socrates, mortal)),
    by(rule("socrates.pl", clause(4))),
    bindings([binding("X", socrates)]),
    uses([
      proof(
        goal(type(socrates, man)),
        by(fact("socrates.pl", clause(3)))
      )
    ])
  )
).

```

The explanation output can itself be read as eyelang input; for example, another program can materialize `why/2` facts such as `why(type(socrates, mortal), Proof)`. `--proof` adds only these explanation facts; it does not change the answers found by the solver.

### Explanation cookbook

eyelang answers can carry their own provenance when proof output is enabled.

Explain one derived fact:

```sh
eyeling --engine eyelang --proof examples/eyelang/socrates.pl
```

The output contains the answer and a `why/2` fact. The proof term shows the source rule that produced the answer and the source fact used below it. Source references use `rule("file.pl", clause(N))` and `fact("file.pl", clause(N))`, where `N` is the 1-based clause number in that file.

Inspect variable bindings with a small policy program:

```prolog
score(case1, 95).
threshold(90).

status(Case, accepted) :-
  score(Case, Score),
  threshold(T),
  ge(Score, T).
```

```sh
eyeling --engine eyelang --proof policy.pl
```

The explanation contains the instantiated answer and the variables that made the rule succeed:

```prolog
status(case1, accepted).
why(
  status(case1, accepted),
  proof(
    goal(status(case1, accepted)),
    by(rule("policy.pl", clause(3))),
    bindings([binding("Case", case1), binding("Score", 95), binding("T", 90)]),
    uses([...])
  )
).
```

Use the `uses([...])` list to follow the proof tree. In the policy example it contains one subproof for `score(case1, 95)`, one for `threshold(90)`, and one for the built-in comparison `ge(95, 90)`. Built-ins are shown as `builtin(Name, Arity)` because they do not come from source clauses.

Reuse explanations as data:

```sh
eyeling --engine eyelang --proof examples/eyelang/socrates.pl > socrates.why.pl
```

The resulting file is ordinary eyelang syntax containing both answers and `why/2` proof facts.

Compose multiple files, stdin, and URLs:

```sh
eyeling --engine eyelang facts.pl rules.pl
printf 'works(stdin, true) :- eq(ok, ok).\n' | eyeling --engine eyelang -
eyeling --engine eyelang https://example.test/program.pl
```

## Default output

eyelang programs write relation predicates directly:

```prolog
parent(pat, jan).
parent(jan, emma).

ancestor(X, Y) :- parent(X, Y).
ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).
```

By default, eyelang asks for new ground consequences of selected output predicates, suppresses duplicates, excludes source facts, sorts the result, and prints Prolog facts:

```prolog
ancestor(jan, emma).
ancestor(pat, emma).
ancestor(pat, jan).
```

This default is intentionally output-oriented. It is not a complete bottom-up saturation engine. Built-ins and proof search remain goal-directed; use `materialize/2` declarations and small output predicates when you want a specific relation, arity, or non-binary answer.

### Focusing default output

Large examples often have internal helper predicates. Add `materialize(Name, Arity).` declarations to restrict default output to selected predicates:

```prolog
materialize(answer, 2).

seed(case1).
helper(Case, score(95)) :- seed(Case).
answer(Case, accepted) :- helper(Case, score(95)).
```

The default output is then:

```prolog
answer(case1, accepted).
```

`materialize/2` is a declaration, not a logical rule to prove. It affects which predicates the CLI prints, not the meaning of the rules themselves.

## Writing programs

A good eyelang program normally has three layers:

1. source facts;
2. helper predicates for calculation or search;
3. concise relation-style outputs, usually binary predicates such as `status(Case, Value)`, `reason(Case, Text)`, `ancestor(Person, Ancestor)`, or `cost(Path, Amount)`.

Example:

```prolog
score(case1, 95).
threshold(90).

accepted(Case) :-
  score(Case, Score),
  threshold(Threshold),
  ge(Score, Threshold).

status(Case, accepted) :- accepted(Case).
reason(Case, "score exceeds threshold") :- accepted(Case).
```

When `status/2` and `reason/2` are derived, they appear in default output. If the program has many helper binary predicates, declare the intended output predicates:

```prolog
materialize(status, 2).
materialize(reason, 2).
```

### Naming

Predicate names and atom constants use the same lexical form. Namespace-like names should be plain names such as `type`, `person_name`, or `odrl_permission`; colon names are not part of the language.

### Embedding remains general

The CLI is output-oriented and uses `materialize/2` to decide what to print. Embedders can still use the JavaScript API and `Solver` directly for arbitrary goals and arities.

Add `-s` or `--stats` when you want lightweight solver counters on stderr without changing stdout:

```sh
eyeling --engine eyelang -s examples/eyelang/n-queens.pl
```

The playground has matching `--stats` and `--proof` checkboxes, so browser runs can show the same counters or explanations like the CLI.


### Builtins

eyelang builtins are registered by name and arity in small modules under [`lib/eyelang/builtins`](../lib/eyelang/builtins). This keeps the runtime portable to Node.js and the browser while giving each builtin family a clear boundary. Builtins are enabled by normal predicate calls.

The core builtin families cover unification, arithmetic, comparison, dates, strings, lists, aggregation, context terms, and search control. Additional reusable finite-search helpers are available only where bundled examples need them to avoid large amounts of repetitive generate-and-test code. These helpers are deliberately general relations rather than shortcuts tied to a particular example name. For example:

```prolog
answer(Queens) :-
  n_queens(8, Queens).

best(Cycle, Cost) :-
  cities(Cities),
  weighted_hamiltonian_cycle(edge, Cities, Cycle, Cost).
```

The reusable search and numeric helpers include `n_queens/2`, Hamiltonian path/cycle helpers, `bounded_path/5`, `cnf_model/3`, Quine-McCluskey helpers, number-theory helpers such as `extended_gcd/5`, and matrix helpers such as `matrix_multiply/2`. These helpers are extension builtins of this implementation; [the eyelang language reference](eyelang-language-reference.md) defines the portable core and standard builtin profile. The complete bundled implementation list is kept in the top-level [README built-ins section](../README.md#built-ins-1), and the regression suite checks that table against the actual runtime registry.

To add a builtin, create or extend a module with `register(registry)` and call `registry.add(name, arity, handler, options)`. The default registry is assembled in [`lib/eyelang/builtins/registry.js`](../lib/eyelang/builtins/registry.js). Builtins that are only safe for specific argument modes should provide a `ready` predicate and `fallbackWhenNotReady: true`, so user-defined clauses remain visible until the builtin is applicable.


## Aggregation helpers

eyelang includes goal-directed aggregation helpers for finite searches:

```prolog
countall(Goal, Count).
sumall(Value, Goal, Sum).
aggregate_min(Key, Template, Goal, BestKey, BestTemplate).
aggregate_max(Key, Template, Goal, BestKey, BestTemplate).
```

Use `countall/2` for solution counts, `sumall/3` for numeric totals, and `aggregate_min/5` or `aggregate_max/5` when a search should keep only the best candidate instead of collecting and sorting every answer. The `Key` can be a number, atom constant, string, compound term, or list; normal term ordering is used, so compound keys such as `[Cost, Path]` are useful for deterministic tie-breaking.

Example:

```prolog
best_cycle(Cycle, Cost) :-
  cities(Cities),
  aggregate_min([Cost, Cycle], Cycle, candidate_cycle(Cities, Cycle, Cost), [Cost, Cycle], Cycle).
```

## Context data

Comma terms can be data as well as conjunctions. eyelang provides two context utilities:

```prolog
holds((name(alice, "Alice"), knows(alice, bob)), name(S, O)).
holds((ready, name(alice, "Alice"), route(alice, bob, 7)), Name, Args).
```

Use `holds/2` when you want to match the member term directly, for example `name(S, O)`, `route(A, B, Cost)`, or `edge(A, arc(B, Cost))`. Use `holds/3` when you need the predicate name and argument list as data: it exposes any-arity member as atom constant `Name` plus a proper list `Args`, so zero-, binary-, and ternary members appear as `ready/0`, `name/2`, and `route/3` shapes without a special binary predicate. These utilities are useful for quoted context data, but they do not make those context members true in the ambient program. The [`context-schema-audit.pl`](../examples/eyelang/context-schema-audit.pl) example shows a case that really needs `holds/3`: it audits heterogeneous message contexts by extracting every member as `Name + Args`, computing each arity, and checking the resulting shape against a schema without knowing the predicate names in advance.

`matches/3` can create context data from named regular-expression captures, which is useful when text logs or messages need to become facts before later rules inspect them with `holds/2` or `holds/3`. See [`observability-log-correlation.pl`](../examples/eyelang/observability-log-correlation.pl) for a complete log-correlation example.

The N3 counterpart of the context schema audit lives at [`examples/context-schema-audit.n3`](../examples/context-schema-audit.n3) with golden output in [`examples/output/context-schema-audit.md`](../examples/output/context-schema-audit.md).


## Example catalog

The repository includes examples for recursion, graph reachability, finite search, arithmetic, list processing, optimization, policies, puzzles, and applied scientific calculations. Bundled examples use relation-style output.

| Input | Short description | Output |
| --- | --- | --- |
| [`access-control-policy.pl`](../examples/eyelang/access-control-policy.pl) | Evaluates role and condition based access decisions. | [`output/access-control-policy.pl`](../examples/eyelang/output/access-control-policy.pl) |
| [`ackermann.pl`](../examples/eyelang/ackermann.pl) | Computes Ackermann-style hyperoperation values. | [`output/ackermann.pl`](../examples/eyelang/output/ackermann.pl) |
| [`age.pl`](../examples/eyelang/age.pl) | Checks whether people meet age thresholds. | [`output/age.pl`](../examples/eyelang/output/age.pl) |
| [`aliases-and-namespaces.pl`](../examples/eyelang/aliases-and-namespaces.pl) | Shows ordinary predicate names for vocabulary aliases. | [`output/aliases-and-namespaces.pl`](../examples/eyelang/output/aliases-and-namespaces.pl) |
| [`alignment-demo.pl`](../examples/eyelang/alignment-demo.pl) | Rolls dataset concepts up through a small alignment taxonomy. | [`output/alignment-demo.pl`](../examples/eyelang/output/alignment-demo.pl) |
| [`allen-interval-calculus.pl`](../examples/eyelang/allen-interval-calculus.pl) | Classifies interval relations with integer time offsets. | [`output/allen-interval-calculus.pl`](../examples/eyelang/output/allen-interval-calculus.pl) |
| [`ancestor.pl`](../examples/eyelang/ancestor.pl) | Derives ancestors from parent facts. | [`output/ancestor.pl`](../examples/eyelang/output/ancestor.pl) |
| [`animal.pl`](../examples/eyelang/animal.pl) | Classifies animals from traits. | [`output/animal.pl`](../examples/eyelang/output/animal.pl) |
| [`annotation.pl`](../examples/eyelang/annotation.pl) | Derives facts from quoted annotation data. | [`output/annotation.pl`](../examples/eyelang/output/annotation.pl) |
| [`auroracare.pl`](../examples/eyelang/auroracare.pl) | Evaluates purpose-based medical data access scenarios. | [`output/auroracare.pl`](../examples/eyelang/output/auroracare.pl) |
| [`backward.pl`](../examples/eyelang/backward.pl) | Shows a backward-rule pattern as a goal-directed numeric rule. | [`output/backward.pl`](../examples/eyelang/output/backward.pl) |
| [`basic-monadic.pl`](../examples/eyelang/basic-monadic.pl) | Runs a monadic benchmark over generated inputs. | [`output/basic-monadic.pl`](../examples/eyelang/output/basic-monadic.pl) |
| [`bayes-diagnosis.pl`](../examples/eyelang/bayes-diagnosis.pl) | Computes scaled Bayesian diagnosis posteriors. | [`output/bayes-diagnosis.pl`](../examples/eyelang/output/bayes-diagnosis.pl) |
| [`bayes-therapy.pl`](../examples/eyelang/bayes-therapy.pl) | Ranks therapies using Bayesian disease likelihoods. | [`output/bayes-therapy.pl`](../examples/eyelang/output/bayes-therapy.pl) |
| [`beam-deflection.pl`](../examples/eyelang/beam-deflection.pl) | Computes cantilever beam deflection. | [`output/beam-deflection.pl`](../examples/eyelang/output/beam-deflection.pl) |
| [`blocks-world-planning.pl`](../examples/eyelang/blocks-world-planning.pl) | Searches a finite blocks-world plan. | [`output/blocks-world-planning.pl`](../examples/eyelang/output/blocks-world-planning.pl) |
| [`bmi.pl`](../examples/eyelang/bmi.pl) | Normalizes BMI inputs and classifies weight. | [`output/bmi.pl`](../examples/eyelang/output/bmi.pl) |
| [`braking-safety-worlds.pl`](../examples/eyelang/braking-safety-worlds.pl) | Classifies braking safety under alternative worlds. | [`output/braking-safety-worlds.pl`](../examples/eyelang/output/braking-safety-worlds.pl) |
| [`buck-converter-design.pl`](../examples/eyelang/buck-converter-design.pl) | Checks buck-converter ripple design. | [`output/buck-converter-design.pl`](../examples/eyelang/output/buck-converter-design.pl) |
| [`cache-performance.pl`](../examples/eyelang/cache-performance.pl) | Summarizes cache latency performance. | [`output/cache-performance.pl`](../examples/eyelang/output/cache-performance.pl) |
| [`canary-release.pl`](../examples/eyelang/canary-release.pl) | Decides canary rollout or rollback. | [`output/canary-release.pl`](../examples/eyelang/output/canary-release.pl) |
| [`cat-koko.pl`](../examples/eyelang/cat-koko.pl) | Demonstrates named existential witnesses from a Cat Koko rule pattern. | [`output/cat-koko.pl`](../examples/eyelang/output/cat-koko.pl) |
| [`clinical-trial-screening.pl`](../examples/eyelang/clinical-trial-screening.pl) | Screens candidates for a trial. | [`output/clinical-trial-screening.pl`](../examples/eyelang/output/clinical-trial-screening.pl) |
| [`collatz-1000.pl`](../examples/eyelang/collatz-1000.pl) | Computes shared Collatz trajectories. | [`output/collatz-1000.pl`](../examples/eyelang/output/collatz-1000.pl) |
| [`combinatorics-findall-sort.pl`](../examples/eyelang/combinatorics-findall-sort.pl) | Collects and sorts finite combinations. | [`output/combinatorics-findall-sort.pl`](../examples/eyelang/output/combinatorics-findall-sort.pl) |
| [`competitive-enzyme-kinetics.pl`](../examples/eyelang/competitive-enzyme-kinetics.pl) | Computes inhibited enzyme reaction rates. | [`output/competitive-enzyme-kinetics.pl`](../examples/eyelang/output/competitive-enzyme-kinetics.pl) |
| [`complex-matrix-stability.pl`](../examples/eyelang/complex-matrix-stability.pl) | Checks stability of a 2x2 system. | [`output/complex-matrix-stability.pl`](../examples/eyelang/output/complex-matrix-stability.pl) |
| [`complex.pl`](../examples/eyelang/complex.pl) | Performs arithmetic on complex pairs. | [`output/complex.pl`](../examples/eyelang/output/complex.pl) |
| [`composition-of-injective-functions-is-injective.pl`](../examples/eyelang/composition-of-injective-functions-is-injective.pl) | Encodes composition and injectivity of finite functions. | [`output/composition-of-injective-functions-is-injective.pl`](../examples/eyelang/output/composition-of-injective-functions-is-injective.pl) |
| [`context-association.pl`](../examples/eyelang/context-association.pl) | Associates named contexts with their contents. | [`output/context-association.pl`](../examples/eyelang/output/context-association.pl) |
| [`context-schema-audit.pl`](../examples/eyelang/context-schema-audit.pl) | Audits mixed-arity context members with `holds/3`. | [`output/context-schema-audit.pl`](../examples/eyelang/output/context-schema-audit.pl) |
| [`control-system.pl`](../examples/eyelang/control-system.pl) | Evaluates control-system measurements and targets. | [`output/control-system.pl`](../examples/eyelang/output/control-system.pl) |
| [`cyclic-path.pl`](../examples/eyelang/cyclic-path.pl) | Computes paths in a cyclic graph. | [`output/cyclic-path.pl`](../examples/eyelang/output/cyclic-path.pl) |
| [`d3-group.pl`](../examples/eyelang/d3-group.pl) | Enumerates subgroups of the D3 group. | [`output/d3-group.pl`](../examples/eyelang/output/d3-group.pl) |
| [`dairy-energy-balance.pl`](../examples/eyelang/dairy-energy-balance.pl) | Classifies dairy cow energy balance. | [`output/dairy-energy-balance.pl`](../examples/eyelang/output/dairy-energy-balance.pl) |
| [`data-negotiation.pl`](../examples/eyelang/data-negotiation.pl) | Chooses an accepted data-negotiation offer. | [`output/data-negotiation.pl`](../examples/eyelang/output/data-negotiation.pl) |
| [`deep-taxonomy-10.pl`](../examples/eyelang/deep-taxonomy-10.pl) | Stress-tests recursive taxonomy depth 10. | [`output/deep-taxonomy-10.pl`](../examples/eyelang/output/deep-taxonomy-10.pl) |
| [`deep-taxonomy-100.pl`](../examples/eyelang/deep-taxonomy-100.pl) | Stress-tests recursive taxonomy depth 100. | [`output/deep-taxonomy-100.pl`](../examples/eyelang/output/deep-taxonomy-100.pl) |
| [`deep-taxonomy-1000.pl`](../examples/eyelang/deep-taxonomy-1000.pl) | Stress-tests recursive taxonomy depth 1000. | [`output/deep-taxonomy-1000.pl`](../examples/eyelang/output/deep-taxonomy-1000.pl) |
| [`deep-taxonomy-10000.pl`](../examples/eyelang/deep-taxonomy-10000.pl) | Stress-tests recursive taxonomy depth 10000. | [`output/deep-taxonomy-10000.pl`](../examples/eyelang/output/deep-taxonomy-10000.pl) |
| [`deep-taxonomy-100000.pl`](../examples/eyelang/deep-taxonomy-100000.pl) | Stress-tests recursive taxonomy depth 100000. | [`output/deep-taxonomy-100000.pl`](../examples/eyelang/output/deep-taxonomy-100000.pl) |
| [`delfour.pl`](../examples/eyelang/delfour.pl) | Derives shopping and authorization recommendations. | [`output/delfour.pl`](../examples/eyelang/output/delfour.pl) |
| [`dense-hamiltonian-cycle.pl`](../examples/eyelang/dense-hamiltonian-cycle.pl) | Searches a dense Hamiltonian cycle with aggregate minimization. | [`output/dense-hamiltonian-cycle.pl`](../examples/eyelang/output/dense-hamiltonian-cycle.pl) |
| [`deontic-logic.pl`](../examples/eyelang/deontic-logic.pl) | Reports obligations, prohibitions, and violations. | [`output/deontic-logic.pl`](../examples/eyelang/output/deontic-logic.pl) |
| [`derived-backward-rule.pl`](../examples/eyelang/derived-backward-rule.pl) | Derives an inverse-property backward rule from rule data. | [`output/derived-backward-rule.pl`](../examples/eyelang/output/derived-backward-rule.pl) |
| [`derived-rule.pl`](../examples/eyelang/derived-rule.pl) | Derives conclusions from rule data. | [`output/derived-rule.pl`](../examples/eyelang/output/derived-rule.pl) |
| [`diamond-property.pl`](../examples/eyelang/diamond-property.pl) | Checks the diamond property of a relation. | [`output/diamond-property.pl`](../examples/eyelang/output/diamond-property.pl) |
| [`dijkstra-findall-sort.pl`](../examples/eyelang/dijkstra-findall-sort.pl) | Finds shortest paths using collected candidates. | [`output/dijkstra-findall-sort.pl`](../examples/eyelang/output/dijkstra-findall-sort.pl) |
| [`dijkstra-risk-path.pl`](../examples/eyelang/dijkstra-risk-path.pl) | Ranks routes by cost and trust. | [`output/dijkstra-risk-path.pl`](../examples/eyelang/output/dijkstra-risk-path.pl) |
| [`dijkstra.pl`](../examples/eyelang/dijkstra.pl) | Enumerates weighted simple paths. | [`output/dijkstra.pl`](../examples/eyelang/output/dijkstra.pl) |
| [`dining-philosophers.pl`](../examples/eyelang/dining-philosophers.pl) | Simulates Chandy-Misra fork exchanges. | [`output/dining-philosophers.pl`](../examples/eyelang/output/dining-philosophers.pl) |
| [`dog.pl`](../examples/eyelang/dog.pl) | Counts dogs and derives when a license is required. | [`output/dog.pl`](../examples/eyelang/output/dog.pl) |
| [`dpv-odrl-purpose-mapping.pl`](../examples/eyelang/dpv-odrl-purpose-mapping.pl) | Maps a DPV process into an ODRL permission view. | [`output/dpv-odrl-purpose-mapping.pl`](../examples/eyelang/output/dpv-odrl-purpose-mapping.pl) |
| [`drone-corridor-planner.pl`](../examples/eyelang/drone-corridor-planner.pl) | Plans bounded drone corridor routes. | [`output/drone-corridor-planner.pl`](../examples/eyelang/output/drone-corridor-planner.pl) |
| [`easter-computus.pl`](../examples/eyelang/easter-computus.pl) | Computes Gregorian Easter dates. | [`output/easter-computus.pl`](../examples/eyelang/output/easter-computus.pl) |
| [`electrical-rc-filter.pl`](../examples/eyelang/electrical-rc-filter.pl) | Sizes an RC low-pass filter. | [`output/electrical-rc-filter.pl`](../examples/eyelang/output/electrical-rc-filter.pl) |
| [`epidemic-policy.pl`](../examples/eyelang/epidemic-policy.pl) | Chooses policies from risk and social cost. | [`output/epidemic-policy.pl`](../examples/eyelang/output/epidemic-policy.pl) |
| [`equivalence-classes-overlap-implies-same-class.pl`](../examples/eyelang/equivalence-classes-overlap-implies-same-class.pl) | Packages the shared-member proof pattern for equivalence classes. | [`output/equivalence-classes-overlap-implies-same-class.pl`](../examples/eyelang/output/equivalence-classes-overlap-implies-same-class.pl) |
| [`eulerian-path.pl`](../examples/eyelang/eulerian-path.pl) | Finds an Eulerian path using each edge once. | [`output/eulerian-path.pl`](../examples/eyelang/output/eulerian-path.pl) |
| [`ev-range-worlds.pl`](../examples/eyelang/ev-range-worlds.pl) | Estimates electric-vehicle trip feasibility. | [`output/ev-range-worlds.pl`](../examples/eyelang/output/ev-range-worlds.pl) |
| [`existential-rule.pl`](../examples/eyelang/existential-rule.pl) | Represents existential witnesses with explicit Skolem-style terms. | [`output/existential-rule.pl`](../examples/eyelang/output/existential-rule.pl) |
| [`exoplanet-validation-worlds.pl`](../examples/eyelang/exoplanet-validation-worlds.pl) | Validates exoplanet candidates across worlds. | [`output/exoplanet-validation-worlds.pl`](../examples/eyelang/output/exoplanet-validation-worlds.pl) |
| [`expression-eval.pl`](../examples/eyelang/expression-eval.pl) | Evaluates a small arithmetic expression tree. | [`output/expression-eval.pl`](../examples/eyelang/output/expression-eval.pl) |
| [`family-cousins.pl`](../examples/eyelang/family-cousins.pl) | Derives cousin and family labels. | [`output/family-cousins.pl`](../examples/eyelang/output/family-cousins.pl) |
| [`fastpow.pl`](../examples/eyelang/fastpow.pl) | Computes powers by repeated squaring. | [`output/fastpow.pl`](../examples/eyelang/output/fastpow.pl) |
| [`fft8-numeric.pl`](../examples/eyelang/fft8-numeric.pl) | Runs an 8-point FFT over complex pairs. | [`output/fft8-numeric.pl`](../examples/eyelang/output/fft8-numeric.pl) |
| [`fibonacci.pl`](../examples/eyelang/fibonacci.pl) | Computes large Fibonacci numbers by fast doubling. | [`output/fibonacci.pl`](../examples/eyelang/output/fibonacci.pl) |
| [`field-nitrogen-balance.pl`](../examples/eyelang/field-nitrogen-balance.pl) | Classifies field nitrogen balance. | [`output/field-nitrogen-balance.pl`](../examples/eyelang/output/field-nitrogen-balance.pl) |
| [`floating-point.pl`](../examples/eyelang/floating-point.pl) | Exercises floating-point arithmetic and comparisons. | [`output/floating-point.pl`](../examples/eyelang/output/floating-point.pl) |
| [`flandor.pl`](../examples/eyelang/flandor.pl) | Derives a Flanders macro-insight authorization and retooling package. | [`output/flandor.pl`](../examples/eyelang/output/flandor.pl) |
| [`four-color-map.pl`](../examples/eyelang/four-color-map.pl) | Checks a four-colour map assignment. | [`output/four-color-map.pl`](../examples/eyelang/output/four-color-map.pl) |
| [`fundamental-theorem-arithmetic.pl`](../examples/eyelang/fundamental-theorem-arithmetic.pl) | Factors integers and reconstructs products. | [`output/fundamental-theorem-arithmetic.pl`](../examples/eyelang/output/fundamental-theorem-arithmetic.pl) |
| [`gcd-bezout-identity.pl`](../examples/eyelang/gcd-bezout-identity.pl) | Computes gcd and Bézout coefficients. | [`output/gcd-bezout-identity.pl`](../examples/eyelang/output/gcd-bezout-identity.pl) |
| [`gd-step-certified.pl`](../examples/eyelang/gd-step-certified.pl) | Certifies a gradient-descent step. | [`output/gd-step-certified.pl`](../examples/eyelang/output/gd-step-certified.pl) |
| [`gdpr-compliance.pl`](../examples/eyelang/gdpr-compliance.pl) | Checks GDPR-style processing compliance. | [`output/gdpr-compliance.pl`](../examples/eyelang/output/gdpr-compliance.pl) |
| [`goldbach-1000.pl`](../examples/eyelang/goldbach-1000.pl) | Finds Goldbach prime pairs up to 1000. | [`output/goldbach-1000.pl`](../examples/eyelang/output/goldbach-1000.pl) |
| [`good-cobbler.pl`](../examples/eyelang/good-cobbler.pl) | Demonstrates term-level structure with a good-cobbler statement. | [`output/good-cobbler.pl`](../examples/eyelang/output/good-cobbler.pl) |
| [`gps.pl`](../examples/eyelang/gps.pl) | Finds and verifies route paths. | [`output/gps.pl`](../examples/eyelang/output/gps.pl) |
| [`graph-reachability.pl`](../examples/eyelang/graph-reachability.pl) | Derives reachable nodes in a graph. | [`output/graph-reachability.pl`](../examples/eyelang/output/graph-reachability.pl) |
| [`gray-code-counter.pl`](../examples/eyelang/gray-code-counter.pl) | Generates Gray-code counter states. | [`output/gray-code-counter.pl`](../examples/eyelang/output/gray-code-counter.pl) |
| [`greatest-lower-bound-uniqueness.pl`](../examples/eyelang/greatest-lower-bound-uniqueness.pl) | Shows uniqueness of greatest lower bounds in a finite order instance. | [`output/greatest-lower-bound-uniqueness.pl`](../examples/eyelang/output/greatest-lower-bound-uniqueness.pl) |
| [`group-inverse-uniqueness.pl`](../examples/eyelang/group-inverse-uniqueness.pl) | Shows uniqueness of inverses in a finite group instance. | [`output/group-inverse-uniqueness.pl`](../examples/eyelang/output/group-inverse-uniqueness.pl) |
| [`hamiltonian-cycle.pl`](../examples/eyelang/hamiltonian-cycle.pl) | Finds a Hamiltonian cycle. | [`output/hamiltonian-cycle.pl`](../examples/eyelang/output/hamiltonian-cycle.pl) |
| [`hamiltonian-path.pl`](../examples/eyelang/hamiltonian-path.pl) | Finds a Hamiltonian path. | [`output/hamiltonian-path.pl`](../examples/eyelang/output/hamiltonian-path.pl) |
| [`hamming-code.pl`](../examples/eyelang/hamming-code.pl) | Corrects a single-bit Hamming word. | [`output/hamming-code.pl`](../examples/eyelang/output/hamming-code.pl) |
| [`hanoi.pl`](../examples/eyelang/hanoi.pl) | Derives the Towers of Hanoi moves. | [`output/hanoi.pl`](../examples/eyelang/output/hanoi.pl) |
| [`heat-loss.pl`](../examples/eyelang/heat-loss.pl) | Computes conductive heat loss. | [`output/heat-loss.pl`](../examples/eyelang/output/heat-loss.pl) |
| [`heron-theorem.pl`](../examples/eyelang/heron-theorem.pl) | Computes triangle area by Heron's theorem. | [`output/heron-theorem.pl`](../examples/eyelang/output/heron-theorem.pl) |
| [`ideal-gas-law.pl`](../examples/eyelang/ideal-gas-law.pl) | Applies the ideal gas law. | [`output/ideal-gas-law.pl`](../examples/eyelang/output/ideal-gas-law.pl) |
| [`illegitimate-reasoning.pl`](../examples/eyelang/illegitimate-reasoning.pl) | Detects suspect reasoning patterns. | [`output/illegitimate-reasoning.pl`](../examples/eyelang/output/illegitimate-reasoning.pl) |
| [`kaprekar.pl`](../examples/eyelang/kaprekar.pl) | Iterates toward Kaprekar's constant. | [`output/kaprekar.pl`](../examples/eyelang/output/kaprekar.pl) |
| [`knowledge-engineering-alignment-flow.pl`](../examples/eyelang/knowledge-engineering-alignment-flow.pl) | Specializes reusable alignment rules into a target-shaped flow view. | [`output/knowledge-engineering-alignment-flow.pl`](../examples/eyelang/output/knowledge-engineering-alignment-flow.pl) |
| [`law-of-cosines.pl`](../examples/eyelang/law-of-cosines.pl) | Computes a triangle side by cosine law. | [`output/law-of-cosines.pl`](../examples/eyelang/output/law-of-cosines.pl) |
| [`least-squares-regression.pl`](../examples/eyelang/least-squares-regression.pl) | Fits a least-squares regression line. | [`output/least-squares-regression.pl`](../examples/eyelang/output/least-squares-regression.pl) |
| [`list-collection.pl`](../examples/eyelang/list-collection.pl) | Demonstrates list and collection built-ins. | [`output/list-collection.pl`](../examples/eyelang/output/list-collection.pl) |
| [`lldm.pl`](../examples/eyelang/lldm.pl) | Calculates leg-length discrepancy measurements. | [`output/lldm.pl`](../examples/eyelang/output/lldm.pl) |
| [`manufacturing-quality-control.pl`](../examples/eyelang/manufacturing-quality-control.pl) | Evaluates process capability and quality. | [`output/manufacturing-quality-control.pl`](../examples/eyelang/output/manufacturing-quality-control.pl) |
| [`matrix.pl`](../examples/eyelang/matrix.pl) | Runs matrix operations over sample inputs. | [`output/matrix.pl`](../examples/eyelang/output/matrix.pl) |
| [`microgrid-dispatch.pl`](../examples/eyelang/microgrid-dispatch.pl) | Plans microgrid dispatch and reserve. | [`output/microgrid-dispatch.pl`](../examples/eyelang/output/microgrid-dispatch.pl) |
| [`monkey-bananas.pl`](../examples/eyelang/monkey-bananas.pl) | Solves the monkey-and-bananas puzzle. | [`output/monkey-bananas.pl`](../examples/eyelang/output/monkey-bananas.pl) |
| [`n-queens.pl`](../examples/eyelang/n-queens.pl) | Searches for N-queens placements. | [`output/n-queens.pl`](../examples/eyelang/output/n-queens.pl) |
| [`network-sla.pl`](../examples/eyelang/network-sla.pl) | Checks network path SLA compliance. | [`output/network-sla.pl`](../examples/eyelang/output/network-sla.pl) |
| [`newton-raphson.pl`](../examples/eyelang/newton-raphson.pl) | Finds roots by Newton-Raphson iteration. | [`output/newton-raphson.pl`](../examples/eyelang/output/newton-raphson.pl) |
| [`nixon-diamond.pl`](../examples/eyelang/nixon-diamond.pl) | Reports the classic Nixon-diamond conflict. | [`output/nixon-diamond.pl`](../examples/eyelang/output/nixon-diamond.pl) |
| [`observability-log-correlation.pl`](../examples/eyelang/observability-log-correlation.pl) | Extracts named regex captures from observability logs and correlates events by trace id. | [`output/observability-log-correlation.pl`](../examples/eyelang/output/observability-log-correlation.pl) |
| [`odrl-dpv-fpv-trust-flow.pl`](../examples/eyelang/odrl-dpv-fpv-trust-flow.pl) | Decides ODRL/DPV data flows with local FPV trust gates. | [`output/odrl-dpv-fpv-trust-flow.pl`](../examples/eyelang/output/odrl-dpv-fpv-trust-flow.pl) |
| [`odrl-dpv-healthcare-risk-ranked.pl`](../examples/eyelang/odrl-dpv-healthcare-risk-ranked.pl) | Ranks healthcare policy risks and mitigations. | [`output/odrl-dpv-healthcare-risk-ranked.pl`](../examples/eyelang/output/odrl-dpv-healthcare-risk-ranked.pl) |
| [`odrl-dpv-risk-ranked.pl`](../examples/eyelang/odrl-dpv-risk-ranked.pl) | Ranks data-policy risks and mitigations. | [`output/odrl-dpv-risk-ranked.pl`](../examples/eyelang/output/odrl-dpv-risk-ranked.pl) |
| [`orbital-transfer-design.pl`](../examples/eyelang/orbital-transfer-design.pl) | Designs a Hohmann orbital transfer. | [`output/orbital-transfer-design.pl`](../examples/eyelang/output/orbital-transfer-design.pl) |
| [`path-discovery.pl`](../examples/eyelang/path-discovery.pl) | Discovers bounded air-route paths. | [`output/path-discovery.pl`](../examples/eyelang/output/path-discovery.pl) |
| [`peano-arithmetic.pl`](../examples/eyelang/peano-arithmetic.pl) | Computes Peano addition, multiplication, and factorial. | [`output/peano-arithmetic.pl`](../examples/eyelang/output/peano-arithmetic.pl) |
| [`peasant.pl`](../examples/eyelang/peasant.pl) | Performs peasant multiplication and exponentiation. | [`output/peasant.pl`](../examples/eyelang/output/peasant.pl) |
| [`pendulum-period.pl`](../examples/eyelang/pendulum-period.pl) | Computes simple pendulum periods. | [`output/pendulum-period.pl`](../examples/eyelang/output/pendulum-period.pl) |
| [`polynomial.pl`](../examples/eyelang/polynomial.pl) | Finds complex integer polynomial roots. | [`output/polynomial.pl`](../examples/eyelang/output/polynomial.pl) |
| [`proof-contrapositive.pl`](../examples/eyelang/proof-contrapositive.pl) | Models proof by contrapositive. | [`output/proof-contrapositive.pl`](../examples/eyelang/output/proof-contrapositive.pl) |
| [`quadratic-formula.pl`](../examples/eyelang/quadratic-formula.pl) | Solves sample quadratic equations. | [`output/quadratic-formula.pl`](../examples/eyelang/output/quadratic-formula.pl) |
| [`quine-mccluskey.pl`](../examples/eyelang/quine-mccluskey.pl) | Minimizes Boolean terms with Quine-McCluskey. | [`output/quine-mccluskey.pl`](../examples/eyelang/output/quine-mccluskey.pl) |
| [`radioactive-decay.pl`](../examples/eyelang/radioactive-decay.pl) | Computes radioactive decay over time. | [`output/radioactive-decay.pl`](../examples/eyelang/output/radioactive-decay.pl) |
| [`riemann-hypothesis.pl`](../examples/eyelang/riemann-hypothesis.pl) | Checks a finite catalogue of non-trivial zeta zeros against the Riemann-hypothesis condition. | [`output/riemann-hypothesis.pl`](../examples/eyelang/output/riemann-hypothesis.pl) |
| [`sat-dpll.pl`](../examples/eyelang/sat-dpll.pl) | Solves a finite SAT instance. | [`output/sat-dpll.pl`](../examples/eyelang/output/sat-dpll.pl) |
| [`security-incident-correlation.pl`](../examples/eyelang/security-incident-correlation.pl) | Correlates security incidents across signals. | [`output/security-incident-correlation.pl`](../examples/eyelang/output/security-incident-correlation.pl) |
| [`service-impact.pl`](../examples/eyelang/service-impact.pl) | Analyzes service impact over cyclic dependencies. | [`output/service-impact.pl`](../examples/eyelang/output/service-impact.pl) |
| [`sieve.pl`](../examples/eyelang/sieve.pl) | Enumerates primes with a sieve-style program. | [`output/sieve.pl`](../examples/eyelang/output/sieve.pl) |
| [`skolem-functions.pl`](../examples/eyelang/skolem-functions.pl) | Generates deterministic functional terms. | [`output/skolem-functions.pl`](../examples/eyelang/output/skolem-functions.pl) |
| [`socket-age.pl`](../examples/eyelang/socket-age.pl) | Shows socket-declared age reasoning inputs and plugs. | [`output/socket-age.pl`](../examples/eyelang/output/socket-age.pl) |
| [`socket-family.pl`](../examples/eyelang/socket-family.pl) | Shows socket-declared family-source inputs and ancestry rules. | [`output/socket-family.pl`](../examples/eyelang/output/socket-family.pl) |
| [`socrates.pl`](../examples/eyelang/socrates.pl) | Derives that Socrates is mortal. | [`output/socrates.pl`](../examples/eyelang/output/socrates.pl) |
| [`statistics-summary.pl`](../examples/eyelang/statistics-summary.pl) | Computes population statistics for a sample. | [`output/statistics-summary.pl`](../examples/eyelang/output/statistics-summary.pl) |
| [`superdense-coding.pl`](../examples/eyelang/superdense-coding.pl) | Models superdense-coding bit transmission. | [`output/superdense-coding.pl`](../examples/eyelang/output/superdense-coding.pl) |
| [`traveling-salesman.pl`](../examples/eyelang/traveling-salesman.pl) | Finds an optimal traveling-salesman tour. | [`output/traveling-salesman.pl`](../examples/eyelang/output/traveling-salesman.pl) |
| [`trust-flow-provenance-threshold.pl`](../examples/eyelang/trust-flow-provenance-threshold.pl) | Classifies message trust from provenance confidence scores. | [`output/trust-flow-provenance-threshold.pl`](../examples/eyelang/output/trust-flow-provenance-threshold.pl) |
| [`turing.pl`](../examples/eyelang/turing.pl) | Simulates a binary-increment Turing machine. | [`output/turing.pl`](../examples/eyelang/output/turing.pl) |
| [`vector-similarity.pl`](../examples/eyelang/vector-similarity.pl) | Computes dot product, norm, and cosine similarity. | [`output/vector-similarity.pl`](../examples/eyelang/output/vector-similarity.pl) |
| [`vulnerability-impact.pl`](../examples/eyelang/vulnerability-impact.pl) | Analyzes vulnerable transitive dependencies and urgent patch impact. | [`output/vulnerability-impact.pl`](../examples/eyelang/output/vulnerability-impact.pl) |
| [`witch.pl`](../examples/eyelang/witch.pl) | Derives the classic “burn the witch” rule chain. | [`output/witch.pl`](../examples/eyelang/output/witch.pl) |
| [`wolf-goat-cabbage.pl`](../examples/eyelang/wolf-goat-cabbage.pl) | Solves the wolf-goat-cabbage river crossing. | [`output/wolf-goat-cabbage.pl`](../examples/eyelang/output/wolf-goat-cabbage.pl) |
| [`zebra.pl`](../examples/eyelang/zebra.pl) | Solves the zebra logic puzzle. | [`output/zebra.pl`](../examples/eyelang/output/zebra.pl) |



## Golden outputs, tests, and conformance

Golden answer outputs live in [`examples/eyelang/output`](../examples/eyelang/output). `npm run test:eyelang` covers the eyelang integration check, conformance cases, regression checks, runnable examples, and proof-output examples. A curated proof-output suite for `.pl` examples lives in [`examples/eyelang/proof`](../examples/eyelang/proof). Example tests pin `local_time/1` to `2026-05-30` so date-dependent examples stay deterministic. Regenerate them after an intentional output or explanation change:

```sh
for f in examples/eyelang/*.pl; do
  [ -e "$f" ] || continue
  b=$(basename "$f")
  EYELANG_LOCAL_TIME=2026-05-30 eyeling --engine eyelang "$f" > "examples/eyelang/output/$b"
done

for f in examples/eyelang/proof/*.pl; do
  b=$(basename "$f")
  EYELANG_LOCAL_TIME=2026-05-30 eyeling --engine eyelang --proof "examples/eyelang/$b" > "examples/eyelang/proof/$b"
done
```

Run the full eyelang suite:

```sh
npm run test:eyelang
```

The eyelang corpus runner runs in this order: Conformance, Regression/API/White-box, Examples. Each section prints its own subtotal, followed by a suite-specific grand total. The suite checks the conformance cases derived from the language reference, supplemental regression/API/white-box checks, and every runnable example against its golden output.

Run only one internal suite when you are iterating:

```sh
node test/eyelang/run-conformance.mjs
node test/eyelang/run-regression.mjs
node test/eyelang/run-examples.mjs
```

The conformance suite lives in [`test/eyelang/conformance/`](../test/eyelang/conformance/) and is split into `core` and `extension` profiles matching the language reference. Each case is a small program with an exact expected stdout file, and some internal conformance cases also include a goal file for testing the embeddable solver, so other implementations can reuse the same cases. The regression suite lives in [`test/eyelang/run-regression.mjs`](../test/eyelang/run-regression.mjs) and covers CLI regressions, the public JavaScript API, and white-box invariants for parser, unification, and indexing behavior.

## Development and release

Common commands:

```sh
npm run test:eyelang        # integration check plus eyelang corpus
npm run test:eyelang:corpus # conformance, regression/API/white-box, examples, and proof examples
node test/eyelang/run-conformance.mjs
node test/eyelang/run-regression.mjs
node test/eyelang/run-examples.mjs
eyeling --engine eyelang --help
```

Useful profiling smoke test:

```sh
eyeling --engine eyelang -s examples/eyelang/n-queens.pl > /dev/null
```

For a release:

1. update `VERSION`;
2. update `README.md` and the language reference;
3. regenerate golden outputs if behavior changed;
4. run `npm run test:eyelang`;
5. publish the repository with the browser playground assets if publishing the playground. The playground includes controls equivalent to CLI `--stats` and `--proof`.

## Relationship to Eyeling

[Eyeling](https://github.com/eyereasoner/eyeling) and eyelang share the same goal of small, inspectable rule-based reasoning in JavaScript, but they make different language and implementation trade-offs.

Eyeling is the RDF/Notation3 member of the family. It reads N3-style triples, quoted formulas, forward rules written with `=>`, backward rules written with `<=`, RDF terms, RDF-JS data, and RDF-oriented streams. That makes it the better fit when data interchange with RDF/N3 tools is the main requirement.

eyelang is the compact Prolog-style member of the family. It uses ordinary predicate syntax such as `parent(alice, bob).` and `ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).` This keeps the core syntax close to the ISO-standardized Prolog tradition while deliberately staying much smaller than ISO Prolog. It is a good fit when the problem is naturally relational, goal-directed, finite, and does not need RDF graph interchange.

A useful rule of thumb:

| Use case | Prefer | Why |
| --- | --- | --- |
| RDF/N3 data, triples, prefixes, graph terms, RDF-JS, RDF message streams | Eyeling | The surface language and APIs are RDF/Notation3-native. |
| Compact relational rules over ordinary terms, lists, arithmetic, and finite search | eyelang | The syntax is shorter for non-RDF relation programs and output is ordinary facts. |
| Human-auditable derivations | Either | Both can emit proof explanations when requested. |
| Large generated Horn-clause workloads | eyelang | The engine specializes in predicate/arity indexing, scalar argument indexes, fast fact paths, and materialized output goals. |

For the deep taxonomy benchmark, eyelang is substantially faster in current local checks. On one sandbox run, `eyeling --engine eyelang examples/eyelang/deep-taxonomy-100000.pl > /dev/null` took about `1.60 sec`, while `eyeling` package version `1.28.7` on `examples/deep-taxonomy-100000.n3` took about `4.56 sec` without proof and about `5.04 sec` with proof. Treat those numbers as a smoke comparison rather than a formal benchmark: hardware, Node.js version, package version, and CLI startup all matter.

The projects are therefore complementary rather than replacements for each other: Eyeling optimizes for Semantic Web interoperability and N3 expressiveness; eyelang optimizes for a small standard-looking relational rule language and fast finite goal-directed execution.

## Performance notes

Use `-s` or `--stats` for a quick sanity check while optimizing solver changes. It prints counters such as `solve_goals_calls`, `unify_calls`, `deterministic_rule_expansions`, `candidate_lists_selected`, `clause_candidates_considered`, `clauses_tried`, `max_depth`, and `max_solver_call_depth` to stderr, leaving normal output stable for golden-file tests. The `max_solver_call_depth` counter is especially useful for browser regressions, where the VM call stack can be tighter than a command-line run.

eyelang hashes predicate groups by name and arity, then indexes clauses by scalar argument values. It also builds two-argument composite indexes for scalar pairs and probes those composite indexes without per-lookup heap allocation. This helps both large generated programs with many predicates and selective queries such as:

```prolog
edge(g1, a, X).
path(a, Y).
status(Case, accepted).
```

Ground facts use a fast path that avoids freshening and copying a rule body. Recursive-predicate detection uses an explicit work stack, which keeps large predicate chains safer in the browser. Recursive examples use an active-call variant guard to prevent common cyclic closures from looping. Selected predicates can be memoized with:

```prolog
memoize(path, 2).
```

For large programs, keep helper predicates selective, bind arguments early, and declare focused output predicates with `materialize/2` when default output would otherwise solve broad helper goals.

## Implementation limits

eyelang is intentionally smaller than ISO Prolog. It has no operators, cut, modules, dynamic database updates, DCGs, or complete ISO library. Negation is negation-as-failure through `not/1`. Search is goal-directed and expected to be finite for the selected output goals. Output explanations are non-normative proof printouts and do not change answer semantics. 
