# ODRL policy reasoning

## One reasoner, many kinds of policy questions

A policy system rarely needs to answer only one question.

It may need to decide whether an action is allowed, detect contradictory rules,
compare a specific rule with a more general one, or admit that the available
rules do not determine a unique answer.

The `odrl-policy-reasoning.pl` example shows how those questions can live in
one executable logical model.

[Run the example in the EyeProlog playground](https://eyereasoner.github.io/eyeprolog/playground#example=odrl-policy-reasoning)

---

# The problem is bigger than permit or deny

A realistic policy engine may be asked:

- **Enforcement:** may Alice print this report?
- **Conditions:** does the permission apply only for research use?
- **Duties:** is attribution required before distribution is allowed?
- **Conflicts:** what if one rule permits an action and another prohibits it?
- **Subsumption:** does a broad policy already cover a narrower policy?
- **Incomplete information:** can the rules justify a definite answer at all?

These are different questions, but they are questions about the same policy
model.

---

# One small policy world

The example contains:

- parties such as `alice`, `bob`, `analysts`, and `anyone`;
- assets such as reports and datasets;
- actions such as `use`, `display`, `print`, `read`, and `aggregate`;
- permissions and prohibitions;
- constraints and duties;
- requests asking whether a concrete action may be performed.

For example, a policy can permit analysts to `use` reports while separately
prohibiting Alice from `print`ing one particular report.

That is enough to create a genuine policy conflict.

---

# Actions are related, not isolated

Policy actions can stand in several useful relationships.

```prolog
broader(use, present).
broader(present, display).
broader(use, print).

requires(aggregate, read).
```

So a rule about `use` can also be relevant to a request to `display` or
`print`, while `aggregate` may depend on `read` even though neither action is a
specialization of the other.

The example can therefore answer six kinds of action-matching question:

`exact`, `broader`, `narrower`, `required`, `requiring`, and `no_match`.

---

# Rules can be active, inactive, or irrelevant

A rule does not automatically apply just because its action looks similar to
the requested action.

The reasoner also checks the party, asset, constraints, and duties.

For example:

```prolog
permission(context_policy, research_use, analysts, use, reports).
constraint(research_use, purpose, research).
```

A research request can activate this permission. A commercial request reaches
the same rule but fails its constraint, so the rule is **inactive**. A request
for an unrelated action is simply **not applicable**.

This distinction matters: "the rule applies but its condition failed" is not
the same as "this rule has nothing to say about the request".

---

# Enforcement combines the applicable rules

Once individual rules have been evaluated, the policy can answer the practical
question: what should the system do?

The example demonstrates:

- an active permission becoming `permit`;
- an active prohibition becoming `deny`;
- a failed duty or constraint becoming `deny` in the closed evaluator;
- an unmatched request being permitted by an `open` evaluator;
- the same unmatched request being denied by `closed` or `default` behaviour.

So enforcement is built from the same rule facts used by the other reasoning
questions rather than being a separate policy representation.

---

# Conflicting rules need a policy decision

Suppose a request matches both a permission and a prohibition.

The example runs the same kind of conflict under all three ODRL conflict
strategies:

- `perm` — the permission wins;
- `prohibit` — the prohibition wins;
- `invalid` — the conflict invalidates the result.

This keeps **detecting a conflict** separate from **deciding what a policy does
with that conflict**.

That separation is useful because different policies may deliberately resolve
the same logical conflict in different ways.

---

# Conflicts can be indirect

Two rules do not need to mention exactly the same action to interfere with one
another.

The example detects three forms:

1. **Exact conflict** — permission and prohibition concern the same action.
2. **Subsumption conflict** — a broad permission such as `use` overlaps a
   narrower prohibition such as `print`.
3. **Dependency conflict** — a permitted action such as `aggregate` requires
   another action such as `read`, while `read` is prohibited.

This is why an action model is important: looking only for identical action
names would miss meaningful policy conflicts.

---

# Subsumption asks "does this already cover that?"

Subsumption turns policy comparison into another executable query.

At the action level:

```prolog
?- action_subsumes(use, display).
true.
```

At the rule level, the comparison also takes parties, assets, constraints, and
duties into account.

At the policy level, the reasoner asks whether every rule in a more specific
policy is covered by some rule in the more general policy.

This supports questions such as:

> Does policy A already express everything required by policy B?

The example contains both positive and negative cases for action, rule, and
whole-policy subsumption.

---

# Sometimes "yes or no" is the wrong choice

Rule systems can contain recursion through negation.

In simplified form:

```prolog
permission(X) :- tnot(prohibition(X)).
prohibition(X) :- tnot(permission(X)).
```

For a request caught in this negative cycle, arbitrarily choosing one side
would invent information that the rules do not justify.

EyeProlog uses **Well-Founded Semantics (WFS)**, which has three truth states:

- **true** — the claim can be established;
- **false** — its negation can be established;
- **undefined** — neither side is justified because the reasoning is cyclic.

---

# Undefined is useful information

The example deliberately asks three WFS questions:

```text
clear_permission  -> true
absent_permission -> false
negative_cycle    -> undefined
```

`undefined` is not an error and it is not a random third answer.

It tells the application that the policy knowledge itself does not determine a
stable true/false conclusion.

An enforcement layer can then choose how to handle that uncertainty — for
example by denying conservatively, asking for more information, or escalating
for review — without corrupting the logical result.

---

# Why put these questions in one reasoner?

A mixed *reasoning* approach can still have a single declarative home.

The example uses different logical capabilities where they fit:

- hierarchy and transitive reasoning for action relationships;
- ordinary rules for applicability and enforcement;
- structural reasoning for conflict detection and subsumption;
- negation and WFS for recursive defaults and incomplete conclusions.

They are not forced into one algorithm. They coexist behind one language, one
knowledge model, and one query mechanism.

That is the sense in which EyeProlog can be **"a reasoner to run them all."**

---

# What this example is — and is not

`odrl-policy-reasoning.pl` demonstrates the **reasoning layer** in plain
EyeProlog.

It is not intended to be a complete ODRL JSON-LD parser or a replacement for
the full ODRL information model. Other repository examples demonstrate RDF and
ODRL data handling.

Its purpose is narrower and practical: show that enforcement, conflict
analysis, subsumption, dependencies, constraints, duties, and three-valued WFS
reasoning can be queried coherently in one executable model.

---

# Try it yourself

Run the example in the browser:

**https://eyereasoner.github.io/eyeprolog/playground#example=odrl-policy-reasoning**

Then change one fact at a time:

- fulfil or remove a duty;
- change `research` to `commercial`;
- add or remove an action hierarchy edge;
- introduce a new prohibition;
- change the policy conflict strategy;
- create or break a negative cycle.

Then observe which enforcement, conflict, subsumption, and WFS answers change
together.
