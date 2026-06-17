# eyelang

[![npm version](https://img.shields.io/npm/v/eyelang.svg)](https://www.npmjs.com/package/eyelang)
[![DOI](https://img.shields.io/badge/DOI-10.5281%2Fzenodo.1242549108-blue.svg)](https://doi.org/10.5281/zenodo.20342331)

eyelang is a small rule engine for Prolog-style Horn clauses over ordinary terms, lists, arithmetic, strings, and finite search. The command-line executable is `eyelang`.

Programs write relations directly, for example `ancestor(pat, emma)` or `status(case1, accepted)`. eyelang output is ordinary eyelang syntax: by default, the CLI materializes selected answer facts and prints those facts only. Pass `--proof` (or `-p`) when you also want each answer followed by a `why/2` explanation fact that records the proof. Programs may add `materialize(Name, Arity).` declarations to focus output on selected predicates.


Try it in the [browser playground](https://eyereasoner.github.io/eyelang/playground). The playground includes run options equivalent to CLI `--stats` and `--proof`.

For the normative language definition, including lexical syntax, terms, clauses, goals, built-ins, `memoize/2`, `materialize/2`, and conformance boundaries, read the [eyelang specification](SPEC.md).

## Contents

1. [Quick start](#quick-start)
2. [Running eyelang](#running-eyelang)
3. [Default output](#default-output)
4. [Writing programs](#writing-programs)
5. [Aggregation helpers](#aggregation-helpers)
6. [Formula data](#formula-data)
7. [RDF 1.2 and Notation3 compatibility](#rdf-12-and-notation3-compatibility)
8. [Example catalog](#example-catalog)
9. [Golden outputs, tests, and conformance](#golden-outputs-tests-and-conformance)
10. [Development and release](#development-and-release)
11. [Relationship to Eyeling](#relationship-to-eyeling)
12. [Performance notes](#performance-notes)
13. [Implementation limits](#implementation-limits)

## Quick start

Install dependencies, if any, and run the command-line executable:

```sh
npm install
```

There is no build step for the CLI. Run examples, multiple inputs, stdin, or a URL:

```sh
bin/eyelang --version
bin/eyelang examples/ancestor.pl
bin/eyelang facts.pl rules.pl
printf 'works(stdin, true) :- eq(ok, ok).\n' | bin/eyelang -
bin/eyelang https://raw.githubusercontent.com/eyereasoner/eyelang/refs/heads/main/examples/ancestor.pl
```

The CLI runs directly on Node.js 18 or newer. The browser playground uses the same source modules through `playground-worker.mjs`; no separate browser build is required.

Serve the playground locally:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/playground.html
```

## Running eyelang

Show the package version:

```sh
bin/eyelang --version
bin/eyelang -v
```

Run a program and let eyelang print derived binary facts:

```sh
bin/eyelang examples/ancestor.pl
```

Enable proof explanations when you want machine-readable provenance:

```sh
bin/eyelang --proof examples/ancestor.pl
bin/eyelang -p examples/ancestor.pl
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
bin/eyelang --proof examples/socrates.pl
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
bin/eyelang --proof policy.pl
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
bin/eyelang --proof examples/socrates.pl > socrates.why.pl
```

The resulting file is ordinary eyelang syntax containing both answers and `why/2` proof facts.

Compose multiple files, stdin, and URLs:

```sh
bin/eyelang facts.pl rules.pl
printf 'works(stdin, true) :- eq(ok, ok).\n' | bin/eyelang -
bin/eyelang https://example.test/program.pl
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
bin/eyelang -s examples/sudoku.pl
```

The playground has matching `--stats` and `--proof` checkboxes, so browser runs can show the same counters or explanations like the CLI.


### Builtins

eyelang builtins are registered by name and arity in small modules under [`src/builtins`](src/builtins). This keeps the runtime portable to Node.js and the browser while giving each builtin family a clear boundary. Builtins are enabled by normal predicate calls.

The core builtin families cover unification, arithmetic, comparison, dates, strings, lists, aggregation, formula terms, and search control. Additional reusable finite-search helpers are available for examples that would otherwise need large amounts of repetitive generate-and-test code. These helpers are deliberately general relations rather than shortcuts tied to a particular example name. For example:

```prolog
solution(Name, Rows) :-
  puzzle(Name, Grid),
  sudoku(Grid, Rows).

answer(Queens) :-
  n_queens(8, Queens).

best(Cycle, Cost) :-
  cities(Cities),
  weighted_hamiltonian_cycle(edge, Cities, Cycle, Cost).
```

`sudoku/2` accepts either an 81-character string or a 9x9 list. Digits `1` to `9` are givens; `0`, `.`, and `_` mark blanks. It returns the solved 9x9 list.

The reusable search and numeric helpers include `atom_range/4`, `atom_ranges/4`, `n_queens/2`, Hamiltonian path/cycle helpers, `cnf_model/3`, Quine-McCluskey helpers, bounded subset/path helpers, number-theory helpers such as `extended_gcd/5`, matrix helpers such as `matrix_multiply/2`, and `alphametic_sum/5`. These helpers are extension builtins of this implementation; [`SPEC.md`](SPEC.md) defines the portable core and standard builtin profile.

To add a builtin, create or extend a module with `register(registry)` and call `registry.add(name, arity, handler, options)`. The default registry is assembled in [`src/builtins/registry.js`](src/builtins/registry.js). Builtins that are only safe for specific argument modes should provide a `ready` predicate and `fallbackWhenNotReady: true`, so user-defined clauses remain visible until the builtin is applicable.


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

## Formula data

Comma terms can be data as well as conjunctions. eyelang provides relation-oriented formula utilities.

`formula_atom(Formula, Atom)` enumerates atomic formula terms inside a comma formula:

```prolog
formula_atom((name(alice, "Alice"), knows(alice, bob)), X).
```

`formula_binary(Formula, S, P, O)` enumerates binary terms and exposes their functor as an atom constant:

```prolog
formula_binary((name(alice, "Alice"), knows(alice, bob)), S, P, O).
```

This can yield `S = alice`, `P = name`, `O = "Alice"` and `S = alice`, `P = knows`, `O = bob`. The utility is useful for quoted formula data, but it does not make those formula members true in the ambient program.


## RDF 1.2 and Notation3 compatibility

The core eyelang syntax remains Prolog-like, but `src/rdf.js` adds a compatibility layer for RDF 1.2 Turtle/N-Triples style data and a practical Notation3 rule subset. Use it from the CLI with `--rdf`, `--rdf12`, `--n3`, or `--input-format FORMAT`; file inputs ending in `.ttl`, `.nt`, or `.n3` are recognized when the CLI uses its default `auto` format.

```sh
bin/eyelang --rdf data.ttl rules.n3
printf '@prefix : <http://example.com/> .
{ ?x :parent ?y . } => { ?x :related ?y . } .
:alice :parent :bob .
' | bin/eyelang --n3 -
```

RDF triples are lowered to ordinary `rdf/3` goals:

```prolog
rdf(Subject, Predicate, Object).
```

RDF terms are explicit eyelang compound terms:

```prolog
iri("http://example.com/alice")
bnode("b0")
literal("Alice", iri("http://www.w3.org/2001/XMLSchema#string"), "", "")
triple(Subject, Predicate, Object)
```

The layer supports `PREFIX`/`@prefix`, `BASE`/`@base`, `VERSION`/`@version`, IRIs, prefixed names, blank nodes, strings, numeric and boolean literals, language-tagged and RDF 1.2 directional language-tagged strings, RDF collections, blank-node property lists, RDF 1.2 triple terms `<<( ... )>>`, reified triple sugar `<< ... >>`, annotation blocks `{| ... |}`, N3 rules of the form `{ antecedent } => { consequent } .`, reverse rules of the form `{ consequent } <= { antecedent } .`, and N3 equality `=` as `owl:sameAs`. Reified triples and annotations are expanded through `rdf:reifies`, so this Turtle fragment:

```turtle
VERSION "1.2"
PREFIX : <http://example.com/>
:alice :name "Alice" ~ :t {| :statedBy :bob |} .
```

is made available as eyelang facts like:

```prolog
rdf(iri("http://example.com/alice"), iri("http://example.com/name"), literal("Alice", iri("http://www.w3.org/2001/XMLSchema#string"), "", "")).
rdf(iri("http://example.com/t"), iri("http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies"), triple(iri("http://example.com/alice"), iri("http://example.com/name"), literal("Alice", iri("http://www.w3.org/2001/XMLSchema#string"), "", ""))).
rdf(iri("http://example.com/t"), iri("http://example.com/statedBy"), iri("http://example.com/bob")).
```

From JavaScript, use `parseRdfClauses(source, options)` when you want clause objects, or `rdfToEyelang(source, options)` when you want the lowered eyelang source text.

N3 body triples whose predicates are in the common SWAP namespaces are lowered to eyelang built-ins instead of `rdf/3` goals. The practical bridge covers math comparisons and arithmetic such as `math:sum`, `math:difference`, `math:product`, `math:quotient`, `math:rounded`, and trigonometric functions, with exact BigInt-backed integer paths for large N3 arithmetic examples; string predicates such as `string:contains`, `string:startsWith`, `string:concatenation`, `string:length`, `string:replace`, and `string:scrape`; list predicates such as `list:member`, `list:append`, `list:first`, `list:rest`, `list:length`, `list:reverse`, and `list:sort`; `crypto:sha`, `crypto:md5`, `crypto:sha256`, `crypto:sha512`; simple `time:*` component extraction; and selected `log:*` helpers such as `log:equalTo`, `log:notEqualTo`, `log:uri`, `log:dtlit`, and `log:rawType`. This follows the builtin families used by eyeling while keeping eyelang's execution model small.

RDF/N3 examples now live directly in [`examples/`](examples/), with golden outputs in [`examples/output/`](examples/output/), matching the existing example layout. They include eyeling-inspired `socrates.n3`, `family-cousins.n3`, and `annotation-rdf12.ttl` examples; focused RDF 1.2 triple-term and directional-language examples; `n3-builtins.n3`; and a larger `eyeling-*.n3` set adapted from the eyeling example directory. The added eyeling-style examples cover backward rules, recursive `<=`, equality, collection/list handling, Ackermann-style hyperoperations, Fibonacci numbers, dog-license, witch, Cat Koko, family/cousin, alignment, BMI, and SWAP math/string/list/crypto/time builtins. Run them with auto format detection or force the reader explicitly:

```sh
bin/eyelang examples/socrates.n3
bin/eyelang --rdf12 examples/annotation-rdf12.ttl
bin/eyelang --n3 examples/n3-builtins.n3
bin/eyelang --n3 examples/eyeling-backward-recursion.n3
bin/eyelang --n3 examples/eyeling-ackermann.n3
bin/eyelang --n3 examples/eyeling-fibonacci.n3
```

This is a compatibility layer, not a validating W3C conformance parser. It intentionally covers the graph-oriented syntax, common RDF 1.2 constructs, and the N3 Horn-rule/builtin patterns that map cleanly to eyelang; it does not implement RDF/XML, full TriG datasets, SPARQL, scoped N3 formula built-ins such as full `log:semantics`, or every Notation3 construct.

## Example catalog

The repository includes examples for recursion, graph reachability, finite search, arithmetic, list processing, optimization, policies, puzzles, N3-inspired rule chains, and applied scientific calculations. Bundled examples use relation-style output.

| Input | Short description | Output |
| --- | --- | --- |
| [`access-control-policy.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/access-control-policy.pl) | Evaluates role and condition based access decisions. | [`output/access-control-policy.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/access-control-policy.pl) |
| [`ackermann.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/ackermann.pl) | Computes Ackermann-style hyperoperation values. | [`output/ackermann.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/ackermann.pl) |
| [`age.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/age.pl) | Checks whether people meet age thresholds. | [`output/age.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/age.pl) |
| [`aliases-and-namespaces.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/aliases-and-namespaces.pl) | Shows ordinary predicate names for vocabulary aliases. | [`output/aliases-and-namespaces.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/aliases-and-namespaces.pl) |
| [`alignment-demo.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/alignment-demo.pl) | Rolls dataset concepts up through a small alignment taxonomy. | [`output/alignment-demo.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/alignment-demo.pl) |
| [`allen-interval-calculus.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/allen-interval-calculus.pl) | Classifies interval relations with integer time offsets. | [`output/allen-interval-calculus.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/allen-interval-calculus.pl) |
| [`ancestor.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/ancestor.pl) | Derives ancestors from parent facts. | [`output/ancestor.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/ancestor.pl) |
| [`animal.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/animal.pl) | Classifies animals from traits. | [`output/animal.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/animal.pl) |
| [`annotation.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/annotation.pl) | Derives facts from quoted annotation data. | [`output/annotation.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/annotation.pl) |
| [`annotation-rdf12.ttl`](https://github.com/eyereasoner/eyelang/blob/main/examples/annotation-rdf12.ttl) | Demonstrates RDF 1.2 annotation syntax lowered through `rdf:reifies`. | [`output/annotation-rdf12.ttl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/annotation-rdf12.ttl) |
| [`auroracare.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/auroracare.pl) | Evaluates purpose-based medical data access scenarios. | [`output/auroracare.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/auroracare.pl) |
| [`backward.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/backward.pl) | Shows a backward-rule pattern as a goal-directed numeric rule. | [`output/backward.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/backward.pl) |
| [`basic-monadic.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/basic-monadic.pl) | Runs a monadic benchmark over generated inputs. | [`output/basic-monadic.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/basic-monadic.pl) |
| [`bayes-diagnosis.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/bayes-diagnosis.pl) | Computes scaled Bayesian diagnosis posteriors. | [`output/bayes-diagnosis.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/bayes-diagnosis.pl) |
| [`bayes-therapy.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/bayes-therapy.pl) | Ranks therapies using Bayesian disease likelihoods. | [`output/bayes-therapy.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/bayes-therapy.pl) |
| [`beam-deflection.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/beam-deflection.pl) | Computes cantilever beam deflection. | [`output/beam-deflection.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/beam-deflection.pl) |
| [`blocks-world-planning.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/blocks-world-planning.pl) | Searches a finite blocks-world plan. | [`output/blocks-world-planning.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/blocks-world-planning.pl) |
| [`bmi.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/bmi.pl) | Normalizes BMI inputs and classifies weight. | [`output/bmi.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/bmi.pl) |
| [`braking-safety-worlds.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/braking-safety-worlds.pl) | Classifies braking safety under alternative worlds. | [`output/braking-safety-worlds.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/braking-safety-worlds.pl) |
| [`buck-converter-design.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/buck-converter-design.pl) | Checks buck-converter ripple design. | [`output/buck-converter-design.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/buck-converter-design.pl) |
| [`cache-performance.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/cache-performance.pl) | Summarizes cache latency performance. | [`output/cache-performance.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/cache-performance.pl) |
| [`canary-release.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/canary-release.pl) | Decides canary rollout or rollback. | [`output/canary-release.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/canary-release.pl) |
| [`cat-koko.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/cat-koko.pl) | Demonstrates named existential witnesses from a Cat Koko rule pattern. | [`output/cat-koko.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/cat-koko.pl) |
| [`clinical-trial-screening.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/clinical-trial-screening.pl) | Screens candidates for a trial. | [`output/clinical-trial-screening.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/clinical-trial-screening.pl) |
| [`collatz-1000.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/collatz-1000.pl) | Computes shared Collatz trajectories. | [`output/collatz-1000.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/collatz-1000.pl) |
| [`combinatorics-findall-sort.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/combinatorics-findall-sort.pl) | Collects and sorts finite combinations. | [`output/combinatorics-findall-sort.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/combinatorics-findall-sort.pl) |
| [`competitive-enzyme-kinetics.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/competitive-enzyme-kinetics.pl) | Computes inhibited enzyme reaction rates. | [`output/competitive-enzyme-kinetics.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/competitive-enzyme-kinetics.pl) |
| [`complex-matrix-stability.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/complex-matrix-stability.pl) | Checks stability of a 2x2 system. | [`output/complex-matrix-stability.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/complex-matrix-stability.pl) |
| [`complex.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/complex.pl) | Performs arithmetic on complex pairs. | [`output/complex.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/complex.pl) |
| [`composition-of-injective-functions-is-injective.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/composition-of-injective-functions-is-injective.pl) | Encodes composition and injectivity of finite functions. | [`output/composition-of-injective-functions-is-injective.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/composition-of-injective-functions-is-injective.pl) |
| [`context-association.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/context-association.pl) | Associates named contexts with their contents. | [`output/context-association.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/context-association.pl) |
| [`control-system.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/control-system.pl) | Evaluates control-system measurements and targets. | [`output/control-system.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/control-system.pl) |
| [`cryptarithmetic-send-more-money.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/cryptarithmetic-send-more-money.pl) | Solves SEND+MORE and related puzzles. | [`output/cryptarithmetic-send-more-money.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/cryptarithmetic-send-more-money.pl) |
| [`cyclic-path.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/cyclic-path.pl) | Computes paths in a cyclic graph. | [`output/cyclic-path.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/cyclic-path.pl) |
| [`d3-group.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/d3-group.pl) | Enumerates subgroups of the D3 group. | [`output/d3-group.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/d3-group.pl) |
| [`dairy-energy-balance.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/dairy-energy-balance.pl) | Classifies dairy cow energy balance. | [`output/dairy-energy-balance.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/dairy-energy-balance.pl) |
| [`data-negotiation.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/data-negotiation.pl) | Chooses an accepted data-negotiation offer. | [`output/data-negotiation.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/data-negotiation.pl) |
| [`deep-taxonomy-10.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/deep-taxonomy-10.pl) | Stress-tests recursive taxonomy depth 10. | [`output/deep-taxonomy-10.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/deep-taxonomy-10.pl) |
| [`deep-taxonomy-100.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/deep-taxonomy-100.pl) | Stress-tests recursive taxonomy depth 100. | [`output/deep-taxonomy-100.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/deep-taxonomy-100.pl) |
| [`deep-taxonomy-1000.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/deep-taxonomy-1000.pl) | Stress-tests recursive taxonomy depth 1000. | [`output/deep-taxonomy-1000.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/deep-taxonomy-1000.pl) |
| [`deep-taxonomy-10000.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/deep-taxonomy-10000.pl) | Stress-tests recursive taxonomy depth 10000. | [`output/deep-taxonomy-10000.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/deep-taxonomy-10000.pl) |
| [`deep-taxonomy-100000.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/deep-taxonomy-100000.pl) | Stress-tests recursive taxonomy depth 100000. | [`output/deep-taxonomy-100000.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/deep-taxonomy-100000.pl) |
| [`delfour.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/delfour.pl) | Derives shopping and authorization recommendations. | [`output/delfour.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/delfour.pl) |
| [`dense-hamiltonian-cycle.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/dense-hamiltonian-cycle.pl) | Searches a dense Hamiltonian cycle with aggregate minimization. | [`output/dense-hamiltonian-cycle.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/dense-hamiltonian-cycle.pl) |
| [`deontic-logic.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/deontic-logic.pl) | Reports obligations, prohibitions, and violations. | [`output/deontic-logic.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/deontic-logic.pl) |
| [`derived-backward-rule.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/derived-backward-rule.pl) | Derives an inverse-property backward rule from rule data. | [`output/derived-backward-rule.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/derived-backward-rule.pl) |
| [`derived-rule.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/derived-rule.pl) | Derives conclusions from rule data. | [`output/derived-rule.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/derived-rule.pl) |
| [`diamond-property.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/diamond-property.pl) | Checks the diamond property of a relation. | [`output/diamond-property.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/diamond-property.pl) |
| [`dijkstra-findall-sort.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/dijkstra-findall-sort.pl) | Finds shortest paths using collected candidates. | [`output/dijkstra-findall-sort.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/dijkstra-findall-sort.pl) |
| [`dijkstra-risk-path.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/dijkstra-risk-path.pl) | Ranks routes by cost and trust. | [`output/dijkstra-risk-path.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/dijkstra-risk-path.pl) |
| [`dijkstra.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/dijkstra.pl) | Enumerates weighted simple paths. | [`output/dijkstra.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/dijkstra.pl) |
| [`dining-philosophers.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/dining-philosophers.pl) | Simulates Chandy-Misra fork exchanges. | [`output/dining-philosophers.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/dining-philosophers.pl) |
| [`dog.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/dog.pl) | Counts dogs and derives when a license is required. | [`output/dog.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/dog.pl) |
| [`drone-corridor-planner.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/drone-corridor-planner.pl) | Plans bounded drone corridor routes. | [`output/drone-corridor-planner.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/drone-corridor-planner.pl) |
| [`easter-computus.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/easter-computus.pl) | Computes Gregorian Easter dates. | [`output/easter-computus.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/easter-computus.pl) |
| [`electrical-rc-filter.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/electrical-rc-filter.pl) | Sizes an RC low-pass filter. | [`output/electrical-rc-filter.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/electrical-rc-filter.pl) |
| [`epidemic-policy.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/epidemic-policy.pl) | Chooses policies from risk and social cost. | [`output/epidemic-policy.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/epidemic-policy.pl) |
| [`equivalence-classes-overlap-implies-same-class.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/equivalence-classes-overlap-implies-same-class.pl) | Packages the shared-member proof pattern for equivalence classes. | [`output/equivalence-classes-overlap-implies-same-class.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/equivalence-classes-overlap-implies-same-class.pl) |
| [`eulerian-path.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/eulerian-path.pl) | Finds an Eulerian path using each edge once. | [`output/eulerian-path.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/eulerian-path.pl) |
| [`ev-range-worlds.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/ev-range-worlds.pl) | Estimates electric-vehicle trip feasibility. | [`output/ev-range-worlds.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/ev-range-worlds.pl) |
| [`exact-cover-sudoku.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/exact-cover-sudoku.pl) | Solves Sudoku via exact-cover-style constraints. | [`output/exact-cover-sudoku.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/exact-cover-sudoku.pl) |
| [`existential-rule.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/existential-rule.pl) | Represents existential witnesses with explicit Skolem-style terms. | [`output/existential-rule.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/existential-rule.pl) |
| [`exoplanet-validation-worlds.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/exoplanet-validation-worlds.pl) | Validates exoplanet candidates across worlds. | [`output/exoplanet-validation-worlds.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/exoplanet-validation-worlds.pl) |
| [`expression-eval.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/expression-eval.pl) | Evaluates a small arithmetic expression tree. | [`output/expression-eval.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/expression-eval.pl) |
| [`family-cousins.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/family-cousins.pl) | Derives cousin and family labels. | [`output/family-cousins.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/family-cousins.pl) |
| [`fastpow.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/fastpow.pl) | Computes powers by repeated squaring. | [`output/fastpow.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/fastpow.pl) |
| [`fft8-numeric.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/fft8-numeric.pl) | Runs an 8-point FFT over complex pairs. | [`output/fft8-numeric.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/fft8-numeric.pl) |
| [`fibonacci.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/fibonacci.pl) | Computes large Fibonacci numbers by fast doubling. | [`output/fibonacci.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/fibonacci.pl) |
| [`field-nitrogen-balance.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/field-nitrogen-balance.pl) | Classifies field nitrogen balance. | [`output/field-nitrogen-balance.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/field-nitrogen-balance.pl) |
| [`floating-point.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/floating-point.pl) | Exercises floating-point arithmetic and comparisons. | [`output/floating-point.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/floating-point.pl) |
| [`flandor.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/flandor.pl) | Derives a Flanders macro-insight authorization and retooling package. | [`output/flandor.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/flandor.pl) |
| [`four-color-map.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/four-color-map.pl) | Checks a four-colour map assignment. | [`output/four-color-map.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/four-color-map.pl) |
| [`fundamental-theorem-arithmetic.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/fundamental-theorem-arithmetic.pl) | Factors integers and reconstructs products. | [`output/fundamental-theorem-arithmetic.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/fundamental-theorem-arithmetic.pl) |
| [`gcd-bezout-identity.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/gcd-bezout-identity.pl) | Computes gcd and Bézout coefficients. | [`output/gcd-bezout-identity.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/gcd-bezout-identity.pl) |
| [`gd-step-certified.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/gd-step-certified.pl) | Certifies a gradient-descent step. | [`output/gd-step-certified.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/gd-step-certified.pl) |
| [`gdpr-compliance.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/gdpr-compliance.pl) | Checks GDPR-style processing compliance. | [`output/gdpr-compliance.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/gdpr-compliance.pl) |
| [`goldbach-1000.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/goldbach-1000.pl) | Finds Goldbach prime pairs up to 1000. | [`output/goldbach-1000.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/goldbach-1000.pl) |
| [`good-cobbler.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/good-cobbler.pl) | Demonstrates term-level structure with a good-cobbler statement. | [`output/good-cobbler.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/good-cobbler.pl) |
| [`gps.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/gps.pl) | Finds and verifies route paths. | [`output/gps.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/gps.pl) |
| [`graph-reachability.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/graph-reachability.pl) | Derives reachable nodes in a graph. | [`output/graph-reachability.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/graph-reachability.pl) |
| [`gray-code-counter.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/gray-code-counter.pl) | Generates Gray-code counter states. | [`output/gray-code-counter.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/gray-code-counter.pl) |
| [`greatest-lower-bound-uniqueness.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/greatest-lower-bound-uniqueness.pl) | Shows uniqueness of greatest lower bounds in a finite order instance. | [`output/greatest-lower-bound-uniqueness.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/greatest-lower-bound-uniqueness.pl) |
| [`group-inverse-uniqueness.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/group-inverse-uniqueness.pl) | Shows uniqueness of inverses in a finite group instance. | [`output/group-inverse-uniqueness.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/group-inverse-uniqueness.pl) |
| [`hamiltonian-cycle.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/hamiltonian-cycle.pl) | Finds a Hamiltonian cycle. | [`output/hamiltonian-cycle.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/hamiltonian-cycle.pl) |
| [`hamiltonian-path.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/hamiltonian-path.pl) | Finds a Hamiltonian path. | [`output/hamiltonian-path.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/hamiltonian-path.pl) |
| [`hamming-code.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/hamming-code.pl) | Corrects a single-bit Hamming word. | [`output/hamming-code.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/hamming-code.pl) |
| [`hanoi.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/hanoi.pl) | Derives the Towers of Hanoi moves. | [`output/hanoi.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/hanoi.pl) |
| [`heat-loss.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/heat-loss.pl) | Computes conductive heat loss. | [`output/heat-loss.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/heat-loss.pl) |
| [`heron-theorem.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/heron-theorem.pl) | Computes triangle area by Heron's theorem. | [`output/heron-theorem.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/heron-theorem.pl) |
| [`ideal-gas-law.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/ideal-gas-law.pl) | Applies the ideal gas law. | [`output/ideal-gas-law.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/ideal-gas-law.pl) |
| [`illegitimate-reasoning.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/illegitimate-reasoning.pl) | Detects suspect reasoning patterns. | [`output/illegitimate-reasoning.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/illegitimate-reasoning.pl) |
| [`kaprekar.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/kaprekar.pl) | Iterates toward Kaprekar's constant. | [`output/kaprekar.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/kaprekar.pl) |
| [`law-of-cosines.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/law-of-cosines.pl) | Computes a triangle side by cosine law. | [`output/law-of-cosines.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/law-of-cosines.pl) |
| [`least-squares-regression.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/least-squares-regression.pl) | Fits a least-squares regression line. | [`output/least-squares-regression.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/least-squares-regression.pl) |
| [`list-collection.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/list-collection.pl) | Demonstrates list and collection built-ins. | [`output/list-collection.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/list-collection.pl) |
| [`lldm.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/lldm.pl) | Calculates leg-length discrepancy measurements. | [`output/lldm.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/lldm.pl) |
| [`manufacturing-quality-control.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/manufacturing-quality-control.pl) | Evaluates process capability and quality. | [`output/manufacturing-quality-control.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/manufacturing-quality-control.pl) |
| [`matrix.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/matrix.pl) | Runs matrix operations over sample inputs. | [`output/matrix.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/matrix.pl) |
| [`microgrid-dispatch.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/microgrid-dispatch.pl) | Plans microgrid dispatch and reserve. | [`output/microgrid-dispatch.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/microgrid-dispatch.pl) |
| [`monkey-bananas.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/monkey-bananas.pl) | Solves the monkey-and-bananas puzzle. | [`output/monkey-bananas.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/monkey-bananas.pl) |
| [`n-queens.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/n-queens.pl) | Searches for N-queens placements. | [`output/n-queens.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/n-queens.pl) |
| [`network-sla.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/network-sla.pl) | Checks network path SLA compliance. | [`output/network-sla.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/network-sla.pl) |
| [`newton-raphson.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/newton-raphson.pl) | Finds roots by Newton-Raphson iteration. | [`output/newton-raphson.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/newton-raphson.pl) |
| [`nixon-diamond.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/nixon-diamond.pl) | Reports the classic Nixon-diamond conflict. | [`output/nixon-diamond.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/nixon-diamond.pl) |
| [`odrl-dpv-healthcare-risk-ranked.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/odrl-dpv-healthcare-risk-ranked.pl) | Ranks healthcare policy risks and mitigations. | [`output/odrl-dpv-healthcare-risk-ranked.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/odrl-dpv-healthcare-risk-ranked.pl) |
| [`odrl-dpv-risk-ranked.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/odrl-dpv-risk-ranked.pl) | Ranks data-policy risks and mitigations. | [`output/odrl-dpv-risk-ranked.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/odrl-dpv-risk-ranked.pl) |
| [`orbital-transfer-design.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/orbital-transfer-design.pl) | Designs a Hohmann orbital transfer. | [`output/orbital-transfer-design.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/orbital-transfer-design.pl) |
| [`path-discovery.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/path-discovery.pl) | Discovers bounded air-route paths. | [`output/path-discovery.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/path-discovery.pl) |
| [`peano-arithmetic.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/peano-arithmetic.pl) | Computes Peano addition, multiplication, and factorial. | [`output/peano-arithmetic.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/peano-arithmetic.pl) |
| [`peasant.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/peasant.pl) | Performs peasant multiplication and exponentiation. | [`output/peasant.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/peasant.pl) |
| [`pendulum-period.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/pendulum-period.pl) | Computes simple pendulum periods. | [`output/pendulum-period.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/pendulum-period.pl) |
| [`polynomial.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/polynomial.pl) | Finds complex integer polynomial roots. | [`output/polynomial.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/polynomial.pl) |
| [`project-portfolio-optimization.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/project-portfolio-optimization.pl) | Optimizes a constrained project portfolio with pruning and aggregate builtins. | [`output/project-portfolio-optimization.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/project-portfolio-optimization.pl) |
| [`proof-contrapositive.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/proof-contrapositive.pl) | Models proof by contrapositive. | [`output/proof-contrapositive.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/proof-contrapositive.pl) |
| [`quadratic-formula.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/quadratic-formula.pl) | Solves sample quadratic equations. | [`output/quadratic-formula.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/quadratic-formula.pl) |
| [`quine-mccluskey.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/quine-mccluskey.pl) | Minimizes Boolean terms with Quine-McCluskey. | [`output/quine-mccluskey.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/quine-mccluskey.pl) |
| [`radioactive-decay.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/radioactive-decay.pl) | Computes radioactive decay over time. | [`output/radioactive-decay.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/radioactive-decay.pl) |
| [`resilient-city-orchestration.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/resilient-city-orchestration.pl) | Orchestrates storm-response missions from signals, policy, routes, teams, and portfolio optimization. | [`output/resilient-city-orchestration.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/resilient-city-orchestration.pl) |
| [`riemann-hypothesis.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/riemann-hypothesis.pl) | Checks a finite catalogue of non-trivial zeta zeros against the Riemann-hypothesis condition. | [`output/riemann-hypothesis.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/riemann-hypothesis.pl) |
| [`sat-dpll.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/sat-dpll.pl) | Solves a finite SAT instance. | [`output/sat-dpll.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/sat-dpll.pl) |
| [`security-incident-correlation.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/security-incident-correlation.pl) | Correlates security incidents across signals. | [`output/security-incident-correlation.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/security-incident-correlation.pl) |
| [`service-impact.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/service-impact.pl) | Analyzes service impact over cyclic dependencies. | [`output/service-impact.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/service-impact.pl) |
| [`sieve.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/sieve.pl) | Enumerates primes with a sieve-style program. | [`output/sieve.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/sieve.pl) |
| [`skolem-functions.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/skolem-functions.pl) | Generates deterministic functional terms. | [`output/skolem-functions.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/skolem-functions.pl) |
| [`socket-age.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/socket-age.pl) | Shows socket-declared age reasoning inputs and plugs. | [`output/socket-age.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/socket-age.pl) |
| [`socket-family.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/socket-family.pl) | Shows socket-declared family-source inputs and ancestry rules. | [`output/socket-family.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/socket-family.pl) |
| [`socrates.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/socrates.pl) | Derives that Socrates is mortal. | [`output/socrates.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/socrates.pl) |
| [`statistics-summary.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/statistics-summary.pl) | Computes population statistics for a sample. | [`output/statistics-summary.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/statistics-summary.pl) |
| [`sudoku.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/sudoku.pl) | Solves generic 9x9 Sudoku strings through the sudoku/2 builtin. | [`output/sudoku.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/sudoku.pl) |
| [`superdense-coding.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/superdense-coding.pl) | Models superdense-coding bit transmission. | [`output/superdense-coding.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/superdense-coding.pl) |
| [`traveling-salesman.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/traveling-salesman.pl) | Finds an optimal traveling-salesman tour. | [`output/traveling-salesman.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/traveling-salesman.pl) |
| [`turing.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/turing.pl) | Simulates a binary-increment Turing machine. | [`output/turing.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/turing.pl) |
| [`vector-similarity.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/vector-similarity.pl) | Computes dot product, norm, and cosine similarity. | [`output/vector-similarity.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/vector-similarity.pl) |
| [`vulnerability-impact.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/vulnerability-impact.pl) | Analyzes vulnerable transitive dependencies and urgent patch impact. | [`output/vulnerability-impact.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/vulnerability-impact.pl) |
| [`witch.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/witch.pl) | Derives the classic “burn the witch” N3 rule chain. | [`output/witch.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/witch.pl) |
| [`wolf-goat-cabbage.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/wolf-goat-cabbage.pl) | Solves the wolf-goat-cabbage river crossing. | [`output/wolf-goat-cabbage.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/wolf-goat-cabbage.pl) |
| [`zebra.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/zebra.pl) | Solves the zebra logic puzzle. | [`output/zebra.pl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/zebra.pl) |


| [`directional-language.ttl`](https://github.com/eyereasoner/eyelang/blob/main/examples/directional-language.ttl) | Demonstrates RDF 1.2 directional language-tagged strings. | [`output/directional-language.ttl`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/directional-language.ttl) |
| [`n3-builtins.n3`](https://github.com/eyereasoner/eyelang/blob/main/examples/n3-builtins.n3) | Uses N3 `<=` plus `math:`, `string:`, and `list:` builtins. | [`output/n3-builtins.n3`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/n3-builtins.n3) |
| [`triple-term.n3`](https://github.com/eyereasoner/eyelang/blob/main/examples/triple-term.n3) | Demonstrates RDF 1.2 triple terms in N3 data and rules. | [`output/triple-term.n3`](https://github.com/eyereasoner/eyelang/blob/main/examples/output/triple-term.n3) |

## Golden outputs, tests, and conformance

Golden answer outputs live in [`examples/output`](examples/output). `npm run test:examples` covers every top-level runnable example with extension `.pl`, `.n3`, `.ttl`, or `.nt`. A curated proof-output suite for `.pl` examples lives in [`examples/proof`](examples/proof). Example tests pin `local_time/1` to `2026-05-30` so date-dependent examples stay deterministic. Regenerate them after an intentional output or explanation change:

```sh
for f in examples/*.pl examples/*.n3 examples/*.ttl examples/*.nt; do
  [ -e "$f" ] || continue
  b=$(basename "$f")
  EYELANG_LOCAL_TIME=2026-05-30 bin/eyelang "$f" > "examples/output/$b"
done

for f in examples/proof/*.pl; do
  b=$(basename "$f")
  EYELANG_LOCAL_TIME=2026-05-30 bin/eyelang --proof "examples/$b" > "examples/proof/$b"
done
```

Run the full test suite:

```sh
npm test
```

The test suite runs in this order: Conformance, Regression/API/White-box, Examples. Each section prints its own subtotal, followed by a suite-specific grand total. The suite checks the conformance cases derived from `SPEC.md`, supplemental regression/API/white-box checks, and every runnable example against its golden output.

Run only one suite when you are iterating:

```sh
npm run test:conformance
npm run test:regression
npm run test:examples
```

The conformance suite lives in [`conformance/`](conformance/) and is split into `core` and `extension` profiles matching `SPEC.md`. Each case is a small program with an exact expected stdout file, and some internal conformance cases also include a goal file for testing the embeddable solver, so other implementations can reuse the same cases. The regression suite lives in [`test/run-regression.js`](test/run-regression.js) and covers CLI regressions, the public JavaScript API, and white-box invariants for parser, unification, and indexing behavior.

## Development and release

Common commands:

```sh
npm test                  # conformance, regression/API/white-box, and examples
npm run test:conformance  # only the conformance suite
npm run test:regression   # CLI regression, API, and white-box checks
npm run test:examples     # every example against examples/output
node bin/eyelang --help
```

Useful profiling smoke test:

```sh
bin/eyelang -s examples/sudoku.pl > /dev/null
```

For a release:

1. update `VERSION`;
2. update `README.md` and `SPEC.md`;
3. regenerate golden outputs if behavior changed;
4. run `npm test`;
5. publish the repository with `playground.html` and `playground-worker.mjs` if publishing the playground. The playground includes controls equivalent to CLI `--stats` and `--proof`.

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

For the deep taxonomy benchmark, eyelang is substantially faster in current local checks. On one sandbox run, `node bin/eyelang examples/deep-taxonomy-100000.pl > /dev/null` took about `1.60 sec`, while `eyeling` package version `1.28.7` on `examples/deep-taxonomy-100000.n3` took about `4.56 sec` without proof and about `5.04 sec` with proof. Treat those numbers as a smoke comparison rather than a formal benchmark: hardware, Node.js version, package version, and CLI startup all matter.

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

eyelang is intentionally smaller than ISO Prolog. It has no operators, cut, modules, dynamic database updates, DCGs, or complete ISO library. Negation is negation-as-failure through `not/1`. Search is goal-directed and expected to be finite for the selected output goals. Output explanations are non-normative proof printouts and do not change answer semantics. The RDF 1.2 / Notation3 reader is an implementation compatibility layer over `rdf/3`, not a normative RDF conformance profile.
