# ODRL + DPV Risk Assessment

## Ranked, explainable output from machine-readable “Terms of Service”

This deck explains the logic behind `odrl-dpv-risk-ranked.n3`: how an agreement is modeled in **ODRL**, how risks are expressed in **DPV**, and how **N3 rules** connect the two into a ranked report. ([GitHub][1])

---

## The  idea

We want ToS / policy clauses that are:

* **Readable by humans** (the actual clause text)
* **Processable by machines** (permissions, prohibitions, duties, constraints)
* **Auditable** (why a risk was flagged)
* **Actionable** (what mitigations to add)
* **Prioritized** (ranked by score)

This example does that by combining **ODRL** (policy structure) + **DPV** (risk vocabulary) + **N3 rules** (logic). ([GitHub][1])

---

## Why ODRL matters here

ODRL is used to encode the *normative* structure of agreements:

* **Permission**: something is allowed
* **Prohibition**: something is disallowed
* **Duty**: something must be done (e.g., inform)
* **Constraint**: conditions like “noticeDays ≥ 14”

This turns ToS clauses into a structured “policy graph” you can reason over. ([W3C][2])

---

## Why DPV matters here

DPV provides shared terms to describe privacy-related concepts, including:

* **dpv:Risk**
* consequences / impacts
* severity & risk level (via the DPV Risk extension)

So the output isn’t just “something seems bad”, but *typed, interoperable risks* that other systems can understand. ([DPV Risk & Impact Assessment][3])

---

## What the file contains (5 parts)

1. **Consumer profile** (needs + importance weights)
2. **Agreement** as an **ODRL policy graph** + linked clause text
3. **Risk rules**: patterns over ODRL → create DPV risks + mitigations
4. **Score + severity/level** classification
5. **Ranked explainable output** strings

All in one Notation3 (N3) program. ([GitHub][1])

---

## Part 1 — Consumer profile (what the user cares about)

The example profile defines four “needs”, each with an importance weight:

| Need                       | Meaning                                | Importance |
| -------------------------- | -------------------------------------- | ---------: |
| Data cannot be removed     | provider shouldn’t remove account/data |         20 |
| Changes need notice        | must notify ≥ 14 days                  |         15 |
| No sharing without consent | explicit consent required              |         12 |
| Data portability           | must allow export                      |         10 |

These weights later boost the risk score when a need is violated. ([GitHub][1])

---

## Part 2 — Agreement modeled as ODRL

Inside a quoted graph (`:policyGraph { ... }`) the policy defines:

* **C1** Permission to remove account/data
* **C2** Permission to change terms with an **inform duty** and **noticeDays ≥ 3**
* **C3** Permission to share user data (no consent safeguard)
* **C4** Prohibition to export data (blocks portability)

Each ODRL rule links to a `:Clause` resource that stores the human text. ([GitHub][1])

---

## ODRL clause pattern (how to read it)

A typical ODRL rule here looks like:

* **assigner**: provider
* **assignee**: consumer
* **action**: (removeAccount / shareData / changeTerms / exportData)
* **target**: (UserAccount / UserData / AgreementText)
* optional **duty** (e.g., inform)
* optional **constraint** (e.g., noticeDays threshold)

That structure is what the logic rules match on. ([GitHub][1])

---

## Part 3 — The logic bridge: N3 rules

Each risk rule follows the same recipe:

1. **Match** a clause in the policy graph (`log:includes`)
2. **Detect missing safeguards** (`log:notIncludes`) or insufficient safeguards (comparisons)
3. **Create** a DPV risk instance (`dpv:Risk`) + risk source + explanation text
4. **Attach mitigations** as `dpv:RiskMitigationMeasure`
5. **Store** a numeric score seed (`:scoreRaw`)

Key N3 tools you’ll see:

* `log:includes` / `log:notIncludes` for scoped graph checks ([w3c.github.io][4])
* `log:skolem` to mint stable identifiers for risks/measures ([GitHub][1])
* `string:format`, `math:sum`, `math:difference`, comparisons, etc. ([GitHub][1])

---

## Deep dive: Rule R3 (share data without consent)

**Natural language translation:**

> If the agreement permits sharing user data, and the consumer requires “no sharing without explicit consent”, and the policy graph does **not** contain a consent constraint for that sharing permission, then generate a DPV risk “unwanted disclosure”, explain it, score it, and suggest adding a consent constraint.

This is exactly what `log:includes` + `log:notIncludes` is doing. ([GitHub][1])

---

## R3 “missing safeguard” pattern (conceptual)

```n3
?G log:includes    { :PermShareData odrl:action tosl:shareData . } .
?G log:notIncludes { :PermShareData odrl:constraint [
    odrl:leftOperand tosl:consent ;
    odrl:operator odrl:eq ;
    odrl:rightOperand true
] . } .
```

Result: create `dpv:Risk` + add mitigation “Add explicit consent constraint before data sharing.” ([GitHub][1])

---

## Part 4 — Scoring and DPV risk levels

### Scoring (simple and explainable)

Each rule computes:

* `:scoreRaw = base + needImportance`
* then caps at **100**

### Mapping score → severity/level

* **80–100** → High severity / High risk
* **50–79** → Moderate
* **0–49** → Low

This gives a consistent DPV-style classification (`dpv:hasSeverity`, `dpv:hasRiskLevel`). ([GitHub][1])

---

## What the example will rank (with the given numbers)

From the file’s constants + importance weights:

1. **C1 account removal w/o notice + inform**
   base 90 + 20 = 110 → capped **100** (High)
2. **C3 sharing w/o consent**
   base 85 + 12 = **97** (High)
3. **C2 terms change notice too short (3 < 14)**
   base 70 + 15 = **85** (High)
4. **C4 export prohibited (no portability)**
   base 60 + 10 = **70** (Moderate)

So the “worst” risks appear first. ([GitHub][1])

---

## Part 5 — Ranked, explainable output

Instead of “printing during reasoning”, the program emits facts like:

* `log:outputString "..."`

Then Eyeling’s `--strings` / `-r` mode collects and sorts them deterministically. ([GitHub][5])

To force ranking, it uses an **inverse score key**:

* `inv = 1000 - score`
* smaller `inv` → higher score → printed first

That’s why high-risk items appear at the top. ([GitHub][1])

---

## What makes it “explainable”

Every risk carries:

* **Which clause** it came from (`:aboutClause`, clauseId + text)
* **Which need** it violated (`:violatesNeed`)
* A human explanation string (`dct:description`, built with `string:format`)
* Suggested **mitigations**, each with a description and even a “patch-like” triple snippet (`:suggestAdd { ... }`)

So you can show a ranked report *and* justify every item. ([GitHub][1])

---

## Why this ODRL + DPV combo is powerful

* **ODRL** gives you the “contract logic” backbone (may/must/must-not + conditions)
* **DPV** gives you the “privacy/risk language” that tools can share
* **N3** glues them with rules that are:

  * easy to audit
  * easy to extend
  * deterministic to run

This is a practical path from “legal-ish text” → “structured policy” → “ranked risk insights”. ([W3C][2])

---

## How you’d extend this in real life

1. **Add more needs** (e.g., retention limits, security measures, breach notice)
2. **Model more clause types** in ODRL (more actions, constraints, duties)
3. **Write additional risk rules**, each with:

   * pattern match
   * missing/weak safeguard test
   * DPV risk type + mitigation
4. Tune scoring:

   * different bases per risk category
   * incorporate likelihood, data sensitivity, etc.

This stays explainable because it remains rule-based. ([GitHub][1])

---

## Closing takeaway

This file is a compact demo of:

* ODRL as **machine-readable agreement structure**
* DPV as **machine-readable privacy risk output**
* N3 reasoning as the **transparent logic** connecting them
* A ranked report that’s **deterministic** and **explainable**

[1]: https://eyereasoner.github.io/eyeling/demo?url=https://raw.githubusercontent.com/eyereasoner/eyeling/refs/heads/main/examples/odrl-dpv-risk-ranked.n3 "Playground"
[2]: https://www.w3.org/TR/odrl-vocab/ "ODRL Vocabulary & Expression 2.2"
[3]: https://dev.dpvcg.org/dpv/modules/risk "Risk and Impact Assessment"
[4]: https://w3c.github.io/N3/spec/ "Notation3 Language"
[5]: https://eyereasoner.github.io/eyeling/HANDBOOK "Handbook Inside Eyeling"

