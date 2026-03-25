# Inside Eyeling

## A compact Notation3 reasoner in JavaScript — a handbook

> This handbook is written for a computer science student who wants to understand Eyeling as _code_ and as a _reasoning machine_.  
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
- [Appendix B — Notation3: when facts can carry their own logic](#app-b)
- [Appendix C — N3 beyond Prolog: logic that survives the open web](#app-c)
- [Appendix D — LLM + Eyeling: A Repeatable Logic Toolchain](#app-d)
- [Appendix E — How Eyeling reaches 100% on `notation3tests`](#app-e)

---

<a id="preface"></a>

## Preface: what Eyeling is (and what it is not)

Eyeling is a small Notation3 (N3) reasoner implemented in JavaScript. Its job is to take:

1. **Facts** (RDF-like triples), and
2. **Rules** written in N3’s implication style (`=>` and `<=`),

and compute consequences until nothing new follows.

If you’ve seen Datalog or Prolog, the shape will feel familiar. Eyeling blends both:

- **Forward chaining** (like Datalog saturation) for `=>` rules.
- **Backward chaining** (like Prolog goal solving) for `<=` rules _and_ for built-in predicates.

That last point is the heart of Eyeling’s design: _forward rules are executed by proving their bodies using a backward engine_. This lets forward rules depend on computations and “virtual predicates” without explicitly materializing everything as facts.

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
4. `lib/rules.js` — small rule helpers (rule-local blank lifting and rule utilities).
5. `lib/engine.js` — the core inference engine:
   - equality + alpha equivalence for formulas
   - unification + substitutions
   - indexing facts and backward rules
   - backward goal proving (`proveGoals`) and forward saturation (`forwardChain`)
   - scoped-closure machinery (for `log:*In` and includes tests)
   - tracing hooks (`lib/trace.js`, `log:trace`)
   - time helpers for `time:*` built-ins (`lib/time.js`)
   - deterministic Skolem IDs (head existentials + `log:skolem`) (`lib/skolem.js`)
6. `lib/builtins.js` — builtin predicate evaluation plus shared literal/number/string/list helpers:
   - `makeBuiltins(deps)` dependency-injects engine hooks (unification, proving, deref, …)
   - and returns `{ evalBuiltin, isBuiltinPred }` back to the engine
   - includes `materializeRdfLists(...)`, a small pre-pass that rewrites _anonymous_ `rdf:first`/`rdf:rest` linked lists into concrete N3 list terms so `list:*` builtins can work uniformly
7. `lib/explain.js` — proof comments + `log:outputString` aggregation (fact ordering and pretty output).
8. `lib/deref.js` — synchronous dereferencing for `log:content` / `log:semantics` (used by builtins and engine).
9. `lib/printing.js` — conversion back to N3 text.
10. `lib/cli.js` + `lib/entry.js` — command-line wiring and bundle entry exports.
11. `index.js` — the npm API wrapper (spawns the bundled CLI synchronously).

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
2. **`headBlankLabels`** records which blank node labels occur _explicitly in the head_ of a rule. Those blanks are treated as existentials and get skolemized per firing. (Chapter 9.)

### 3.3 Interning

Eyeling interns IRIs and Literals by string value. Interning is a quiet performance trick with big consequences:

- repeated IRIs/Literals become pointer-equal
- indexing is cheaper
- comparisons are faster and allocations drop.

In addition, interned **Iri**/**Literal** terms (and generated **Blank** terms) get a small, non-enumerable integer id `.__tid` that is stable for the lifetime of the process. This `__tid` is used as the engine’s “fast key”:

- fact indexes (`__byPred` / `__byPS` / `__byPO`) key by `__tid` values **and store fact _indices_** (predicate buckets are keyed by `predicate.__tid`, and PS/PO buckets are keyed by the subject/object `.__tid`; buckets contain integer indices into the `facts` array)
- duplicate detection uses `"sid	pid	oid"` where each component is a `__tid`
- unification/equality has an early-out when two terms share the same `__tid`

For blanks, the id is derived from the blank label (so different blank labels remain different existentials).

Terms are treated as immutable: once interned/created, the code assumes you won’t mutate `.value` (or `.label` for blanks).

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

- `true` becomes “empty triple list”
- `false` becomes “no head triples” _plus_ the `isFuse` flag if forward.

---

<a id="ch05"></a>

## Chapter 5 — Rule normalization: “compile-time” semantics (`lib/rules.js`)

Before rules hit the engine, Eyeling performs one lightweight transformation. A second “make it work” trick—deferring built-ins that can’t run yet—happens later inside the goal prover.

### 5.1 Lifting blank nodes in rule bodies into variables

In N3 practice, blanks in _rule premises_ behave like universally-quantified placeholders. Eyeling implements this by converting `Blank(label)` to `Var(_bN)` in the premise only.

So a premise like:

```n3
{ _:x :p ?y. } => { ... }.
```

acts like:

```n3
{ ?_b1 :p ?y. } => { ... }.
```

This avoids the “existential in the body” trap and matches how most rule authors expect N3 to behave.

Blanks in the **conclusion** are _not_ lifted — they remain blanks and later become existentials (Chapter 9).

### 5.2 Builtin deferral in forward-rule bodies

In a depth-first proof, the order of goals matters. Many built-ins only become informative once parts of the triple are **already instantiated** (for example comparisons, pattern tests, and other built-ins that don’t normally create bindings).

If such a builtin runs while its subject/object still contain variables or blanks, it may return **no solutions** (because it can’t decide yet) or only the **empty delta** (`{}`), even though it would succeed (or fail) once other goals have bound the needed values.

Eyeling supports a runtime deferral mechanism inside `proveGoals(...)`, enabled only when proving the bodies of forward rules.

What happens when `proveGoals(..., { deferBuiltins: true })` sees a builtin goal:

- Eyeling evaluates the builtin once.
- If the builtin yields **no deltas**, or only **empty deltas** (`[{}]`), and:
  - there are still other goals remaining, and
  - the builtin goal still contains variables/blanks, and
  - the goal list hasn’t already been rotated too many times,
- then Eyeling **rotates that builtin goal to the end** of the current goal list and continues with the next goal first.

A small counter (`deferCount`) caps how many rotations can happen (at most the length of the current goal list), so the prover can’t loop forever by endlessly “trying later”.

There is one extra guard for a small whitelist of built-ins that are considered satisfiable even when both subject and object are completely unbound (see `__builtinIsSatisfiableWhenFullyUnbound`). For these, if evaluation yields no deltas and there is nothing left to bind (either it is the last goal, or deferral has already been exhausted), Eyeling treats the builtin as a vacuous success (`[{}]`) so it doesn’t block the proof.

This is intentionally enabled for **forward-chaining rule bodies only**. Backward rules keep their normal left-to-right goal order, which can be important for termination on some programs.

### 5.3 Materializing anonymous RDF collections into N3 list terms

Many N3 documents encode lists using RDF’s linked-list vocabulary:

```n3
_:c rdf:first :a.
_:c rdf:rest _:d.
_:d rdf:first :b.
_:d rdf:rest rdf:nil.
```

Eyeling supports _both_ representations:

- **Concrete N3 lists** like `(:a :b)` are parsed as `ListTerm([...])` directly.
- **RDF collections** using `rdf:first`/`rdf:rest` can be traversed by list-aware builtins.

To make list handling simpler and faster, Eyeling runs a small pre-pass called `materializeRdfLists(...)` (implemented in `lib/builtins.js` and invoked by the CLI/entry code). It:

- scans the **input triples** for well‑formed `rdf:first`/`rdf:rest` chains,
- **rewrites only anonymous (blank-node) list nodes** into concrete `ListTerm(...)`,
- and applies that rewrite consistently across the input triple set and all rule premises/heads.

Why only blank nodes? Named list nodes (IRIs) must keep their identity, because some programs treat them as addressable resources; Eyeling leaves those as `rdf:first`/`rdf:rest` graphs so list builtins can still walk them when needed.

---

<a id="ch06"></a>

## Chapter 6 — Equality, alpha-equivalence, and unification (`lib/engine.js`)

Once you enter `engine.js`, you enter the “physics layer.” Everything else depends on the correctness of:

- equality and normalization (especially for literals)
- alpha-equivalence for formulas
- unification and substitution application

### 6.1 Two equalities: structural vs alpha-equivalent

Eyeling has ordinary structural equality (term-by-term) for most terms.

But **quoted formulas** (`GraphTerm`) demand something stronger. Two formulas should match even if their internal blank/variable names differ, as long as the structure is the same.

That’s alpha-equivalence:

- `{ _:x :p ?y. }` should match `{ _:z :p ?w. }`

Eyeling implements alpha-equivalence by checking whether there exists a consistent renaming mapping between the two formulas’ variables/blanks that makes the triples match.

Important scope nuance: only blanks/variables that are local to the quoted formula participate in alpha-renaming. If a formula is being matched after an outer substitution has already instantiated part of it, those substituted terms are treated as fixed. In other words, alpha-equivalence may rename formula-local placeholders, but it must not rename names that came from the enclosing match. This prevents a substituted outer blank node from being confused with a local blank node inside the quoted formula.

So `{ _:x :p :o }` obtained by substituting `?A = _:x` into `{ ?A :p :o }` must not alpha-match `{ _:b :p :o }` by renaming `_:x` to `_:b`.

### 6.2 Groundness: “variables inside formulas don’t leak”

Eyeling makes a deliberate choice about _groundness_:

- a triple is “ground” if it has no free variables in normal positions
- **variables inside a `GraphTerm` do not make the surrounding triple non-ground**

This is encoded in functions like `isGroundTermInGraph`. It’s what makes it possible to assert and store triples that _mention formulas with variables_ as data.

### 6.3 Substitutions: chaining and application

A substitution is a plain JS object:

```js
{ X: Term, Y: Term, ... }
```

When applying substitutions, Eyeling follows **chains**:

- if `X → Var(Y)` and `Y → Iri(...)`, applying to `X` yields the IRI.

Chains arise naturally during unification (e.g. when variables unify with other variables) and during rule firing.

At the API boundary, a substitution is still just a plain object, and unification still produces _delta_ objects (small `{ varName: Term }` maps).  
But inside the hot backward-chaining loop (`proveGoals`), Eyeling uses a Prolog-style **trail** to avoid cloning substitutions at every step:

- keep one **mutable** substitution object during DFS
- when a candidate match yields a delta, **apply the bindings in place**
- record newly-bound variable names on a **trail stack**
- on backtracking, **undo** only the bindings pushed since a saved “mark”

This keeps the search semantics identical, but removes the “copy a growing object per step” cost that dominates deep/branchy proofs. Returned solutions are emitted as compact plain objects, so callers never observe mutation.

Implementation details (and why they matter):

- **`applySubstTerm` is the only “chain chaser”.** It follows `Var → Term` links until it reaches a stable term.
  - Unification’s occurs-check prevents most cycles, but `applySubstTerm` still defends against accidental cyclic chains.
  - The cycle guard is written to avoid allocating a `Set` in the common case (short chains).
- **Structural sharing is deliberate.** Applying a substitution often changes nothing:
  - `applySubstTerm` returns the original term when it is unaffected.
  - list/open-list/graph terms are only rebuilt if at least one component changes (lazy copy-on-change).
  - `applySubstTriple` returns the original `Triple` when `s/p/o` are unchanged.

These “no-op returns” are one of the biggest practical performance wins in the engine: backward chaining and forward rule instantiation apply substitutions constantly, so avoiding allocations reduces GC pressure without changing semantics.

### 6.4 Unification: the core operation

Unification is implemented in `unifyTerm` / `unifyTriple`, with support for:

- variable binding with occurs check
- list unification (elementwise)
- open-list unification (prefix + tail variable)
- formula unification via graph unification:
  - fast path: identical triple list
  - otherwise: backtracking order-insensitive matching while threading the substitution

There are two key traits of Eyeling’s graph unification:

1. It’s _set-like_: order doesn’t matter.
2. It’s _substitution-threaded_: choices made while matching one triple restrict the remaining matches, just like Prolog.

### 6.5 Literals: lexical vs semantic equality

Eyeling keeps literal values as raw strings, but it parses and normalizes where needed:

- `literalParts(lit)` splits lexical form and datatype IRI
- it recognizes RDF JSON datatype (`rdf:JSON` / `<...rdf#JSON>`)
- it includes caches for numeric parsing, integer parsing (`BigInt`), and numeric metadata.

This lets built-ins and fast-key indexing treat some different lexical spellings as the same value (for example, normalizing `"abc"` and `"abc"^^xsd:string` in the fast-key path).

---

<a id="ch07"></a>

## Chapter 7 — Facts as a database: indexing and fast duplicate checks

Reasoning is mostly “join-like” operations: match a goal triple against known facts. Doing this naively is too slow, so Eyeling builds indexes on top of a plain array.

### 7.1 The fact store

Facts live in an array `facts: Triple[]`.

Eyeling attaches hidden (non-enumerable) index fields:

- `facts.__byPred: Map<predicateId, number[]>` where each entry is an index into `facts` (and `predicateId` is `predicate.__tid`)
- `facts.__byPS: Map<predicateId, Map<termId, number[]>>` where each entry is an index into `facts` (and `termId` is `term.__tid`)
- `facts.__byPO: Map<predicateId, Map<termId, number[]>>` where each entry is an index into `facts` (and `termId` is `term.__tid`)
- `facts.__keySet: Set<string>` for a fast-path `"sid	pid	oid"` key (all three are `__tid` values)

`termFastKey(term)` returns a `termId` (`term.__tid`) for **Iri**, **Literal**, and **Blank** terms, and `null` for structured terms (lists, quoted graphs) and variables.

The “fast key” only exists when `termFastKey` succeeds for all three terms.

### 7.2 Candidate selection: pick the smallest bucket

When proving a goal with IRI predicate, Eyeling computes candidate facts by:

1. restricting to predicate bucket
2. optionally narrowing further by subject or object fast key
3. choosing the smaller of (p,s) vs (p,o) when both exist

This is a cheap selectivity heuristic. In type-heavy RDF, `(p,o)` is often extremely selective (e.g., `rdf:type` + a class IRI), so the PO index can be a major speed win.

### 7.3 Duplicate detection with fast keys

When adding derived facts, Eyeling uses a fast-path duplicate check when possible:

- If all three terms have a fast key (Iri/Literal/Blank → `__tid`), it checks membership in `facts.__keySet` using the `"sid	pid	oid"` key.
- Otherwise (lists, quoted graphs, variables), it falls back to structural triple equality.

This still treats blanks correctly: blanks are _not_ interchangeable; the blank **label** (and thus its `__tid`) is part of the key.

---

<a id="ch08"></a>

## Chapter 8 — Backward chaining: the proof engine (`proveGoals`)

Eyeling’s backward prover is an iterative depth-first search (DFS) that looks a lot like Prolog’s SLD resolution, but written explicitly with a stack to avoid JS recursion limits.

### 8.1 Proof states

A proof state contains:

- `goals`: remaining goal triples
- `subst`: current substitution
- `depth`: current depth (used for compaction heuristics)
- `visited`: previously-seen goals (loop prevention)

### 8.2 The proving loop

At each step:

1. If no goals remain: emit the current substitution as a solution.
2. Otherwise:
   - take the first goal
   - apply the current substitution to it
   - attempt to satisfy it in three ways:
     1. built-ins
     2. backward rules
     3. facts

Eyeling’s order is intentional: built-ins often bind variables cheaply; backward rules expand the search tree (and enable recursion); facts are tried last as cheap terminal matches.

### 8.3 Built-ins: return _deltas_, not full substitutions

A built-in is evaluated by the engine via the builtin library in `lib/builtins.js`:

```js
deltas = evalBuiltin(goal0, {}, facts, backRules, ...)
for delta in deltas:
  mark = trail.length
  if applyDeltaToSubst(delta):
    dfs(restGoals)
  undoTo(mark)
```

**Implementation note (performance):** in the core DFS, Eyeling applies builtin (and unification) deltas into a single mutable substitution and uses a **trail** to undo bindings on backtracking. This preserves the meaning of “threading substitutions through a proof”, but avoids allocating and copying full substitution objects on every branch. Empty deltas (`{}`) are genuinely cheap: they don’t touch the trail and only incur the control-flow overhead of exploring a branch.

**Implementation note (performance):** as of this version, Eyeling also avoids allocating short-lived substitution objects when matching goals against **facts** and when unifying a **backward-rule head** with the current goal. Instead of calling the pure `unifyTriple(..., subst)` (which clones the substitution on each variable bind), the prover performs an **in-place unification** directly into the mutable `substMut` store and records only the newly-bound variable names on the trail. This typically reduces GC pressure significantly on reachability / path-search workloads, where unification is executed extremely frequently.

So built-ins behave like relations that can generate zero, one, or many possible bindings. A list generator might yield many deltas; a numeric test yields zero or one.

#### 8.3.1 Builtin deferral and “vacuous” solutions

Conjunction in N3 is order-insensitive, but many builtins are only useful once some variables are bound by _other_ goals in the same body. When `proveGoals` is called from forward chaining, Eyeling enables **builtin deferral**: if a builtin goal can’t make progress yet, it is rotated to the end of the goal list and retried later (with a small cycle guard to avoid infinite rotation).

“Can’t make progress” includes both cases:

- the builtin returns **no solutions** (`[]`), and
- the builtin returns only **vacuous solutions** (`[{}]`, i.e., success with _no new bindings_) while the goal still contains unbound vars/blanks.

That second case matters for “satisfiable but non-enumerating” builtins (e.g., some `log:` helpers) where early vacuous success would otherwise prevent later goals from ever binding the variables the builtin needs.

### 8.4 Loop prevention: visited multiset with backtracking

Eyeling avoids obvious infinite recursion by recording each (substituted) goal it is currently trying in a per-branch _visited_ structure. If the same goal is encountered again on the same proof branch, Eyeling skips it.

Implementation notes:

- The visited structure is a `Map` from _goal key_ to a reference count, plus a trail array. This makes it cheap to check (`O(1)` average) and cheap to roll back on backtracking (just like the substitution trail).
- Keys are _structural_. Atoms use stable IDs; lists use element keys; variables use their identity (so two different variables are **not** conflated). This keeps the cycle check conservative and avoids accidental pruning.
- This is not full tabling: it does not memoize answers, it only guards against immediate cycles (the common “A depends on A” loops).

### 8.4.1 Minimal completed-goal tabling

Eyeling has a **very small, deliberately conservative answer table** for backward goals.

What is cached:

- only **completed** answer sets
- keyed by the **fully substituted goal list**
- only when the proof is entered from a “top-level” call shape (no active per-branch `visited` context)
- only when the engine is not in a result-limiting mode such as `maxResults`

What is **not** cached:

- pending / in-progress goals
- recursive dependency states
- partial answer streams
- branch-local states inside an active recursive proof

This matters because exposing **pending** answers without dependency propagation would change the meaning of recursive programs. Eyeling therefore caches only results that are already complete and replays them only when the surrounding proof context is equivalent.

The cache is invalidated whenever any of the following changes:

- the number of known facts
- the number of backward rules
- the scoped-closure level
- whether a frozen scoped snapshot is active

So this is **not SLG tabling** and not a general recursion engine. It is best understood as a reuse optimization for repeated backward proofs in a stable proof environment.

Typical win cases:

- many repeated `log:query` directives with the **same premise**
- repeated forward-rule body proofs that ask the same completed backward question
- “query-like” workloads where the expensive part is a repeated backward proof and the fact store does not change between calls

Typical non-win cases:

- first-time proofs
- recursive subgoals whose value depends on future answers
- workloads where the fact set changes between almost every call

### 8.5 Backward rules: indexed by head predicate

Backward rules are indexed in `backRules.__byHeadPred`. When proving a goal with IRI predicate `p`, Eyeling retrieves:

- `rules whose head predicate is p`
- plus `__wildHeadPred` for rules whose head predicate is not an IRI (rare, but supported)

For each candidate rule:

1. standardize it apart (fresh variables)
2. unify the rule head with the goal
3. append the rule body goals in front of the remaining goals

That “standardize apart” step is essential. Without it, reusing a rule multiple times would accidentally share variables across invocations, producing incorrect bindings.

**Implementation note (performance):** `standardizeRule` is called for every backward-rule candidate during proof search.  
To reduce allocation pressure, Eyeling reuses a single fresh `Var(...)` object per _original_ variable name within one standardization pass (all occurrences of `?x` in the rule become the same fresh `?x__N` object). This is semantics-preserving — it still “separates” invocations — but it avoids creating many duplicate Var objects when a variable appears repeatedly in a rule body.

### 8.6 Substitution size on deep proofs

The trail-based substitution store removes the biggest accidental quadratic cost (copying a growing substitution object at every step).  
In deep and branchy searches, the substitution trail still grows, and long variable-to-variable chains increase the work done by `applySubstTerm`.

Eyeling currently keeps the full trail as-is during search. When emitting a solution, it runs a lightweight compaction pass (via `gcCollectVarsInGoals(...)` / `gcCompactForGoals(...)`) so only bindings reachable from the answer variables and remaining goals are kept. It still does not perform general substitution composition/normalization during search.

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

Top-level input triples are kept as parsed (including non-ground triples such as ?X :p :o.). Groundness is enforced when adding derived facts during forward chaining, and when selecting printed/query output triples.

### 9.2 Strict-ground head optimization

There is a nice micro-compiler optimization in `runFixpoint()`:

If a rule’s head is _strictly ground_ (no vars, no blanks, no open lists, even inside formulas), and it contains no head blanks, then the head does not depend on _which_ body solution you choose.

In that case:

- Eyeling only needs **one** proof of the body.
- And if all head triples are already known, it can skip proving the body entirely.

This is a surprisingly effective optimization for “axiom-like” rules with constant heads.

### 9.3 Existentials: skolemizing head blanks

Blank nodes in the **rule head** represent existentials: “there exists something such that…”

Eyeling handles this by replacing head blank labels with fresh blank labels of the form:

- `_:sk_0`, `_:sk_1`, …

But it does something subtle and important: it caches skolemization per (rule firing, head blank label), so that the _same_ firing instance doesn’t keep generating new blanks across outer iterations.

The “firing instance” is keyed by a deterministic string derived from the instantiated body (“firingKey”). This stabilizes the closure and prevents “existential churn.”

**Implementation note (performance):** the firing-instance key is computed in a hot loop, so `firingKey(...)` builds a compact string via concatenation rather than `JSON.stringify`. If you change what counts as a distinct “firing instance”, update the key format and the skolem cache together.

Implementation: deterministic Skolem IDs live in `lib/skolem.js`; the per-firing cache and head-blank rewriting are implemented in `lib/engine.js`.

### 9.4 Inference fuses: `{ ... } => false`

A rule whose conclusion is `false` is treated as a hard failure. During forward chaining:

- Eyeling proves the premise (it only needs one solution)
- if the premise is provable, it prints a message and exits with status code 2

This is Eyeling’s way to express hard consistency checks and detect inconsistencies.

### 9.5 Rule-producing rules (meta-rules)

Eyeling treats certain derived triples as _new rules_:

- `log:implies` and `log:impliedBy` where subject/object are formulas
- it also accepts the literal `true` as an empty formula `{}` on either side

So these are “rule triples”:

```n3
{ ... } log:implies { ... }.
true log:implies { ... }.
{ ... } log:impliedBy true.
```

When such a triple is derived in a forward rule head:

1. Eyeling adds it as a fact (so you can inspect it), and
2. it _promotes_ it into a live rule by constructing a new `Rule` object and inserting it into the forward or backward rule list.

This is meta-programming: your rules can generate new rules during reasoning.

**Implementation note (performance):** rule triples are often derived repeatedly (especially inside loops).  
To keep promotion cheap, Eyeling maintains a `Set` of canonical rule keys for both the forward-rule list and the backward-rule list. Promotion checks membership in O(1) time instead of scanning the rule arrays and doing structural comparisons each time.

---

<a id="ch10"></a>

## Chapter 10 — Scoped closure, priorities, and `log:conclusion`

Some `log:` built-ins talk about “what is included in the closure” or “collect all solutions.” These are tricky in a forward-chaining engine because the closure is _evolving_.

Eyeling addresses this with a disciplined two-phase strategy and an optional priority mechanism.

### 10.1 The two-phase outer loop (Phase A / Phase B)

Forward chaining runs inside an _outer loop_ that alternates:

- **Phase A**: scoped built-ins are disabled (they “delay” by failing)

- Eyeling saturates normally to a fixpoint

- then Eyeling freezes a snapshot of the saturated facts

- **Phase B**: scoped built-ins are enabled, but they query only the frozen snapshot

- Eyeling runs saturation again (new facts can appear due to scoped queries)

This produces deterministic behavior for scoped operations: they observe a stable snapshot, not a moving target.

**Implementation note (performance):** the two-phase scheme is only needed when the program actually uses scoped built-ins. If no rule contains `log:collectAllIn`, `log:forAllIn`, `log:includes`, or `log:notIncludes`, Eyeling **skips Phase B entirely** and runs only a single saturation. This avoids re-running the forward fixpoint and can prevent a “query-like” forward rule (one whose body contains an expensive backward proof search) from being executed twice.

**Implementation note (performance):** in Phase A there is no snapshot, so scoped built-ins (and priority-gated scoped queries) are guaranteed to “delay” by failing.  
Instead of proving the entire forward-rule body only to fail at the end, Eyeling precomputes whether a forward rule depends on scoped built-ins and skips it until a snapshot exists and the requested closure level is reached. This can avoid very expensive proof searches in programs that combine recursion with `log:*In` built-ins.

### 10.2 Priority-gated closure levels

Eyeling introduces a `scopedClosureLevel` counter:

- level 0 means “no snapshot available” (Phase A)
- level 1, 2, … correspond to snapshots produced after each Phase A saturation

Some built-ins interpret a positive integer literal as a requested priority:

- `log:collectAllIn` and `log:forAllIn` use the **object position** for priority
- `log:includes` and `log:notIncludes` use the **subject position** for priority

If a rule requests priority `N`, Eyeling delays that builtin until `scopedClosureLevel >= N`.

In practice this allows rule authors to write “don’t run this scoped query until the closure is stable enough” and is what lets Eyeling iterate safely when rule-producing rules introduce new needs.

### 10.3 `log:conclusion`: local deductive closure of a formula

`log:conclusion` is handled in a particularly elegant way:

- given a formula `{ ... }` (a `GraphTerm`),
- Eyeling computes the deductive closure _inside that formula_:
  - extract rule triples inside it (`log:implies`, `log:impliedBy`)
  - run `forwardChain` locally over those triples

- cache the result in a `WeakMap` so the same formula doesn’t get recomputed

Notably, `log:impliedBy` inside the formula is treated as forward implication too for closure computation (and also indexed as backward to help proving).

This makes formulas a little world you can reason about as data.

---

<a id="ch11"></a>

## Chapter 11 — Built-ins as a standard library (`lib/builtins.js`)

Built-ins are where Eyeling stops being “just a Datalog engine” and becomes a practical N3 tool.

Implementation note: builtin code lives in `lib/builtins.js` and is wired into the prover by the engine via `makeBuiltins(deps)` (dependency injection keeps the modules loosely coupled).

### 11.1 How Eyeling recognizes built-ins

A predicate is treated as builtin if:

- it is an IRI in one of the builtin namespaces:
  - `crypto:`, `math:`, `log:`, `string:`, `time:`, `list:`

- or it is `rdf:first` / `rdf:rest` (treated as list-like builtins)
- unless **super restricted mode** is enabled, in which case only `log:implies` and `log:impliedBy` are treated as builtins.

Super restricted mode exists to let you treat all other predicates as ordinary facts/rules without any built-in evaluation.

**Note on `log:query`:** Eyeling also recognizes a special _top-level_ directive of the form `{...} log:query {...}.` to **select which results to print**. This is **not** a builtin predicate (it is not evaluated as part of goal solving); it is handled by the parser/CLI/output layer. See §11.3.5 below and Chapter 13 for details.

### 11.2 Built-ins return multiple solutions

Every builtin returns a list of substitution _deltas_.

That means built-ins can be:

- **functional** (return one delta binding an output)
- **tests** (return either `[{}]` for success or `[]` for failure)
- **generators** (return many deltas)

List operations are a common source of generators; numeric comparisons are tests.

Below is a drop-in replacement for **§11.3 “A tour of builtin families”** that aims to be _fully self-contained_ and to cover **every builtin currently implemented in `lib/builtins.js`** (including the `rdf:first` / `rdf:rest` aliases).

---

## 11.3 A tour of builtin families

Eyeling’s builtins are best thought of as _foreign predicates_: they look like ordinary N3 predicates in your rules, but when the engine tries to satisfy a goal whose predicate is a builtin, it does not search the fact store. Instead, it calls a piece of JavaScript that implements the predicate’s semantics.

That one sentence explains a lot of “why does it behave like _that_?”:

- Builtins are evaluated **during backward proof** (goal solving), just like facts and backward rules.
- A builtin may produce **zero solutions** (fail), **one solution** (deterministic succeed), or **many solutions** (a generator).
- Most builtins behave like relations, not like functions: they can sometimes run “backwards” (bind the subject from the object) if the implementation supports it.

### 11.3.0 Reading builtin “signatures” in this handbook

The N3 Builtins tradition often describes builtins using “schema” annotations like:

- `$s+` / `$o+` — input must be bound (or at least not a variable in practice)
- `$s-` / `$o-` — output position (often a variable that will be bound)
- `$s?` / `$o?` — may be unbound
- `$s.i` — list element _i_ inside the subject list

Eyeling is a little more pragmatic: it implements the spirit of these schemas, but it also has several “engineering” conventions that appear across many builtins:

1. **Variables (`?X`) may be bound** by a builtin if the builtin is written to do so.
2. **Blank nodes (`[]` / `_:`)** are frequently treated as “don’t care” placeholders. Many builtins accept a blank node in an output position and simply succeed without binding.
3. **Fully unbound relations are usually not enumerated.** If both sides are unbound and enumerating solutions would be infinite (or huge), a number of builtins treat that situation as “satisfiable” and succeed once without binding anything. (This is mainly to keep meta-tests and some N3 conformance cases happy.)

With that, we can tour the builtin families as Eyeling actually implements them.

---

## 11.3.1 `crypto:` — digest functions (Node-only)

These builtins hash a string and return a lowercase hex digest as a plain string literal.

### `crypto:sha`, `crypto:md5`, `crypto:sha256`, `crypto:sha512`

**Shape:** `$literal crypto:sha256 $digest`

**Semantics (Eyeling):**

- The **subject must be a literal**. Eyeling takes the literal’s lexical form (stripping quotes) as UTF-8 input.
- The **object** is unified with a **plain string literal** containing the hex digest.

**Important runtime note:** Eyeling uses Node’s `crypto` module. If `crypto` is not available (e.g., in some browser builds), these builtins simply **fail** (return no solutions).

**Example:**

```n3
"hello" crypto:sha256 ?d.
# ?d becomes "2cf24dba5...<snip>...9824"
```

---

## 11.3.2 `math:` — numeric and numeric-like relations

Eyeling’s `math:` builtins fall into three broad categories:

1. **Comparisons**: test-style predicates (`>`, `<`, `=`, …).
2. **Arithmetic on numbers**: sums, products, division, rounding, etc.
3. **Unary analytic functions**: trig/hyperbolic functions and a few helpers.

A key design choice: Eyeling parses numeric terms fairly strictly, but comparisons accept a wider “numeric-like” domain including durations and date/time values in some cases.

### 11.3.2.1 Numeric comparisons

These builtins succeed or fail; they do not introduce new bindings.

- `math:greaterThan` (>)
- `math:lessThan` (<)
- `math:notGreaterThan` (≤)
- `math:notLessThan` (≥)
- `math:equalTo` (=)
- `math:notEqualTo` (≠)

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

- Proper XSD numeric literals (`xsd:integer`, `xsd:decimal`, `xsd:float`, `xsd:double`, and integer-derived types).
- Untyped numeric tokens (`123`, `-4.5`, `1.2e3`) when they look numeric.
- `xsd:duration` literals (treated as seconds via a simplified model).
- `xsd:date` and `xsd:dateTime` literals (converted to epoch seconds for comparison).

**Edge cases:**

- `NaN` is treated as **not equal to anything**, including itself, for `math:equalTo`.
- Comparisons involving non-parsable values simply fail.

These are pure tests. In forward rules, if a test builtin is encountered before its inputs are bound and it fails, Eyeling may **defer** it and try other goals first; once variables become bound, the test is retried.

---

### 11.3.2.2 Arithmetic on lists of numbers

These are “function-like” relations where the subject is usually a list and the object is the result.

#### `math:sum`

**Shape:** `( $x1 $x2 ... ) math:sum $total`

- Subject must be a list of numeric terms (the list may be empty or a singleton).
- Empty list sums to **0**.
- Computes the numeric sum.
- Chooses an output datatype based on the “widest” numeric datatype seen among inputs and (optionally) the object position; integers stay integers unless the result is non-integer.

Eyeling also supports a small, EYE-style convenience for timestamp arithmetic:

- **DateTime plus duration/seconds**: `(dateTime durationOrSeconds) math:sum dateTime`
  - `xsd:duration` is interpreted as seconds (same model as `math:difference`).
  - Output is a normalized `xsd:dateTime` in UTC lexical form (`...Z`).

#### `math:product`

**Shape:** `( $x1 $x2 ... ) math:product $total`

- Subject must be a list of numeric terms (the list may be empty or a singleton).
- Empty list product is **1**.
- Same datatype conventions as `math:sum`, but multiplies.

#### `math:difference`

This one is more interesting because Eyeling supports a couple of mixed “numeric-like” cases.

**Shape:** `( $a $b ) math:difference $c`

Eyeling supports:

1. **Numeric subtraction**: `c = a - b`.
2. **DateTime difference**: `(dateTime1 dateTime2) math:difference duration`
   - Produces an **`xsd:duration`** in a seconds-only lexical form such as `"PT900S"^^xsd:duration`.
   - This avoids ambiguity around month/year day-length and still plays well with `math:lessThan`, `math:greaterThan`, etc. because Eyeling's numeric comparison builtins treat `xsd:duration` as seconds.

3. **DateTime minus duration**: `(dateTime durationOrSeconds) math:difference dateTime`
   - Subtracts a duration from a dateTime and yields a new dateTime.

If the types don’t fit any supported case, the builtin fails.

#### `math:quotient`

**Shape:** `( $a $b ) math:quotient $q`

- Parses both inputs as numbers.
- Requires finite values and `b != 0`.
- Computes `a / b`, picking a suitable numeric datatype for output.

#### `math:integerQuotient`

**Shape:** `( $a $b ) math:integerQuotient $q`

- Intended for integer division with remainder discarded (truncation toward zero).
- Prefers exact arithmetic using **BigInt** if both inputs are integer literals.
- Falls back to Number parsing if needed, but still requires integer-like values.

#### `math:remainder`

**Shape:** `( $a $b ) math:remainder $r`

- Integer-only modulus.
- Uses BigInt when possible; otherwise requires both numbers to still represent integers.
- Fails on division by zero.

#### `math:rounded`

**Shape:** `$x math:rounded $n`

- Rounds to nearest integer.
- Tie-breaking follows JavaScript `Math.round`, i.e. halves go toward **+∞** (`-1.5 -> -1`, `1.5 -> 2`).
- Eyeling emits the integer as an **integer token literal** (and also accepts typed numerics if they compare equal).

---

### 11.3.2.3 Exponentiation and unary numeric relations

#### `math:exponentiation`

**Shape:** `( $base $exp ) math:exponentiation $result`

- Forward direction supports two modes:
  - **Exact integer mode (BigInt):** if `$base` and `$exp` are integer literals and `$exp >= 0`, Eyeling computes the exact integer power using BigInt (with a safety cap on the estimated result size to avoid OOM).
  - **Numeric mode (Number):** otherwise, if base and exponent parse as finite Numbers, computes `base ** exp`.
- Reverse direction (limited): Eyeling can sometimes solve for the exponent if:
  - base and result are numeric, finite, and **positive**
  - base is not 1
  - exponent is unbound In that case it uses logarithms: `exp = log(result) / log(base)`.

This is a pragmatic inversion, not a full algebra system.

The **BigInt exact-integer mode** exists specifically to avoid rule-level “repeat multiply” derivations that can explode memory for large exponents (e.g., the Ackermann example).

#### Unary “math relations” (often invertible)

Eyeling implements these as a shared pattern: if the subject is numeric, compute object; else if the object is numeric, compute subject via an inverse function; if both sides are unbound, succeed once (don’t enumerate).

- `math:absoluteValue`
- `math:negation`
- `math:degrees` (and implicitly its inverse “radians” conversion)
- `math:sin`, `math:cos`, `math:tan`
- `math:asin`, `math:acos`, `math:atan`
- `math:sinh`, `math:cosh`, `math:tanh` (only if JS provides the functions)

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

- `time:year`
- `time:month`
- `time:day`
- `time:hour`
- `time:minute`
- `time:second`

**Shape:** `$dt time:month $m`

**Semantics:**

- Subject must be an `xsd:dateTime` literal in a format Eyeling can parse.
- Object becomes the corresponding integer component (as an integer token literal).
- If the object is already a numeric literal, Eyeling accepts it if it matches.

### `time:timeZone`

**Shape:** `$dt time:timeZone $tz`

Returns the trailing zone designator:

- `"Z"` for UTC, or
- a string like `"+02:00"` / `"-05:00"`

It yields a **plain string literal** (and also accepts typed `xsd:string` literals).

### `time:localTime`

**Shape:** `"" time:localTime ?now`

Binds `?now` to the current local time as an `xsd:dateTime` literal.

Two subtle but important engineering choices:

1. Eyeling memoizes “now” per reasoning run so that repeated uses in one run don’t drift.
2. Eyeling supports a fixed “now” override (used for deterministic tests).

---

## 11.3.4 `list:` — list structure, iteration, and higher-order helpers

Eyeling has a real internal list term (`ListTerm`) that corresponds to N3’s `(a b c)` surface syntax.

### RDF collections (`rdf:first` / `rdf:rest`) are materialized

N3 and RDF can also express lists as linked blank nodes using `rdf:first` / `rdf:rest` and `rdf:nil`. Eyeling _materializes_ such structures into internal list terms before reasoning so that `list:*` builtins can operate uniformly.

For convenience and compatibility, Eyeling treats:

- `rdf:first` as an alias of `list:first`
- `rdf:rest` as an alias of `list:rest`

### Core list destructuring

#### `list:first` (and `rdf:first`)

**Shape:** `(a b c) list:first a`

- Succeeds iff the subject is a **non-empty closed list**.
- Unifies the object with the first element.

#### `list:rest` (and `rdf:rest`)

**Shape:** `(a b c) list:rest (b c)`

Eyeling supports both:

- closed lists `(a b c)`, and
- _open lists_ of the form `(a b ... ?T)` internally.

For open lists, “rest” preserves openness:

- Rest of `(a ... ?T)` is `?T`
- Rest of `(a b ... ?T)` is `(b ... ?T)`

#### `list:firstRest`

This is a very useful “paired” view of a list.

**Forward shape:** `(a b c) list:firstRest (a (b c))`

**Backward shapes (construction):**

- If the object is `(first restList)`, it can construct the list.
- If `rest` is a variable, Eyeling constructs an open list term.

This is the closest thing to Prolog’s `[H|T]` in Eyeling.

**Implementation note (performance):** `list:firstRest` is a hot builtin in many recursive list-building programs (including path finding). Eyeling constructs the new prefix using pre-sized arrays and simple loops (instead of spread syntax) to reduce transient allocations.

---

### Membership and iteration (multi-solution builtins)

These builtins can yield multiple solutions.

#### `list:member`

**Shape:** `(a b c) list:member ?x`

Generates one solution per element, unifying the object with each member.

#### `list:in`

**Shape:** `?x list:in (a b c)`

Same idea, but the list is in the **object** position and the **subject** is unified with each element.

#### `list:iterate`

**Shape:** `(a b c) list:iterate ?pair`

Generates `(index value)` pairs with **0-based indices**:

- `(0 a)`, `(1 b)`, `(2 c)`, …

A nice ergonomic detail: the object may be a pattern such as:

```n3
(a b c) list:iterate ( ?i "b" ).
```

In that case Eyeling unifies `?i` with `1` and checks the value part appropriately.

#### `list:memberAt`

**Shape:** `( (a b c) 1 ) list:memberAt b`

The subject must be a 2-element list: `(listTerm indexTerm)`.

Eyeling can use this relationally:

- If the index is bound, it can return the value.
- If the value is bound, it can search for indices that match.
- If both are variables, it generates pairs (similar to `iterate`, but with separate index/value logic).

Indices are **0-based**.

---

### Transformations and queries

#### `list:length`

**Shape:** `(a b c) list:length 3`

Returns the length as an integer token literal.

A small but intentional strictness: if the object is already ground, Eyeling does not accept “integer vs decimal equivalences” here; it wants the exact integer notion.

#### `list:last`

**Shape:** `(a b c) list:last c`

Returns the last element of a non-empty list.

#### `list:reverse`

Reversible in the sense that either side may be the list:

- If subject is a list, object becomes its reversal.
- If object is a list, subject becomes its reversal.

It does not enumerate arbitrary reversals; it’s a deterministic transform once one side is known.

#### `list:remove`

**Shape:** `( (a b a c) a ) list:remove (b c)`

Removes all occurrences of an item from a list.

Important requirement: the item to remove must be **ground** (fully known) before the builtin will run.

#### `list:notMember` (test)

**Shape:** `(a b c) list:notMember x`

Succeeds iff the object cannot be unified with any element of the subject list. As a test, it typically works best once its inputs are bound; in forward rules Eyeling may defer it if it is reached before bindings are available.

#### `list:append`

This is list concatenation, but Eyeling implements it in a pleasantly relational way.

**Forward shape:** `( (a b) (c) (d e) ) list:append (a b c d e)`

Subject is a list of lists; object is their concatenation.

**Splitting (reverse-ish) mode:** If the **object is a concrete list**, Eyeling tries all ways of splitting it into the given number of parts and unifying each part with the corresponding subject element. This can yield multiple solutions and is handy for logic programming patterns.

#### `list:sort`

Sorts a list into a deterministic order.

- Requires the input list’s elements to be **ground**.
- Orders literals numerically when both sides look numeric; otherwise compares their lexical strings.
- Orders lists lexicographically by elements.
- Orders IRIs by IRI string.
- Falls back to a stable structural key for mixed cases.

Like `reverse`, this is “reversible” only in the sense that if one side is a list, the other side can be unified with its sorted form.

#### `list:map` (higher-order)

This is one of Eyeling’s most powerful list builtins because it calls back into the reasoner.

**Shape:** `( (x1 x2 x3) ex:pred ) list:map ?outList`

Semantics:

1. The subject is a 2-element list: `(inputList predicateIri)`.
2. `inputList` must be ground.
3. For each element `el` in the input list, Eyeling proves the goal:

   ```n3
   el predicateIri ?y.
   ```

   using _the full engine_ (facts, backward rules, and builtins).

4. All resulting `?y` values are collected in proof order and concatenated into the output list.
5. If an element produces no solutions, it contributes nothing.

This makes `list:map` a compact “query over a list” operator.

---

## 11.3.5 `log:` — unification, formulas, scoping, and meta-level control

The `log:` family is where N3 stops being “RDF with rules” and becomes a _meta-logic_. Eyeling supports the core operators you need to treat formulas as terms, reason inside quoted graphs, and compute closures.

### Equality and inequality

#### `log:equalTo`

**Shape:** `$x log:equalTo $y`

This is simply **term unification**: it succeeds if the two terms can be unified and returns any bindings that result.

#### `log:notEqualTo` (test)

Succeeds iff the terms **cannot** be unified. No new bindings.

### Working with formulas as terms

In Eyeling, a quoted formula `{ ... }` is represented as a `GraphTerm` whose content is a list of triples (and, when parsed from documents, rule terms can also appear as `log:implies` / `log:impliedBy` triples inside formulas).

#### `log:conjunction`

**Shape:** `( F1 F2 ... ) log:conjunction F`

- Subject is a list of formulas.
- Object becomes a formula containing all triples from all inputs.
- Duplicate triples are removed.
- The literal `true` is treated as the **empty formula** and is ignored in the merge.

#### `log:conclusion`

**Shape:** `F log:conclusion C`

Computes the _deductive closure_ of the formula `F` **using only the information inside `F`**:

- Eyeling starts with all triples inside `F` as facts.
- It treats `{A} => {B}` (represented internally as a `log:implies` triple between formulas) as a forward rule.
- It treats `{A} <= {B}` as the corresponding forward direction for closure purposes.
- Then it forward-chains to a fixpoint _within that local fact set_.
- The result is returned as a formula containing all derived triples.

Eyeling caches `log:conclusion` results per formula object, so repeated calls with the same formula term are cheap.

### Dereferencing and parsing (I/O flavored)

These builtins reach outside the current fact set. They are synchronous by design.

#### `log:content`

**Shape:** `<doc> log:content ?txt`

- Dereferences the IRI (fragment stripped) and returns the raw bytes as an `xsd:string` literal.
- In Node: HTTP(S) is fetched synchronously; non-HTTP is treated as a local file path (including `file://`).
- In browsers/workers: uses synchronous XHR (subject to CORS).

#### `log:semantics`

**Shape:** `<doc> log:semantics ?formula`

Dereferences and parses the remote/local resource as N3/Turtle-like syntax, returning a formula.

A nice detail: top-level rules in the parsed document are represented _as data_ inside the returned formula using `log:implies` / `log:impliedBy` triples between formula terms. This means you can treat “a document plus its rules” as a single first-class formula object.

#### `log:semanticsOrError`

Like `log:semantics`, but on failure it returns a string literal such as:

- `error(dereference_failed,...)`
- `error(parse_error,...)`

This is convenient in robust pipelines where you want logic that can react to failures.

#### `log:parsedAsN3`

**Shape:** `" ...n3 text... " log:parsedAsN3 ?formula`

Parses an in-memory string as N3 and returns the corresponding formula.

### Type inspection

#### `log:rawType`

Returns one of four IRIs:

- `log:Formula` (quoted graph)
- `log:Literal`
- `rdf:List` (closed or open list terms)
- `log:Other` (IRIs, blank nodes, etc.)

### Literal constructors

These two are classic N3 “bridge” operators between structured data and concrete RDF literal forms.

#### `log:dtlit`

Relates a datatype literal to a pair `(lex datatypeIri)`.

- If object is a literal, it can produce the subject list `(stringLiteral datatypeIri)`.
- If subject is such a list, it can produce the corresponding datatype literal.
- If both subject and object are variables, Eyeling treats this as satisfiable and succeeds once.

Language-tagged strings are normalized: they are treated as having datatype `rdf:langString`.

#### `log:langlit`

Relates a language-tagged literal to a pair `(lex langTag)`.

- If object is `"hello"@en`, subject can become `("hello" "en")`.
- If subject is `("hello" "en")`, object can become `"hello"@en`.
- Fully unbound succeeds once.

### Rules as data: introspection

#### `log:implies` and `log:impliedBy`

As _syntax_, Eyeling parses `{A} => {B}` and `{A} <= {B}` into internal forward/backward rules.

As _builtins_, `log:implies` and `log:impliedBy` let you **inspect the currently loaded rule set**:

- `log:implies` enumerates forward rules as `(premiseFormula, conclusionFormula)` pairs.
- `log:impliedBy` enumerates backward rules similarly.

Each enumerated rule is standardized apart (fresh variable names) before unification so you can safely query over it.

### Top-level directive: `log:query` (output selection)

**Shape (top level only):**

```n3
{ ...premise... } log:query { ...conclusion... }.
```

`log:query` is best understood as an **output projection**, not as a rule and not as a normal builtin:

- Eyeling still computes the saturated forward closure (facts + rules, including backward-rule proofs where needed).
- It then proves the **premise formula** as a goal (as if it were fed to `log:includes` in the global scope).
- For every solution, it instantiates the **conclusion formula** and collects the resulting triples.
- The final output is the **set of unique ground triples** from those instantiated conclusions.

This is “forward-rule-like” in spirit (premise ⇒ conclusion), but the instantiated conclusion triples are **not added back into the fact store**; they are just what Eyeling prints.

**Implementation note (performance):** repeated top-level `log:query` directives with the **same premise formula** are a good fit for Eyeling’s minimal completed-goal tabling (§8.4.1). The first query still performs the full backward proof; later identical premises can reuse the completed answer set as long as the saturated closure and scoped-query context are unchanged.

**Important details:**

- Only **top-level** `{...} log:query {...}.` directives are recognized. Inside quoted formulas (or inside rule bodies/heads) it is just an ordinary triple.
- Query-mode output depends on the saturated closure, so it cannot be streamed; `--stream` has no effect when any `log:query` directives are present.
- If you want _logical_ querying inside a rule/proof, use `log:includes` (and optionally `log:conclusion`) instead.

**Example (project a result set):**

```n3
@prefix : <urn:ex:>.
@prefix log: <http://www.w3.org/2000/10/swap/log#>.

{ :a :p ?x } => { :a :q ?x }.
:a :p :b.

{ :a :q ?x } log:query { :result :x ?x }.
```

Output (only):

```n3
:result :x :b .
```

### Scoped proof inside formulas: `log:includes` and friends

#### `log:includes`

**Shape:** `Scope log:includes GoalFormula`

This proves all triples in `GoalFormula` as goals, returning the substitutions that make them provable.

Eyeling has **two modes**:

1. **Explicit scope graph**: if `Scope` is a formula `{...}`
   - Eyeling reasons _only inside that formula_ (its triples are the fact store).
   - External rules are not used.

2. **Priority-gated global scope**: otherwise
   - Eyeling uses a _frozen snapshot_ of the current global closure.
   - The “priority” is read from the subject if it’s a positive integer literal `N`.
   - If the closure level is below `N`, the builtin “delays” by failing at that point in the search.

This priority mechanism exists because Eyeling’s forward chaining runs in outer iterations with a “freeze snapshot then evaluate scoped builtins” phase. The goal is to make scoped meta-builtins stable and deterministic: they query a fixed snapshot rather than chasing a fact store that is being mutated mid-iteration.

Also supported:

- The object may be the literal `true`, meaning the empty formula, which is always included (subject to the priority gating above).

#### `log:notIncludes` (test)

Negation-as-failure version: it succeeds iff `log:includes` would yield no solutions (under the same scoping rules).

#### `log:collectAllIn`

**Shape:** `( ValueTemplate WhereFormula OutList ) log:collectAllIn Scope`

- Proves `WhereFormula` in the chosen scope.
- For each solution, applies it to `ValueTemplate` and collects the instantiated terms into a list.
- Unifies `OutList` with that list.
- If `OutList` is a blank node, Eyeling just checks satisfiable without binding/collecting.

This is essentially a list-producing “findall”.

#### `log:forAllIn` (test)

**Shape:** `( WhereFormula ThenFormula ) log:forAllIn Scope`

For every solution of `WhereFormula`, `ThenFormula` must be provable under the bindings of that solution. If any witness fails, the builtin fails. No bindings are returned.

As a pure test (no returned bindings), this typically works best once its inputs are bound; in forward rules Eyeling may defer it if it is reached too early.

### Skolemization and URI casting

#### `log:skolem`

**Shape:** `$groundTerm log:skolem ?iri`

Deterministically maps a _ground_ term to a Skolem IRI in Eyeling’s well-known namespace. This is extremely useful when you want a repeatable identifier derived from structured content.

#### `log:uri`

Bidirectional conversion between IRIs and their string form:

- If subject is an IRI, object can be unified with a string literal of its IRI.
- If object is a string literal, subject can be unified with the corresponding IRI — **but** Eyeling rejects strings that cannot be safely serialized as `<...>` in Turtle/N3, and it rejects `_:`-style strings to avoid confusing blank nodes with IRIs.
- Some “fully unbound / don’t-care” combinations succeed once to avoid infinite enumeration.

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

- When you run Eyeling with `--strings` / `-r`, the CLI collects all `log:outputString` triples from the _saturated_ closure.
- It sorts them deterministically by the subject “key” and concatenates the string values in that order.

This is a pure test/side-effect marker (it shouldn’t drive search; it should merely validate that strings exist once other reasoning has produced them). In forward rules Eyeling may defer it if it is reached before the terms are usable.

---

## 11.3.6 `string:` — string casting, tests, and regexes

Eyeling implements string builtins with a deliberate interpretation of “domain is `xsd:string`”:

- Any **IRI** can be cast to a string (its IRI text).
- Any **literal** can be cast to a string:
  - quoted lexical forms decode N3/Turtle escapes,
  - unquoted lexical tokens are taken as-is (numbers, booleans, dateTimes, …).

- Blank nodes, lists, formulas, and variables are not string-castable (and cause the builtin to fail).

### Construction and concatenation

#### `string:concatenation`

**Shape:** `( s1 s2 ... ) string:concatenation s`

Casts each element to a string and concatenates.

#### `string:format`

**Shape:** `( fmt a1 a2 ... ) string:format out`

A tiny `sprintf` subset:

- Supports only `%s` and `%%`.
- Any other specifier (`%d`, `%f`, …) causes the builtin to fail.
- Missing arguments are treated as empty strings.

### Length and character utilities (Eyeling extensions)

Eyeling also implements a few **non-standard** `string:` helpers that are handy for string-based algorithms. These are **not** part of the SWAP builtin set, so treat them as Eyeling extensions.

#### `string:length`

**Shape:** `s string:length n`

Casts `s` to a string and returns its length as an integer literal token.

#### `string:charAt`

**Shape:** `( s i ) string:charAt ch`

- `i` is a numeric term, truncated to an integer.
- Indexing is **0-based** (like JavaScript).
- If `i` is out of range, `ch` is the empty string `""`.

#### `string:setCharAt`

**Shape:** `( s i ch ) string:setCharAt out`

Returns a copy of `s` with the character at index `i` (0-based) replaced by:

- the **first character** of `ch` if `ch` is non-empty, otherwise
- the empty string.

If `i` is out of range, `out` is the original string.

### Containment and prefix/suffix tests

- `string:contains`
- `string:containsIgnoringCase`
- `string:startsWith`
- `string:endsWith`

All are pure tests: they succeed or fail.

### Case-insensitive equality tests

- `string:equalIgnoringCase`
- `string:notEqualIgnoringCase`

### Lexicographic comparisons

- `string:greaterThan`
- `string:lessThan`
- `string:notGreaterThan` (≤ in Unicode codepoint order)
- `string:notLessThan` (≥ in Unicode codepoint order)

These compare JavaScript strings directly, i.e., Unicode code unit order (practically “lexicographic” for many uses, but not locale-aware collation).

### Regex-based tests and extraction

Eyeling compiles patterns using JavaScript `RegExp`, with a small compatibility layer:

- If the pattern uses Unicode property escapes (like `\p{L}`) or code point escapes (`\u{...}`), Eyeling enables the `/u` flag.
- In Unicode mode, some “identity escapes” that would be SyntaxErrors in JS are sanitized in a conservative way.

#### `string:matches` / `string:notMatches` (tests)

**Shape:** `data string:matches pattern`

Tests whether `pattern` matches `data`.

#### `string:replace`

**Shape:** `( data pattern replacement ) string:replace out`

- Compiles `pattern` as a global regex (`/g`).
- Uses JavaScript replacement semantics (so `$1`, `$2`, etc. work).
- Returns the replaced string.

#### `string:scrape`

**Shape:** `( data pattern ) string:scrape out`

Matches the regex once and returns the **first capturing group** (group 1). If there is no match or no group, it fails.

## 11.4 `log:outputString` as a controlled side effect

From a logic-programming point of view, printing is awkward: if you print _during_ proof search, you risk producing output along branches that later backtrack, or producing the same line multiple times in different derivations. Eyeling avoids that whole class of problems by treating “output” as **data**.

The predicate `log:outputString` is the only officially supported “side-effect channel”, and even it is handled in two phases:

1. **During reasoning (declarative phase):**  
   `log:outputString` behaves like a pure test builtin (implemented in `lib/builtins.js`): it succeeds when its arguments are well-formed and sufficiently bound (notably, when the object is a string literal that can be emitted). Importantly, it does _not_ print anything at this time. If a rule derives a triple like:

   ```n3
   :k log:outputString "Hello\n".
   ```

then that triple simply becomes part of the fact base like any other fact.

2. **After reasoning (rendering phase):** Once saturation finishes, Eyeling scans the _final closure_ for `log:outputString` facts and renders them deterministically (this post-pass lives in `lib/explain.js`). Concretely, the CLI collects all such triples, orders them in a stable way (using the subject as a key so output order is reproducible), and concatenates their string objects into the final emitted text.

This separation is not just an aesthetic choice; it preserves the meaning of logic search:

- Proof search may explore multiple branches and backtrack. Because output is only rendered from the **final** set of facts, backtracking cannot “un-print” anything and cannot cause duplicated prints from transient branches.
- Output becomes explainable. If you enable proof comments or inspect the closure, `log:outputString` facts can be traced back to the rules that produced them.
- Output becomes compositional. You can reason about output strings (e.g., sort them, filter them, derive them conditionally) just like any other data.

In short: Eyeling makes `log:outputString` safe by refusing to treat it as an immediate effect. It is a _declarative output fact_ whose concrete rendering is a final, deterministic post-processing step.

---

<a id="ch12"></a>

## Chapter 12 — Dereferencing and web-like semantics (`lib/deref.js`)

Some N3 workflows treat IRIs as pointers to more knowledge. Eyeling supports this with:

- `log:content` — fetch raw text
- `log:semantics` — fetch and parse into a formula
- `log:semanticsOrError` — produce either a formula or an error literal

`deref.js` is deliberately synchronous so the engine can remain synchronous.

### 12.1 Two environments: Node vs browser/worker

- In **Node**, dereferencing can read:
  - HTTP(S) via a subprocess that runs `fetch()` (keeps the engine synchronous)
  - local files (including `file://` URIs) via `fs.readFileSync`
  - in practice, any non-http IRI is treated as a local path for convenience.

- In **browser/worker**, dereferencing uses synchronous XHR (HTTP(S) only), subject to CORS.
  - Many browsers restrict synchronous XHR on the main thread; use a worker (as in `demo.html`) to avoid UI blocking.

### 12.2 Caching

Dereferencing is cached by IRI-without-fragment (fragments are stripped). There are separate caches for:

- raw content text
- parsed semantics (GraphTerm)
- semantics-or-error

This is both a performance and a stability feature: repeated `log:semantics` calls in backward proofs won’t keep refetching.

### 12.3 HTTPS enforcement

Eyeling can optionally rewrite `http://…` to `https://…` before dereferencing (CLI `--enforce-https`, or API option). This is a pragmatic “make more things work in modern environments” knob.

---

<a id="ch13"></a>

## Chapter 13 — Printing, proofs, and the user-facing output

Once reasoning is done (or as it happens in streaming mode), Eyeling converts derived facts back to N3.

### 13.1 Printing terms and triples (`lib/printing.js`)

Printing handles:

- compact qnames via `PrefixEnv`
- `rdf:type` as `a`
- `owl:sameAs` as `=`
- nice formatting for lists and formulas

The printer is intentionally simple; it prints what Eyeling can parse.

### 13.2 Proof comments: local justifications, not full proof trees

When enabled, Eyeling prints a compact comment block per derived triple:

- the derived triple
- the instantiated rule body that was provable
- the schematic forward rule that produced it

It’s a “why this triple holds” explanation, not a globally exported proof graph.

Implementation note: the engine records lightweight `DerivedFact` objects during forward chaining, and `lib/explain.js` (via `makeExplain(...)`) is responsible for turning those objects into the human-readable proof comment blocks.

### 13.3 Streaming derived facts

The engine’s `reasonStream` API can accept an `onDerived` callback. Each time a new forward fact is derived, Eyeling can report it immediately.

This is especially useful in interactive demos (and is the basis of the playground streaming tab).

The same API can now also emit RDF/JS output. When `rdfjs: true` is passed, every `onDerived(...)` payload includes both:

- `triple` — Eyeling’s N3 string form
- `quad` — the same fact as an RDF/JS default-graph quad

For fully stream-oriented RDF/JS consumers there is also `reasonRdfJs(...)`, which exposes the derived facts as an async iterable of RDF/JS quads.

---

<a id="ch14"></a>

## Chapter 14 — Entry points: CLI, bundle exports, and npm API

Eyeling exposes itself in three layers.

### 14.1 The bundled CLI (`eyeling.js`)

The bundle contains the whole engine. The CLI path is the “canonical behavior”:

- parse input file
- reason to closure
- print derived triples or output strings
- optional proof comments
- optional streaming

#### 14.1.1 CLI options at a glance

The current CLI supports a small set of flags (see `lib/cli.js`):

- `-a`, `--ast` — print the parsed AST as JSON and exit.
- `-d`, `--deterministic-skolem` — make `log:skolem` stable across runs.
- `-e`, `--enforce-https` — rewrite `http://…` to `https://…` for dereferencing builtins.
- `-p`, `--proof-comments` — include per-fact proof comment blocks in output.
- `-r`, `--strings` — after reasoning, render only `log:outputString` values (ordered by subject key).
- `-s`, `--super-restricted` — disable all builtins except `log:implies` / `log:impliedBy`.
- `-t`, `--stream` — stream derived triples as soon as they are derived.
- `-v`, `--version` — print version and exit.
- `-h`, `--help` — show usage.

### 14.2 `lib/entry.js`: bundler-friendly exports

`lib/entry.js` exports:

- public APIs: `reasonStream`, `reasonRdfJs`, `rdfjs`, `main`, `version`
- plus a curated set of internals used by the demo (`lex`, `Parser`, `forwardChain`, etc.)

`rdfjs` is a small built-in RDF/JS `DataFactory`, so browser / worker code can construct quads without pulling in another package first.

### 14.3 `index.js`: the npm API wrapper

The npm `reason(...)` function does something intentionally simple and robust:

- normalize the JavaScript input into N3 text
- write that N3 input to a temp file
- spawn the bundled CLI (`node eyeling.js ... input.n3`)
- return stdout (and forward stderr)

This keeps the observable output identical to the CLI while still allowing richer JS-side inputs.

In particular, the npm API now accepts:

- raw N3 strings
- RDF/JS fact inputs (`quads`, `facts`, or `dataset`)
- Eyeling rule objects or full AST bundles like `[prefixes, triples, frules, brules]`

For structured JavaScript input, rules are supplied as current Eyeling `Rule` / `Triple` object graphs or as JSON-serialized `--ast` output with `_type` markers.

If you want to use N3 source text, pass the whole input as a plain N3 string.

One practical implication remains:

- if you want _in-process_ access to the engine objects (facts arrays, derived proof objects), use `reasonStream` / `reasonRdfJs` from the bundle entry rather than the subprocess-based API.

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
   - `(:Socrates rdf:type :Human)`
   - `(:Human rdfs:subClassOf :Mortal)` and one forward rule:
   - premise goals: `?S a ?A`, `?A rdfs:subClassOf ?B`
   - head: `?S a ?B`

2. Forward chaining scans the rule and calls `proveGoals` on the body.

3. Proving `?S a ?A` matches the first fact, producing `{ S = :Socrates, A = :Human }`.

4. With that substitution, the second goal becomes `:Human rdfs:subClassOf ?B`. It matches the second fact, extending to `{ B = :Mortal }`.

5. Eyeling instantiates the head `?S a ?B` → `:Socrates a :Mortal`.

6. The triple is ground and not already present, so it is added and (optionally) printed.

That’s the whole engine in miniature: unify, compose substitutions, emit head triples.

---

<a id="ch16"></a>

## Chapter 16 — Extending Eyeling (without breaking it)

Eyeling is small, which makes it pleasant to extend — but there are a few invariants worth respecting.

### 16.1 Adding a builtin

Most extensions belong in `lib/builtins.js` (inside `evalBuiltin`):

- Decide if your builtin is:
  - a test (0/1 solution)
  - functional (bind output)
  - generator (many solutions)
- Return _deltas_ `{ varName: Term }`, not full substitutions.
- Be cautious with fully-unbound cases: generators can explode the search space.
- If you add a _new predicate_ (not just a new case inside an existing namespace), make sure it is recognized by `isBuiltinPred(...)`.

A small architectural note: `lib/builtins.js` is initialized by the engine via `makeBuiltins(deps)`. It receives hooks (unification, proving, deref, scoped-closure helpers, …) instead of importing the engine directly, which keeps the module graph acyclic and makes browser bundling easier.

If your builtin needs a stable view of the scoped closure, follow the scoped-builtin pattern:

- read from `facts.__scopedSnapshot`
- honor `facts.__scopedClosureLevel` and priority gating

And if your builtin is “forward-only” (needs inputs bound), it’s fine to **fail early** until inputs are available — forward rule proving enables builtin deferral, so the goal can be retried later in the same conjunction.

### 16.2 Adding new term shapes

If you add a new Term subclass, you’ll likely need to touch:

- printing (`termToN3`)
- unification and equality (`unifyTerm`, `termsEqual`, fast keys)
- variable collection for compaction (`gcCollectVarsInTerm`)
- groundness checks

### 16.3 Parser extensions

If you extend parsing, preserve the Rule invariants:

- rule premise is a triple list
- rule conclusion is a triple list
- blanks in premise are lifted (or handled consistently)
- `headBlankLabels` must reflect blanks occurring explicitly in the head _before_ skolemization

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

This appendix is a compact, user-facing reference for **running Eyeling** and **writing inputs that work well**. For deeper explanations and implementation details, follow the chapter links in each section.

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

By default, Eyeling prints **newly derived forward facts** (the heads of fired `=>` rules), serialized as N3. It does **not** reprint your input facts.

If the input contains one or more **top-level** `log:query` directives:

```n3
{ ...premise... } log:query { ...conclusion... }.
```

Eyeling still computes the saturated forward closure, but it prints only the **unique instantiated conclusion triples** of those `log:query` directives (instead of all newly derived facts). This is useful when you want a forward-rule-like projection of results.

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

Note: when `log:query` directives are present, Eyeling cannot stream output (the selected results depend on the saturated closure), so `--stream` has no effect in that mode.

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

- [https://w3c.github.io/N3/spec/#grammar](https://w3c.github.io/N3/spec/#grammar)

See also:

- [Chapter 4 — From characters to AST: lexing and parsing](#ch04)

### A.5 Builtins

Eyeling supports a built-in “standard library” across namespaces like `log:`, `math:`, `string:`, `list:`, `time:`, `crypto:`.

References:

- W3C N3 Built-ins overview: [https://w3c.github.io/N3/reports/20230703/builtins.html](https://w3c.github.io/N3/reports/20230703/builtins.html)
- Eyeling implementation details: [Chapter 11 — Built-ins as a standard library](#ch11)
- The shipped builtin catalogue: `eyeling-builtins.ttl` (in this repo)

If you are running untrusted inputs, consider `--super-restricted` to disable all builtins except implication.

### A.6 Skolemization and `log:skolem`

When forward rule heads contain blank nodes (existentials), Eyeling replaces them with generated Skolem IRIs so derived facts are ground.

See:

- [Chapter 9 — Forward chaining: saturation, skolemization, and meta-rules](#ch09)

### A.7 Networking and `log:semantics`

`log:content`, `log:semantics`, and related builtins dereference IRIs and parse retrieved content. This is powerful, but it is also I/O.

See:

- [Chapter 12 — Dereferencing and web-like semantics](#ch12)

Safety tip:

- Use `--super-restricted` if you want to ensure _no_ dereferencing (and no other builtins) can run.

### A.8 Embedding Eyeling in JavaScript

If you depend on Eyeling as a library, the package exposes:

- a CLI wrapper API (`reason(...)`), and
- in-process engine entry points (via the bundle exports).

See:

- [Chapter 14 — Entry points: CLI, bundle exports, and npm API](#ch14)

### A.9 Further reading

If you want to go deeper into N3 itself and the logic/programming ideas behind Eyeling, these are good starting points:

N3 / Semantic Web specs and reports:

- [https://w3c.github.io/N3/spec/](https://w3c.github.io/N3/spec/)
- [https://w3c.github.io/N3/spec/builtins](https://w3c.github.io/N3/spec/builtins)
- [https://w3c.github.io/N3/spec/semantics](https://w3c.github.io/N3/spec/semantics)

Logic & reasoning background (Wikipedia):

- [https://en.wikipedia.org/wiki/Mathematical_logic](https://en.wikipedia.org/wiki/Mathematical_logic)
- [https://en.wikipedia.org/wiki/Automated_reasoning](https://en.wikipedia.org/wiki/Automated_reasoning)
- [https://en.wikipedia.org/wiki/Forward_chaining](https://en.wikipedia.org/wiki/Forward_chaining)
- [https://en.wikipedia.org/wiki/Backward_chaining](https://en.wikipedia.org/wiki/Backward_chaining)
- [https://en.wikipedia.org/wiki/Unification\_%28computer_science%29](https://en.wikipedia.org/wiki/Unification_%28computer_science%29)
- [https://en.wikipedia.org/wiki/Prolog](https://en.wikipedia.org/wiki/Prolog)
- [https://en.wikipedia.org/wiki/Datalog](https://en.wikipedia.org/wiki/Datalog)
- [https://en.wikipedia.org/wiki/Skolem_normal_form](https://en.wikipedia.org/wiki/Skolem_normal_form)

---

<a id="app-b"></a>

## Appendix B — Notation3: when facts can carry their own logic

RDF succeeded by making a radical design choice feel natural: reduce meaning to small, uniform statements—triples—that can be published, merged, and queried across boundaries. A triple does not presume a database schema, a programming language, or a particular application. It presumes only that names (IRIs) can be shared, and that graphs can be combined.

That strength also marks RDF’s limit. The moment a graph is expected to _do_ something—normalize values, reconcile vocabularies, derive implied relationships, enforce a policy, compute a small transformation—logic tends to migrate into code. The graph becomes an inert substrate while the decisive semantics hide in scripts, services, ETL pipelines, or bespoke rule engines. What remains portable is the data; what often becomes non-portable is the meaning.

Notation3 (N3) sits precisely at that seam. It remains a readable way to write RDF, but it also treats _graphs themselves_ as objects that can be described, matched, and related. The N3 Community Group’s specification presents N3 as an assertion and logic language that extends RDF rather than replacing it: [https://w3c.github.io/N3/spec/](https://w3c.github.io/N3/spec/).

The essential move is quotation: writing a graph inside braces as a thing that can be discussed. Once graphs can be quoted, rules become graph-to-graph transformations. The familiar implication form, `{ … } => { … } .`, reads as a piece of prose: whenever the antecedent pattern holds, the consequent pattern follows. Tim Berners-Lee’s design note frames this as a web-friendly logic with variables and nested graphs: [https://www.w3.org/DesignIssues/Notation3.html](https://www.w3.org/DesignIssues/Notation3.html).

This style of rule-writing makes rules first-class, publishable artifacts. It keeps the unit of exchange stable. Inputs are RDF graphs; outputs are RDF graphs. Inference produces new triples rather than hidden internal state. Rule sets can be versioned alongside data, reviewed as text, and executed by different engines that implement the same semantics. That portability theme runs back to the original W3C Team Submission: [https://www.w3.org/TeamSubmission/n3/](https://www.w3.org/TeamSubmission/n3/).

Practical reasoning also depends on computation: lists, strings, math, comparisons, and the other “small operations” that integration work demands. N3 addresses this by standardizing built-ins—predicates with predefined behavior that can be used inside rule bodies while preserving the declarative, graph-shaped idiom. The built-ins report is here: [https://w3c.github.io/N3/reports/20230703/builtins.html](https://w3c.github.io/N3/reports/20230703/builtins.html).

Testing is where rule languages either converge or fragment. Different implementations can drift on scoping, blank nodes, quantification, and built-in behavior. N3’s recent direction has been toward explicit, testable semantics, documented separately as model-theoretic foundations: [https://w3c.github.io/N3/reports/20230703/semantics.html](https://w3c.github.io/N3/reports/20230703/semantics.html).

In that context, public conformance suites become more than scoreboards: they are the mechanism by which interoperability becomes measurable. The community test suite lives at [https://codeberg.org/phochste/notation3tests/](https://codeberg.org/phochste/notation3tests/), with comparative results published in its report: [https://codeberg.org/phochste/notation3tests/src/branch/main/reports/report.md](https://codeberg.org/phochste/notation3tests/src/branch/main/reports/report.md).

The comparison with older tools is historically instructive. Cwm (Closed World Machine) was an early, influential RDF data processor and forward-chaining reasoner—part of the lineage that treated RDF (often written in N3) as something executable: [https://www.w3.org/2000/10/swap/doc/cwm](https://www.w3.org/2000/10/swap/doc/cwm).

What motivates Notation3, in the end, is architectural restraint. It refuses to let “logic” become merely a private feature of an application stack. It keeps meaning close to the graph: rules are expressed as graph patterns; results are expressed as triples; computation is pulled in through well-defined built-ins rather than arbitrary code. This produces a style of working where integration and inference are not sidecar scripts, but publishable artifacts—documents that can be inspected, shared, tested, and reused.

In that sense, N3 is less a bid to make the web “smarter” than a bid to make meaning _portable_: not only facts that travel, but also the explicit steps by which facts can be connected, extended, and made actionable—without abandoning the simplicity that made triples travel in the first place.

---

<a id="app-c"></a>

## Appendix C — N3 beyond Prolog: logic for RDF-style graphs

Notation3 (N3) rule sets often look similar to Prolog at the surface: they use variables, unification, and implication-style rules (“if these patterns match, then these patterns follow”). N3 is typically used in a different setting: instead of a single program operating over a single local database, N3 rules and data are commonly written as documents that can be published, shared, merged, and referenced across systems.

In practice, that setting is reflected in several common features of N3-style rule writing:

- **Identifiers are IRIs.** Terms are usually global identifiers rather than local symbols, which supports linking across datasets.
- **Input and output are graphs.** Rules consume graph patterns and produce additional triples, so the result of inference can be represented in the same form as the input data.
- **Quoted graphs allow statements-as-data.** N3 can treat a graph (a set of triples) as a term, which makes it possible to represent and reason about assertions (e.g., “this source says …” or “this formula implies …”) as data.
- **Rules can be distributed as text artifacts.** Rules can live alongside data, be versioned, and be reused without requiring an external host language to “carry” the meaning.
- **Built-ins cover common computations.** Many N3 workflows rely on built-ins for operations such as string handling, list processing, comparisons, and related utilities; some workflows also use IRIs as pointers to retrievable content.

Engines can combine execution styles in different ways. One common pattern is to use a Prolog-like backward-chaining prover to satisfy rule bodies, while still using forward chaining to add the instantiated conclusions to the fact set until no new facts are produced.

---

<a id="app-d"></a>

## Appendix D — LLM + Eyeling: A Repeatable Logic Toolchain

Eyeling is a deterministic N3 engine: given facts and rules, it derives consequences to a fixpoint using forward rules proved by a backward engine. That makes it a good “meaning boundary” for LLM-assisted workflows: the LLM can draft and refactor N3, but **Eyeling is what decides what follows**.

A practical pattern is to treat the LLM as a **syntax-and-structure generator** and Eyeling as the **semantic validator**.

### 1) Constrain the LLM to output compilable N3

If the LLM is allowed to emit prose or “almost N3”, you’ll spend your time cleaning up. Instead, require:

- **Only N3** (no explanations in the artifact).
- A fixed prefix set (or a required `@base`).
- One artifact per file (facts + rules), optionally with a separate test file.
- “No invention” rules for IRIs: new symbols must be declared or use a designated namespace.

This is less about prompt craft and more about creating a stable interface between a text generator and a compiler-like consumer.

### 2) Use Eyeling as the compile check and the semantic check

Run Eyeling immediately after generation:

- **Parse failures** → feed the error back to the LLM and request a corrected N3 file (same vocabulary, minimal diff).
- **Runtime failures / fuses** → treat as a spec violation, not “the model being creative”.

Eyeling explicitly supports **inference fuses**: a forward rule with head `false` is a hard failure. This is extremely useful as a guardrail when you want “never allow X” constraints to stop the run.

Example fuse:

```n3
@prefix : <http://example/> .

{ ?u :role :Admin.
  ?u :disabled true.
} => false.
```

If you don’t want “stop the world”, derive a `:Violation` fact instead, and keep going.

### 3) Make the workflow test-driven (golden closures)

The most robust way to keep LLM-generated logic plausible is to make it live under tests:

- Keep tiny **fixtures** (facts) alongside the rules.
- Run Eyeling to produce the **derived closure** (Eyeling emits only newly derived forward facts by default, can optionally include compact proof comments, and can also use `log:query` directives to project a specific result set).
- Compare against an expected output (“golden file”) in CI.

This turns rule edits into a normal change-management loop: diffs are explicit, reviewable, and reproducible.

### 4) Use proofs/traces as the input to the LLM, not the other way around

If you want a natural-language explanation, don’t ask the model to “explain the rules from memory”. Instead:

1. Run Eyeling with proof/trace enabled (Eyeling has explicit tracing hooks and proof-comment support in its output pipeline).
2. Give the LLM the **derived triples + proof comments** and ask it to summarize:
   - what was derived,
   - which rule(s) fired,
   - which premises mattered.

This keeps explanations anchored to what Eyeling actually derived.

### 5) The refinement loop: edits are N3 diffs, not “better prompting”

When output looks wrong, the fix should be a change in the artifact:

- tighten a premise,
- split one rule into two,
- add an exception rule,
- introduce a new predicate to separate concepts,
- add a fuse or a `:Violation` derivation,
- add a test case that locks in the intended behavior.

Then regenerate/rewrite **only the N3**, rerun Eyeling, and review the diff.

### A prompt shape that tends to behave well

A simple structure that keeps the LLM honest:

- “Output **only** N3.”
- “Use exactly these prefixes.”
- “Do not introduce new IRIs outside `<base>#*`.”
- “Include at least N minimal tests as facts in a separate block/file.”
- “If something is unknown, emit a placeholder fact (`:needsFact`) rather than guessing.”

The point isn’t that the LLM is “right”; it’s that **Eyeling makes the result checkable**, and the artifact becomes a maintainable program rather than a one-off generation.

---

<a id="app-e"></a>

## Appendix E — How Eyeling reaches 100% on `notation3tests`

### E.1 The goal

Eyeling does not treat [notation3tests](https://codeberg.org/phochste/notation3tests/) as a side check.

It treats the suite as an **external semantic contract**.

That means:

- the target is public
- the target is reproducible
- the target is outside the local codebase
- success means interoperability, not self-consistency

---

### E.2 The test loop

The workflow is simple and strict:

- clone the external [notation3tests](https://codeberg.org/phochste/notation3tests/) suite
- package the current Eyeling tree
- install that package into the suite
- run the suite’s Eyeling target
- fix semantics, not cosmetics

This keeps the suite honest and keeps Eyeling honest.

---

### E.3 The prompt packet

A typical conformance-fix prompt is not open-ended.

It usually includes a small, repeatable packet:

- the Eyeling source as an attached zip `https://github.com/eyereasoner/eyeling/archive/refs/heads/main.zip`
- pointers to the failing tests
- the exact failing output, or the exact command needed to reproduce it
- a pointer to the N3 spec `https://w3c.github.io/N3/spec/`
- a pointer to the builtin definitions `https://w3c.github.io/N3/spec/builtins.html`
- a direct request to fix the issue in the engine
- a direct request to update `HANDBOOK.md`

The request is usually phrased in a narrow way:

- fix this specific failing conformance case
- preserve existing passing behavior
- make the smallest coherent patch
- add or update a regression test if needed
- update the handbook so the semantic rule is documented, not just implemented
- do not stop at making the test green; align the implementation with the spec and explain the semantic reason in `HANDBOOK.md`

The model is not asked to “improve the reasoner” in general.

It is asked to repair one semantic gap against: the code, the failing test, the spec, and the handbook.

---

### E.4 The core idea

Eyeling reaches 100% by making the engine match the semantics that the suite exercises.

That means getting these right:

- N3 syntax
- rule forms
- quoted formulas
- variable and blank-node behavior
- builtin relations
- closure and duplicate control

The result is not “test gaming.”

The result is semantic alignment.

---

### E.5 One rule core, many surfaces

The suite uses different surface forms for the same logical ideas.

Eyeling accepts and normalizes them into one internal rule model:

- `{ P } => { C } .`
- `{ H } <= { B } .`
- top-level `log:implies`
- top-level `log:impliedBy`

That matters because conformance depends on recognizing equivalence across syntax, not just parsing one preferred style.

---

### E.6 Normalize first, reason second

A large share of conformance work happens **before** execution.

Eyeling normalizes the tricky parts early:

- body blanks become variables
- head blanks stay existential
- RDF collection encodings become list terms
- rule syntax variants become one rule representation

This removes ambiguity before the engine starts proving anything.

---

### E.7 Body blanks vs. head blanks

This is one of the decisive details.

In Eyeling:

- blanks in rule bodies act like placeholders
- blanks in rule heads act like fresh existentials

That split is essential.

Without it:

- rule matching goes wrong
- proofs become unstable
- existential output becomes noisy
- conformance drops

---

### E.8 Builtins must behave like relations

Eyeling does not treat builtins as one-way helper functions.

It treats them as **relations inside proof search**.

That means a builtin can:

- succeed
- fail
- bind variables
- stay satisfiable without yet binding anything

This is critical for the suite, because many builtin cases are really tests of search behavior, not just value computation.

---

### E.9 Delay builtins when needed

Some builtins only become useful after neighboring goals bind enough variables.

Eyeling handles that by deferring non-informative builtins inside conjunctions.

So instead of failing too early, the engine:

- rotates the builtin later
- keeps proving the remaining goals
- retries once more information exists

This preserves logical behavior while staying operationally efficient.

---

### E.10 Formulas are first-class terms

Quoted formulas are not treated as strings.

They are treated as structured logical objects.

That gives Eyeling the machinery it needs for:

- formula matching
- nested reasoning
- `log:includes`
- `log:conclusion`
- formula comparison by alpha-equivalence

This is a major reason the higher-level N3 tests pass cleanly.

---

### E.11 Alpha-equivalence matters

Two formulas that differ only in internal names must still count as the same formula when their structure matches.

Eyeling therefore compares formulas by structure, not by accidental naming.

That removes a common source of false mismatches in:

- quoted formulas
- nested graphs
- rule introspection
- scoped reasoning

---

### E.12 Lists must have one meaning

The suite exercises list behavior in more than one spelling.

Eyeling unifies them:

- concrete N3 lists
- RDF `first/rest` collection encodings

By materializing anonymous RDF collections into list terms, Eyeling gives both forms one semantic path through the engine.

That keeps list reasoning consistent across the whole suite.

---

### E.13 Existentials must be stable

A rule head with blanks must not generate endless fresh variants of the same logical result.

Eyeling stabilizes this by skolemizing head blanks per firing instance.

So one logical firing yields:

- one stable witness
- one stable derived shape
- one meaningful duplicate check

This is what lets closure reach a real fixpoint.

---

### E.14 Duplicate suppression is semantic, not cosmetic

The engine does not merely try to avoid repeated printing.

It tries to avoid repeated derivation of the same fact.

That requires:

- stable term ids
- indexed fact storage
- reliable duplicate keys
- stable existential handling

Without that, a reasoner can look busy forever and still fail conformance.

---

### E.15 Closure must really close

Full conformance depends on real saturation behavior.

Eyeling therefore treats closure as:

- repeated rule firing
- repeated proof over indexed facts
- duplicate-aware insertion
- termination at fixpoint

This is what turns the engine from a parser plus demos into a conformance-grade reasoner.

---

### E.16 Performance choices support correctness

Several implementation choices are operational, but they directly protect conformance:

- predicate-based indexing
- subject/object refinement
- smallest-bucket candidate selection
- fast duplicate keys
- skipping already-known ground heads

These choices reduce accidental nontermination and prevent operational noise from becoming semantic failure.

---

### E.17 The suite stays external

This is a key discipline.

Eyeling does not define success by a private in-repo imitation of [notation3tests](https://codeberg.org/phochste/notation3tests/).

It runs against the external suite.

That means:

- the compliance test suite is shared
- the contract is public
- the result is independently meaningful

A green run says something real.

---

### E.18 Every failure becomes an invariant

Eyeling reaches 100% because failures are not patched superficially.

Each failure is turned into an engine rule.

Examples:

- parser failure → broader syntax support
- list failure → one unified list model
- formula failure → alpha-equivalence discipline
- builtin failure → relational evaluation
- closure failure → stable existential handling

That is how the suite shapes the engine.

---

### E.19 Why 100% happens

Eyeling gets to 100% because all the key layers line up:

- the parser accepts the full rule surface
- normalization removes semantic ambiguity
- formulas are real terms
- builtins participate in proof search
- existential output is stable
- closure reaches a true fixpoint
- the public suite remains the judge

Once those pieces are in place, 100% is the visible result of a coherent design.

---

### E.20 Final takeaway

Eyeling reaches full [notation3tests](https://codeberg.org/phochste/notation3tests/) conformance by making “pass the suite” and “implement N3 correctly enough to interoperate” the same task.

That is the method:

- external suite
- one semantic core
- early normalization
- relational builtins
- formula-aware reasoning
- stable existential output
- duplicate-safe fixpoint closure

That is why the result is 100%.
