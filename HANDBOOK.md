# Inside Eyeling

## A compact Notation3 reasoner in JavaScript — a handbook

> This handbook is written for a computer science student who wants to understand Eyeling as *code* and as a *reasoning machine*.  
> It’s meant to be read linearly, but each chapter stands on its own.


## Contents

- [Preface](#preface)
- [Chapter 1 — The execution model in one picture](#ch01)
- [Chapter 2 — The repository, as a guided reading path](#ch02)
- [Chapter 3 — The data model: terms, triples, formulas, rules](#ch03)
- [Chapter 4 — From characters to AST: lexing and parsing](#ch04)
- [Chapter 5 — Rule normalization: “compile-time” semantics](#ch05)
- [Chapter 6 — Equality, alpha-equivalence, and unification](#ch06)
- [Chapter 7 — Facts as a database: indexing and fast duplicate checks](#ch07)
- [Chapter 8 — Backward chaining: the proof engine](#ch08)
- [Chapter 9 — Forward chaining: saturation, skolemization, and meta-rules](#ch09)
- [Chapter 10 — Scoped closure, priorities, and `log:conclusion`](#ch10)
- [Chapter 11 — Built-ins as a standard library](#ch11)
- [Chapter 12 — Dereferencing and web-like semantics](#ch12)
- [Chapter 13 — Printing, proofs, and the user-facing output](#ch13)
- [Chapter 14 — Entry points: CLI, bundle exports, and npm API](#ch14)
- [Chapter 15 — A worked example: Socrates, step by step](#ch15)
- [Chapter 16 — Extending Eyeling (without breaking it)](#ch16)
- [Epilogue](#epilogue)
- [Appendix A — Eyeling user notes](#app-a)

---

<a id="preface"></a>
## Preface: what Eyeling is (and what it is not)

Eyeling is a small Notation3 (N3) reasoner implemented in JavaScript. Its job is to take:

1. **Facts** (RDF-like triples), and
2. **Rules** written in N3’s implication style (`=>` and `<=`),

and compute consequences until nothing new follows.

If you’ve seen Datalog or Prolog, the shape will feel familiar. Eyeling blends both:

- **Forward chaining** (like Datalog saturation) for `=>` rules.
- **Backward chaining** (like Prolog goal solving) for `<=` rules *and* for built-in predicates.

That last point is the heart of Eyeling’s design: *forward rules are executed by proving their bodies using a backward engine*. This lets forward rules depend on computations and “virtual predicates” without explicitly materializing everything as facts.

Eyeling deliberately keeps the implementation small and dependency-free:
- the published package includes a single bundled file (`eyeling.js`)
- the source is organized into `lib/*` modules that read like a miniature compiler + logic engine.

This handbook is a tour of that miniature system.

---

<a id="ch01"></a>
## Chapter 1 — The execution model in one picture

Let’s name the pieces:

- A **fact** is a triple `(subject, predicate, object)`.
- A **forward rule** has the form `{ body } => { head }.`  
  Read: if the body is provable, assert the head.
- A **backward rule** has the form `{ head } <= { body }.`  
  Read: to prove the head, prove the body.

Eyeling runs like this:

1. Parse the document into:
   - an initial fact set `F`
   - forward rules `R_f`
   - backward rules `R_b`
2. Repeat until fixpoint:
   - for each forward rule `r ∈ R_f`:
     - use the backward prover to find substitutions that satisfy `r.body` using:
       - the current facts
       - backward rules
       - built-ins
     - for each solution, instantiate and add `r.head`

A good mental model is:

> **Forward chaining is “outer control”. Backward chaining is the “query engine” used inside each rule firing.**

A sketch:

```

FORWARD LOOP (saturation)
for each forward rule r:
solutions = PROVE(r.body)   <-- backward reasoning + builtins
for each s in solutions:
emit instantiate(r.head, s)

```

Because `PROVE` can call built-ins (math, string, list, crypto, dereferencing…), forward rules can compute fresh bindings as part of their condition.

---

<a id="ch02"></a>
## Chapter 2 — The repository, as a guided reading path

If you want to follow the code in the same order Eyeling “thinks”, read:

1. `lib/prelude.js` — the AST (terms, triples, rules), namespaces, prefix handling.
2. `lib/lexer.js` — N3/Turtle-ish tokenization.
3. `lib/parser.js` — parsing tokens into triples, formulas, and rules.
4. `lib/rules.js` — small rule “compiler passes” (blank lifting, constraint delaying).
5. `lib/engine.js` — the core engine:
   - equality + alpha equivalence for formulas
   - unification + substitutions
   - indexing facts and backward rules
   - backward goal proving (`proveGoals`)
   - forward saturation (`forwardChain`)
   - built-ins (`evalBuiltin`)
   - scoped-closure machinery (for `log:*In` and includes tests)
   - explanations and output construction
   - tracing hooks (`lib/trace.js`, `log:trace`)
   - time helpers for `time:*` built-ins (`lib/time.js`)
   - deterministic Skolem IDs (head existentials + `log:skolem`) (`lib/skolem.js`)
6. `lib/deref.js` — synchronous dereferencing for `log:content` / `log:semantics`.
7. `lib/printing.js` — conversion back to N3 text.
8. `lib/cli.js` + `lib/entry.js` — command-line wiring and bundle entry exports.
9. `index.js` — the npm API wrapper (spawns the bundled CLI synchronously).

This is almost literally a tiny compiler pipeline:

```

text → tokens → AST (facts + rules) → engine → derived facts → printer

```

---

<a id="ch03"></a>
## Chapter 3 — The data model: terms, triples, formulas, rules (`lib/prelude.js`)

Eyeling uses a small AST. You can think of it as the “instruction set” for the rest of the reasoner.

### 3.1 Terms

A **Term** is one of:

- `Iri(value)` — an absolute IRI string
- `Literal(value)` — stored as raw lexical form (e.g. `"hi"@en`, `12`, `"2020-01-01"^^<dt>`)
- `Var(name)` — variable name without the leading `?`
- `Blank(label)` — blank node label like `_:b1`
- `ListTerm(elems)` — a concrete N3 list `(a b c)`
- `OpenListTerm(prefix, tailVar)` — a “list with unknown tail”, used for list unification patterns
- `GraphTerm(triples)` — a quoted formula `{ ... }` as a first-class term

That last one is special: N3 allows formulas as terms, so Eyeling must treat graphs as matchable data.

### 3.2 Triples and rules

A triple is:

- `Triple(s, p, o)` where each position is a Term.

A rule is:

- `Rule(premiseTriples, conclusionTriples, isForward, isFuse, headBlankLabels)`

Two details matter later:

1. **Inference fuse**: a forward rule whose conclusion is the literal `false` acts as a hard failure. (More in Chapter 10.)
2. **`headBlankLabels`** records which blank node labels occur *explicitly in the head* of a rule. Those blanks are treated as existentials and get skolemized per firing. (Chapter 9.)

### 3.3 Interning

Eyeling interns IRIs and Literals by string value. Interning is a quiet performance trick with big consequences:

- repeated IRIs become pointer-equal
- indexing is cheaper
- comparisons are faster and allocations drop.

Terms are treated as immutable: once interned, the code assumes you won’t mutate `.value`.

### 3.4 Prefix environment

`PrefixEnv` holds prefix mappings and a base IRI. It provides:

- expansion (`ex:foo` → full IRI)
- shrinking for printing (full IRI → `ex:foo` when possible)
- default prefixes for RDF/RDFS/XSD/log/math/string/list/time/genid.

---

<a id="ch04"></a>
## Chapter 4 — From characters to AST: lexing and parsing (`lib/lexer.js`, `lib/parser.js`)

Eyeling’s parser is intentionally pragmatic: it aims to accept “the stuff people actually write” in N3/Turtle, including common shorthand.

### 4.1 Lexing: tokens, not magic

The lexer turns the input into tokens like:

- punctuation: `{ } ( ) [ ] , ; .`
- operators: `=>`, `<=`, `=`, `!`, `^`
- directives: `@prefix`, `@base`, and also SPARQL-style `PREFIX`, `BASE`
- variables `?x`
- blanks `_:b1`
- IRIREF `<...>`
- qnames `rdf:type`, `:local`
- literals: strings (short and long), numbers, `true`/`false`, `^^` datatypes, `@en` language tags
- `#` comments

Parsing becomes dramatically simpler because tokenization already decided where strings end, where numbers are, and so on.

### 4.2 Parsing triples, with Turtle-style convenience

The parser supports:

- predicate/object lists with `;` and `,`
- blank node property lists `[ :p :o; :q :r ]`
- collections `( ... )` as `ListTerm`
- quoted formulas `{ ... }` as `GraphTerm`
- variables, blanks, literals, qnames, IRIREFs
- keyword-ish sugar like `is ... of` and inverse arrows
- path operators `!` and `^` that may generate helper triples via fresh blanks

A nice detail: the parser maintains a `pendingTriples` list used when certain syntactic forms expand into helper triples (for example, some path/property-list expansions). It ensures the “surface statement” still emits all required triples even if the subject itself was syntactic sugar.

### 4.3 Parsing rules: `=>`, `<=`, and log idioms

At the top level, the parser recognizes:

- `{ P } => { C } .` as a forward rule
- `{ H } <= { B } .` as a backward rule

It also normalizes top-level triples of the form:

- `{ P } log:implies { C } .`
- `{ H } log:impliedBy { B } .`

into the same internal Rule objects. That means you can write rules either as operators (`=>`, `<=`) or as explicit `log:` predicates.

### 4.4 `true` and `false` as rule endpoints

Eyeling treats two literals specially in rule positions:

- `true` stands for the empty formula `{}` (an empty premise or head).
- `false` is used for inference fuses (`{ ... } => false.`).

So these are valid patterns:

```n3
true => { :Program :loaded true }.
{ ?x :p :q } => false.
```

Internally:

* `true` becomes “empty triple list”
* `false` becomes “no head triples” *plus* the `isFuse` flag if forward.

---

<a id="ch05"></a>
## Chapter 5 — Rule normalization: “compile-time” semantics (`lib/rules.js`)

Before rules hit the engine, Eyeling performs two lightweight transformations.

### 5.1 Lifting blank nodes in rule bodies into variables

In N3 practice, blanks in *rule premises* behave like universally-quantified placeholders. Eyeling implements this by converting `Blank(label)` to `Var(_bN)` in the premise only.

So a premise like:

```n3
{ _:x :p ?y. } => { ... }.
```

acts like:

```n3
{ ?_b1 :p ?y. } => { ... }.
```

This avoids the “existential in the body” trap and matches how most rule authors expect N3 to behave.

Blanks in the **conclusion** are *not* lifted — they remain blanks and later become existentials (Chapter 9).

### 5.2 Delaying constraints

Some built-ins don’t generate bindings; they only test conditions:

* `math:greaterThan`, `math:lessThan`, `math:equalTo`, …
* `string:matches`, `string:contains`, …
* `log:notIncludes`, `log:forAllIn`, `log:outputString`, …

Eyeling treats these as “constraints” and moves them to the *end* of a forward rule premise. This is a Prolog-style heuristic:

> Bind variables first; only then run pure checks.

It’s not logically necessary, but it improves the chance that constraints run with variables already grounded, reducing wasted search.

---

<a id="ch06"></a>
## Chapter 6 — Equality, alpha-equivalence, and unification (`lib/engine.js`)

Once you enter `engine.js`, you enter the “physics layer.” Everything else depends on the correctness of:

* equality and normalization (especially for literals)
* alpha-equivalence for formulas
* unification and substitution application

### 6.1 Two equalities: structural vs alpha-equivalent

Eyeling has ordinary structural equality (term-by-term) for most terms.

But **quoted formulas** (`GraphTerm`) demand something stronger. Two formulas should match even if their internal blank/variable names differ, as long as the structure is the same.

That’s alpha-equivalence:

* `{ _:x :p ?y. }` should match `{ _:z :p ?w. }`

Eyeling implements alpha-equivalence by checking whether there exists a consistent renaming mapping between the two formulas’ variables/blanks that makes the triples match.

### 6.2 Groundness: “variables inside formulas don’t leak”

Eyeling makes a deliberate choice about *groundness*:

* a triple is “ground” if it has no free variables in normal positions
* **variables inside a `GraphTerm` do not make the surrounding triple non-ground**

This is encoded in functions like `isGroundTermInGraph`. It’s what makes it possible to assert and store triples that *mention formulas with variables* as data.

### 6.3 Substitutions: chaining and application

A substitution is a plain JS object:

```js
{ X: Term, Y: Term, ... }
```

When applying substitutions, Eyeling follows chains:

* if `X → Var(Y)` and `Y → Iri(...)`, applying to `X` yields the IRI.

This matters because unification can bind variables to variables; it’s normal in logic programming, and you want `applySubst` to “chase the link” until it reaches a stable term.

### 6.4 Unification: the core operation

Unification is implemented in `unifyTerm` / `unifyTriple`, with support for:

* variable binding with occurs check
* list unification (elementwise)
* open-list unification (prefix + tail variable)
* formula unification via graph unification:

  * fast path: identical triple list
  * otherwise: backtracking order-insensitive matching while threading the substitution

There are two key traits of Eyeling’s graph unification:

1. It’s *set-like*: order doesn’t matter.
2. It’s *substitution-threaded*: choices made while matching one triple restrict the remaining matches, just like Prolog.

### 6.5 Literals: lexical vs semantic equality

Eyeling keeps literal values as raw strings, but it parses and normalizes where needed:

* `literalParts(lit)` splits lexical form and datatype IRI
* it recognizes RDF JSON datatype (`rdf:JSON` / `<...rdf#JSON>`)
* it includes caches for numeric parsing, integer parsing (`BigInt`), and numeric metadata.

This lets built-ins and fast-key indexing treat some different lexical spellings as the same value (for example, normalizing `"abc"` and `"abc"^^xsd:string` in the fast-key path).

---

<a id="ch07"></a>
## Chapter 7 — Facts as a database: indexing and fast duplicate checks

Reasoning is mostly “join-like” operations: match a goal triple against known facts. Doing this naively is too slow, so Eyeling builds indexes on top of a plain array.

### 7.1 The fact store

Facts live in an array `facts: Triple[]`.

Eyeling attaches hidden (non-enumerable) index fields:

* `facts.__byPred: Map<predicateIRI, Triple[]>`
* `facts.__byPS: Map<predicateIRI, Map<subjectKey, Triple[]>>`
* `facts.__byPO: Map<predicateIRI, Map<objectKey, Triple[]>>`
* `facts.__keySet: Set<string>` for a fast-path “S\tP\tO” key when all terms are IRI/Literal-like

The “fast key” only exists when `termFastKey` succeeds for all three terms.

### 7.2 Candidate selection: pick the smallest bucket

When proving a goal with IRI predicate, Eyeling computes candidate facts by:

1. restricting to predicate bucket
2. optionally narrowing further by subject or object fast key
3. choosing the smaller of (p,s) vs (p,o) when both exist

This is a cheap selectivity heuristic. In type-heavy RDF, `(p,o)` is often extremely selective (e.g., `rdf:type` + a class IRI), so the PO index can be a major speed win.

### 7.3 Duplicate detection is careful about blanks

A tempting optimization would be “treat two triples as duplicates modulo blank renaming.” Eyeling does **not** do this globally, because it would be unsound: different blank labels represent different existentials unless explicitly linked.

So:

* fast-key dedup works for IRI/Literal-only triples
* otherwise, it falls back to real triple equality on actual blank labels.

---

<a id="ch08"></a>
## Chapter 8 — Backward chaining: the proof engine (`proveGoals`)

Eyeling’s backward prover is an iterative depth-first search (DFS) that looks a lot like Prolog’s SLD resolution, but written explicitly with a stack to avoid JS recursion limits.

### 8.1 Proof states

A proof state contains:

* `goals`: remaining goal triples
* `subst`: current substitution
* `depth`: current depth (used for compaction heuristics)
* `visited`: previously-seen goals (loop prevention)

### 8.2 The proving loop

At each step:

1. If no goals remain: emit the current substitution as a solution.
2. Otherwise:

   * take the first goal
   * apply the current substitution to it
   * attempt to satisfy it in three ways:

     1. built-ins
     2. facts
     3. backward rules

Eyeling’s order is intentional: built-ins often bind variables cheaply; rules expand search trees.

### 8.3 Built-ins: return *deltas*, not full substitutions

A built-in is evaluated as:

```js
deltas = evalBuiltin(goal0, {}, facts, backRules, ...)
for delta in deltas:
  composed = composeSubst(currentSubst, delta)
```

So built-ins behave like relations that can generate zero, one, or many possible bindings.

This is important: a list generator might yield many deltas; a numeric test yields zero or one.

### 8.4 Loop prevention: a simple visited list

Eyeling prevents obvious infinite recursion by skipping a goal if it is already in the `visited` list. This is a pragmatic check; it doesn’t implement full tabling, but it avoids the most common “A depends on A” loops.

### 8.5 Backward rules: indexed by head predicate

Backward rules are indexed in `backRules.__byHeadPred`. When proving a goal with IRI predicate `p`, Eyeling retrieves:

* `rules whose head predicate is p`
* plus `__wildHeadPred` for rules whose head predicate is not an IRI (rare, but supported)

For each candidate rule:

1. standardize it apart (fresh variables)
2. unify the rule head with the goal
3. append the rule body goals in front of the remaining goals

That “standardize apart” step is essential. Without it, reusing a rule multiple times would accidentally share variables across invocations, producing incorrect bindings.

### 8.6 Substitution compaction: keeping DFS from going quadratic

Deep backward chains can create large substitutions. If you copy a growing object at every step, you can accidentally get O(depth²) behavior.

Eyeling avoids that with `maybeCompactSubst`:

* if depth is high or substitution is large, it keeps only bindings relevant to:

  * the remaining goals
  * variables from the original goal list (“answer variables”)
  * plus variables transitively referenced inside kept bindings

This is semantics-preserving for the ongoing proof search, but dramatically improves performance on deep recursive proofs.

---

<a id="ch09"></a>
## Chapter 9 — Forward chaining: saturation, skolemization, and meta-rules (`forwardChain`)

Forward chaining is Eyeling’s outer control loop. It is where facts get added and the closure grows.

### 9.1 The shape of saturation

Eyeling loops until no new facts are added. Inside that loop, it scans every forward rule and tries to fire it.

A simplified view:

```text
repeat
  changed = false
  for each forward rule r:
    sols = proveGoals(r.premise, facts, backRules)
    for each solution s:
      for each head triple h in r.conclusion:
        inst = applySubst(h, s)
        inst = skolemizeHeadBlanks(inst)
        if inst is ground and new:
          add inst to facts
          changed = true
until not changed
```

### 9.2 Strict-ground head optimization

There is a nice micro-compiler optimization in `runFixpoint()`:

If a rule’s head is *strictly ground* (no vars, no blanks, no open lists, even inside formulas), and it contains no head blanks, then the head does not depend on *which* body solution you choose.

In that case:

* Eyeling only needs **one** proof of the body.
* And if all head triples are already known, it can skip proving the body entirely.

This is a surprisingly effective optimization for “axiom-like” rules with constant heads.

### 9.3 Existentials: skolemizing head blanks

Blank nodes in the **rule head** represent existentials: “there exists something such that…”

Eyeling handles this by replacing head blank labels with fresh blank labels of the form:

* `_:sk_0`, `_:sk_1`, …

But it does something subtle and important: it caches skolemization per (rule firing, head blank label), so that the *same* firing instance doesn’t keep generating new blanks across outer iterations.

The “firing instance” is keyed by a deterministic string derived from the instantiated body (“firingKey”). This stabilizes the closure and prevents “existential churn.”

Implementation: deterministic Skolem IDs live in `lib/skolem.js`; the per-firing cache and head-blank rewriting are implemented in `lib/engine.js`.

### 9.4 Inference fuses: `{ ... } => false`

A rule whose conclusion is `false` is treated as a hard failure. During forward chaining:

* Eyeling proves the premise (it only needs one solution)
* if the premise is provable, it prints a message and exits with status code 2

This is Eyeling’s way to express constraints and detect inconsistencies.

### 9.5 Rule-producing rules (meta-rules)

Eyeling treats certain derived triples as *new rules*:

* `log:implies` and `log:impliedBy` where subject/object are formulas
* it also accepts the literal `true` as an empty formula `{}` on either side

So these are “rule triples”:

```n3
{ ... } log:implies { ... }.
true log:implies { ... }.
{ ... } log:impliedBy true.
```

When such a triple is derived in a forward rule head:

1. Eyeling adds it as a fact (so you can inspect it), and
2. it *promotes* it into a live rule by constructing a new `Rule` object and inserting it into the forward or backward rule list.

This is meta-programming: your rules can generate new rules during reasoning.

---

<a id="ch10"></a>
## Chapter 10 — Scoped closure, priorities, and `log:conclusion`

Some `log:` built-ins talk about “what is included in the closure” or “collect all solutions.” These are tricky in a forward-chaining engine because the closure is *evolving*.

Eyeling addresses this with a disciplined two-phase strategy and an optional priority mechanism.

### 10.1 The two-phase outer loop (Phase A / Phase B)

Forward chaining runs inside an *outer loop* that alternates:

* **Phase A**: scoped built-ins are disabled (they “delay” by failing)

* Eyeling saturates normally to a fixpoint

* then Eyeling freezes a snapshot of the saturated facts

* **Phase B**: scoped built-ins are enabled, but they query only the frozen snapshot

* Eyeling runs saturation again (new facts can appear due to scoped queries)

This produces deterministic behavior for scoped operations: they observe a stable snapshot, not a moving target.

### 10.2 Priority-gated closure levels

Eyeling introduces a `scopedClosureLevel` counter:

* level 0 means “no snapshot available” (Phase A)
* level 1, 2, … correspond to snapshots produced after each Phase A saturation

Some built-ins interpret a positive integer literal as a requested priority:

* `log:collectAllIn` and `log:forAllIn` use the **object position** for priority
* `log:includes` and `log:notIncludes` use the **subject position** for priority

If a rule requests priority `N`, Eyeling delays that builtin until `scopedClosureLevel >= N`.

In practice this allows rule authors to write “don’t run this scoped query until the closure is stable enough” and is what lets Eyeling iterate safely when rule-producing rules introduce new needs.

### 10.3 `log:conclusion`: local deductive closure of a formula

`log:conclusion` is handled in a particularly elegant way:

* given a formula `{ ... }` (a `GraphTerm`),
* Eyeling computes the deductive closure *inside that formula*:

  * extract rule triples inside it (`log:implies`, `log:impliedBy`)
  * run `forwardChain` locally over those triples
* cache the result in a `WeakMap` so the same formula doesn’t get recomputed

Notably, `log:impliedBy` inside the formula is treated as forward implication too for closure computation (and also indexed as backward to help proving).

This makes formulas a little world you can reason about as data.

---

<a id="ch11"></a>
## Chapter 11 — Built-ins as a standard library (`evalBuiltin`)

Built-ins are where Eyeling stops being “just a Datalog engine” and becomes a practical N3 tool.

### 11.1 How Eyeling recognizes built-ins

A predicate is treated as builtin if:

* it is an IRI in one of the builtin namespaces:

  * `crypto:`, `math:`, `log:`, `string:`, `time:`, `list:`
* or it is `rdf:first` / `rdf:rest` (treated as list-like builtins)
* unless **super restricted mode** is enabled, in which case only `log:implies` and `log:impliedBy` are treated as builtins.

Super restricted mode exists to let you treat all other predicates as ordinary facts/rules without any built-in evaluation.

### 11.2 Built-ins return multiple solutions

Every builtin returns a list of substitution *deltas*.

That means built-ins can be:

* **functional** (return one delta binding an output)
* **tests** (return either `[{}]` for success or `[]` for failure)
* **generators** (return many deltas)

List operations are a common source of generators; numeric comparisons are tests.

Below is a drop-in replacement for **§11.3 “A tour of builtin families”** that aims to be *fully self-contained* and to cover **every builtin currently implemented in `lib/engine.js`** (including the `rdf:first` / `rdf:rest` aliases).

---

## 11.3 A tour of builtin families

Eyeling’s builtins are best thought of as *foreign predicates*: they look like ordinary N3 predicates in your rules, but when the engine tries to satisfy a goal whose predicate is a builtin, it does not search the fact store. Instead, it calls a piece of JavaScript that implements the predicate’s semantics.

That one sentence explains a lot of “why does it behave like *that*?”:

* Builtins are evaluated **during backward proof** (goal solving), just like facts and backward rules.
* A builtin may produce **zero solutions** (fail), **one solution** (deterministic succeed), or **many solutions** (a generator).
* Most builtins behave like relations, not like functions: they can sometimes run “backwards” (bind the subject from the object) if the implementation supports it.
* Some builtins are **pure tests** (constraints): they never introduce new bindings; they only succeed or fail. Eyeling recognizes a subset of these and tends to schedule them *late* in forward-rule premises so they run after other goals have had a chance to bind variables.

### 11.3.0 Reading builtin “signatures” in this handbook

The N3 Builtins tradition often describes builtins using “schema” annotations like:

* `$s+` / `$o+` — input must be bound (or at least not a variable in practice)
* `$s-` / `$o-` — output position (often a variable that will be bound)
* `$s?` / `$o?` — may be unbound
* `$s.i` — list element *i* inside the subject list

Eyeling is a little more pragmatic: it implements the spirit of these schemas, but it also has several “engineering” conventions that appear across many builtins:

1. **Variables (`?X`) may be bound** by a builtin if the builtin is written to do so.
2. **Blank nodes (`[]` / `_:`)** are frequently treated as “don’t care” placeholders. Many builtins accept a blank node in an output position and simply succeed without binding.
3. **Fully unbound relations are usually not enumerated.** If both sides are unbound and enumerating solutions would be infinite (or huge), a number of builtins treat that situation as “satisfiable” and succeed once without binding anything. (This is mainly to keep meta-tests and some N3 conformance cases happy.)

With that, we can tour the builtin families as Eyeling actually implements them.

---

## 11.3.1 `crypto:` — digest functions (Node-only)

These builtins hash a string and return a lowercase hex digest as a plain string literal.

### `crypto:sha`, `crypto:md5`, `crypto:sha256`, `crypto:sha512`

**Shape:**
`$literal crypto:sha256 $digest`

**Semantics (Eyeling):**

* The **subject must be a literal**. Eyeling takes the literal’s lexical form (stripping quotes) as UTF-8 input.
* The **object** is unified with a **plain string literal** containing the hex digest.

**Important runtime note:** Eyeling uses Node’s `crypto` module. If `crypto` is not available (e.g., in some browser builds), these builtins simply **fail** (return no solutions).

**Example:**

```n3
"hello" crypto:sha256 ?d.
# ?d becomes "2cf24dba5...<snip>...9824"
```

---

## 11.3.2 `math:` — numeric and numeric-like relations

Eyeling’s `math:` builtins fall into three broad categories:

1. **Comparisons**: constraint-style predicates (`>`, `<`, `=`, …).
2. **Arithmetic on numbers**: sums, products, division, rounding, etc.
3. **Unary analytic functions**: trig/hyperbolic functions and a few helpers.

A key design choice: Eyeling parses numeric terms fairly strictly, but comparisons accept a wider “numeric-like” domain including durations and date/time values in some cases.

### 11.3.2.1 Numeric comparisons (constraints)

These builtins succeed or fail; they do not introduce new bindings.

* `math:greaterThan`  (>)
* `math:lessThan`     (<)
* `math:notGreaterThan` (≤)
* `math:notLessThan`    (≥)
* `math:equalTo`        (=)
* `math:notEqualTo`     (≠)

**Shapes:**

```n3
$a math:greaterThan $b.
$a math:equalTo $b.
```

Eyeling also accepts an older cwm-ish variant where the **subject is a 2-element list**:

```n3
( $a $b ) math:greaterThan true.   # (supported as a convenience)
```

**Accepted term types (Eyeling):**

* Proper XSD numeric literals (`xsd:integer`, `xsd:decimal`, `xsd:float`, `xsd:double`, and integer-derived types).
* Untyped numeric tokens (`123`, `-4.5`, `1.2e3`) when they look numeric.
* `xsd:duration` literals (treated as seconds via a simplified model).
* `xsd:date` and `xsd:dateTime` literals (converted to epoch seconds for comparison).

**Edge cases:**

* `NaN` is treated as **not equal to anything**, including itself, for `math:equalTo`.
* Comparisons involving non-parsable values simply fail.

These are pure tests. In forward rules, if a test builtin is encountered before its inputs are bound and it fails, Eyeling may **defer** it and try other goals first; once variables become bound, the test is retried.

---

### 11.3.2.2 Arithmetic on lists of numbers

These are “function-like” relations where the subject is usually a list and the object is the result.

#### `math:sum`

**Shape:** `( $x1 $x2 ... ) math:sum $total`

* Subject must be a list of **at least two** numeric terms.
* Computes the numeric sum.
* Chooses an output datatype based on the “widest” numeric datatype seen among inputs and (optionally) the object position; integers stay integers unless the result is non-integer.

#### `math:product`

**Shape:** `( $x1 $x2 ... ) math:product $total`

* Same conventions as `math:sum`, but multiplies.

#### `math:difference`

This one is more interesting because Eyeling supports a couple of mixed “numeric-like” cases.

**Shape:** `( $a $b ) math:difference $c`

Eyeling supports:

1. **Numeric subtraction**: `c = a - b`.
2. **DateTime difference**: `(dateTime1 dateTime2) math:difference duration`

   * Produces an `xsd:duration` in whole days (internally computed via seconds then formatted).
3. **DateTime minus duration**: `(dateTime duration) math:difference dateTime`

   * Subtracts a duration from a dateTime and yields a new dateTime.

If the types don’t fit any supported case, the builtin fails.

#### `math:quotient`

**Shape:** `( $a $b ) math:quotient $q`

* Parses both inputs as numbers.
* Requires finite values and `b != 0`.
* Computes `a / b`, picking a suitable numeric datatype for output.

#### `math:integerQuotient`

**Shape:** `( $a $b ) math:integerQuotient $q`

* Intended for integer division with remainder discarded (truncation toward zero).
* Prefers exact arithmetic using **BigInt** if both inputs are integer literals.
* Falls back to Number parsing if needed, but still requires integer-like values.

#### `math:remainder`

**Shape:** `( $a $b ) math:remainder $r`

* Integer-only modulus.
* Uses BigInt when possible; otherwise requires both numbers to still represent integers.
* Fails on division by zero.

#### `math:rounded`

**Shape:** `$x math:rounded $n`

* Rounds to nearest integer.
* Tie-breaking follows JavaScript `Math.round`, i.e. halves go toward **+∞** (`-1.5 -> -1`, `1.5 -> 2`).
* Eyeling emits the integer as an **integer token literal** (and also accepts typed numerics if they compare equal).

---

### 11.3.2.3 Exponentiation and unary numeric relations

#### `math:exponentiation`

**Shape:** `( $base $exp ) math:exponentiation $result`

* Forward direction: if base and exponent are numeric, computes `base ** exp`.
* Reverse direction (limited): Eyeling can sometimes solve for the exponent if:

  * base and result are numeric, finite, and **positive**
  * base is not 1
  * exponent is unbound
    In that case it uses logarithms: `exp = log(result) / log(base)`.

This is a pragmatic inversion, not a full algebra system.

#### Unary “math relations” (often invertible)

Eyeling implements these as a shared pattern: if the subject is numeric, compute object; else if the object is numeric, compute subject via an inverse function; if both sides are unbound, succeed once (don’t enumerate).

* `math:absoluteValue`
* `math:negation`
* `math:degrees` (and implicitly its inverse “radians” conversion)
* `math:sin`, `math:cos`, `math:tan`
* `math:asin`, `math:acos`, `math:atan`
* `math:sinh`, `math:cosh`, `math:tanh` (only if JS provides the functions)

**Example:**

```n3
"0"^^xsd:double math:cos ?c.      # forward
?x math:cos "1"^^xsd:double.      # reverse (principal acos)
```

Inversion uses principal values (e.g., `asin`, `acos`, `atan`) and does not attempt to enumerate periodic families of solutions.

---

## 11.3.3 `time:` — dateTime inspection and “now”

Eyeling’s time builtins work over `xsd:dateTime` lexical forms. They are deliberately simple: they extract components from the lexical form rather than implementing a full time zone database.

Implementation: these helpers live in `lib/time.js` and are called from `lib/engine.js`’s builtin evaluator.

### Component extractors

* `time:year`
* `time:month`
* `time:day`
* `time:hour`
* `time:minute`
* `time:second`

**Shape:**
`$dt time:month $m`

**Semantics:**

* Subject must be an `xsd:dateTime` literal in a format Eyeling can parse.
* Object becomes the corresponding integer component (as an integer token literal).
* If the object is already a numeric literal, Eyeling accepts it if it matches.

### `time:timeZone`

**Shape:**
`$dt time:timeZone $tz`

Returns the trailing zone designator:

* `"Z"` for UTC, or
* a string like `"+02:00"` / `"-05:00"`

It yields a **plain string literal** (and also accepts typed `xsd:string` literals).

### `time:localTime`

**Shape:**
`"" time:localTime ?now`

Binds `?now` to the current local time as an `xsd:dateTime` literal.

Two subtle but important engineering choices:

1. Eyeling memoizes “now” per reasoning run so that repeated uses in one run don’t drift.
2. Eyeling supports a fixed “now” override (used for deterministic tests).

---

## 11.3.4 `list:` — list structure, iteration, and higher-order helpers

Eyeling has a real internal list term (`ListTerm`) that corresponds to N3’s `(a b c)` surface syntax.

### RDF collections (`rdf:first` / `rdf:rest`) are materialized

N3 and RDF can also express lists as linked blank nodes using `rdf:first` / `rdf:rest` and `rdf:nil`. Eyeling *materializes* such structures into internal list terms before reasoning so that `list:*` builtins can operate uniformly.

For convenience and compatibility, Eyeling treats:

* `rdf:first` as an alias of `list:first`
* `rdf:rest`  as an alias of `list:rest`

### Core list destructuring

#### `list:first` (and `rdf:first`)

**Shape:**
`(a b c) list:first a`

* Succeeds iff the subject is a **non-empty closed list**.
* Unifies the object with the first element.

#### `list:rest` (and `rdf:rest`)

**Shape:**
`(a b c) list:rest (b c)`

Eyeling supports both:

* closed lists `(a b c)`, and
* *open lists* of the form `(a b ... ?T)` internally.

For open lists, “rest” preserves openness:

* Rest of `(a ... ?T)` is `?T`
* Rest of `(a b ... ?T)` is `(b ... ?T)`

#### `list:firstRest`

This is a very useful “paired” view of a list.

**Forward shape:**
`(a b c) list:firstRest (a (b c))`

**Backward shapes (construction):**

* If the object is `(first restList)`, it can construct the list.
* If `rest` is a variable, Eyeling constructs an open list term.

This is the closest thing to Prolog’s `[H|T]` in Eyeling.

---

### Membership and iteration (multi-solution builtins)

These builtins can yield multiple solutions.

#### `list:member`

**Shape:**
`(a b c) list:member ?x`

Generates one solution per element, unifying the object with each member.

#### `list:in`

**Shape:**
`?x list:in (a b c)`

Same idea, but the list is in the **object** position and the **subject** is unified with each element.

#### `list:iterate`

**Shape:**
`(a b c) list:iterate ?pair`

Generates `(index value)` pairs with **0-based indices**:

* `(0 a)`, `(1 b)`, `(2 c)`, …

A nice ergonomic detail: the object may be a pattern such as:

```n3
(a b c) list:iterate ( ?i "b" ).
```

In that case Eyeling unifies `?i` with `1` and checks the value part appropriately.

#### `list:memberAt`

**Shape:**
`( (a b c) 1 ) list:memberAt b`

The subject must be a 2-element list: `(listTerm indexTerm)`.

Eyeling can use this relationally:

* If the index is bound, it can return the value.
* If the value is bound, it can search for indices that match.
* If both are variables, it generates pairs (similar to `iterate`, but with separate index/value logic).

Indices are **0-based**.

---

### Transformations and queries

#### `list:length`

**Shape:**
`(a b c) list:length 3`

Returns the length as an integer token literal.

A small but intentional strictness: if the object is already ground, Eyeling does not accept “integer vs decimal equivalences” here; it wants the exact integer notion.

#### `list:last`

**Shape:**
`(a b c) list:last c`

Returns the last element of a non-empty list.

#### `list:reverse`

Reversible in the sense that either side may be the list:

* If subject is a list, object becomes its reversal.
* If object is a list, subject becomes its reversal.

It does not enumerate arbitrary reversals; it’s a deterministic transform once one side is known.

#### `list:remove`

**Shape:**
`( (a b a c) a ) list:remove (b c)`

Removes all occurrences of an item from a list.

Important constraint: the item to remove must be **ground** (fully known) before the builtin will run.

#### `list:notMember` (constraint)

**Shape:**
`(a b c) list:notMember x`

Succeeds iff the object cannot be unified with any element of the subject list. As a test, it typically works best once its inputs are bound; in forward rules Eyeling may defer it if it is reached before bindings are available.

#### `list:append`

This is list concatenation, but Eyeling implements it in a pleasantly relational way.

**Forward shape:**
`( (a b) (c) (d e) ) list:append (a b c d e)`

Subject is a list of lists; object is their concatenation.

**Splitting (reverse-ish) mode:**
If the **object is a concrete list**, Eyeling tries all ways of splitting it into the given number of parts and unifying each part with the corresponding subject element. This can yield multiple solutions and is handy for logic programming patterns.

#### `list:sort`

Sorts a list into a deterministic order.

* Requires the input list’s elements to be **ground**.
* Orders literals numerically when both sides look numeric; otherwise compares their lexical strings.
* Orders lists lexicographically by elements.
* Orders IRIs by IRI string.
* Falls back to a stable structural key for mixed cases.

Like `reverse`, this is “reversible” only in the sense that if one side is a list, the other side can be unified with its sorted form.

#### `list:map` (higher-order)

This is one of Eyeling’s most powerful list builtins because it calls back into the reasoner.

**Shape:**
`( (x1 x2 x3) ex:pred ) list:map ?outList`

Semantics:

1. The subject is a 2-element list: `(inputList predicateIri)`.
2. `inputList` must be ground.
3. For each element `el` in the input list, Eyeling proves the goal:

   ```n3
   el predicateIri ?y.
   ```

   using *the full engine* (facts, backward rules, and builtins).
4. All resulting `?y` values are collected in proof order and concatenated into the output list.
5. If an element produces no solutions, it contributes nothing.

This makes `list:map` a compact “query over a list” operator.

---

## 11.3.5 `log:` — unification, formulas, scoping, and meta-level control

The `log:` family is where N3 stops being “RDF with rules” and becomes a *meta-logic*. Eyeling supports the core operators you need to treat formulas as terms, reason inside quoted graphs, and compute closures.

### Equality and inequality

#### `log:equalTo`

**Shape:**
`$x log:equalTo $y`

This is simply **term unification**: it succeeds if the two terms can be unified and returns any bindings that result.

#### `log:notEqualTo` (constraint)

Succeeds iff the terms **cannot** be unified. No new bindings.

### Working with formulas as terms

In Eyeling, a quoted formula `{ ... }` is represented as a `GraphTerm` whose content is a list of triples (and, when parsed from documents, rule terms can also appear as `log:implies` / `log:impliedBy` triples inside formulas).

#### `log:conjunction`

**Shape:**
`( F1 F2 ... ) log:conjunction F`

* Subject is a list of formulas.
* Object becomes a formula containing all triples from all inputs.
* Duplicate triples are removed.
* The literal `true` is treated as the **empty formula** and is ignored in the merge.

#### `log:conclusion`

**Shape:**
`F log:conclusion C`

Computes the *deductive closure* of the formula `F` **using only the information inside `F`**:

* Eyeling starts with all triples inside `F` as facts.
* It treats `{A} => {B}` (represented internally as a `log:implies` triple between formulas) as a forward rule.
* It treats `{A} <= {B}` as the corresponding forward direction for closure purposes.
* Then it forward-chains to a fixpoint *within that local fact set*.
* The result is returned as a formula containing all derived triples.

Eyeling caches `log:conclusion` results per formula object, so repeated calls with the same formula term are cheap.

### Dereferencing and parsing (I/O flavored)

These builtins reach outside the current fact set. They are synchronous by design.

#### `log:content`

**Shape:**
`<doc> log:content ?txt`

* Dereferences the IRI (fragment stripped) and returns the raw bytes as an `xsd:string` literal.
* In Node: HTTP(S) is fetched synchronously; non-HTTP is treated as a local file path (including `file://`).
* In browsers/workers: uses synchronous XHR (subject to CORS).

#### `log:semantics`

**Shape:**
`<doc> log:semantics ?formula`

Dereferences and parses the remote/local resource as N3/Turtle-like syntax, returning a formula.

A nice detail: top-level rules in the parsed document are represented *as data* inside the returned formula using `log:implies` / `log:impliedBy` triples between formula terms. This means you can treat “a document plus its rules” as a single first-class formula object.

#### `log:semanticsOrError`

Like `log:semantics`, but on failure it returns a string literal such as:

* `error(dereference_failed,...)`
* `error(parse_error,...)`

This is convenient in robust pipelines where you want logic that can react to failures.

#### `log:parsedAsN3`

**Shape:**
`" ...n3 text... " log:parsedAsN3 ?formula`

Parses an in-memory string as N3 and returns the corresponding formula.

### Type inspection

#### `log:rawType`

Returns one of four IRIs:

* `log:Formula` (quoted graph)
* `log:Literal`
* `rdf:List` (closed or open list terms)
* `log:Other` (IRIs, blank nodes, etc.)

### Literal constructors

These two are classic N3 “bridge” operators between structured data and concrete RDF literal forms.

#### `log:dtlit`

Relates a datatype literal to a pair `(lex datatypeIri)`.

* If object is a literal, it can produce the subject list `(stringLiteral datatypeIri)`.
* If subject is such a list, it can produce the corresponding datatype literal.
* If both subject and object are variables, Eyeling treats this as satisfiable and succeeds once.

Language-tagged strings are normalized: they are treated as having datatype `rdf:langString`.

#### `log:langlit`

Relates a language-tagged literal to a pair `(lex langTag)`.

* If object is `"hello"@en`, subject can become `("hello" "en")`.
* If subject is `("hello" "en")`, object can become `"hello"@en`.
* Fully unbound succeeds once.

### Rules as data: introspection

#### `log:implies` and `log:impliedBy`

As *syntax*, Eyeling parses `{A} => {B}` and `{A} <= {B}` into internal forward/backward rules.

As *builtins*, `log:implies` and `log:impliedBy` let you **inspect the currently loaded rule set**:

* `log:implies` enumerates forward rules as `(premiseFormula, conclusionFormula)` pairs.
* `log:impliedBy` enumerates backward rules similarly.

Each enumerated rule is standardized apart (fresh variable names) before unification so you can safely query over it.

### Scoped proof inside formulas: `log:includes` and friends

#### `log:includes`

**Shape:**
`Scope log:includes GoalFormula`

This proves all triples in `GoalFormula` as goals, returning the substitutions that make them provable.

Eyeling has **two modes**:

1. **Explicit scope graph**: if `Scope` is a formula `{...}`

   * Eyeling reasons *only inside that formula* (its triples are the fact store).
   * External rules are not used.

2. **Priority-gated global scope**: otherwise

   * Eyeling uses a *frozen snapshot* of the current global closure.
   * The “priority” is read from the subject if it’s a positive integer literal `N`.
   * If the closure level is below `N`, the builtin “delays” by failing at that point in the search.

This priority mechanism exists because Eyeling’s forward chaining runs in outer iterations with a “freeze snapshot then evaluate scoped builtins” phase. The goal is to make scoped meta-builtins stable and deterministic: they query a fixed snapshot rather than chasing a fact store that is being mutated mid-iteration.

Also supported:

* The object may be the literal `true`, meaning the empty formula, which is always included (subject to the priority gating above).

#### `log:notIncludes` (constraint)

Negation-as-failure version: it succeeds iff `log:includes` would yield no solutions (under the same scoping rules).

#### `log:collectAllIn`

**Shape:**
`( ValueTemplate WhereFormula OutList ) log:collectAllIn Scope`

* Proves `WhereFormula` in the chosen scope.
* For each solution, applies it to `ValueTemplate` and collects the instantiated terms into a list.
* Unifies `OutList` with that list.
* If `OutList` is a blank node, Eyeling just checks satisfiable without binding/collecting.

This is essentially a list-producing “findall”.

#### `log:forAllIn` (constraint)

**Shape:**
`( WhereFormula ThenFormula ) log:forAllIn Scope`

For every solution of `WhereFormula`, `ThenFormula` must be provable under the bindings of that solution. If any witness fails, the builtin fails. No bindings are returned.

As a pure test (no returned bindings), this typically works best once its inputs are bound; in forward rules Eyeling may defer it if it is reached too early.

### Skolemization and URI casting

#### `log:skolem`

**Shape:**
`$groundTerm log:skolem ?iri`

Deterministically maps a *ground* term to a Skolem IRI in Eyeling’s well-known namespace. This is extremely useful when you want a repeatable identifier derived from structured content.

#### `log:uri`

Bidirectional conversion between IRIs and their string form:

* If subject is an IRI, object can be unified with a string literal of its IRI.
* If object is a string literal, subject can be unified with the corresponding IRI — **but** Eyeling rejects strings that cannot be safely serialized as `<...>` in Turtle/N3, and it rejects `_:`-style strings to avoid confusing blank nodes with IRIs.
* Some “fully unbound / don’t-care” combinations succeed once to avoid infinite enumeration.

### Side effects and output directives

#### `log:trace`

Always succeeds once and prints a debug line to stderr:

```
<s> TRACE <o>
```

using the current prefix environment for pretty printing.

Implementation: this is implemented by `lib/trace.js` and called from `lib/engine.js`.

#### `log:outputString`

As a goal, this builtin simply checks that the terms are sufficiently bound/usable and then succeeds. The actual “printing” behavior is handled by the CLI:

* When you run Eyeling with `--strings` / `-r`, the CLI collects all `log:outputString` triples from the *saturated* closure.
* It sorts them deterministically by the subject “key” and concatenates the string values in that order.

This is a pure test/side-effect marker (it shouldn’t drive search; it should merely validate that strings exist once other reasoning has produced them). In forward rules Eyeling may defer it if it is reached before the terms are usable.

---

## 11.3.6 `string:` — string casting, tests, and regexes

Eyeling implements string builtins with a deliberate interpretation of “domain is `xsd:string`”:

* Any **IRI** can be cast to a string (its IRI text).
* Any **literal** can be cast to a string:

  * quoted lexical forms decode N3/Turtle escapes,
  * unquoted lexical tokens are taken as-is (numbers, booleans, dateTimes, …).
* Blank nodes, lists, formulas, and variables are not string-castable (and cause the builtin to fail).

### Construction and concatenation

#### `string:concatenation`

**Shape:**
`( s1 s2 ... ) string:concatenation s`

Casts each element to a string and concatenates.

#### `string:format`

**Shape:**
`( fmt a1 a2 ... ) string:format out`

A tiny `sprintf` subset:

* Supports only `%s` and `%%`.
* Any other specifier (`%d`, `%f`, …) causes the builtin to fail.
* Missing arguments are treated as empty strings.

### Containment and prefix/suffix tests (constraints)

* `string:contains`
* `string:containsIgnoringCase`
* `string:startsWith`
* `string:endsWith`

All are pure tests: they succeed or fail.

### Case-insensitive equality tests (constraints)

* `string:equalIgnoringCase`
* `string:notEqualIgnoringCase`

### Lexicographic comparisons (constraints)

* `string:greaterThan`
* `string:lessThan`
* `string:notGreaterThan` (≤ in Unicode codepoint order)
* `string:notLessThan`    (≥ in Unicode codepoint order)

These compare JavaScript strings directly, i.e., Unicode code unit order (practically “lexicographic” for many uses, but not locale-aware collation).

### Regex-based tests and extraction

Eyeling compiles patterns using JavaScript `RegExp`, with a small compatibility layer:

* If the pattern uses Unicode property escapes (like `\p{L}`) or code point escapes (`\u{...}`), Eyeling enables the `/u` flag.
* In Unicode mode, some “identity escapes” that would be SyntaxErrors in JS are sanitized in a conservative way.

#### `string:matches` / `string:notMatches` (constraints)

**Shape:**
`data string:matches pattern`

Tests whether `pattern` matches `data`.

#### `string:replace`

**Shape:**
`( data pattern replacement ) string:replace out`

* Compiles `pattern` as a global regex (`/g`).
* Uses JavaScript replacement semantics (so `$1`, `$2`, etc. work).
* Returns the replaced string.

#### `string:scrape`

**Shape:**
`( data pattern ) string:scrape out`

Matches the regex once and returns the **first capturing group** (group 1). If there is no match or no group, it fails.


## 11.4 `log:outputString` as a controlled side effect

From a logic-programming point of view, printing is awkward: if you print *during* proof search, you risk producing output along branches that later backtrack, or producing the same line multiple times in different derivations. Eyeling avoids that whole class of problems by treating “output” as **data**.

The predicate `log:outputString` is the only officially supported “side-effect channel”, and even it is handled in two phases:

1. **During reasoning (declarative phase):**  
   `log:outputString` behaves like a constraint-style builtin: it succeeds when its arguments are well-formed and sufficiently bound (notably, when the object is a string literal that can be emitted). Importantly, it does *not* print anything at this time. If a rule derives a triple like:

   ```n3
   :k log:outputString "Hello\n".
   ```

then that triple simply becomes part of the fact base like any other fact.

2. **After reasoning (rendering phase):**
   Once saturation finishes, Eyeling scans the *final closure* for `log:outputString` facts and renders them deterministically. Concretely, the CLI collects all such triples, orders them in a stable way (using the subject as a key so output order is reproducible), and concatenates their string objects into the final emitted text.

This separation is not just an aesthetic choice; it preserves the meaning of logic search:

* Proof search may explore multiple branches and backtrack. Because output is only rendered from the **final** set of facts, backtracking cannot “un-print” anything and cannot cause duplicated prints from transient branches.
* Output becomes explainable. If you enable proof comments or inspect the closure, `log:outputString` facts can be traced back to the rules that produced them.
* Output becomes compositional. You can reason about output strings (e.g., sort them, filter them, derive them conditionally) just like any other data.

In short: Eyeling makes `log:outputString` safe by refusing to treat it as an immediate effect. It is a *declarative output fact* whose concrete rendering is a final, deterministic post-processing step.

---

<a id="ch12"></a>
## Chapter 12 — Dereferencing and web-like semantics (`lib/deref.js`)

Some N3 workflows treat IRIs as pointers to more knowledge. Eyeling supports this with:

* `log:content` — fetch raw text
* `log:semantics` — fetch and parse into a formula
* `log:semanticsOrError` — produce either a formula or an error literal

`deref.js` is deliberately synchronous so the engine can remain synchronous.

### 12.1 Two environments: Node vs browser/worker

* In **Node**, dereferencing can read:

  * HTTP(S) via a subprocess (still synchronous)
  * local files (including `file://` URIs) via `fs.readFileSync`
  * in practice, any non-http IRI is treated as a local path for convenience.

* In **browser/worker**, dereferencing uses synchronous XHR, subject to CORS, and only for HTTP(S).

### 12.2 Caching

Dereferencing is cached by IRI-without-fragment (fragments are stripped). There are separate caches for:

* raw content text
* parsed semantics (GraphTerm)
* semantics-or-error

This is both a performance and a stability feature: repeated `log:semantics` calls in backward proofs won’t keep refetching.

### 12.3 HTTPS enforcement

Eyeling can optionally rewrite `http://…` to `https://…` before dereferencing (CLI `--enforce-https`, or API option). This is a pragmatic “make more things work in modern environments” knob.

---

<a id="ch13"></a>
## Chapter 13 — Printing, proofs, and the user-facing output

Once reasoning is done (or as it happens in streaming mode), Eyeling converts derived facts back to N3.

### 13.1 Printing terms and triples (`lib/printing.js`)

Printing handles:

* compact qnames via `PrefixEnv`
* `rdf:type` as `a`
* `owl:sameAs` as `=`
* nice formatting for lists and formulas

The printer is intentionally simple; it prints what Eyeling can parse.

### 13.2 Proof comments: local justifications, not full proof trees

When enabled, Eyeling prints a compact comment block per derived triple:

* the derived triple
* the instantiated rule body that was provable
* the schematic forward rule that produced it

It’s a “why this triple holds” explanation, not a globally exported proof graph.

### 13.3 Streaming derived facts

The engine’s `reasonStream` API can accept an `onDerived` callback. Each time a new forward fact is derived, Eyeling can report it immediately.

This is especially useful in interactive demos (and is the basis of the playground streaming tab).

---

<a id="ch14"></a>
## Chapter 14 — Entry points: CLI, bundle exports, and npm API

Eyeling exposes itself in three layers.

### 14.1 The bundled CLI (`eyeling.js`)

The bundle contains the whole engine. The CLI path is the “canonical behavior”:

* parse input file
* reason to closure
* print derived triples or output strings
* optional proof comments
* optional streaming

### 14.2 `lib/entry.js`: bundler-friendly exports

`lib/entry.js` exports:

* public APIs: `reasonStream`, `main`, `version`
* plus a curated set of internals used by the demo (`lex`, `Parser`, `forwardChain`, etc.)

### 14.3 `index.js`: the npm API wrapper

The npm `reason(...)` function does something intentionally simple and robust:

* write your N3 input to a temp file
* spawn the bundled CLI (`node eyeling.js ... input.n3`)
* return stdout (and forward stderr)

This ensures the API matches the CLI perfectly and keeps the public surface small.

One practical implication:

* if you want *in-process* access to the engine objects (facts arrays, derived proof objects), use `reasonStream` from the bundle entry rather than the subprocess-based API.

---

<a id="ch15"></a>
## Chapter 15 — A worked example: Socrates, step by step

Consider:

```n3
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix : <http://example.org/socrates#>.

:Socrates a :Human.
:Human rdfs:subClassOf :Mortal.

{ ?S a ?A. ?A rdfs:subClassOf ?B } => { ?S a ?B }.
```

What Eyeling does:

1. Parsing yields two facts:

   * `(:Socrates rdf:type :Human)`
   * `(:Human rdfs:subClassOf :Mortal)`
     and one forward rule:
   * premise goals: `?S a ?A`, `?A rdfs:subClassOf ?B`
   * head: `?S a ?B`

2. Forward chaining scans the rule and calls `proveGoals` on the body.

3. Proving `?S a ?A` matches the first fact, producing `{ S = :Socrates, A = :Human }`.

4. With that substitution, the second goal becomes `:Human rdfs:subClassOf ?B`.
   It matches the second fact, extending to `{ B = :Mortal }`.

5. Eyeling instantiates the head `?S a ?B` → `:Socrates a :Mortal`.

6. The triple is ground and not already present, so it is added and (optionally) printed.

That’s the whole engine in miniature: unify, compose substitutions, emit head triples.

---

<a id="ch16"></a>
## Chapter 16 — Extending Eyeling (without breaking it)

Eyeling is small, which makes it pleasant to extend — but there are a few invariants worth respecting.

### 16.1 Adding a builtin

Most extensions belong in `evalBuiltin`:

* Decide if your builtin is:

  * a test (0/1 solution)
  * functional (bind output)
  * generator (many solutions)
* Return *deltas* `{ varName: Term }`, not full substitutions.
* Be cautious with fully-unbound cases: generators can explode the search space.

If your builtin needs a stable view of the closure, follow the scoped-builtin pattern:

* read from `facts.__scopedSnapshot`
* honor `facts.__scopedClosureLevel` and priority gating

### 16.2 Adding new term shapes

If you add a new Term subclass, you’ll likely need to touch:

* printing (`termToN3`)
* unification and equality (`unifyTerm`, `termsEqual`, fast keys)
* variable collection for compaction (`gcCollectVarsInTerm`)
* groundness checks

### 16.3 Parser extensions

If you extend parsing, preserve the Rule invariants:

* rule premise is a triple list
* rule conclusion is a triple list
* blanks in premise are lifted (or handled consistently)
* `headBlankLabels` must reflect blanks occurring explicitly in the head *before* skolemization

---

<a id="epilogue"></a>
## Epilogue: the philosophy of this engine

Eyeling’s codebase is compact because it chooses one powerful idea and leans into it:

> **Use backward proving as the “executor” for forward rule bodies.**

That design makes built-ins and backward rules feel like a standard library of relations, while forward chaining still gives you the determinism and “materialized closure” feel of Datalog.

If you remember only one sentence from this handbook, make it this:

**Eyeling is a forward-chaining engine whose rule bodies are solved by a Prolog-like backward prover with built-ins.**

Everything else is engineering detail — interesting, careful, sometimes subtle — but always in service of that core shape.

---

<a id="app-a"></a>
## Appendix A — Eyeling user notes

This appendix is a compact, user-facing reference for **running Eyeling** and **writing inputs that work well**.
For deeper explanations and implementation details, follow the chapter links in each section.

### A.1 Install and run

Eyeling is distributed as an npm package.

- Run without installing:

  ```bash
  npx eyeling --help
  npx eyeling yourfile.n3
  ```

- Or install globally:

  ```bash
  npm i -g eyeling
  eyeling yourfile.n3
  ```

See also: [Chapter 14 — Entry points: CLI, bundle exports, and npm API](#ch14).

### A.2 What Eyeling prints

By default, Eyeling prints **newly derived forward facts** (the heads of fired `=>` rules), serialized as N3.
It does **not** reprint your input facts.

For proof/explanation output and output modes, see:
- [Chapter 13 — Printing, proofs, and the user-facing output](#ch13)

### A.3 CLI quick reference

The authoritative list is always:

```bash
eyeling --help
```

Options:
```
  -a, --ast                    Print parsed AST as JSON and exit.
  -d, --deterministic-skolem   Make log:skolem stable across reasoning runs.
  -e, --enforce-https          Rewrite http:// IRIs to https:// for log dereferencing builtins.
  -h, --help                   Show this help and exit.
  -p, --proof-comments         Enable proof explanations.
  -r, --strings                Print log:outputString strings (ordered by key) instead of N3 output.
  -s, --super-restricted       Disable all builtins except => and <=.
  -t, --stream                 Stream derived triples as soon as they are derived.
  -v, --version                Print version and exit.
```

See also:
- [Chapter 13 — Printing, proofs, and the user-facing output](#ch13)
- [Chapter 12 — Dereferencing and web-like semantics](#ch12)

### A.4 N3 syntax notes that matter in practice

Eyeling implements a practical N3 subset centered around facts and rules.

- A **fact** is a triple ending in `.`:

  ```n3
  :alice :knows :bob .
  ```

- A **forward rule**:

  ```n3
  { ?x :p ?y } => { ?y :q ?x } .
  ```

- A **backward rule**:

  ```n3
  { ?x :ancestor ?z } <= { ?x :parent ?z } .
  ```

Quoted graphs/formulas use `{ ... }`. Inside a quoted formula, directive scope matters:

- `@prefix/@base` and `PREFIX/BASE` directives may appear at top level **or inside `{ ... }`**, and apply to the formula they occur in (formula-local scoping).

For the formal grammar, see the N3 spec grammar:
- https://w3c.github.io/N3/spec/#grammar

See also:
- [Chapter 4 — From characters to AST: lexing and parsing](#ch04)

### A.5 Builtins

Eyeling supports a built-in “standard library” across namespaces like `log:`, `math:`, `string:`, `list:`, `time:`, `crypto:`.

References:
- W3C N3 Built-ins overview: https://w3c.github.io/N3/reports/20230703/builtins.html
- Eyeling implementation details: [Chapter 11 — Built-ins as a standard library](#ch11)
- The shipped builtin catalogue: `eyeling-builtins.ttl` (in this repo)

If you are running untrusted inputs, consider `--super-restricted` to disable all builtins except implication.

### A.6 Skolemization and `log:skolem`

When forward rule heads contain blank nodes (existentials), Eyeling replaces them with generated Skolem IRIs so derived facts are ground.

See:
- [Chapter 9 — Forward chaining: saturation, skolemization, and meta-rules](#ch09)

### A.7 Networking and `log:semantics`

`log:content`, `log:semantics`, and related builtins dereference IRIs and parse retrieved content.
This is powerful, but it is also I/O.

See:
- [Chapter 12 — Dereferencing and web-like semantics](#ch12)

Safety tip:
- Use `--super-restricted` if you want to ensure *no* dereferencing (and no other builtins) can run.

### A.8 Embedding Eyeling in JavaScript

If you depend on Eyeling as a library, the package exposes:
- a CLI wrapper API (`reason(...)`), and
- in-process engine entry points (via the bundle exports).

See:
- [Chapter 14 — Entry points: CLI, bundle exports, and npm API](#ch14)

### A.9 Further reading
If you want to go deeper into N3 itself and the logic/programming ideas behind Eyeling, these are good starting points:

N3 / Semantic Web specs and reports:
- https://w3c.github.io/N3/spec/
- https://w3c.github.io/N3/reports/20230703/semantics.html
- https://w3c.github.io/N3/reports/20230703/builtins.html

Logic & reasoning background (Wikipedia):
- https://en.wikipedia.org/wiki/Mathematical_logic
- https://en.wikipedia.org/wiki/Automated_reasoning
- https://en.wikipedia.org/wiki/Forward_chaining
- https://en.wikipedia.org/wiki/Backward_chaining
- https://en.wikipedia.org/wiki/Unification_%28computer_science%29
- https://en.wikipedia.org/wiki/Prolog
- https://en.wikipedia.org/wiki/Datalog
- https://en.wikipedia.org/wiki/Skolem_normal_form
