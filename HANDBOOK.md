# Inside Eyeling

## A compact Notation3 reasoner in JavaScript — a handbook

> This handbook is written for a computer science student who wants to understand Eyeling as _code_ and as a _reasoning machine_.  
> It is meant to be read linearly, but each chapter stands on its own.

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
- [Appendix C — Why N3 fits the Eyeling examples](#app-c)
- [Appendix D — LLM + Eyeling: A Repeatable Logic Toolchain](#app-d)
- [Appendix E — How Eyeling reaches 100% on `notation3tests`](#app-e)
- [Appendix F — The ARC approach: Answer • Reason Why • Check](#app-f)
- [Appendix G — Eyeling and the W3C CG Notation3 Semantics](#app-g)
- [Appendix H — Applied Constructor-Theory and the N3 ARC examples](#app-h)
- [Appendix I — The Eyeling Playground](#app-i)
- [Appendix J — Formalism Is Fine](#app-j)
- [Appendix K — Whitehead-inspired becoming examples](#app-k)

---

<a id="preface"></a>

## Preface: what Eyeling is (and what it is not)

Eyeling is a small Notation3 (N3) reasoner implemented in JavaScript. Its job is to take:

1. **Facts** (RDF-like triples), and
2. **Rules** written in N3’s implication style (`=>` and `<=`),

and compute consequences until nothing new follows.

If you have seen Datalog or Prolog, the shape will feel familiar. Eyeling blends both:

- **Forward chaining** (like Datalog saturation) for `=>` rules.
- **Backward chaining** (like Prolog goal solving) for `<=` rules _and_ for built-in predicates.

That last point is the heart of Eyeling’s design: _forward rules are executed by proving their bodies using a backward engine_. This lets forward rules depend on computations and “virtual predicates” without explicitly materializing everything as facts.

Eyeling deliberately keeps the implementation small and dependency-free:

- the published package includes a Node-oriented bundle (`eyeling.js`) and a dedicated browser bundle (`dist/browser/eyeling.browser.js`)
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

This is very nearly a tiny compiler pipeline:

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

Terms are treated as immutable: once interned/created, the code assumes you will not mutate `.value` (or `.label` for blanks).

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

A useful detail: the parser maintains a `pendingTriples` list used when certain syntactic forms expand into helper triples (for example, some path/property-list expansions). It ensures the “surface statement” still emits all required triples even if the subject itself was syntactic sugar.

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

Before rules hit the engine, Eyeling performs one lightweight transformation. A second “make it work” trick—deferring built-ins that cannot run yet—happens later inside the goal prover.

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

### 5.1.1 Quoted formulas in rule bodies: direct pattern positions vs nested data positions

There is one important refinement to the “lift blanks in rule bodies” rule when a rule body mentions a quoted formula (`GraphTerm`).

Eyeling now distinguishes **direct quoted-formula positions** from **nested quoted-formula data**.

#### Direct quoted-formula positions in a premise triple

When a quoted formula appears **directly** as the subject, predicate, or object term of a premise triple, Eyeling treats blank nodes inside that quoted formula as **rule-body placeholders** and lifts them to rule variables.

Example:

```n3
{ :A :B :C } a :Statement.

{
  { _:X :B :C } a :Statement.
} => {
  :result :is true.
}.
```

This matches and derives `:result :is true.` because the direct quoted formula `{ _:X :B :C }` is being used as a **pattern-bearing term** in the premise triple.

This behavior is mainly for interoperability with engines that treat blank nodes in such direct quoted-formula premise positions as pattern placeholders.

#### Nested quoted formulas remain data

If the quoted formula is nested **inside another term** in the rule body — for example inside a list used by `log:conjunction` — Eyeling preserves the quoted formula’s own blank-node scope.

So this rule body:

```n3
{
  ( { ?S a :Subject } { [] a :Thing } ) log:conjunction ?Z.
} => { ... }.
```

must keep the inner `[]` as a **formula-local blank node**. Eyeling treats it as belonging to the quoted graph, not as a rule-body variable that escapes into the surrounding rule.

That distinction matters because quoted formulas still play **two different roles** in Eyeling:

1. **Formula as data** — for example when constructing a formula with `log:conjunction` or storing `{ ... }` inside another data term. In this role, local blanks stay blanks. They print as blank nodes and participate in alpha-equivalence only within that quoted formula.
2. **Formula as a query pattern** — either through query-like builtins such as `log:includes`, `log:notIncludes`, `log:collectAllIn`, or `log:forAllIn`, or through a **direct quoted-formula premise position** as described above. In that role, the formula’s local blanks may be treated existentially while matching.

The practical rule is:

> **Eyeling lifts blanks inside quoted formulas only when the quoted formula appears directly in an ordinary premise triple position.**
>
> For `log:includes` and `log:notIncludes`, quoted formula operands keep their own blank-node scope. The builtin may treat blanks in the goal formula existentially while proving it, but blanks in an explicit scope graph remain formula-local blanks and may be returned as blank nodes rather than synthetic variables such as `?_b1`.

This keeps `log:conjunction` and formula printing honest, while still allowing direct quoted-formula premise patterns such as `{ _:X :B :C } a :Statement.` to match interoperably.

### 5.2 Builtin deferral in forward-rule bodies

In a depth-first proof, the order of goals matters. Many built-ins only become informative once parts of the triple are **already instantiated** (for example comparisons, pattern tests, and other built-ins that do not normally create bindings).

If such a builtin runs while its subject/object still contain variables or blanks, it may return **no solutions** (because it cannot decide yet) or only the **empty delta** (`{}`), even though it would succeed (or fail) once other goals have bound the needed values.

Eyeling supports a runtime deferral mechanism inside `proveGoals(...)`, enabled only when proving the bodies of forward rules.

What happens when `proveGoals(..., { deferBuiltins: true })` sees a builtin goal:

- Eyeling evaluates the builtin once.
- If the builtin yields **no deltas**, or only **empty deltas** (`[{}]`), and:
  - there are still other goals remaining, and
  - the builtin goal still contains variables/blanks, and
  - the goal list hasn’t already been rotated too many times,
- then Eyeling **rotates that builtin goal to the end** of the current goal list and continues with the next goal first.

A small counter (`deferCount`) caps how many rotations can happen (at most the length of the current goal list), so the prover cannot loop forever by endlessly “trying later”.

There is one extra guard for a small whitelist of built-ins that are considered satisfiable even when both subject and object are completely unbound (see `__builtinIsSatisfiableWhenFullyUnbound`). For these, if evaluation yields no deltas and there is nothing left to bind (either it is the last goal, or deferral has already been exhausted), Eyeling treats the builtin as a vacuous success (`[{}]`) so it does not block the proof.

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

That is alpha-equivalence:

- `{ _:x :p ?y. }` should match `{ _:z :p ?w. }`

Eyeling implements alpha-equivalence by checking whether there exists a consistent renaming mapping between the two formulas’ variables/blanks that makes the triples match.

Important scope nuance: only blanks/variables that are local to the quoted formula participate in alpha-renaming. If a formula is being matched after an outer substitution has already instantiated part of it, those substituted terms are treated as fixed. In other words, alpha-equivalence may rename formula-local placeholders, but it must not rename names that came from the enclosing match. This prevents a substituted outer blank node from being confused with a local blank node inside the quoted formula.

So `{ _:x :p :o }` obtained by substituting `?A = _:x` into `{ ?A :p :o }` must not alpha-match `{ _:b :p :o }` by renaming `_:x` to `_:b`.

A related operational detail matters for rule execution: alpha-equivalence is only a **binding-free shortcut** when both quoted formulas are variable-free after substitution. If unbound variables still remain inside the formulas, Eyeling must fall back to structural quoted-formula unification so shared outer rule variables can actually bind. Otherwise a premise such as `?A :has { ?S ?P ?O }` could appear to match while leaving `?S ?P ?O` unbound for later goals.

### 6.2 Groundness: “variables inside formulas do not leak”

Eyeling makes a deliberate choice about _groundness_:

- a triple is “ground” if it has no free variables in normal positions
- **variables inside a `GraphTerm` do not make the surrounding triple non-ground**

This is encoded in functions like `isGroundTermInGraph`. It is what makes it possible to assert and store triples that _mention formulas with variables_ as data.

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

1. It is _set-like_: order does not matter.
2. It is _substitution-threaded_: choices made while matching one triple restrict the remaining matches, just like Prolog.

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

The same selectivity idea is also reused by the single-premise forward-rule agenda in `forwardChain`: safe one-premise rules are pre-indexed by predicate / `(p,s)` / `(p,o)` patterns so a newly added fact only checks the small subset of rules that could match it.

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

**Implementation note (performance):** in the core DFS, Eyeling applies builtin (and unification) deltas into a single mutable substitution and uses a **trail** to undo bindings on backtracking. This preserves the meaning of “threading substitutions through a proof”, but avoids allocating and copying full substitution objects on every branch. Empty deltas (`{}`) are genuinely cheap: they do not touch the trail and only incur the control-flow overhead of exploring a branch.

**Implementation note (performance):** as of this version, Eyeling also avoids allocating short-lived substitution objects when matching goals against **facts** and when unifying a **backward-rule head** with the current goal. Instead of calling the pure `unifyTriple(..., subst)` (which clones the substitution on each variable bind), the prover performs an **in-place unification** directly into the mutable `substMut` store and records only the newly-bound variable names on the trail. This typically reduces GC pressure significantly on reachability / path-search workloads, where unification is executed extremely frequently.

So built-ins behave like relations that can generate zero, one, or many possible bindings. A list generator might yield many deltas; a numeric test yields zero or one.

#### 8.3.1 Builtin deferral and “vacuous” solutions

Conjunction in N3 is order-insensitive, but many builtins are only useful once some variables are bound by _other_ goals in the same body. When `proveGoals` is called from forward chaining, Eyeling enables **builtin deferral**: if a builtin goal cannot make progress yet, it is rotated to the end of the goal list and retried later (with a small cycle guard to avoid infinite rotation).

“Cannot make progress” includes both cases:

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

There is also a narrow fast path for some **single-premise** forward rules. When a rule has exactly one non-builtin premise and that premise cannot also be satisfied through backward rules, `forwardChain` can index the rule by that premise shape and fire it directly from newly added facts. This does **not** replace the general saturation loop; it is only an agenda-style shortcut for the safe one-premise case.

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

But it does something subtle and important: it caches skolemization per (rule firing, head blank label), so that the _same_ firing instance does not keep generating new blanks across outer iterations.

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

In practice this allows rule authors to write “do not run this scoped query until the closure is stable enough” and is what lets Eyeling iterate safely when rule-producing rules introduce new needs.

### 10.3 `log:conclusion`: local deductive closure of a formula

`log:conclusion` is handled in a particularly elegant way:

- given a formula `{ ... }` (a `GraphTerm`),
- Eyeling computes the deductive closure _inside that formula_:
  - extract rule triples inside it (`log:implies`, `log:impliedBy`)
  - run `forwardChain` locally over those triples

- cache the result in a `WeakMap` so the same formula does not get recomputed

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
2. **Blank nodes (`[]` / `_:`)** are frequently treated as “do not care” placeholders. Many builtins accept a blank node in an output position and simply succeed without binding.
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

If the types do not fit any supported case, the builtin fails.

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

Eyeling implements these as a shared pattern: if the subject is numeric, compute object; else if the object is numeric, compute subject via an inverse function; if both sides are unbound, succeed once (do not enumerate).

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

1. Eyeling memoizes “now” per reasoning run so that repeated uses in one run do not drift.
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

It does not enumerate arbitrary reversals; it is a deterministic transform once one side is known.

#### `list:remove`

**Shape:** `( (a b a c) a ) list:remove (b c)`

Removes all occurrences of an item from a list.

Important requirement: the item to remove must be **ground** (fully known) before the builtin will run.

#### `list:notMember` (test)

**Shape:** `(a b c) list:notMember x`

Succeeds iff the object cannot be unified with any element of the subject list. As a test, it typically works best once its inputs are bound; in forward rules Eyeling may defer it if it is reached before bindings are available.

#### `list:append`

This is list concatenation, but Eyeling implements it in a usefully relational way.

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

A useful detail: top-level rules in the parsed document are represented _as data_ inside the returned formula using `log:implies` / `log:impliedBy` triples between formula terms. This means you can treat “a document plus its rules” as a single first-class formula object.

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
   - Blank nodes inside the explicit scope graph are preserved as graph-local blanks; if a goal variable matches one, the binding is a blank node, not a lifted rule variable.

2. **Priority-gated global scope**: otherwise
   - Eyeling uses a _frozen snapshot_ of the current global closure.
   - The “priority” is read from the subject if it is a positive integer literal `N`.
   - If the closure level is below `N`, the builtin “delays” by failing at that point in the search.

This priority mechanism exists because Eyeling’s forward chaining runs in outer iterations with a “freeze snapshot then evaluate scoped builtins” phase. The goal is to make scoped meta-builtins stable and deterministic: they query a fixed snapshot rather than chasing a fact store that is being mutated mid-iteration.

Also supported:

- The object may be the literal `true`, meaning the empty formula, which is always included (subject to the priority gating above).

**Important blank-node note:** when the goal formula is used as a **pattern**, Eyeling treats blank nodes that are **local to that quoted formula** as existential placeholders during the proof.

So a pattern such as:

```n3
{ ?x :p [] }
```

means “find an `?x` that has some `:p` value”, not “find the specific blank node label printed here”.

But that existential behavior is intentionally limited:

- it applies only to blanks that are **owned by the quoted formula being proved**
- it does **not** rename or relax terms that were already supplied by an outer substitution
- it does **not** turn concrete members of already-bound lists or other already-ground structures into fresh variables

That last point is easy to miss. A builtin may receive a formula after part of it has already been instantiated from outer bindings. Those substituted-in terms are fixed data, not fresh existential placeholders. Keeping that boundary sharp prevents accidental overmatching and keeps numeric/list-oriented examples stable.

#### `log:notIncludes` (test)

Negation-as-failure version: it succeeds iff `log:includes` would yield no solutions (under the same scoping rules).

#### `log:collectAllIn`

**Shape:** `( ValueTemplate WhereFormula OutList ) log:collectAllIn Scope`

- Proves `WhereFormula` in the chosen scope.
- For each solution, applies it to `ValueTemplate` and collects the instantiated terms into a list.
- Unifies `OutList` with that list.
- If `OutList` is a blank node, Eyeling just checks satisfiable without binding/collecting.

As with `log:includes`, blank nodes that are local to `WhereFormula` behave as existential query placeholders while that formula is being proved. But blanks that came from already-bound outer data remain fixed.

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
- Some “fully unbound / do not-care” combinations succeed once to avoid infinite enumeration.

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

- When the final closure contains any `log:outputString` triples, the CLI collects all of them from the _saturated_ closure and renders those strings instead of the default N3 output.
- It sorts them deterministically by the subject “key” and concatenates the string values in that order.

This is a pure test/side-effect marker (it should not drive search; it should merely validate that strings exist once other reasoning has produced them). In forward rules Eyeling may defer it if it is reached before the terms are usable.

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

A small `printf`/`sprintf` subset:

- Supports `%%`, `%s`, `%d`/`%i`/`%u`, `%f`/`%F`, `%e`/`%E`, `%g`/`%G`, and `%c`.
- Supports width and precision, plus the `-` and `0` flags.
- Unsupported flags/specifiers cause the builtin to fail.
- Missing `%s` arguments are treated as empty strings.
- The format string `fmt` itself must be string-castable.
- Each `%s` argument may be any bound non-variable term:
  - string-castable terms (IRIs and literals) use their direct string value;
  - other bound terms (blank nodes, lists, quoted formulas, …) are rendered as N3.
- Numeric directives require numerically parseable literals.

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

The predicate `log:outputString` is the only officially supported “side-effect channel”, and even it is handled in two phases. If any final `log:outputString` facts exist, Eyeling renders them automatically as the CLI output:

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

In short: Eyeling makes `log:outputString` safe by refusing to treat it as an immediate effect. It is a _declarative output fact_ whose concrete rendering is a final, deterministic post-processing step. If any such facts are present in the final closure, Eyeling renders those strings automatically instead of printing the default N3 result set.

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

This is both a performance and a stability feature: repeated `log:semantics` calls in backward proofs will not keep refetching.

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

It is a “why this triple holds” explanation, not a globally exported proof graph.

Implementation note: the engine records lightweight `DerivedFact` objects during forward chaining, and `lib/explain.js` (via `makeExplain(...)`) is responsible for turning those objects into the human-readable proof comment blocks.

### 13.3 Streaming derived facts

The engine’s `reasonStream` API can accept an `onDerived` callback. Each time a new forward fact is derived, Eyeling can report it immediately.

This is especially useful in interactive demos (and is the basis of the playground streaming tab).

The same API can now also emit RDF/JS output. When `rdfjs: true` is passed, every `onDerived(...)` payload includes both:

- `triple` — Eyeling’s N3 string form
- `quad` — the same fact as an RDF/JS default-graph quad

If your closure may contain N3-only terms such as quoted formulas (`GraphTerm`), RDF/JS conversion can fail because those terms have no standard RDF/JS representation. In that case, pass `skipUnsupportedRdfJs: true` to keep the full N3 closure while silently omitting any derived triples that cannot be represented as RDF/JS quads. When this flag is enabled, `onDerived(...)` still fires for every derived fact, but `quad` is only present for the representable ones.

For fully stream-oriented RDF/JS consumers there is also `reasonRdfJs(...)`, which exposes the derived facts as an async iterable of RDF/JS quads. The same `skipUnsupportedRdfJs: true` flag applies there as well.

---

<a id="ch14"></a>

## Chapter 14 — Entry points: CLI, bundle exports, and npm API

Eyeling exposes itself in three layers.

### 14.1 Install and first run

Eyeling targets modern JavaScript runtimes. For the npm package and CLI workflow, use **Node.js 18 or newer**.

Install from npm:

```bash
npm i eyeling
```

Run a self-contained example from stdin:

```bash
echo '@prefix : <http://example.org/> .
:Socrates a :Man .
{ ?x a :Man } => { ?x a :Mortal } .' | npx eyeling
```

You can also pass one or more file paths/URLs, or `-` to read explicitly from stdin. When multiple inputs are given, Eyeling parses each source separately, merges the parsed ASTs, and then runs one reasoning pass over the combined facts and rules. This avoids constructing one giant N3 source string.

Show the available options:

```bash
npx eyeling --help
```

A few practical defaults are worth remembering:

- In normal mode, Eyeling prints **newly derived forward facts**.
- If the input contains top-level `log:query` directives, Eyeling prints the **query-selected conclusion triples** instead.
- If the final closure contains any `log:outputString` triples, Eyeling renders those strings instead of emitting the default N3 result set.

Custom builtins can be loaded explicitly from the CLI:

```bash
npx eyeling --builtin lib/builtin-sudoku.js examples/sudoku.n3
```

### 14.2 The bundled Node CLI/runtime (`eyeling.js`)

The bundle contains the whole engine. The CLI path is the “canonical behavior”:

- parse one or more input sources; with multiple sources, parse each source independently and merge the ASTs
- reason to closure
- print derived triples, or render `log:outputString` strings when present
- optional proof comments
- optional streaming

#### 14.2.1 CLI options at a glance

The current CLI supports a small set of flags (see `lib/cli.js`):

- `-a`, `--ast` — print the parsed AST as JSON and exit.
- `--builtin <module.js>` — load a custom builtin module (repeatable).
- `-d`, `--deterministic-skolem` — make `log:skolem` stable across runs.
- `-e`, `--enforce-https` — rewrite `http://…` to `https://…` for dereferencing builtins.
- `-p`, `--proof-comments` — include per-fact proof comment blocks in output.
- `-s`, `--super-restricted` — disable all builtins except `log:implies` / `log:impliedBy`.
- `-t`, `--stream` — stream derived triples as soon as they are derived.
- `-v`, `--version` — print version and exit.
- `-h`, `--help` — show usage.
- With no positional argument, Eyeling reads from stdin when input is piped.
- Use `-` as the input path to read explicitly from stdin.
- Multiple positional inputs are allowed, for example `eyeling facts.n3 rules.n3`; rules from any input can match facts from any other input after the merge.

### 14.3 Package entrypoint split for Node, browser, and CLI

The repo now publishes three distinct surfaces instead of forcing browser tooling through the Node-first bundle entry:

- `index.js` remains the **Node API** used by `require('eyeling')` and `import eyeling from 'eyeling'` in Node.
- `bin/eyeling.cjs` is the **CLI shim** with the shebang. It loads the Node bundle and calls `main()`.
- `dist/browser/eyeling.browser.js` is the **browser-safe bundle asset** with **no shebang**.
- `dist/browser/index.mjs` is the **browser import surface** exported as `eyeling/browser`.

That gives the intended mental model:

```js
import eyeling from 'eyeling'; // Node
import eyelingBrowser from 'eyeling/browser'; // Browser / worker
```

```bash
npx eyeling …                              # CLI
```

The `package.json` `exports` map points the `browser` condition at `dist/browser/index.mjs`, so browser-oriented bundlers stop resolving the package root to the Node wrapper in `index.js`.

`dist/browser/index.mjs` intentionally re-exports only the browser-safe surface:

- `reasonStream(...)`
- `reasonRdfJs(...)`
- `rdfjs`
- `registerBuiltin(...)`
- `unregisterBuiltin(...)`
- `registerBuiltinModule(...)`
- `listBuiltinIris()`

It deliberately does **not** expose `loadBuiltinModule(...)`, because loading builtin files by module specifier is a Node-only pattern. In browsers, custom builtins should be registered directly in-process (for example with `registerBuiltin(...)` or `registerBuiltinModule(...)`).

For browser apps, prefer running Eyeling in a **Web Worker** and importing `eyeling/browser` there.

### 14.3 `lib/entry.js`: bundler-friendly exports

`lib/entry.js` exports:

- public APIs: `reasonStream`, `reasonRdfJs`, `rdfjs`, `main`, `version`
- plus a curated set of internals used by the demo (`lex`, `Parser`, `forwardChain`, etc.)

`rdfjs` is a small built-in RDF/JS `DataFactory`, so browser / worker code can construct quads without pulling in another package first.

### 14.4 JavaScript API

Eyeling exposes two JavaScript entry styles:

- `reason(...)` from `index.js` when you want the same text output as the CLI
- `reasonStream(...)` / `reasonRdfJs(...)` from the Node bundle or `eyeling/browser` when you want in-process reasoning and structured RDF/JS results

#### 14.4.1 npm helper: `reason(...)`

The npm `reason(...)` function does something intentionally simple and robust:

- normalize the JavaScript input into N3 text
- write that N3 input to a temp file
- spawn the bundled CLI (`node eyeling.js ... input.n3`)
- return stdout (and forward stderr)

This keeps the observable output identical to the CLI while still allowing richer JS-side inputs.

CommonJS:

```js
const { reason } = require('eyeling');

const input = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix : <http://example.org/socrates#>.

:Socrates a :Human.
:Human rdfs:subClassOf :Mortal.

{ ?s a ?A. ?A rdfs:subClassOf ?B. } => { ?s a ?B. }.
`;

console.log(reason({ proofComments: false }, input));
```

ESM:

```js
import eyeling from 'eyeling';

const input = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix : <http://example.org/socrates#>.

:Socrates a :Human.
:Human rdfs:subClassOf :Mortal.

{ ?s a ?A. ?A rdfs:subClassOf ?B. } => { ?s a ?B. }.
`;

console.log(eyeling.reason({ proofComments: false }, input));
```

Notes:

- `reason()` returns the same textual output you would get from the CLI for the same input and options.
- By default, the npm helper keeps output machine-friendly (`proofComments: false`).
- Use this path when you want CLI-equivalent behavior inside JavaScript.

#### 14.4.2 RDF-JS and Eyeling rule-object interoperability

The JavaScript APIs accept four input styles:

1. plain N3 text
2. a multi-source N3 object (`{ sources: [...] }`)
3. RDF/JS fact input (`quads`, `facts`, or `dataset`)
4. Eyeling rule objects or full AST bundles

If you want to use one N3 source text, pass the whole input as a plain string. If you want to avoid concatenating several N3 sources into one large string, pass them as a source list instead.

For example:

```js
const { reason } = require('eyeling');

const out = reason(
  { proofComments: false },
  {
    sources: [
      '@prefix : <http://example.org/> .\n:Socrates a :Man .\n',
      '@prefix : <http://example.org/> .\n{ ?x a :Man } => { ?x a :Mortal } .\n',
    ],
  },
);

console.log(out);
```

In a source list, each source is parsed with its own blank-node scope and optional base IRI. That means the same explicit blank label, such as `_:x`, in two different sources does not accidentally become the same blank node after merging. Prefix declarations are merged mainly for readable output; IRI expansion has already happened while each source was parsed.

For RDF/JS facts, the graph must be the default graph. Named-graph quads are rejected.

If you already have rules in structured form, Eyeling rule objects can be passed directly in the API:

```js
const { reason, rdfjs } = require('eyeling');

const ex = 'http://example.org/';

const rule = {
  _type: 'Rule',
  premise: [
    {
      _type: 'Triple',
      s: { _type: 'Var', name: 'x' },
      p: { _type: 'Iri', value: ex + 'parent' },
      o: { _type: 'Var', name: 'y' },
    },
  ],
  conclusion: [
    {
      _type: 'Triple',
      s: { _type: 'Var', name: 'x' },
      p: { _type: 'Iri', value: ex + 'ancestor' },
      o: { _type: 'Var', name: 'y' },
    },
  ],
  isForward: true,
  isFuse: false,
  headBlankLabels: [],
};

const out = reason(
  { proofComments: false },
  {
    quads: [rdfjs.quad(rdfjs.namedNode(ex + 'alice'), rdfjs.namedNode(ex + 'parent'), rdfjs.namedNode(ex + 'bob'))],
    rules: [rule],
  },
);

console.log(out);
```

You can also pass a full AST bundle directly, for example `[prefixes, triples, forwardRules, backwardRules]`.

#### 14.4.3 In-process bundle API: `reasonStream(...)` and `reasonRdfJs(...)`

Use the bundle entry if you want structured results while the engine is running instead of final CLI text after the fact.

`reasonStream(...)` can emit RDF/JS quads while reasoning runs:

```js
import eyeling from './eyeling.js';

const result = eyeling.reasonStream(input, {
  proof: false,
  rdfjs: true,
  skipUnsupportedRdfJs: true,
  onDerived: ({ triple, quad }) => {
    if (quad) console.log(quad);
    else console.warn('Skipped non-RDF/JS derived triple:', triple);
  },
});
```

That same path also lets derived results be consumed as an async stream of RDF/JS quads:

```js
for await (const quad of eyeling.reasonRdfJs(input, {
  skipUnsupportedRdfJs: true,
})) {
  console.log(quad);
}
```

Use `skipUnsupportedRdfJs: true` when you want RDF/JS consumers to ignore derived triples that contain N3-only terms such as quoted formulas. This affects only RDF/JS export. The underlying Eyeling closure and `closureN3` output remain unchanged.

Use these entry points when you need one or more of the following:

- RDF/JS quads as fact input
- Eyeling rule objects passed directly from JavaScript
- derived results consumed as RDF/JS quads
- streaming derived RDF/JS quads during reasoning

### 14.5 Choosing the right entry point

A practical rule of thumb:

- if you want the same final text output as the CLI, use `reason(...)`
- if you want in-process access to structured facts, quads, or streaming derivations, use `reasonStream(...)` / `reasonRdfJs(...)`

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

That is the whole engine in miniature: unify, compose substitutions, emit head triples.

---

<a id="ch16"></a>

## Chapter 16 — Extending Eyeling (without breaking it)

Eyeling is small, which makes it pleasant to extend — but there are a few invariants worth respecting.

The most important update is architectural: **you no longer need to patch `lib/builtins.js` just to add a project-specific builtin**. The preferred path is now to load a custom builtin module, either programmatically or from the CLI. Core builtins still live in `lib/builtins.js`, but user extensions can stay outside the engine.

### 16.1 The preferred path: custom builtin modules

Eyeling now exposes a small custom-builtin registry.

At runtime, builtin predicates can be added with:

- `registerBuiltin(iri, handler)`
- `unregisterBuiltin(iri)`
- `registerBuiltinModule(moduleExport, origin?)`
- `loadBuiltinModule(specifier, { resolveFrom? })`
- `listBuiltinIris()`

That means the extension story is:

- keep the engine’s shipped builtins in `lib/builtins.js`
- keep your own application or domain builtins in a separate `.js` module
- load that module with `--builtin` or from JavaScript

This is the safest way to extend Eyeling because it avoids forking the builtin dispatcher and keeps upgrades merge-friendly.

### 16.2 CLI loading: `--builtin`

The CLI accepts a repeatable `--builtin <module.js>` option:

```bash
eyeling --builtin ./hello-builtin.js rules.n3
```

You can pass it more than once:

```bash
eyeling --builtin ./math-extra.js --builtin ./domain-rules.js input.n3
```

Each module is loaded before reasoning starts. Paths are resolved from the current working directory.

The same capability is available through the npm wrapper:

```js
const { reason } = require('eyeling');
const out = reason({ builtinModules: ['./hello-builtin.js'] }, n3Text);
```

### 16.2.1 Stability rule for `--builtin`

Eyeling keeps `--builtin` simple.

There is one small helper API passed into builtin modules. That helper object is frozen, its key set is regression-tested, and builtin modules must use one of the documented export forms.

In practice, this means:

- builtin module loading accepts only the documented export forms
- the helper API exposed by `__buildBuiltinRegistrationApi()` has a fixed key set
- builtin handlers should return an array of substitution objects
- accidental helper drift is caught by `test/builtins.test.js`

This is only meant to stop silent breakage. It is **not** a promise that Eyeling can never change the builtin API. If the helper surface ever needs to change, that change should be deliberate, documented, and called out in release notes.

### 16.3 What a builtin module may export

Eyeling accepts these stable module shapes.

#### A function export

```js
module.exports = ({ registerBuiltin, internLiteral, unifyTerm, terms }) => {
  const { Var } = terms;

  registerBuiltin('http://example.org/custom#hello', ({ goal, subst }) => {
    const lit = internLiteral('"world"');
    if (goal.o instanceof Var) {
      return [{ ...subst, [goal.o.name]: lit }];
    }
    const s2 = unifyTerm(goal.o, lit, subst);
    return s2 ? [s2] : [];
  });
};
```

#### An object with `register(api)`

```js
module.exports = {
  register(api) {
    api.registerBuiltin('http://example.org/custom#ping', ({ subst }) => [subst]);
  },
};
```

#### A plain object mapping predicate IRIs to handlers

```js
module.exports = {
  'http://example.org/custom#ok': ({ subst }) => [subst],
};
```

#### An object with `.builtins`

```js
module.exports = {
  builtins: {
    'http://example.org/custom#ok': ({ subst }) => [subst],
  },
};
```

#### An object with `.default` as a plain object map

This is mainly an ESM/transpiler compatibility form.

```js
module.exports = {
  default: {
    'http://example.org/custom#ok': ({ subst }) => [subst],
  },
};
```

If none of those shapes match, Eyeling rejects the module with a descriptive error.

### 16.4 The handler contract

Builtin handlers are called with a context object containing:

- `iri` — the predicate IRI string
- `goal` — the current triple goal
- `subst` — the current substitution
- `facts` — the active fact store
- `backRules` — the backward-rule set
- `depth` — current proof depth
- `varGen` — the variable generator state
- `maxResults` — current result cap
- `api` — the same registration/helper API used by modules

A handler should return an **array of substitution objects**:

- `[]` means failure / no solutions
- `[{}]` means success with no new bindings
- `[{ ...delta }]` means one successful continuation with bindings
- multiple objects mean a generator builtin

Returning something else is rejected at runtime.

In practice:

- Decide if your builtin is a test, a functional relation, or a generator.
- Return substitutions (or substitution deltas merged into the current substitution), not printed output.
- Be cautious with fully-unbound generators: they can explode the search space.
- If a builtin needs inputs to be bound first, it is fine to fail early and let forward-rule proving retry later in the conjunction.

Custom builtin failures are wrapped so the predicate IRI appears in the thrown error message, which makes debugging much easier from the CLI.

### 16.5 The helper API exposed to builtin modules

Builtin modules do not need to import internal engine files directly. Eyeling passes a helper API into module registration, and that helper surface is kept intentionally small.

The current helper function set is:

- `registerBuiltin`, `unregisterBuiltin`, `listBuiltinIris`
- `internIri`, `internLiteral`, `literalParts`
- `termToJsString`, `termToJsStringDecoded`, `termToN3`, `iriValue`
- `unifyTerm`, `applySubstTerm`, `applySubstTriple`, `proveGoals`, `isGroundTerm`
- `computeConclusionFromFormula`, `skolemIriFromGroundTerm`
- `parseBooleanLiteralInfo`, `parseNumericLiteralInfo`, `parseXsdDecimalToBigIntScale`, `pow10n`
- `normalizeLiteralForFastKey`, `literalsEquivalentAsXsdString`, `materializeRdfLists`

The stable namespace bags are:

- `terms`: `Literal`, `Iri`, `Var`, `Blank`, `ListTerm`, `OpenListTerm`, `GraphTerm`, `Triple`, `Rule`
- `ns`: `RDF_NS`, `XSD_NS`, `CRYPTO_NS`, `MATH_NS`, `TIME_NS`, `LIST_NS`, `LOG_NS`, `STRING_NS`

The helper object is frozen and regression-tested so helper additions, removals, and renames do not slip in silently.

That API keeps the extension boundary explicit: custom builtins get the operations they need without reaching into Eyeling’s private module graph.

### 16.6 A shipped example: the Sudoku builtin

The repository now ships a Sudoku builtin module (`lib/builtin-sudoku.js`) and a matching example program (`sudoku.n3`).

So this works out of the box:

```bash
eyeling sudoku.n3
```

That example is useful for two reasons:

- it shows a realistic domain-specific builtin implemented outside the core builtin switchboard
- it demonstrates the intended deployment model for larger custom relations: keep the N3 logic in the `.n3` file, and keep specialized search/verification code in a loadable builtin module

### 16.7 When you should still edit `lib/builtins.js`

Editing `lib/builtins.js` is still reasonable when you are:

- adding or fixing a **core** Eyeling builtin
- changing builtin behavior that should ship as part of Eyeling itself
- modifying the builtin helper API that custom modules depend on

But if the builtin is project-specific, experimental, or domain-bound, prefer a custom module first.

A small architectural note: `lib/builtins.js` is still initialized by the engine via `makeBuiltins(deps)`. It receives hooks (unification, proving, deref, scoped-closure helpers, …) instead of importing the engine directly, which keeps the module graph acyclic and makes browser bundling easier.

If your builtin needs a stable view of the scoped closure, follow the scoped-builtin pattern:

- read from `facts.__scopedSnapshot`
- honor `facts.__scopedClosureLevel` and priority gating

### 16.8 Adding new term shapes

If you add a new Term subclass, you’ll likely need to touch:

- printing (`termToN3`)
- unification and equality (`unifyTerm`, `termsEqual`, fast keys)
- variable collection for compaction (`gcCollectVarsInTerm`)
- groundness checks

### 16.9 Parser extensions

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

Usage:

```bash
eyeling [options] [file-or-url.n3|- ...]
```

Options:

```
  -a, --ast                    Print parsed AST as JSON and exit.
      --builtin <module.js>    Load a custom builtin module (repeatable).
  -d, --deterministic-skolem   Make log:skolem stable across reasoning runs.
  -e, --enforce-https          Rewrite http:// IRIs to https:// for log dereferencing builtins.
  -h, --help                   Show this help and exit.
  -p, --proof-comments         Enable proof explanations.
  -s, --super-restricted       Disable all builtins except => and <=.
  -t, --stream                 Stream derived triples as soon as they are derived.
  -v, --version                Print version and exit.
```

Input note: with multiple positional inputs, Eyeling reads and parses each source separately, then merges facts, forward rules, backward rules, and `log:query` directives before reasoning. Blank node labels are scoped per input document.

Note: when `log:query` directives are present, or when the program may produce `log:outputString` facts, Eyeling cannot stream its final user-facing output from partial derivations, so `--stream` has no effect in those cases. In the latter case Eyeling saturates first and then renders the collected output strings.

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

It also supports **custom builtin modules**.

- From the CLI: `eyeling --builtin ./my-builtins.js input.n3`
- From JavaScript: `reason({ builtinModules: ['./my-builtins.js'] }, input)`
- Programmatically in-process: `registerBuiltin(...)`, `registerBuiltinModule(...)`, `loadBuiltinModule(...)`

A concrete shipped example is the Sudoku builtin and the root-level `sudoku.n3` program:

```bash
eyeling sudoku.n3
```

References:

- W3C N3 Built-ins overview: [https://w3c.github.io/N3/reports/20230703/builtins.html](https://w3c.github.io/N3/reports/20230703/builtins.html)
- Eyeling implementation details: [Chapter 11 — Built-ins as a standard library](#ch11)
- Extension API and custom module loading: [Chapter 16 — Extending Eyeling (without breaking it)](#ch16)
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

## Appendix C — Why N3 fits the Eyeling examples

The Eyeling examples combine several things at once. They contain facts about a situation, rules that derive new facts, checks that make the result testable, and an answer that can be shown to a human. That combination matters. It means that Eyeling is not only a data exercise and not only a logic exercise. It needs a notation in which data and rules can remain together.

This raises a practical question: which language fits these examples best?

SQL is a natural candidate when the main task is storing data and querying it. Prolog is a natural candidate when the main task is writing rules and deriving consequences from facts. N3 is interesting because it tries to keep those two sides together. The point of this appendix is not to rank SQL, Prolog, and N3 in general. The point is to explain why N3 works especially well for Eyeling-style examples.

### What the examples need

A typical Eyeling example is not just a small dataset. It is also not just a set of inference rules. It is a compact artifact in which several layers belong together.

There is usually a description of a situation: products, airports, organisms, policies, signatures, dates, or other entities. There are rules that derive new facts from those inputs. There are explicit checks that say whether the intended conclusions hold. And there is often a final answer or explanation that is part of the example itself.

This is the real design problem. If the language handles only one of these layers well, then the example has to be split up. The data ends up in one notation, the rules in another, the checks somewhere else, and the final answer in yet another place. Once that happens, the example becomes harder to read and harder to maintain.

### What SQL contributes

SQL is strong when the main task is structured data and queries over that data. It is excellent for tables, filtering, aggregation, joins, and efficient execution. When an Eyeling example is translated into DuckDB, SQL can do a surprising amount. Recursive queries can express route search. Views can express derived facts. Checks can be written as boolean queries. Output can be assembled from query results.

That is useful, and it shows that the examples can be operationalized in a relational setting.

However, SQL is not the original shape of these examples. To get there, the graph-like source has to be mapped into tables, and the rule logic has to be reconstructed with joins, common table expressions, macros, and views. The result can work well, but the conceptual structure becomes more indirect. Data and reasoning are still connected, but they are no longer expressed in the same native form.

In other words, SQL is a good execution target, but it is not always the clearest authoring language for this kind of material.

### What Prolog contributes

Prolog is strong when the main task is expressing facts and rules directly. An Eyeling example often looks much closer to Prolog than to SQL once the focus shifts to derivation. Facts become predicates. Rules become clauses. Recursive reasoning becomes natural. This makes Prolog a very good target when the aim is to express the logical behavior of an example clearly.

That is why Prolog translations of Eyeling examples often feel much cleaner than SQL translations. The rule layer fits naturally.

However, Prolog is not primarily a graph data notation. Eyeling examples often use a linked-data style in which named entities and relations remain visible as part of the knowledge representation. In Prolog this can certainly be modeled, but it is usually represented as application-specific predicates rather than as a graph-native notation. That means the rule side is natural, while the original data style becomes less central.

So Prolog captures the inference well, but it does not preserve the same linked-data feel as naturally as N3 does.

### Why N3 fits these examples well

N3 fits Eyeling well because it keeps the data model and the rule model close together.

The facts remain graph-shaped. Entities and relations can be written directly. Rules can be added in the same notation. Checks can be expressed next to the derivations they depend on. Even the final answer can remain part of the same artifact. This allows an example to stay compact from beginning to end.

That compactness is important. It means the reader can inspect one example and see the situation, the derivation, the checks, and the answer without mentally switching between several different layers of representation.

This is the main reason N3 feels like a sweet spot in Eyeling. Compared with SQL, it avoids the split between graph-shaped knowledge and relational encoding. Compared with Prolog, it avoids the split between logic programming and linked-data representation. It keeps both sides close enough that the whole example can stay in one place.

### Where this matters in practice

This matters most in examples where the structure of the knowledge is part of the point.

In the path-discovery example, the facts describe airports and routes, and the rule describes how a connection can be found through a bounded number of stopovers. In SQL, this becomes a recursive query over tables. In Prolog, it becomes a recursive predicate over facts. In N3, the graph and the rule remain in one notation.

In the barley-seed-becoming example, the facts describe stages, transitions, and constraints, and the rules determine what can and cannot become something else. In SQL and Prolog, this can be translated, but N3 preserves the original structure more directly.

In the delfour example, the same pattern becomes even clearer. The example combines facts about products and household needs, rules about authorization and recommendation, checks over the derived conclusions, and a final human-readable answer. That kind of example is exactly where a language that keeps data, rules, checks, and answers together becomes valuable.

### Conclusion

N3 is not the best language for every task. SQL is stronger as a database query language. Prolog is stronger as a pure rule language. But the Eyeling examples are not only database exercises and not only rule exercises.

They are compact knowledge artifacts in which facts, rules, checks, and answers belong together.

That is why N3 fits them so well. It is not because N3 wins an abstract language competition. It is because these examples need a form in which data and reasoning can remain unified. For Eyeling, that is exactly what N3 provides.

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

If you do not want “stop the world”, derive a `:Violation` fact instead, and keep going.

### 3) Make the workflow test-driven (golden closures)

The most robust way to keep LLM-generated logic plausible is to make it live under tests:

- Keep tiny **fixtures** (facts) alongside the rules.
- Run Eyeling to produce the **derived closure** (Eyeling emits only newly derived forward facts by default, can optionally include compact proof comments, and can also use `log:query` directives to project a specific result set).
- Compare against an expected output (“golden file”) in CI.

This turns rule edits into a normal change-management loop: diffs are explicit, reviewable, and reproducible.

### 4) Use proofs/traces as the input to the LLM, not the other way around

If you want a natural-language explanation, do not ask the model to “explain the rules from memory”. Instead:

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

The point is not that the LLM is “right”; it is that **Eyeling makes the result checkable**, and the artifact becomes a maintainable program rather than a one-off generation.

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

---

<a id="app-f"></a>

## Appendix F — The ARC approach: Answer • Reason Why • Check

A simple way to write a good Eyeling program is to make it do three things in one file:

> give the answer, say why, and check that it really holds.

That is the ARC approach: **Answer • Reason Why • Check**.

The idea is not to make the program more grand or formal. It is to make it more useful. A bare result is often not enough. A reader also wants to see the small reason that matters, and to know that the program will fail loudly if an important assumption is wrong.

In Eyeling this style comes quite naturally. Facts hold the data. Rules derive the conclusion. `log:outputString` can turn the conclusion into readable output. And a rule that concludes `false` acts as a fuse: if a bad condition becomes provable, the run stops instead of quietly producing a misleading result.

### F.1 What the three parts mean

The **Answer** is the direct result. It should be short and easy to recognize. In many Eyeling files it is a final recommendation, a route, a computed value, a decision such as `allowed` or `blocked`, or a small report line emitted with `log:outputString`.

The **Reason Why** is the compact explanation. It is not hidden chain-of-thought and it does not need to be long. Usually it is just the witness, threshold, policy, path, or intermediate fact that made the answer follow. A good reason tells the reader what mattered.

The **Check** is the part that keeps the program honest. It should do more than repeat the answer in different words. A good check tests something that could really fail: a structural invariant, a recomputed quantity, a boundary condition, or a rule that derives `false` when the answer would be inconsistent with the inputs.

A short way to remember ARC is this:

> an answer tells you **what** happened, a reason tells you **why**, and a check tells you **whether you should trust it**.

### F.2 Why this fits Eyeling well

ARC is not an extra subsystem in Eyeling. It is mostly a good habit.

Eyeling already separates data from logic. It already lets you derive readable output instead of printing ad hoc text during proof search. And it already has a very strong notion of validation through inference fuses. So ARC is really just a clean way to organize an ordinary Eyeling file so that a human reader can see the result, the explanation, and the safety net together.

This is especially useful for examples. A newcomer can run the file and see what it does. A maintainer can inspect the few rules that justify the result. And an external developer can tell whether the example merely prints something nice or actually checks itself.

### F.3 A simple pattern to follow

A practical ARC-style Eyeling file often has four visible layers.

First come the **facts**: the input data, parameters, thresholds, policies, or known relationships. Then comes the **logic**: the rules that derive the internal conclusion. Then comes the **presentation**: rules that turn the result into `log:outputString` lines or other report facts. Finally come the **checks**: rules that validate the result or trigger `false` when an invariant is broken.

You do not have to separate these layers perfectly, but it helps a lot when the file reads in roughly that order.

### F.4 A tiny template

```n3
@prefix : <http://example.org/> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix math: <http://www.w3.org/2000/10/swap/math#> .

# Facts
:case :input 42 .

# Logic
{ :case :input ?n . ?n math:greaterThan 10 . }
    => { :case :decision "allowed" . } .

# Answer
{ :case :decision ?d . }
    => { :answer log:outputString "Answer\n" .
         :answer log:outputString ?d . } .

# Reason Why
{ :case :input ?n . :case :decision ?d . }
    => { :why log:outputString "\nReason Why\n" .
         :why log:outputString "Input satisfied the rule threshold.\n" . } .

# Check
{ :case :decision "allowed" .
  :case :input ?n .
  ?n math:notGreaterThan 10 . }
    => false .
```

The exact wording can vary. The important thing is the shape: derive the result, make the key reason visible, and include at least one check that could fail for a real reason.

### F.5 What a good check looks like

A good check is not a decorative `:ok true` line. It should add real confidence.

Sometimes that means recomputing a quantity from another angle. Sometimes it means checking a witness path instead of only the summary result. Sometimes it means making sure a threshold really was crossed, or that a list or graph has the shape the rest of the program assumes. And sometimes the right check is simply an inference fuse that says: if this contradiction appears, stop.

The point is not to make checks large. The point is to make them real.

### F.6 ARC and the Insight Economy

One reason ARC matters beyond pedagogy is that it matches a broader way of thinking about data and computation that Ruben Verborgh has called the **Insight Economy**.

The basic claim is simple: raw data is usually the wrong thing to exchange directly. A better system refines source data into a **specific, purpose-limited, time-bound insight** that is useful in one context, loses much of its value when copied without that context, and can be governed more safely than an unrestricted dump of the original data.

That fits Eyeling remarkably well. Eyeling can derive narrow conclusions explicitly, show why they follow, and attach checks that make sure a decision still respects policy, scope, thresholds, or consistency constraints. In other words, an Eyeling program can act as a small governed insight refinery rather than as a black box that merely emits a verdict.

This is also why ARC is a good mental model here. The **Answer** is the bounded insight. The **Reason Why** makes the governing basis visible. The **Check** ensures the result can be trusted for the stated purpose instead of silently drifting beyond it.

### F.7 ARC-style examples in `examples/`

The following examples are especially useful if you want to see Eyeling files that derive an answer, expose the key reason, and include meaningful checks. Each entry links to both the source example and the corresponding generated output file in `examples/output/`.

#### Insight Economy and governed-data cases

- [`examples/auroracare.n3`](examples/auroracare.n3) · [`examples/output/auroracare.txt`](examples/output/auroracare.txt) — purpose-based medical data exchange with explicit allow/deny reasoning and checks around role, purpose, and conditions.
- [`examples/calidor.n3`](examples/calidor.n3) · [`examples/output/calidor.txt`](examples/output/calidor.txt) — heatwave-response case where private household signals become a narrow, expiring cooling-support insight.
- [`examples/delfour.n3`](examples/delfour.n3) · [`examples/output/delfour.txt`](examples/output/delfour.txt) — shopping-assistance case where a private condition becomes a bounded “prefer lower-sugar products” insight.
- [`examples/flandor.n3`](examples/flandor.n3) · [`examples/output/flandor.txt`](examples/output/flandor.txt) — macro-economic coordination case for Flanders that turns sensitive local signals into a regional retooling insight.
- [`examples/medior.n3`](examples/medior.n3) · [`examples/output/medior.txt`](examples/output/medior.txt) — post-discharge care-coordination case that derives a minimal continuity-bundle insight without sharing the full record.
- [`examples/parcellocker.n3`](examples/parcellocker.n3) · [`examples/output/parcellocker.txt`](examples/output/parcellocker.txt) — one-time parcel pickup authorization with a clear permit decision, justification, and misuse checks.
- [`examples/harborsmr.n3`](examples/harborsmr.n3) · [`examples/output/harborsmr.txt`](examples/output/harborsmr.txt) — SMR flexibility case where private plant telemetry becomes a narrow, expiring electrolysis-dispatch insight with policy and safety checks.

- [`examples/transistor-switch.n3`](examples/transistor-switch.n3) · [`examples/output/transistor-switch.txt`](examples/output/transistor-switch.txt) — NPN low-side switch model with exact arithmetic and cutoff-versus-saturation checks.

#### Core ARC-style walkthroughs

- [`examples/bmi.n3`](examples/bmi.n3) · [`examples/output/bmi.txt`](examples/output/bmi.txt) — Body Mass Index calculation with normalization, WHO category assignment, and boundary checks.
- [`examples/control-system.n3`](examples/control-system.n3) · [`examples/output/control-system.txt`](examples/output/control-system.txt) — small control-system example that derives actuator commands and explains feedforward and feedback contributions.
- [`examples/easter.n3`](examples/easter.n3) · [`examples/output/easter.txt`](examples/output/easter.txt) — Gregorian Easter computus with a readable explanation and date-window checks.
- [`examples/french-cities.n3`](examples/french-cities.n3) · [`examples/output/french-cities.txt`](examples/output/french-cities.txt) — graph reachability over French cities with explicit path reasoning.
- [`examples/gps.n3`](examples/gps.n3) · [`examples/output/gps.txt`](examples/output/gps.txt) — tiny route-planning example for western Belgium with route comparison and metric checks.
- [`examples/resto.n3`](examples/resto.n3) · [`examples/output/resto.txt`](examples/output/resto.txt) — RESTdesc-style service composition from person and date to a concrete restaurant reservation.
- [`examples/sudoku.n3`](examples/sudoku.n3) · [`examples/output/sudoku.txt`](examples/output/sudoku.txt) — Sudoku solver and report generator with consistency checks over the solved grid.
- [`examples/wind-turbine.n3`](examples/wind-turbine.n3) · [`examples/output/wind-turbine.txt`](examples/output/wind-turbine.txt) — predictive-maintenance example that turns sensor readings into an auditable inspection decision.

#### Technical and scientific ARC demos

- [`examples/fundamental-theorem-arithmetic.n3`](examples/fundamental-theorem-arithmetic.n3) · [`examples/output/fundamental-theorem-arithmetic.txt`](examples/output/fundamental-theorem-arithmetic.txt) — smallest-divisor prime factorization of 202692987 with ARC-style existence, uniqueness-up-to-order, and primality checks.
- [`examples/complex-matrix-stability.n3`](examples/complex-matrix-stability.n3) · [`examples/output/complex-matrix-stability.txt`](examples/output/complex-matrix-stability.txt) — discrete-time stability classification for three diagonal complex 2×2 matrices via spectral radius and ARC-style checks.
- [`examples/matrix-mechanics.n3`](examples/matrix-mechanics.n3) · [`examples/output/matrix-mechanics.txt`](examples/output/matrix-mechanics.txt) — small 2×2 matrix example deriving trace, determinant, products, and a non-zero commutator.
- [`examples/pn-junction-tunneling.n3`](examples/pn-junction-tunneling.n3) · [`examples/output/pn-junction-tunneling.txt`](examples/output/pn-junction-tunneling.txt) — semiconductor toy model that explains current-proxy behavior across bias points.
- [`examples/transistor-switch.n3`](examples/transistor-switch.n3) · [`examples/output/transistor-switch.txt`](examples/output/transistor-switch.txt) — NPN low-side switch model with exact arithmetic and cutoff-versus-saturation checks.

#### Applied Constructor-Theory ARC examples

- [`examples/act-alarm-bit-interoperability.n3`](examples/act-alarm-bit-interoperability.n3) · [`examples/output/act-alarm-bit-interoperability.txt`](examples/output/act-alarm-bit-interoperability.txt) — applied constructor-theory information example showing interoperability of an alarm bit across unlike media together with a no-cloning contrast for a quantum token.
- [`examples/act-docking-abort.n3`](examples/act-docking-abort.n3) · [`examples/output/act-docking-abort.txt`](examples/output/act-docking-abort.txt) — applied constructor-theory ARC case for a spacecraft docking-abort token covering permutation, copying, measurement, serial and parallel composition, and the impossibility of cloning a quantum seal.
- [`examples/act-isolation-breach.n3`](examples/act-isolation-breach.n3) · [`examples/output/act-isolation-breach.txt`](examples/output/act-isolation-breach.txt) — applied constructor-theory ARC case for a biosafety isolation-breach token covering preparation, distinguishability, reversible permutation, copying, measurement, composition, and no-cloning.
- [`examples/act-gravity-mediator-witness.n3`](examples/act-gravity-mediator-witness.n3) · [`examples/output/act-gravity-mediator-witness.txt`](examples/output/act-gravity-mediator-witness.txt) — applied constructor-theory witness showing that, under locality and interoperability, entanglement mediated only by gravity implies a non-classical gravitational mediator.
- ['examples/act-yeast-self-reproduction.n3'](examples/act-yeast-self-reproduction.n3) · ['examples/output/act-yeast-self-reproduction.txt'](examples/output/act-yeast-self-reproduction.txt) — applied constructor-theory example of a yeast starter culture showing replicator, vehicle, self-reproduction, heritable variation, and natural selection under no-design laws.
- ['examples/act-barley-seed-lineage.n3'](examples/act-barley-seed-lineage.n3) · ['examples/output/act-barley-seed-lineage.txt'](examples/output/act-barley-seed-lineage.txt) — applied constructor-theory ARC case showing both possible and impossible lineage tasks under no-design laws, including blocked reproduction, dormancy, and evolvability when key ingredients are missing.
- ['examples/act-tunnel-junction-wake-switch.n3'](examples/act-tunnel-junction-wake-switch.n3) · ['examples/output/act-tunnel-junction-wake-switch.txt'](examples/output/act-tunnel-junction-wake-switch.txt) — applied constructor-theory ARC case comparing a tunnel-junction wake switch with a conventional PN junction via explicit can/cannot rules for tunneling, sub-threshold current, negative differential response, and low-bias switching.
- ['examples/act-photosynthetic-exciton-transfer.n3'](examples/act-photosynthetic-exciton-transfer.n3) · ['examples/output/act-photosynthetic-exciton-transfer.txt'](examples/output/act-photosynthetic-exciton-transfer.txt) — applied constructor-theory ARC case for quantum-assisted exciton transfer in a photosynthetic antenna, contrasting a tuned complex with a detuned one via explicit can/cannot rules.
- ['examples/act-sensor-memory-reset.n3'](examples/act-sensor-memory-reset.n3) · ['examples/output/act-sensor-memory-reset.txt'](examples/output/act-sensor-memory-reset.txt) — applied constructor-theory ARC case showing that a sensor memory reset is possible with a work medium but not with heat alone, highlighting work/heat distinction and irreversibility.

#### Deep-classification stress tests

- [`examples/deep-taxonomy-10.n3`](examples/deep-taxonomy-10.n3) · [`examples/output/deep-taxonomy-10.txt`](examples/output/deep-taxonomy-10.txt) — ARC-style deep-taxonomy benchmark at depth 10.
- [`examples/deep-taxonomy-100.n3`](examples/deep-taxonomy-100.n3) · [`examples/output/deep-taxonomy-100.txt`](examples/output/deep-taxonomy-100.txt) — ARC-style deep-taxonomy benchmark at depth 100.
- [`examples/deep-taxonomy-1000.n3`](examples/deep-taxonomy-1000.n3) · [`examples/output/deep-taxonomy-1000.txt`](examples/output/deep-taxonomy-1000.txt) — ARC-style deep-taxonomy benchmark at depth 1000.
- [`examples/deep-taxonomy-10000.n3`](examples/deep-taxonomy-10000.n3) · [`examples/output/deep-taxonomy-10000.txt`](examples/output/deep-taxonomy-10000.txt) — ARC-style deep-taxonomy benchmark at depth 10000.
- [`examples/deep-taxonomy-100000.n3`](examples/deep-taxonomy-100000.n3) · [`examples/output/deep-taxonomy-100000.txt`](examples/output/deep-taxonomy-100000.txt) — ARC-style deep-taxonomy benchmark at depth 100000.

These files fit together because they all present reasoning in a recognizably ARC-like way: they derive an answer, make the reason visible in a compact report, and include checks that are meant to catch real mistakes. Some are classical logic or numeric examples; others show how Eyeling can express policy-aware, insight-oriented decision flows without collapsing everything into opaque application code.

### F.8 How to read an ARC-style example

A good way to read one of these files is to start with the question in the comments or input facts. Then find the part that gives the answer. Then trace the few rules that explain why that answer follows. Finally, look for the checks: the validation facts, the recomputation, or the `=> false` fuse that would stop the run if something important were wrong.

That reading order keeps the example grounded in observable behavior rather than in source code alone.

### F.9 What ARC is not

ARC does not mean wrapping every file in ceremony. It does not mean long prose explanations. It does not mean hiding important assumptions in comments while the executable part stays thin. And it does not mean replacing checks with a confident tone.

A file really follows ARC only when the answer, the explanation, and the validation all live in the program itself.

### F.10 Why this style is worth using

This style is worth using because it makes an Eyeling file easier to run, easier to inspect, and easier to trust. The result is visible. The key reason is visible. The check is visible. That makes examples better teaching material, makes policy or computation examples easier to audit, and makes the whole file more reusable as a small reasoning artifact instead of an opaque session transcript.

<a id="app-g"></a>

## Appendix G — Eyeling and the W3C CG Notation3 Semantics

The purpose of this appendix is to say where Eyeling tracks the [W3C CG Notation3 semantics](https://w3c.github.io/N3/spec/semantics) closely, and where Eyeling makes deliberate operational choices of its own.

The comparison point here is the W3C CG Notation3 semantics document, not a claim that Eyeling is trying to be a line-by-line implementation of that document. Eyeling is a working reasoner, so some choices are shaped by execution, indexing, determinism, and the practical habits of N3 authors.

### G.1 Where Eyeling is strongly aligned

- **Core term model (IRIs, literals, variables, blank nodes, lists, quoted formulas):** The semantics document treats N3 terms as IRIs, literals, variables, lists, and graph terms. Eyeling’s internal model matches that shape directly through `Iri`, `Literal`, `Var`, `Blank`, `ListTerm`, and `GraphTerm`.

- **Quoted formulas need alpha-equivalence / isomorphism:** The semantics document defines isomorphism for graphs and graph terms using consistent renaming. Eyeling implements the same practical idea operationally as alpha-equivalence for `GraphTerm`, with consistent renaming as the criterion for a match.

- **Rules as implication (and `true` as empty formula):** The semantics document gives a special role to `log:implies` and treats `true` and `false` specially, with `true` corresponding to the empty formula. Eyeling follows that shape: it accepts both `{ P } => { C }` and `{ P } log:implies { C }`, and it treats `true` as `{}`.

- **Lists as first-class citizens (not just RDF collections):** The semantics document treats lists as genuine N3 terms. Eyeling does the same through `ListTerm`, and also materializes RDF `rdf:first` / `rdf:rest` chains into list terms so one list model can be used throughout the engine.

### G.2 Where Eyeling diverges or goes beyond the semantics document

#### G.2.1 Blank nodes in rule bodies: Eyeling chooses common N3 rule-writing practice

The semantics document describes blank nodes as existentially quantified with local scope. Eyeling intentionally rewrites blank nodes in **rule premises** into variables during normalization. In practice this makes body blanks behave like the placeholders many N3 authors expect when they write rules.

That is a real semantic choice. It is useful and intentional, but it is not the same as reading blank nodes as existentials everywhere.

#### G.2.2 Groundness of quoted formulas containing variables

In the semantics document, whether a graph term is ground depends on whether the underlying graph is closed, and nested formulas can still contain free variables when viewed in isolation. Eyeling makes a pragmatic engine choice: variables inside a `GraphTerm` do not make the surrounding triple non-ground. In the handbook this is summarized as “variables inside formulas do not leak.”

That supports indexing, matching, and duplicate checks, but it is not a one-to-one restatement of model-theoretic groundness for graph terms.

#### G.2.3 Eyeling defines operational behavior beyond what the semantics document currently fixes

The semantics document mainly fixes meaning around implication and the core N3 term/formula model. Eyeling goes further and gives operational meaning to a large standard library of builtins and control features. Examples include `math:*`, `string:*`, `list:*`, `time:*`, `log:includes`, `log:notIncludes`, `log:query`, and scoped closure via `log:conclusion`.

So Eyeling is not only implementing the semantics document; it is also defining engine behavior for features that the current document does not fully specify.

#### G.2.4 Inference fuses (`=> false`) are an engine-level procedural feature

The semantics document discusses `false` in relation to implication and constraints. Eyeling turns `{ ... } => false` into an engine-level hard failure with a visible message and failing exit status. That is a practical tooling feature: it lets a rule act like a checked invariant.

This is very useful in real programs, but it is an operational behavior of the reasoner, not something a model-theoretic semantics “executes.”

#### G.2.5 Surface-language coverage is not the same thing as semantic alignment

The semantics document discusses explicit quantification in its abstract syntax. Eyeling mostly exposes implicit quantification through `?x` variables and blank nodes, together with the rule-normalization choices described earlier. The handbook documents the supported surface forms Eyeling actually parses, which may be narrower than the full abstract surface discussed in the semantics document.

So even where the underlying ideas line up, the accepted concrete syntax may still be a proper subset.

### G.3 The practical takeaway

A good short summary is this:

- Eyeling is strongly aligned with the N3 semantics on the **core ontology of terms, quoted formulas, implication, and lists**.
- Eyeling makes deliberate, implementation-shaped choices around **rule-body blanks, groundness of quoted formulas, and constraint execution**.
- Eyeling also defines a wider operational language than the current semantics document, especially through builtins and scoped proof/query features.

So the handbook and the semantics document are best read as complementary. The semantics document explains the abstract shape of Notation3. The handbook explains how a compact working reasoner realizes that shape, and where it chooses a practical execution model over a purely model-theoretic presentation.

<a id="app-h"></a>

## Appendix H — Applied Constructor-Theory and the N3 ARC examples

This appendix explains the idea behind the **Applied Constructor-Theory** examples collected in the `examples/act-*` files.

The short version is:

> Appendix F explains the **presentation style** of ARC.  
> This appendix explains the **scientific style** of the ACT examples.

In this handbook, **ACT** is used as a practical label for examples that take constructor-theoretic ideas and turn them into concrete, runnable N3 programs. The label is local to this handbook: it is a convenient way to group examples that are about constructor theory in action, not a claim that there is one official file format or one officially standardized subfield called “ACT”.

### H.1 What constructor theory is trying to do

Constructor theory is a proposal for formulating physics in terms of **which transformations are possible, which are impossible, and why**, rather than only in terms of trajectories and initial conditions.

That shift matters because many scientifically important statements already have that shape:

- information can be copied from one medium to another
- an accurate self-reproducer can exist under no-design laws
- a work medium can reset a memory in a way that heat alone cannot
- a mediator that can entangle two quantum systems cannot be purely classical

Those are not merely predictions of one trajectory. They are statements about a space of **allowed and forbidden tasks**. Constructor theory is designed to make such statements fundamental rather than secondary.

### H.2 Why this matters for applied examples

The constructor-theory programme is often presented through applications and research themes rather than as a closed symbolic calculus. In practice, that makes it a good fit for example-driven reasoning in Eyeling.

An Eyeling ACT example does not try to reproduce the full mathematical machinery of a physics paper. Instead, it extracts the **task structure** of the claim:

- what is being attempted
- which resources or media are available
- which structural conditions make the task possible
- which missing conditions make the task impossible
- what small set of checks would make the conclusion auditable

That is exactly the kind of thing N3 rules are good at expressing.

### H.3 Why N3 fits constructor-theoretic reasoning unusually well

Notation3 is a good match for constructor-theoretic examples for four reasons.

First, N3 rules are naturally relational. They can say:

```n3
{ ?system :has ?property . } => { ?system :can ?task . } .
```

and just as naturally:

```n3
{ ?system :lacks ?property . } => { ?system :cannot ?task . } .
```

That is already close to the “science of can and cannot” idiom.

Second, N3 can keep the explanation close to the answer. The conditions, the derived `:can` / `:cannot` facts, and the final human-readable report can all live in one file.

Third, Eyeling supports `log:outputString`, so the result can be rendered as a compact ARC report rather than as a raw closure dump.

Fourth, Eyeling supports rule-based checks and hard fuses (`=> false`), so the example can state not only the claim but also what would count as a contradiction of the claim.

That combination makes N3 a strong medium for **pedagogical applied constructor theory**: it is executable, inspectable, and naturally counterfactual.

### H.4 What these ACT examples are — and what they are not

These examples are **not** microscopic simulations.

They do not solve Schrödinger equations, semiconductor transport equations, or full biochemical kinetics. They are closer to **task-logic models**. They capture the counterfactual structure of a scientific claim:

- if these conditions hold, then this task is possible
- if these conditions are absent, then that task is impossible
- if the task is possible, what larger conclusion follows
- if the task is impossible, what stronger claim is ruled out

That is why an ACT example often looks more like a carefully structured scientific argument than like a numerical simulator.

This is a feature, not a bug. The point is to model the **explanatory logic** of the claim in constructor-theoretic form.

### H.5 The recurring shape of an ACT file in Eyeling

Most of the ACT files in this repository follow the same skeleton.

#### H.5.1 A concrete scenario

Each file starts with a scenario that is tangible enough to picture:

- an alarm bit crossing unlike media
- a docking abort token
- a biosafety isolation-breach signal
- a gravitational mediator witness
- a yeast or barley lineage
- a tunnel-junction wake switch
- a photosynthetic transfer complex
- a sensor memory that must be reset

The point of the scenario is to stop constructor theory from floating away into abstract slogans.

#### H.5.2 Positive rules: what the system can do

The positive rules derive facts such as:

- `:can :Copy`
- `:can :Measure`
- `:can :AccurateSelfReproduction`
- `:can :EfficientExcitonTransfer`
- `:can :ReliableResetFromWork`

These are the constructor-theoretic heart of the file. They say which tasks become possible when the right structural conditions are present.

#### H.5.3 Negative rules: what the system cannot do

The negative rules derive facts such as:

- `:cannot :CloneAllStates`
- `:cannot :AccurateSelfReproduction`
- `:cannot :AdaptivePersistence`
- `:cannot :ServeLeakAlarmWakeCircuit`
- `:cannot :ReadyForReuseFromHeatAlone`

These rules matter just as much as the positive ones. A constructor-theoretic explanation is incomplete if it says only what works and never says what is ruled out.

In practice, the negative rules often provide the sharpest insight in the file.

#### H.5.4 An ARC report

The final rule usually emits a `log:outputString` report with three parts:

- **Answer**
- **Reason Why**
- **Check**

That is the Appendix F layer. ARC gives the file a readable surface. Constructor theory gives it the inner scientific logic.

#### H.5.5 Comments that explain the scientific role of each rule block

The better ACT examples are heavily commented. The comments should say not just what the syntax is doing, but what scientific role the block plays:

#### H.5.6 Editorial conventions for ACT files

For this repository, the ACT examples should stay visibly **Eyeling-native**. They should read as compact N3 task-logic models rather than as a second language layer.

A good default order is:

1. scenario facts;
2. positive `:can` rules;
3. negative `:cannot` rules;
4. checks;
5. the final ARC report.

The ARC report should make the decisive contrast explicit: what task is possible, what task is impossible, and which missing ingredient or witness explains the contrast.

- interoperability
- locality
- no-cloning
- replicator–vehicle logic
- work versus heat
- irreversibility
- short-lived quantum assistance
- blocked lineage closure

That is important because these examples are meant to teach a way of thinking, not only to demonstrate parser coverage.

### H.6 The main constructor-theory themes represented in the examples

The current ACT examples are listed in Appendix F’s example catalog. This appendix is the conceptual companion to that list.

Here are the main themes those files illustrate.

#### H.6.1 Information as a task-level notion

The alarm-bit, docking-abort, and isolation-breach examples treat information as something that can be copied, permuted, measured, and moved between unlike media.

#### H.6.2 Life as accurate self-reproduction under no-design laws

The yeast and barley files follow the constructor-theory-of-life pattern: replication, self-reproduction, and natural selection are treated as tasks that can be possible under no-design laws when the right structural conditions are present.

These examples are especially good for N3 because the logic is already rule-shaped:

- digital heredity enables accurate copying
- vehicle structure enables construction and repair
- variation plus selection enables adaptive persistence
- missing ingredients block those tasks

#### H.6.3 Thermodynamics as possible and impossible tasks

The sensor-memory-reset example is a compact way to express constructor-theoretic thermodynamics: a work-like resource can drive a reliable reset task that heat alone cannot, and an irreversible degradation path need not have the exact reverse available.

#### H.6.4 Non-classicality witnesses in hybrid systems

The gravity-mediator example shows how a constructor-theoretic application can be expressed as a chain of constraints: if locality and interoperability hold, and a mediator can entangle two quantum systems, then that mediator cannot be purely classical.

That kind of claim is perfect for N3 because it is already naturally expressed as a chain of conditions and consequences rather than as a trajectory simulation.

#### H.6.5 Quantum effects in practical settings

The tunnel-junction and photosynthetic-transfer files show how ACT examples can model quantum effects without pretending to be full microscopic calculations. They capture the counterfactual claim that certain structural conditions make a task possible, while contrast conditions block it.

This is often the right level of abstraction for a reasoning example: detailed enough to be about a real scientific idea, but explicit enough to stay executable and inspectable.

### H.7 How to read an ACT example well

A good reading order is:

1. identify the concrete application scenario
2. identify the `:can` facts the file is trying to establish
3. identify the `:cannot` facts that provide the contrast
4. read the final ARC report
5. go back and inspect the rule blocks that justify that report
6. check whether the file includes explicit validation or a fuse

That order preserves the scientific meaning of the example. You first see the task. Then you see the allowed and forbidden transformations. Only then do you look at the syntax in detail.

### H.8 What makes a strong ACT example in this repository

A strong ACT example in Eyeling usually has five traits.

It is **concrete**. The reader can picture the system.

It is **counterfactual**. The file derives both a meaningful `:can` and a meaningful `:cannot`.

It is **commented at the scientific level**. The comments explain principles, not just syntax.

It is **ARC-shaped**. The answer, reason, and checks are visible.

And it is **honest about scope**. It does not pretend to be a full physical simulation when it is really a task-logic model.

### H.9 Why keep these examples in the handbook at all

Because constructor theory can otherwise seem either too abstract or too grand.

The ACT examples solve that by making the ideas runnable. They let a reader see, in a small executable artifact, how a principle about possible and impossible tasks can be turned into explicit rules, explicit contrasts, and explicit checks.

That is valuable even for readers who do not plan to work on constructor theory itself. It shows a wider lesson:

> some scientific explanations are best understood not as “what happened once,” but as “what could be made to happen, what could not, and what structural features make the difference.”

That is exactly the sort of explanation that N3, and Eyeling in particular, can make unusually clear.

<a id="app-i"></a>

## Appendix I — The Eyeling Playground

The **Eyeling Playground** is the browser-based front end for experimenting with Eyeling without a local install or command-line workflow. It is meant for teaching, quick debugging, live demos, and shareable reasoning examples. Rather than treating reasoning as an offline batch process, the playground makes it interactive: users can edit N3 directly in the browser, load remote N3 from a URL, run reasoning, inspect streamed output, and share the current state through a link.

This appendix explains what the playground is for, how it is structured, and why it matters in practice.

### I.1 Why the playground exists

Notation3 is expressive, compact, and unusually good at mixing RDF-style data with rules, but the first contact experience can still be awkward for many users. Command-line tools are powerful, but they are not always the best entry point for small experiments, teaching sessions, or public demonstrations.

The playground exists to lower that initial friction. It lets a user:

- open a page,
- edit or paste a small N3 program,
- run reasoning immediately,
- inspect output and errors in place,
- and share the exact setup with a URL.

That makes the playground useful not only for newcomers, but also for experienced users who want a fast feedback loop for small examples.

### I.2 Core interaction model

At the center of the playground is an **editable N3 program**. This is the main authoring area for facts, rules, and output-oriented directives.

Alongside that editor is a **Load from URL** field. A remote N3 document can be fetched directly into the playground, which makes it easy to reuse examples stored in a repository or a raw hosted file.

A key recent addition is **background knowledge mode**. When enabled, the N3 loaded from a URL is not written into the editor. Instead, it is stored separately as background knowledge and merged with the editable program only when reasoning runs. This supports a very common workflow:

- keep a stable imported dataset or rule base,
- keep the local editor small and focused,
- iterate on local rules, queries, or reporting logic without repeatedly copying the larger imported source.

That separation is helpful both pedagogically and practically. It mirrors real reasoning work, where a user often reasons _over_ a fixed body of data rather than constantly rewriting it.

### I.3 Execution behavior

The playground is designed to feel responsive even when reasoning is not trivial. To do that, it uses a browser execution model that can run inference in a worker rather than blocking the main UI thread. Output is then surfaced back into the page.

The user-facing controls support three main actions:

- **Run reasoning**,
- **Pause/Resume**,
- **Stop**.

This matters because the playground is not just a text box plus a submit button. It treats reasoning as a process that can be observed while it happens.

The output behavior also adapts to the kind of N3 program being run. In some cases the natural result is a streamed list of derived triples. In others, such as programs using output-oriented constructs like `log:outputString`, a rendered text result is more appropriate. The playground supports both styles.

### I.4 Error handling and explainability

For an interactive reasoning environment, error behavior matters almost as much as successful output. The playground therefore gives particular attention to syntax and runtime feedback.

When an N3 syntax error occurs, the output pane shows the error with line and column information, and the editor highlights the offending line. This shortens the distance between the parser’s complaint and the place where the user needs to fix the program.

The playground also exposes two configuration toggles that are especially useful for explanation and browser safety:

- **proof comments**, which make reasoning output more explanatory,
- **HTTPS dereferencing enforcement**, which helps avoid mixed-content problems when dereferencing from the browser.

Together these choices make the playground better suited to live explanation, teaching, and debugging than a minimal browser wrapper would be.

### I.5 Shareable state through URLs

One of the most practical features of the playground is that its state can be encoded in the page URL.

The canonical query parameters are:

- `edit` — sets the editor content,
- `url` — fills the URL field,
- `loadbg` — determines whether the URL should be loaded as background knowledge,
- `proofcomments` — initializes the proof-comments checkbox,
- `httpsderef` — initializes the HTTPS dereferencing checkbox.

This makes the playground particularly strong for tutorials and demos. A link can specify not just a program, but a whole configuration: an imported resource, whether it belongs in background knowledge, a small editable overlay, and the relevant runtime toggles.

Older hash-based links are still accepted as a fallback, but new state updates are written using query parameters because they scale better as the UI grows beyond a single editor field.

### I.6 What the playground is good for

The playground is especially valuable in four settings.

#### I.6.1 Teaching

Students can begin with a small example and see what changes immediately when they edit a fact or rule. This is a much more direct way to learn N3 than starting from installation instructions.

#### I.6.2 Live demos

A presenter can preload a scenario, show a compact local rule set, run inference, and then share a reproducible link afterward. Background knowledge mode is particularly helpful here because it keeps the visible editor small while still grounding the run in a richer imported source.

#### I.6.3 Debugging small programs

For short reasoning tasks, the playground can be a faster debugging surface than a command-line loop. It is well suited to checking syntax, validating a rule pattern, or inspecting a small proof-oriented run.

#### I.6.4 Sharing examples

A single link can capture enough context for another person to reproduce an example quickly. This is valuable in issue reports, discussions, teaching material, and public-facing demonstrations.

### I.7 Limits of the playground

The playground is intentionally lightweight, and it should be understood in that role.

It is not meant to replace the command line for large-scale workloads, benchmarking, or repository-scale automation. Browser memory and execution limits still matter. Likewise, loading remote resources depends on ordinary web constraints such as network access and cross-origin availability.

In short: the playground is best thought of as a compact interactive front end for exploration, communication, and small-to-medium experiments.

### I.8 Why it matters

The Eyeling Playground shows that N3 reasoning can be made substantially more approachable without flattening the underlying logic into a toy interface. A relatively small set of features — an editor, a URL loader, background knowledge mode, responsive execution, proof toggles, and shareable query parameters — is enough to support serious educational and exploratory work.

That is the main value of the playground. It gives Eyeling a public-facing, browser-native environment where reasoning is not hidden behind setup overhead, and where examples can move easily between author, teacher, student, and reviewer.

<a id="app-j"></a>

## Appendix J — Formalism Is Fine

For Eyeling, formal methods are not an obstacle to practical reasoning. They are part of what makes the system useful. A reasoner is easier to trust when its facts, rules, derivations, and limits can be stated explicitly rather than hidden in application code. That is the sense in which formalism matters here: not as ceremony, but as a way of keeping the behavior of the system inspectable.

Horn logic is fine because it gives a disciplined core. It does not try to express every possible form of reasoning. Instead, it offers a fragment that is small enough to implement clearly and strong enough to support a wide range of real tasks. That trade is often a good one. In a compact reasoner, expressiveness only helps when it does not destroy clarity or operational control.

Notation3 is fine because a logic language also needs a readable surface. Eyeling works with terms, triples, formulas, and rules, but those structures still have to be written, reviewed, debugged, and shared. N3 matters because it keeps the logic close to the page. A rule still looks like something a person can follow. A quoted formula still looks like a graph that can be inspected. That readability is part of what makes the reasoner teachable and portable.

Executable specification is fine because there is real value in keeping semantics and implementation close together. When a specification can be run, it becomes easier to test the intended behavior on concrete inputs, compare outcomes across examples, and find the points where an abstract account is still too vague. Execution does not replace semantics, but it is often the best way to expose whether the semantics is precise enough to guide an implementation.

Herbrand semantics is fine because it gives symbolic reasoning a concrete semantic basis. Instead of beginning with an opaque external domain, it begins with the symbolic constructions themselves and asks what follows from them under the rules. That is a natural fit for Eyeling. The engine reasons over terms, substitutions, triples, formulas, and proof states. Herbrand-style semantics therefore does not feel like an imported philosophical story. It describes the level at which the system actually works.

Gödel incompleteness is fine because the limits of formal systems are not a refutation of formal reasoning. They are part of its shape. Once a system becomes expressive enough, one should expect structural limits on what it can prove about itself. That does not make formal methods less serious. It shows that their boundaries are principled rather than accidental. For a handbook like this one, that is the right lesson: formal systems are valuable not because they say everything, but because they say some things clearly, explicitly, and in a form that can be checked.

Taken together, these positions support a straightforward attitude toward Eyeling. Horn logic is fine. Notation3 is fine. Executable specification is fine. Herbrand semantics is fine. Gödel incompleteness is fine. None of these commitments make the reasoner narrower in a harmful sense. They make it clearer, easier to inspect, and easier to trust. For this project, that is enough.

<a id="app-k"></a>

## Appendix K — Whitehead-inspired becoming examples

A small family of examples in the repository (`examples/*-becoming.n3`) explores a common idea: that logic can describe not only what **is** the case, but what a thing, system, lineage, or device can **become**. The inspiration is Whiteheadian in a broad sense. The examples do not attempt to formalize Whitehead’s metaphysics as scholarship. Instead, they borrow one guiding intuition from it: reality is often better understood as a structured passage from one state to another than as a mere inventory of static objects.

In N3 terms, this means the examples are written so that rules describe **state-transition potential**. Earlier examples in the handbook often use predicates such as `:can`, `:cannot`, `:supports`, or `:requires`. The becoming family shifts the emphasis toward predicates such as `:canBecome` and `:cannotBecome`, along with intermediate states such as protected dormancy, germination, negative differential response, or adaptive persistence. This is still ordinary Horn-style reasoning. The novelty is not in the engine, but in the modeling style.

The seven current becoming examples span several domains. One is a pure Whiteheadian toy model, where actual occasions prehend a past, respond to a lure of possibility, and become objectively available for future occasions. Others translate the same pattern into engineering revision, developmental genetics, control-systems design, constructor-theoretic task transition, barley-seed lineage renewal, and tunnel-junction wake switching. The common thread is always the same: an entity inherits a prior condition, encounters some enabling or disabling structure, and either reaches a new stabilized state or fails to do so.

That common pattern makes the examples useful pedagogically. They show that Eyeling is not limited to taxonomies, datatype checks, or one-step deductions. It can also express **process descriptions** in a compact symbolic form. A design revision can become a new approved baseline. A cell state can become a differentiated lineage state. A controller can become a validated closed-loop design. A substrate can become a new attribute-state under a possible task. A seed lineage can become a self-renewing cycle. A tunnel junction can become a low-bias wake-serving device.

These examples are also helpful because they keep different levels of abstraction visible. Some of them are deliberately metaphysical, some quasi-biological, some engineering-oriented, and some constructor-theoretic. But they all run through the same reasoner, using the same underlying machinery: terms, triples, forward rules, and closure. That is a quiet but important point. Eyeling does not care whether the domain is philosophy, control theory, genetics, or device physics. What matters is whether the modeled transitions can be stated clearly enough as explicit conditions and consequences.

The becoming examples should therefore be read as **executable schemata** rather than as complete scientific models. They intentionally simplify their domains. The engineering example does not replace design verification. The genetics example does not replace systems biology. The constructor-theory example does not replace the theory itself. And the Whitehead example is not a substitute for reading Whitehead. What the examples do show is that N3 can serve as a clean medium for expressing relational process in a way that remains inspectable, runnable, and easy to vary.

For the handbook, these examples matter for two reasons. First, they provide a concrete demonstration that Eyeling can handle a style of reasoning that feels closer to **becoming, development, and transformation** than to static classification. Second, they show how expressive gains can come from modeling choices rather than from adding new machinery to the engine. The same forward-chaining core that proves `:Socrates a :Mortal` can also prove that a lineage becomes evolvable, that a controller becomes approved, or that a wake switch becomes serviceable under a low-bias regime.

That is why this appendix belongs after Appendix J. “Formalism is fine” not only because it supports rigor, but because it can remain flexible enough to describe worlds in motion. The becoming examples are small demonstrations of that claim. They show that a compact N3 reasoner can host process-oriented models without ceasing to be simple, readable, and executable.
