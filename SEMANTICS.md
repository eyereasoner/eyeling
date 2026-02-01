How does the [Eyeling HANDBOOK](https://eyereasoner.github.io/eyeling/HANDBOOK) line up with the W3C CG [Notation3 Semantics](https://w3c.github.io/N3/spec/semantics) document — and where does it intentionally diverge?

## Where Eyeling is strongly aligned

- **Core term model (IRIs, literals, variables, blank nodes, lists, quoted formulas):** The semantics spec treats N3 terms as IRIs/literals/variables plus **lists** and **graph terms**. Eyeling’s handbook describes the same internal term universe: `Iri`, `Literal`, `Var`, `Blank`, `ListTerm`, `GraphTerm`.

- **Quoted formulas need alpha-equivalence / isomorphism:** The semantics spec defines isomorphism for graphs and graph terms using renaming mappings (including special handling for nested scopes). Eyeling implements this operationally as **alpha-equivalence for `GraphTerm`**, explicitly describing “consistent renaming” as the match criterion.

- **Rules as implication (and `true` as empty formula):** The semantics spec defines log-semantics for `log:implies` and explicitly treats boolean `true`/`false` as special literals, with `true` corresponding to the empty formula. Eyeling’s parser/normalizer explicitly supports `{P} => {C}` and `{P} log:implies {C}`, and treats `true` as `{}`.

- **Lists as first-class citizens (not just RDF collections):** The semantics spec treats lists as proper N3 terms. Eyeling uses concrete `ListTerm`s and even materializes RDF `rdf:first`/`rdf:rest` chains into list terms to operate uniformly.

## Where Eyeling diverges or goes beyond the semantics doc

### 1) Blank nodes in **rule bodies**: Eyeling chooses “N3 practice” over “bnodes are existential”

The semantics doc states (for concrete syntax intuition) that **blank nodes correspond to existentially quantified variables** with **local scope**. Eyeling _intentionally_ rewrites blanks in **premises** into variables (“universally-quantified placeholders”), to avoid “existential in the body” behavior.

This is a _real semantic choice_: it matches how many people _write_ N3 rules, but it is not the same as a straightforward “bnodes are existentials everywhere” reading.

### 2) “Groundness” of quoted formulas containing variables

In the semantics spec, whether a graph term is ground depends on whether the underlying graph is closed (no free variables), and it discusses how variables can appear free when you isolate a nested graph term. Eyeling explicitly makes a pragmatic choice: **variables inside a `GraphTerm` do not make the surrounding triple non-ground** (“variables inside formulas don’t leak”).

That’s convenient for operational indexing/matching, but it doesn’t mirror the model-theoretic notion of ground graph terms one-to-one.

### 3) Eyeling implements lots of behavior the semantics doc does not yet define

The semantics report currently only gives special meaning to `log:implies` (and says LP is planned to be extended). Eyeling defines a large operational “standard library” of builtins and advanced control features (e.g., scoped querying / snapshotting). For example, it gives `log:includes`/`log:notIncludes` a two-phase snapshot semantics for determinism.

So: Eyeling is **ahead of / outside** what `semantics.html` formally specifies today.

### 4) Constraint handling via “inference fuses” (`=> false`) is operational

The semantics doc includes a notion of `false` in connection with `log:implies` constraints. Eyeling turns `{...} => false` into an _engine-level hard failure_ (exit status, message), i.e., a procedural constraint mechanism rather than just a semantic condition.

That’s useful in tooling, but it’s not something the model-theoretic semantics itself “does” (it defines truth/entailment, not process control).

### 5) Possible coverage gaps vs full N3 surface language (not strictly “semantics.html”, but relevant)

Eyeling’s handbook lists supported directives/tokens (`@prefix`, `@base`, etc.) but does not mention explicit quantifier directives like `@forAll` / `@forSome`. The semantics document leans on explicit quantification in its **abstract syntax** discussion. So Eyeling appears to support _implicit_ quantification via `?x` and blanks (plus its own rule-normalization choices), but may not implement the full explicit-quantifier surface syntax.
