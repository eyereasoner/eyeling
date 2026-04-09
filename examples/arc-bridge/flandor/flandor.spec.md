# Flandor — Semi-Formal ARC Specification

## Status

This document is the **normative specification** for the Flandor case.
The file `flandor.model.mjs` is the **reference ECMAScript implementation** of these clauses.
The file `flandor.data.json` is the **instance** evaluated in this bundle.
The file `flandor.expected.json` is the **conformance vector** for that instance.

## Aha

Nobody has to reveal their books for the region to coordinate.

Firm-side, labour-side, and grid-side evidence remain local. What crosses the policy boundary is a narrow,
signed, expiring conclusion: Flanders presently faces enough combined pressure to justify a temporary
retooling response. The traded product is not raw data, but a permissioned conclusion.

## Conventions

- “iff” means “if and only if”.
- A clause identifier such as `R1` or `M3` is normative.
- A conforming implementation may be written in any language, but it shall produce the same derived
  values and pass/fail outcomes for the supplied instance.
- The reference implementation uses ECMAScript because you preferred an international-standard JS language.

## Vocabulary

**V1. Region** is the polity for which a macro-economic insight is derived.

**V2. Industrial cluster** is a regional production grouping with an export-orders index.

**V3. Labour-market signal** is a regional indicator that includes the technical vacancy rate.

**V4. Grid signal** is a regional indicator that includes congestion hours.

**V5. Policy package** is an intervention option with cost and coverage properties.

**V6. Insight envelope** is the ordered pair `(insight, policy)` together with integrity metadata.

## Input instance

**I1.** The region is `Flanders`.

**I2.** The observed clusters are Antwerp chemicals and Ghent manufacturing.

**I3.** The technical vacancy rate is `4.6%`.

**I4.** Grid congestion is `19` hours.

**I5.** The budget cap is `€140M`.

**I6.** The candidate packages are the four packages listed in `flandor.data.json`.

## Derivation clauses

**R1. ExportWeakness.**  
`ExportWeakness` holds iff there exists a cluster `c` such that `c.exportOrdersIndex < 90`.

**R2. SkillsStrain.**  
`SkillsStrain` holds iff `technicalVacancyRatePct > 3.9`.

**R3. GridStress.**  
`GridStress` holds iff `congestionHours > 11`.

**R4. ActiveNeedCount.**  
`ActiveNeedCount` is the number of true predicates among `ExportWeakness`, `SkillsStrain`, and `GridStress`.

**R5. NeedsRetoolingPulse.**  
`NeedsRetoolingPulse` holds iff `ActiveNeedCount ≥ 3`.

## Selection clauses

**S1. Eligible(p).**  
A package `p` is eligible iff:
1. `p.costMEUR ≤ budget.maxMEUR`; and
2. for every active need, `p` covers that need.

**S2. RecommendedPackage.**  
`RecommendedPackage` is the eligible package with minimum `costMEUR`.

**S3. No-package fallback.**  
If no eligible package exists, the recommendation is `None`.

## Governance clauses

**G1. AuthorizedUse.**  
`AuthorizedUse` holds iff:
1. the requested action is `odrl:use`;
2. the requested purpose is `regional_stabilization`; and
3. the authorization time is not later than the expiry time.

**G2. SurveillanceReuseProhibited.**  
`SurveillanceReuseProhibited` holds iff the policy prohibits distribution for purpose `firm_surveillance`.

**G3. DutyTimely.**  
`DutyTimely` holds iff the duty-performance time is not later than the expiry time.

## Integrity and minimization clauses

**M1. CanonicalEnvelope.**  
The canonical envelope string is the stable JSON serialization of the ordered pair `(insight, policy)`,
with object keys sorted lexicographically at every level.

**M2. PayloadHashMatches.**  
`PayloadHashMatches` holds iff `SHA-256(CanonicalEnvelope) = declaredPayloadHashSHA256`.

**M3. SignatureVerifies.**  
`SignatureVerifies` holds iff the declared HMAC verifies under the agreed verification mode.

**M4. MinimizationRespected.**  
`MinimizationRespected` holds iff the serialized insight contains none of the forbidden terms:
`salary`, `payroll`, `invoice`, `medical`, `firmname`.

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
- surveillanceReuseProhibited
- packageWithinBudget
- packageCoversAllActiveNeeds
- lowestCostEligiblePackageChosen

## Reference outcome for this instance

For the supplied instance:
- `ExportWeakness = true`
- `SkillsStrain = true`
- `GridStress = true`
- `ActiveNeedCount = 3`
- `NeedsRetoolingPulse = true`
- `RecommendedPackage = "Flandor Retooling Pulse"`

The expected ARC report and integrity values are recorded in `flandor.expected.json`.
