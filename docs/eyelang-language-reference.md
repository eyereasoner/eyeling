# eyelang Language Reference

## Table of contents

- [Abstract](#abstract)
- [1. Terminology and normative language](#1-terminology-and-normative-language)
- [2. Design goals](#2-design-goals)
- [3. Lexical structure](#3-lexical-structure)
  - [3.1 Character stream](#31-character-stream)
  - [3.2 Comments](#32-comments)
  - [3.3 Punctuation tokens](#33-punctuation-tokens)
  - [3.4 Variables](#34-variables)
  - [3.5 Atom constants](#35-atom-constants)
  - [3.6 Strings](#36-strings)
  - [3.7 Numbers](#37-numbers)
- [4. Surface grammar](#4-surface-grammar)
- [5. Terms](#5-terms)
  - [5.1 Variables](#51-variables)
  - [5.2 Atom constants, strings, and numbers](#52-atom-constants-strings-and-numbers)
  - [5.3 Compound terms and atomic formulas](#53-compound-terms-and-atomic-formulas)
  - [5.4 Lists](#54-lists)
  - [5.5 Comma terms](#55-comma-terms)
- [6. Clauses and predicates](#6-clauses-and-predicates)
- [7. Goals and proof search](#7-goals-and-proof-search)
  - [7.1 Unification](#71-unification)
  - [7.2 Failure](#72-failure)
  - [7.3 Finite search expectation](#73-finite-search-expectation)
- [8. Logical reading: Herbrand semantics](#8-logical-reading-herbrand-semantics)
  - [8.1 Variables and quantification](#81-variables-and-quantification)
  - [8.2 Equality, identity, and unification](#82-equality-identity-and-unification)
  - [8.3 Goal-directed execution versus model-theoretic meaning](#83-goal-directed-execution-versus-model-theoretic-meaning)
  - [8.4 Built-ins and operational extensions](#84-built-ins-and-operational-extensions)
- [9. Standard built-in predicates](#9-standard-built-in-predicates)
  - [9.1 Equality and unification](#91-equality-and-unification)
  - [9.2 Arithmetic](#92-arithmetic)
  - [9.3 Comparison](#93-comparison)
  - [9.4 Dates and durations](#94-dates-and-durations)
  - [9.5 Generators](#95-generators)
  - [9.6 Strings and atom constants](#96-strings-and-atom-constants)
  - [9.7 Lists](#97-lists)
  - [9.8 Aggregation and ordering](#98-aggregation-and-ordering)
  - [9.9 Context terms](#99-context-terms)
  - [9.10 Search control](#910-search-control)
- [10. Extension built-ins](#10-extension-built-ins)
- [11. Declarations](#11-declarations)
  - [11.1 Memoization](#111-memoization)
  - [11.2 Default-output materialization](#112-default-output-materialization)
- [12. eyelang Sockets](#12-eyelang-sockets)
  - [12.1 Socket vocabulary](#121-socket-vocabulary)
  - [12.2 Socket example](#122-socket-example)
  - [12.3 Sockets and AI agents](#123-sockets-and-ai-agents)
- [13. Output and read-back profile](#13-output-and-read-back-profile)
  - [13.1 Explanation output](#131-explanation-output)
- [14. Conformance profiles](#14-conformance-profiles)
  - [14.1 Core language profile](#141-core-language-profile)
  - [14.2 Standard built-in profile](#142-standard-built-in-profile)
  - [14.3 Standard host profile](#143-standard-host-profile)
- [15. Relationship to ISO Prolog](#15-relationship-to-iso-prolog)
- [16. Examples](#16-examples)
  - [16.1 Transitive closure](#161-transitive-closure)
  - [16.2 Arithmetic](#162-arithmetic)
  - [16.3 Lists](#163-lists)
  - [16.4 Negation as failure](#164-negation-as-failure)
- [17. Security and portability considerations](#17-security-and-portability-considerations)

## Abstract

eyelang is a compact Prolog-like definite-clause language for rule-based programs over ordinary terms, lists, arithmetic, strings, and finite search. An eyelang program is a finite sequence of facts and Horn clauses. The underlying declarative semantics of the pure language is **Herbrand semantics**: constants, compound terms, and lists denote themselves, and predicates denote sets of ground atomic formulas over those terms. Evaluation is goal-directed: goals are solved by unification against facts, rules, and a fixed set of built-in predicates.

eyelang is intentionally smaller than ISO Prolog. It supports enough Prolog syntax to express Horn-clause reasoning, list processing, arithmetic examples, finite search, and context data, without operators, cut, modules, dynamic predicates, DCGs, or a complete ISO standard library.

## 1. Terminology and normative language

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be interpreted as normative requirements.

A **term** is a variable, atom constant, string, number, list, or compound term.

An **atom constant** is a symbolic scalar term, such as `pat`, `type`, or `'atom with spaces'`. It is a term and may appear as an argument, list element, functor name, or predicate name.

An **atomic formula** is a predicate application such as `parent(pat, jan)` or `status(case1, accepted)`. It is the unit of truth in a Herbrand interpretation. In some logic-programming literature atomic formulas are called "atoms"; this specification avoids that shorthand. Whenever the noun "atom" appears here outside the phrase "atomic formula", it means **atom constant**.

This distinction is normative: `pat` is an atom constant and can appear as a term argument; `parent(pat, jan)` is an atomic formula and can appear as a fact, rule head, or goal. A compound term such as `pair(pat, jan)` has the same surface shape as an atomic formula, but its role is determined by context: as data it is a compound term, and as a clause head or goal it is an atomic formula with predicate symbol `pair/2`.

A **clause** is either a fact `Head.` or a rule `Head :- Body.`.

A **goal** is an atomic formula, a built-in call, or a comma conjunction.

A **source fact** is a fact written directly in the input program. A **new derivation** is a ground consequence found through at least one rule and not merely repeated from the source facts.

The **Herbrand universe** of a program is the set of all ground eyelang terms constructible from the constants and functors in the program, together with the built-in list constructors `[]` and `./2` where lists are used. The **Herbrand base** is the set of all ground atomic formulas whose predicate symbols occur in the program and whose arguments are terms from the Herbrand universe.

## 2. Design goals

eyelang is designed to be:

- small enough to embed and audit;
- deterministic in textual output order after duplicate suppression;
- useful for relation-style `p(S, O)` output through ordinary predicate names;
- practical for examples involving recursion, lists, arithmetic, strings, aggregation, finite search, and context-valued data.

Non-goals include complete ISO Prolog compatibility, operator declarations, module systems, dynamic database updates, cut-based control, and full bottom-up closure semantics.

## 3. Lexical structure

### 3.1 Character stream

Input is Unicode text. Whitespace separates tokens and is otherwise insignificant outside quoted strings and quoted atom constants.

### 3.2 Comments

A percent sign starts a line comment outside quoted strings and quoted atom constants. The comment extends to the end of the line.

```prolog
parent(pat, jan).  % this is a comment
```

### 3.3 Punctuation tokens

The punctuation tokens are:

```text
(  )  [  ]  ,  |  .  :-
```

A colon outside `:-` is not part of the language. Namespace-like names SHOULD be written as plain atom constants such as `person_type` or `odrl_permission`.

### 3.4 Variables

A variable starts with an uppercase ASCII letter or underscore, followed by zero or more ASCII letters, digits, or underscores.

Examples:

```prolog
X
Person
_Thing
_
```

Each `_` anonymous variable occurrence is fresh.

### 3.5 Atom constants

A plain atom constant starts with a lowercase ASCII letter and is followed by zero or more ASCII letters, digits, or underscores:

```prolog
pat
type
case_123
```

A quoted atom constant is enclosed in single quotes. A single quote inside a quoted atom constant is represented by doubling it:

```prolog
'atom with spaces'
'needs''quote'
''
```

A graphic atom constant is one or more graphic characters from this set:

```text
#$&*+-/<=>?@^~\
```

### 3.6 Strings

A string is enclosed in double quotes. The implementation supports common escapes such as `\n`, `\t`, `\"`, and `\\`.

### 3.7 Numbers

Numbers are scalar terms. Integers, decimal numbers, and scientific notation are accepted:

```prolog
0
-42
0.25
1.25e-3
1.25e+3
```

Integer arithmetic built-ins use arbitrary-precision decimal strings where possible. Floating operations use the host implementation's IEEE-754 double-precision behavior.

## 4. Surface grammar

This grammar is descriptive. Implementations MAY reject programs that exceed implementation limits.

```text
program      ::= clause*
clause       ::= term "." | term ":-" goal_list "."
goal_list    ::= term ("," term)*
term         ::= variable
              | atom_constant
              | string
              | number
              | atom_constant "(" [term ("," term)*] ")"
              | "[" [list_items] "]"
              | "(" term ("," term)+ ")"
list_items   ::= term ("," term)* ["|" term]
```

Here `atom_constant` is a lexical class for symbolic scalar terms, not an atomic formula. Atomic formulas are represented by the grammar alternative `atom_constant "(" ... ")"` when such a compound appears in a clause head, rule body, or selected goal.

A clause head SHOULD be a compound term. Non-compound heads are parsed but are not useful in the current predicate index.

Zero-arity compounds are written with parentheses:

```prolog
nil().
value(example, nil()).
```

## 5. Terms

### 5.1 Variables

Variables are scoped to a single clause or selected goal. A variable in a rule head and body denotes the same logical variable within that clause.

### 5.2 Atom constants, strings, and numbers

Atom constants, strings, and numbers are distinct scalar term kinds. Two scalar terms unify only when their type and lexical value match, except where a built-in explicitly interprets lexical values.

### 5.3 Compound terms and atomic formulas

A compound term has a functor name and arity:

```prolog
parent(pat, jan)
pair(3, nested(atom, [x, y]))
```

The same concrete syntax is used for atomic formulas when the compound appears as a fact, rule head, or goal. In `parent(pat, jan).`, `parent/2` is a predicate symbol and the whole expression is an atomic formula. In `value(x, parent(pat, jan)).`, the inner `parent(pat, jan)` is ordinary compound data.

The functor or predicate name is fixed syntactically and is written as an atom constant. eyelang does not support variables in predicate or functor position.

### 5.4 Lists

Lists use Prolog surface syntax and are represented internally with `./2` and `[]`:

```prolog
[]
[a, b, c]
[a, b | tail]
```

### 5.5 Comma terms

Parenthesized comma terms may be goals or data:

```prolog
(parent(pat, jan), parent(jan, emma))
(name(alice, "Alice"), knows(alice, bob))
```

When a comma term appears as a goal, it is evaluated as conjunction. When it appears as data, it remains a term. `holds/2` enumerates member terms inside such contexts, and `holds/3` exposes each member as a predicate name plus an argument list for any arity.

## 6. Clauses and predicates

A fact has no body:

```prolog
parent(pat, jan).
```

A rule has a head and a body:

```prolog
ancestor(X, Y) :-
  parent(X, Y).

ancestor(X, Z) :-
  parent(X, Y),
  ancestor(Y, Z).
```

Clauses with the same predicate name and arity define one predicate group. Predicate name and arity are both significant: `p/1` and `p/2` are different predicates.

## 7. Goals and proof search

Goals are solved left-to-right. For a user-defined atomic-formula goal, eyelang selects candidate clauses by predicate name, arity, and available indexes. A candidate clause is freshened, its head is unified with the goal, and then its body is solved.

A conjunction goal succeeds when all conjunct goals succeed in order. An answer is printed as the resolved answer term followed by a period.

### 7.1 Unification

Unification follows the ordinary first-order term structure used by the language. The implementation does not perform an occurs check.

### 7.2 Failure

A goal fails when no built-in case or user clause can prove it. eyelang has no exception term language; parse errors and resource failures are implementation errors reported to the host.

### 7.3 Finite search expectation

Programs and selected output goals SHOULD be written so the relevant search space is finite. eyelang includes recursion guards and memoization support, but it is not required to terminate for arbitrary recursive logic programs.

## 8. Logical reading: Herbrand semantics

The pure eyelang language is interpreted over the **Herbrand universe** and **Herbrand base**. The Herbrand universe is the first-order universe made only of the ground terms that can be built from the program's atom constants, strings, numbers, list constructors, and compound functors. There are no hidden domain elements: a term denotes itself. For example, the atom constant `pat` denotes the Herbrand constant `pat`, and the number `3` denotes the numeric Herbrand constant written `3`. The Herbrand base is separate from the universe: it contains ground atomic formulas such as `parent(pat, jan)`, whose predicate symbol is `parent/2` and whose arguments are Herbrand terms.

An atom constant by itself is not true or false. For example, `pat` is a term, not a proposition. Truth applies to atomic formulas: `person(pat)` may be true or false in a Herbrand interpretation, while `pat` is simply one possible argument term.

A **Herbrand interpretation** for a program is a set of ground atomic formulas that are considered true. A source fact such as:

```prolog
parent(pat, jan).
```

places the ground atomic formula `parent(pat, jan)` in the interpretation. A rule such as:

```prolog
ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).
```

is read universally over Herbrand terms: for every substitution of `X`, `Y`, and `Z` by ground Herbrand terms, if both ground body atomic formulas are true, then the ground head atomic formula is true. The declarative meaning of a pure program is the **least Herbrand model**: the smallest set of ground atomic formulas that contains all facts and is closed under all rules.

Equivalently, the least Herbrand model is obtained by repeatedly applying the immediate-consequence operation: start with the source facts, add every ground rule head whose ground body is already true, and continue to the least fixed point. This definition is mathematical; an implementation does not have to compute the model bottom-up.

### 8.1 Variables and quantification

Variables do not range over external objects, records, pointers, or host-language values. In the logical reading, variables range over Herbrand terms. A rule is implicitly universally quantified over its variables. A selected goal is existential in the usual logic-programming sense: eyelang searches for substitutions of its variables by Herbrand terms that make the goal true with respect to the program.

### 8.2 Equality, identity, and unification

Because the domain is Herbrand, equality in the pure language is syntactic identity of terms after substitution. Two distinct atom constants are distinct. Two compound terms are equal only when they have the same functor, the same arity, and pairwise equal arguments. Lists follow the same rule through their `[]` and `./2` representation.

Operationally, eyelang uses first-order unification to find substitutions. The implementation does not perform an occurs check, so cyclic terms are not part of the portable Herbrand reading even if a particular implementation can temporarily construct recursive bindings internally. Portable programs SHOULD avoid relying on occurs-check-sensitive cases such as `eq(X, f(X))`.

### 8.3 Goal-directed execution versus model-theoretic meaning

eyelang's CLI and library evaluator are goal-directed. They try to prove requested goals by resolving them against facts, rules, and built-ins, using clause order, goal order, indexing, memoization, and deterministic built-in execution. This operational strategy is intended to enumerate answers that are true in the least Herbrand model for the pure Horn-clause fragment, but it is not a complete bottom-up model enumerator. Non-terminating recursion or infinite generators can prevent an answer from being found even when the answer belongs to the least Herbrand model.

Default CLI output is also a host behavior, not a separate semantics. It asks broad materialization goals, suppresses duplicates, excludes source facts, keeps ground answers, and prints selected consequences. Embedders can still access the goal-directed solver directly through the implementation API.

### 8.4 Built-ins and operational extensions

Built-ins are specified relations or operations added to the Herbrand core. A built-in call in a goal has the syntax of an atomic formula, but its success relation is specified procedurally here rather than by source clauses. Some built-ins, such as `eq/2`, `append/3`, `member/2`, and `length/2`, can be understood as relations over Herbrand terms. Others, such as arithmetic, string matching, date/time predicates, aggregation, `once/1`, and negation-as-failure, are operational extensions whose behavior is defined by this specification rather than by pure least-Herbrand-model semantics alone.

Arithmetic and string built-ins do not introduce a separate semantic universe. They inspect the lexical values of already represented Herbrand constants and, when they succeed, bind output arguments to eyelang terms such as numbers, strings, or atom constants. For example, `add(2, 3, X)` may bind `X` to the number term `5`; it does not mean that variables range over host-language numbers outside the Herbrand universe.

Negation-as-failure `not(Goal)` is especially operational: it succeeds when the current goal-directed search finds no solution for `Goal`. It is not classical negation and should not be read as adding negative facts to the Herbrand model. Programs using negation SHOULD keep the negated goal sufficiently ground and finite.

## 9. Standard built-in predicates

This section specifies the **standard built-ins** of the eyelang language. An implementation that claims support for this standard built-in profile MUST implement the predicates in this section with the meanings described here.

A built-in call is still written as an atomic formula, but the relation is provided by the host implementation rather than by source clauses. Several built-ins are mode-sensitive: they are intended to run when their input arguments are sufficiently ground, and implementations may leave user-defined clauses visible when that mode is not yet satisfied.

Implementations MAY provide additional built-ins, but such built-ins are extensions and are not part of this normative catalog. Extension built-ins are discussed separately in section 10.

### 9.1 Equality and unification

| Built-in | Meaning |
|---|---|
| `eq(A, B)` | Succeeds when `A` and `B` unify. |
| `neq(A, B)` | Succeeds when `A` and `B` do not unify. |

### 9.2 Arithmetic

| Built-in | Meaning |
|---|---|
| `neg(A, B)` | `B` is the numeric negation of `A`. |
| `abs(A, B)` | `B` is the absolute value of `A`. |
| `sin(A, B)`, `cos(A, B)`, `asin(A, B)`, `acos(A, B)`, `log(A, B)` | Floating functions. |
| `rounded(A, B)` | `B` is `A` rounded to the nearest integer. |
| `add(A, B, C)` | `C = A + B`. |
| `sub(A, B, C)` | `C = A - B`. |
| `mul(A, B, C)` | `C = A * B`. |
| `div(A, B, C)` | `C = A / B`; integer inputs use integer division. |
| `mod(A, B, C)` | Integer remainder. |
| `pow(A, B, C)` | `C = A^B`. |
| `min(A, B, C)` | Numeric minimum. |

### 9.3 Comparison

| Built-in | Meaning |
|---|---|
| `lt(A, B)` | `A < B`. |
| `gt(A, B)` | `A > B`. |
| `le(A, B)` | `A =< B`. |
| `ge(A, B)` | `A >= B`. |

Comparisons interpret numeric-looking terms numerically. Other scalar terms are compared lexically.

### 9.4 Dates and durations

| Built-in | Meaning |
|---|---|
| `local_time(T)` | Binds `T` to the local date string. For deterministic runs, `EYELANG_LOCAL_TIME=YYYY-MM-DD` overrides the current date. |
| `difference(A, B, D)` | Computes an ISO-like date/duration difference. |

### 9.5 Generators

| Built-in | Meaning |
|---|---|
| `between(Low, High, X)` | Enumerates integers from `Low` through `High`. |
| `smallest_divisor_from(N, Start, D)` | Finds a divisor of `N` starting at `Start`. |

### 9.6 Strings and atom constants

| Built-in | Meaning |
|---|---|
| `str_concat(A, B, C)` | String concatenation. |
| `contains(Text, Needle)` | Text contains `Needle`. |
| `matches(Text, Pattern)` | Text matches a simple implementation regex/search pattern. |
| `matches(Text, Pattern, Context)` | Text matches a JavaScript regular expression with named capture groups; `Context` is a comma context containing one unary term per matched capture group. |
| `not_matches(Text, Pattern)` | Negation of `matches/2`. |

### 9.7 Lists

| Built-in | Meaning |
|---|---|
| `append(A, B, C)` | List append/split relation. |
| `nth0(Index, List, Value)` | Zero-based list lookup. |
| `set_nth0(Index, List, Value, Out)` | Functional list update. |
| `rest(List, Tail)` | Tail of a non-empty list. |
| `member(X, List)` | Member generator. |
| `select(X, List, Rest)` | Selects one occurrence. |
| `not_member(X, List)` | Succeeds when `X` is not a member. |
| `reverse(A, B)` | Reverses a proper list. |
| `length(List, N)` | Proper-list length. |

### 9.8 Aggregation and ordering

| Built-in | Meaning |
|---|---|
| `findall(Template, Goal, Bag)` | Collects all templates for solutions of `Goal`. |
| `countall(Goal, Count)` | Counts solutions of `Goal`; empty solution sets produce `0`. |
| `sumall(Template, Goal, Sum)` | Sums numeric `Template` values over solutions of `Goal`; empty solution sets produce `0`. |
| `aggregate_min(Key, Template, Goal, BestKey, BestTemplate)` | Selects the solution of `Goal` with the smallest resolved `Key`, returning that key and the corresponding resolved `Template`. Fails when `Goal` has no solutions. |
| `aggregate_max(Key, Template, Goal, BestKey, BestTemplate)` | Selects the solution of `Goal` with the largest resolved `Key`, returning that key and the corresponding resolved `Template`. Fails when `Goal` has no solutions. |
| `sort(Input, Output)` | Sorts and deduplicates a proper list. |

### 9.9 Context terms

Context terms are data representations of atomic formulas and comma conjunctions.

| Built-in | Meaning |
|---|---|
| `holds(Context, Term)` | Enumerates member terms inside a context term and unifies each member with `Term`. |
| `holds(Context, Name, Args)` | Enumerates context members of any arity, exposing each member as atom constant `Name` plus a proper argument list `Args`. |

Example:

```prolog
holds((name(alice, "Alice"), knows(alice, bob)), name(S, O)).
holds((ready, name(alice, "Alice"), route(alice, bob, 7)), Name, Args).
```

The first goal can yield `holds((name(alice, "Alice"), knows(alice, bob)), name(alice, "Alice")).` The second can yield `holds((ready, name(alice, "Alice"), route(alice, bob, 7)), ready, []).`, `holds((ready, name(alice, "Alice"), route(alice, bob, 7)), name, [alice, "Alice"]).`, and `holds((ready, name(alice, "Alice"), route(alice, bob, 7)), route, [alice, bob, 7]).`

`holds/3` is the appropriate form for schema-style introspection because it exposes the predicate name and all arguments without assuming a fixed arity. For example, a single rule can inspect `heartbeat`, `source(sensor17)`, `temperature(sensor17, 38)`, and `signature(sensor17, sha256, Hash, Time)` as `heartbeat/0`, `source/1`, `temperature/2`, and `signature/4`; see [`context-schema-audit.pl`](../examples/eyelang/context-schema-audit.pl).

The N3 example [`context-schema-audit.n3`](../examples/context-schema-audit.n3) shows the same idea in quoted graph form: members are encoded as predicates with RDF-list argument objects, then `log:includes` and `list:length` expose `Name + Arity` for schema checking.

### 9.10 Search control

| Built-in | Meaning |
|---|---|
| `not(Goal)` | Negation as failure. Succeeds when `Goal` has no solution. |
| `once(Goal)` | Succeeds with at most the first solution of `Goal`. |

## 10. Extension built-ins

Implementations MAY provide additional built-ins beyond the standard predicates listed above. Such built-ins are **extension built-ins**. They are useful for embedding eyelang in particular host environments, exposing efficient finite-domain solvers, or providing domain-specific relations for examples and applications.

Extension built-ins are not required for conformance to this specification. A portable eyelang program SHOULD NOT depend on an extension built-in unless the target implementation explicitly documents that extension.

An extension built-in SHOULD obey the same surface-language discipline as standard built-ins:

- it is called using ordinary atomic-formula syntax, for example `some_extension(A, B)`;
- its arguments and results are eyelang terms from the Herbrand universe;
- it succeeds, fails, and binds variables as a relation over eyelang terms;
- it SHOULD document its intended modes, especially which arguments must be ground before it runs deterministically;
- it MUST NOT change the meaning of ordinary facts, rules, unification, or standard built-ins.

For example, an implementation may include extension modules for number-theory algorithms, graph search, or matrix operations. Those modules may be valuable and may make example programs much faster, but their predicate names, arities, algorithms, and modes are implementation-defined unless they are separately standardized.

An implementation that provides explanation output SHOULD make extension built-ins explainable at least as opaque successful or failed built-in calls, so that proof traces do not incorrectly report "no clauses" for a host-provided relation.

## 11. Declarations

Declarations are written as ordinary facts, but the host treats them specially.

### 11.1 Memoization

```prolog
memoize(Name, Arity).
```

`Name` MUST be an atom constant and `Arity` MUST be a non-negative integer. The declaration asks the solver to table answers for the named predicate group when applicable.

Example:

```prolog
memoize(path, 2).
```

### 11.2 Default-output materialization

```prolog
materialize(Name, Arity).
```

`Name` MUST be an atom constant and `Arity` MUST be a non-negative integer. If a program contains one or more `materialize/2` declarations, default CLI output is restricted to those predicate groups. Source facts are still excluded from printed output.

Example:

```prolog
materialize(status, 2).
materialize(reason, 2).
```

`materialize/2` affects host output selection only; it does not change the logical meaning of the program.

## 12. eyelang Sockets

A **eyelang Socket** is a declared semantic opening in a eyelang program where facts, rules, tools, datasets, or agents can plug in knowledge through an explicit contract while preserving eyelang-readable reasoning and explanations.

The term follows the ordinary socket pattern: a socket defines a place where a matching provider can connect. In eyelang, the matching part is knowledge. A socket identifies what shape of knowledge a program expects; a plug identifies which provider supplies it. This separates reasoning logic from knowledge providers and makes composition boundaries visible as eyelang data.

In this specification, sockets are a portable **programming pattern** expressed with ordinary facts. The core solver does not give `socket/2`, `plug/2`, `provides/1`, or `requires/1` special proof-search behavior unless a host explicitly documents such an extension. Because they are ordinary facts, socket declarations remain readable, inspectable, explainable, and safe to ignore by hosts that do not validate them.

### 12.1 Socket vocabulary

The minimal socket vocabulary is:

```prolog
socket(Name, Contract).
plug(Provider, Name).
provides(Signature).
requires(Signature).
```

`Name` and `Provider` are ordinary eyelang terms, usually atom constants. `Contract` is an ordinary eyelang term that describes the expected or offered knowledge. A portable signature form is:

```prolog
predicate(PredicateName, Arity)
```

For example:

```prolog
socket(family_source, provides(predicate(parent, 2))).
plug(family_file, family_source).
```

This says that `family_source` is a named opening for knowledge of the shape `parent/2`, and that `family_file` is the provider plugged into that opening.

### 12.2 Socket example

A rule module can declare the knowledge it expects:

```prolog
materialize(ancestor, 2).

socket(family_source, provides(predicate(parent, 2))).
plug(family_file, family_source).

parent(pat, jan).
parent(jan, emma).

ancestor(X, Y) :-
    parent(X, Y).

ancestor(X, Z) :-
    parent(X, Y),
    ancestor(Y, Z).
```

The `ancestor/2` rules do not depend on a particular storage mechanism for `parent/2`. In a small test, the provider may be the same file. In an embedded host, it may be a database adapter, a document extractor, a remote service, or another eyelang module. The socket facts make that boundary explicit without changing the logical meaning of the rules.

When eyelang derives `ancestor(pat, emma)`, the answer explanation can still refer to the source clauses that were actually used, for example facts for `parent/2` and rules for `ancestor/2`. The socket facts add an inspectable description of where such knowledge is intended to enter.

### 12.3 Sockets and AI agents

eyelang Sockets are especially useful for AI-facing systems. An AI agent can extract or propose candidate claims, but those claims should enter a reasoning program as explicit eyelang facts or rules through a declared socket rather than as opaque text. eyelang can then check the claims against other facts and rules, derive consequences, and optionally return ordinary `why/2` explanations.

This gives a clear division of labor: AI can help generate, translate, and connect knowledge; eyelang can represent, check, and explain the reasoning; sockets define the boundary between them.

## 13. Output and read-back profile

Normal answer output prints one resolved answer term followed by a period. Strings are double-quoted; atom constants are quoted when needed; lists use list syntax; compound terms use functor notation. Host interfaces MAY provide an option such as `--proof` to add `why/2` explanation facts; this option MUST NOT change the answers found.

Output SHOULD be accepted as eyelang input when it contains only supported term syntax. Explanations are ordinary eyelang facts, so answer output can be read back and processed by eyelang.

Default host output behavior is:

1. parse all inputs into one program;
2. collect source fact lines for duplicate suppression;
3. if `materialize/2` declarations exist, solve those predicate groups; otherwise solve all binary predicate groups with at least one rule;
4. keep only ground answers;
5. remove answers identical to source facts;
6. suppress duplicates;
7. print each answer, followed by its `why/2` explanation only if the host interface was explicitly asked to emit proof output.

### 13.1 Explanation output

When proof output is enabled, each answer SHOULD be followed by a machine-readable `why/2` fact. Explanation output is ordinary eyelang syntax whose second argument is a nested abstract proof term such as `proof(goal(G), by(Method), bindings(Bindings), uses(Proofs))`; implementations SHOULD print `goal(...)` and `by(...)` on separate lines for readability. A proof term preserves the answer goal, derivation method, relevant bindings, and nested uses while omitting proof IDs. User clauses SHOULD be referenced explicitly as `fact(Filename, clause(N))` or `rule(Filename, clause(N))`, where `N` is the 1-based clause number within that source. Built-ins SHOULD be referenced as `builtin(Name, Arity)` because they do not come from source clauses. Explanation output is outside the logical semantics of the input program and MUST NOT change the set of answers.

## 14. Conformance profiles

### 14.1 Core language profile

A conforming core language implementation supports:

- lexical syntax described above;
- facts and definite clauses;
- first-order unification without occurs check;
- left-to-right goal-directed proof search;
- lists and comma conjunctions;
- answer printing.

### 14.2 Standard built-in profile

A conforming standard built-in implementation supports the built-ins listed in section 9. These are the portable built-ins independent implementations should implement when they claim standard built-in compatibility.

### 14.3 Standard host profile

A conforming standard host also supports:

- `memoize/2` declarations;
- `materialize/2` declarations;
- default derived output;
- explanation output;
- stdin, file, and URL inputs in the CLI.

Browser execution, package layout, and any extension built-ins described in implementation documentation are outside this specification unless separately standardized.


Conformance cases for these profiles live in the repository under `conformance/`. They are run by `npm test` before the example suite, and can be run alone with `npm run test:conformance`. The cases use exact expected standard output files so independent implementations can compare behavior case by case.

## 15. Relationship to ISO Prolog

eyelang borrows familiar Prolog syntax and Horn-clause execution but is not ISO Prolog. Notable differences include:

- no operators or operator declarations;
- no cut;
- no modules;
- no dynamic database update;
- no DCGs;
- no full ISO term ordering or standard library;
- no variables in functor or predicate position;
- no occurs check in unification.

Programs intended to be portable to eyelang SHOULD avoid ISO-specific syntax and keep terms explicit.

## 16. Examples

### 16.1 Transitive closure

```prolog
parent(pat, jan).
parent(jan, emma).

ancestor(X, Y) :- parent(X, Y).
ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).
```

### 16.2 Arithmetic

```prolog
square(X, Y) :- mul(X, X, Y).
answer(three, Y) :- square(3, Y).
```

### 16.3 Lists

```prolog
first([X | _Rest], X).
answer(example, X) :- first([a, b, c], X).
```

### 16.4 Negation as failure

```prolog
closed(b).
open(X) :- not(closed(X)).
status(a, open) :- open(a).
```

## 17. Security and portability considerations

URL input uses host networking support when available. Hosts SHOULD treat downloaded programs as untrusted code because they can trigger expensive search.

Programs SHOULD be written with finite search in mind. Broad default materialization can be expensive for helper predicates; use `materialize/2` declarations and concise output predicates when needed.

