# Medior — ARC Specification

## Status

This document is the **normative specification** for the Medior case. The file `medior.model.mjs` is the **reference ECMAScript implementation** of these clauses. The file `medior.data.json` is the **instance** evaluated in this bundle. The file `medior.expected.json` is the **conformance vector** for that instance.

## Insight Economy context

This case is a care-coordination reading of Ruben Verborgh’s
[Inside the Insight Economy](https://ruben.verborgh.org/blog/2025/08/12/inside-the-insight-economy/).
Its core move is that no party has to disclose the full patient record in order
to coordinate after discharge. The laboratory, medication list, and admission
history remain where they are. What crosses the coordination boundary is a
narrow, signed, expiring insight: this patient presently merits a continuity
bundle in the early post-discharge window.

The product being shared is therefore not a raw record, but a permissioned,
minimal conclusion for care coordination, with reuse for insurance pricing
explicitly forbidden.

## Conventions

- “iff” means “if and only if”.
- A clause identifier such as `R1` or `M3` is normative.
- A conforming implementation may be written in any language, but it shall produce the same derived values and pass/fail outcomes for the supplied instance.
- The reference implementation uses ECMAScript because you preferred an international-standard JS language.

## Vocabulary

**V1. Care region** is the healthcare network in which the coordination insight is used.

**V2. Post-discharge signal** is a patient-specific indicator relevant to continuity risk.

**V3. Care package** is an intervention option with cost and coverage properties.

**V4. Insight envelope** is the ordered pair `(insight, policy)` together with integrity metadata.

## Input instance

**I1.** The care region is `Flanders`.

**I2.** The estimated glomerular filtration rate is `52`.

**I3.** The active medication count is `9`.

**I4.** Admissions in the last 180 days equal `2`.

**I5.** Hours since discharge equal `18`.

**I6.** The budget cap is `€5`.

**I7.** The candidate packages are the four packages listed in `medior.data.json`.

## Derivation clauses

**R1. RenalSafetyConcern.**  
`RenalSafetyConcern` holds iff `eGFR < 60`.

**R2. PolypharmacyRisk.**  
`PolypharmacyRisk` holds iff `activeMedicationCount ≥ 8`.

**R3. ReadmissionHistory.**  
`ReadmissionHistory` holds iff `admissionsLast180Days ≥ 1`.

**R4. RecentDischargeWindow.**  
`RecentDischargeWindow` holds iff `hoursSinceDischarge ≤ 48`.

**R5. ActiveNeedCount.**  
`ActiveNeedCount` is the number of true predicates among `RenalSafetyConcern`, `PolypharmacyRisk`, `ReadmissionHistory`, and `RecentDischargeWindow`.

**R6. NeedsContinuityBundle.**  
`NeedsContinuityBundle` holds iff `ActiveNeedCount ≥ 3`.

## Selection clauses

**S1. Eligible(p).**  
A package `p` is eligible iff:

1. `p.costEUR ≤ budget.maxEUR`; and
2. for every active need, `p` covers that need.

**S2. RecommendedPackage.**  
`RecommendedPackage` is the eligible package with minimum `costEUR`.

**S3. No-package fallback.**  
If no eligible package exists, the recommendation is `None`.

## Governance clauses

**G1. AuthorizedUse.**  
`AuthorizedUse` holds iff:

1. the requested action is `odrl:use`;
2. the requested purpose is `care_coordination`; and
3. the authorization time is not later than the expiry time.

**G2. InsurancePricingProhibited.**  
`InsurancePricingProhibited` holds iff the policy prohibits distribution for purpose `insurance_pricing`.

**G3. DutyTimely.**  
`DutyTimely` holds iff the duty-performance time is not later than the expiry time.

## Integrity and minimization clauses

**M1. CanonicalEnvelope.**  
The canonical envelope string is the stable JSON serialization of the ordered pair `(insight, policy)`, with object keys sorted lexicographically at every level.

**M2. PayloadHashMatches.**  
`PayloadHashMatches` holds iff `SHA-256(CanonicalEnvelope) = declaredPayloadHashSHA256`.

**M3. SignatureVerifies.**  
`SignatureVerifies` holds iff the declared HMAC verifies under the agreed verification mode.

**M4. MinimizationRespected.**  
`MinimizationRespected` holds iff the serialized insight contains none of the forbidden terms: `name`, `address`, `ssn`, `fullrecord`, `genome`.

**M5. ScopeComplete.**  
`ScopeComplete` holds iff the insight contains `scopeDevice`, `scopeEvent`, and `expiresAt`.

## Output contract

**O1. Answer.**  
A conforming renderer shall expose:

- case name
- region
- metric
- active need count
- threshold
- recommended package
- budget cap
- package cost
- payload hash
- envelope HMAC

**O2. Reason Why.**  
A conforming renderer shall explain which predicates hold and why the package was selected.

**O3. Check.**  
A conforming renderer shall expose a named PASS/FAIL outcome for each of:

- payloadHashMatches
- signatureVerifies
- thresholdReached
- scopeComplete
- minimizationRespected
- authorizationAllowed
- dutyTimely
- insurancePricingProhibited
- packageWithinBudget
- packageCoversAllActiveNeeds
- lowestCostEligiblePackageChosen

## Reference outcome for this instance

For the supplied instance:

- `RenalSafetyConcern = true`
- `PolypharmacyRisk = true`
- `ReadmissionHistory = true`
- `RecentDischargeWindow = true`
- `ActiveNeedCount = 4`
- `NeedsContinuityBundle = true`
- `RecommendedPackage = "Medior Continuity Pulse"`

The expected ARC report and integrity values are recorded in `medior.expected.json`.
