# Inside Eyeling

## A compact Notation3 reasoner in JavaScript — a self-contained handbook

> This handbook is written for a computer science student who wants to understand Eyeling as *code* and as a *reasoning machine*.  
> It’s meant to be read linearly, but each chapter stands on its own.

---

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
6. `lib/deref.js` — synchronous dereferencing for `log:content` / `log:semantics`.
7. `lib/printing.js` — conversion back to N3 text.
8. `lib/cli.js` + `lib/entry.js` — command-line wiring and bundle entry exports.
9. `index.js` — the npm API wrapper (spawns the bundled CLI synchronously).

This is almost literally a tiny compiler pipeline:

```

text → tokens → AST (facts + rules) → engine → derived facts → printer

```

---

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

### 11.3 A tour of builtin families

This handbook won’t list every builtin (Eyeling ships a `eyeling-builtins.ttl` file describing them), but it helps to understand how they *feel* in the engine:

* **math:** arithmetic and numeric relations
  comparisons (`greaterThan`, `lessThan`, …), arithmetic (`sum`, `difference`, …), rounding, trig, etc.

* **string:** string relations and transformations
  concatenation, substring, regex match / notMatch, case operations, comparisons, `startsWith`, `endsWith`, and a notable one:

  * `string:jsonPointer` — treats a literal with datatype `rdf:JSON` as JSON text and applies a JSON Pointer query, with caching.

* **list:** list relations
  member tests and generators, append, first/rest decompositions, etc. Open-list terms exist mainly to support relational list operations.

* **time:** time extraction and formatting
  year/month/day/hour/minute/second, and other small utilities.

* **crypto:** hashing in Node environments (md5/sha variants), used as deterministic computation.

* **log:** meta-level and reasoning-specific tools
  includes/notIncludes, collectAllIn/forAllIn (scoped), outputString (side-channel output), semantics/content dereferencing, skolemization, `log:conclusion`, and introspection hooks.

### 11.4 `log:outputString` as a controlled side effect

Eyeling avoids printing during proof search. Instead, `log:outputString` produces facts that are later collected and printed (or returned) in a deterministic order.

This is a classic trick in declarative systems:

* represent output as data
* render it at the end.

---

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

## Epilogue: the philosophy of this engine

Eyeling’s codebase is compact because it chooses one powerful idea and leans into it:

> **Use backward proving as the “executor” for forward rule bodies.**

That design makes built-ins and backward rules feel like a standard library of relations, while forward chaining still gives you the determinism and “materialized closure” feel of Datalog.

If you remember only one sentence from this handbook, make it this:

**Eyeling is a forward-chaining engine whose rule bodies are solved by a Prolog-like backward prover with built-ins.**

Everything else is engineering detail — interesting, careful, sometimes subtle — but always in service of that core shape.

