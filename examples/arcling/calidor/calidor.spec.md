# Calidor — ARC Specification

## Status

This document is the normative specification for the Calidor case. The file `calidor.model.go` is the reference Go implementation of these clauses. The file `calidor.data.json` is the instance evaluated in this bundle. The file `calidor.expected.json` is the conformance vector for that instance.

## Insight Economy context

This case models municipal heatwave support. A household gateway observes local indoor heat stress, local vulnerability signals, and local prepaid-energy stress. Those raw details remain local. The system shares only a narrow, expiring insight that the household qualifies for priority cooling support during the current heat-alert window.

The city may use that insight for heatwave response. It may not reuse it for unrelated purposes such as tenant screening.

## Conventions

- “iff” means “if and only if”.
- A clause identifier such as `R1` or `G2` is normative.
- A conforming implementation may be written in any language, but it shall produce the same derived values and pass/fail outcomes for the supplied instance.
- The reference implementation in this bundle is written in Go.
- Input validation is part of the reference model. A malformed instance shall fail before evaluation.

## Vocabulary

**V1. Heat alert** is the municipal emergency context.

**V2. Unsafe indoor heat** is sustained indoor temperature at or above the configured threshold.

**V3. Vulnerability presence** is the existence of at least one local heat-sensitivity or mobility-related flag.

**V4. Energy constraint** is insufficient prepaid energy credit to sustain cooling use.

**V5. Support package** is a municipal assistance option with a cost and a set of capabilities.

**V6. Insight envelope** is the ordered pair `(insight, policy)` together with integrity metadata.

## Input instance

**I1.** The municipality is `Calidor`.

**I2.** The current heat alert level is `4`.

**I3.** The alert threshold is `3`.

**I4.** The current indoor temperature is `31.4` °C.

**I5.** Unsafe indoor heat requires at least `30.0` °C for at least `6` hours.

**I6.** The household has local vulnerability flags.

**I7.** Remaining prepaid energy credit is `3.2` EUR.

**I8.** Energy constraint holds at or below `5.0` EUR.

**I9.** Priority cooling support requires at least `3` active needs.

**I10.** The support catalog is the one listed in `calidor.data.json`.

## Derivation clauses

**R1. HeatAlertActive.** `HeatAlertActive` holds iff `currentAlertLevel ≥ alertLevelAtLeast`.

**R2. UnsafeIndoorHeat.** `UnsafeIndoorHeat` holds iff:

1. `currentIndoorTempC ≥ indoorTempCAtLeast`; and
2. `hoursAtOrAboveThreshold ≥ hoursAtOrAboveThresholdAtLeast`.

**R3. VulnerabilityPresent.** `VulnerabilityPresent` holds iff the local vulnerability flag list is non-empty.

**R4. EnergyConstraint.** `EnergyConstraint` holds iff `remainingPrepaidCreditEur ≤ energyCreditEurAtMost`.

**R5. ActiveNeedCount.** `ActiveNeedCount` is the number of true predicates among:

- `HeatAlertActive`
- `UnsafeIndoorHeat`
- `VulnerabilityPresent`
- `EnergyConstraint`

**R6. PriorityCoolingSupportNeeded.** `PriorityCoolingSupportNeeded` holds iff `ActiveNeedCount ≥ minimumActiveNeedCount`.

**R7. RequiredCapabilities.** The required capability set is formed as follows:

1. if `HeatAlertActive` and `UnsafeIndoorHeat`, include `cooling_kit`;
2. if `VulnerabilityPresent`, include `welfare_check` and `transport`;
3. if `EnergyConstraint`, include `bill_credit`.

The resulting set is sorted lexically for reporting.

**R8. EligiblePackage(p).** For a package `p`, `EligiblePackage(p)` holds iff:

1. `p.costEur ≤ maxPackageCostEur`; and
2. `p.capabilities` cover every entry in `RequiredCapabilities`.

**R9. RecommendedPackage.** `RecommendedPackage` is the eligible package with minimum `costEur`, breaking ties lexically by `id`.

## Governance clauses

**G1. AuthorizedUse.** `AuthorizedUse` holds iff:

1. the requested action is `odrl:use`;
2. the requested purpose is `heatwave_response`; and
3. the authorization time is not later than the expiry time.

**G2. TenantScreeningProhibited.** `TenantScreeningProhibited` holds iff the policy prohibits distribution for purpose `tenant_screening`.

**G3. DutyTimely.** `DutyTimely` holds iff the duty-performance time is not later than the expiry time.

## Integrity and minimization clauses

**M1. CanonicalEnvelope.** The canonical envelope string is the JSON serialization of the ordered pair `(insight, policy)` with keys emitted in this exact sequence:

- insight: `createdAt`, `expiresAt`, `id`, `metric`, `municipality`, `scopeDevice`, `scopeEvent`, `supportPolicy`, `threshold`, `type`
- policy: `duty`, `permission`, `profile`, `prohibition`, `type`

For this case, `threshold` is serialized lexically as `3.0` rather than `3`, because the integrity vector is defined over those exact envelope bytes.

**M2. PayloadHashMatches.** `PayloadHashMatches` holds iff the model-computed SHA-256 of `CanonicalEnvelope` equals the expected SHA-256 value recorded in the conformance vector.

**M3. SignatureVerifies.** `SignatureVerifies` holds iff the model-computed HMAC-SHA-256 of `CanonicalEnvelope` equals the expected HMAC value recorded in the conformance vector.

**M4. MinimizationRespected.** `MinimizationRespected` holds iff the serialized insight contains none of the forbidden terms:

- `heat_sensitive_condition`
- `mobility_limitation`
- `credit`
- `meter_trace`

**M5. ScopeComplete.** `ScopeComplete` holds iff the insight contains `scopeDevice`, `scopeEvent`, and `expiresAt`.

## Output contract

**O1. Answer.** A conforming renderer shall expose:

- the main recommendation sentence
- recommended package
- required capabilities
- payload hash
- envelope HMAC

**O2. Reason Why.** A conforming renderer shall explain that raw household heat, vulnerability, and prepaid-energy details remain local and that only a narrow heatwave-response insight is shared.

**O3. Check.** A conforming renderer shall expose a named yes/no or PASS/FAIL outcome for each of:

- `signatureVerifies`
- `payloadHashMatches`
- `minimizationRespected`
- `scopeComplete`
- `authorizationAllowed`
- `heatAlertActive`
- `unsafeIndoorHeat`
- `priorityCoolingSupportNeeded`
- `recommendedPackageEligible`
- `dutyTimingConsistent`
- `tenantScreeningProhibited`

## Reference outcome for this instance

For the supplied instance:

- `HeatAlertActive = true`
- `UnsafeIndoorHeat = true`
- `VulnerabilityPresent = true`
- `EnergyConstraint = true`
- `ActiveNeedCount = 4`
- `PriorityCoolingSupportNeeded = true`
- `RecommendedPackage = "Calidor Priority Cooling Bundle"`

The expected ARC report and integrity values are recorded in `calidor.expected.json`.
