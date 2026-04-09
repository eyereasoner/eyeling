# Delfour — ARC Specification

## Status

This document is the **normative specification** for the Delfour case. The file `delfour.model.mjs` is the **reference ECMAScript implementation** of these clauses. The file `delfour.data.json` is the **instance** evaluated in this bundle. The file `delfour.expected.json` is the **conformance vector** for that instance.

## Insight Economy context

This case is the household-scale reading of Ruben Verborgh’s [Inside the Insight Economy](https://ruben.verborgh.org/blog/2025/08/12/inside-the-insight-economy/). Its core claim is that a person can share a useful shopping hint without exposing sensitive health details. A phone turns a private condition into a neutral, limited insight such as "prefer lower-sugar products", attaches clear usage rules and an expiry time, and sends it to a store scanner.

The scanner may use that insight to suggest a better product, but not for unrelated purposes such as marketing. The scanner does not need the diagnosis. It only needs the right shopping conclusion.

## Conventions

- “iff” means “if and only if”.
- A clause identifier such as `R1` or `M3` is normative.
- A conforming implementation may be written in any language, but it shall produce the same derived values and pass/fail outcomes for the supplied instance.
- The reference implementation uses ECMAScript because you preferred an international-standard JS language.

## Vocabulary

**V1. Household condition** is a private fact local to the phone.

**V2. Low-sugar need** is a neutral shopping need derived from the household condition.

**V3. Scanned product** is the product presently under consideration by the store self-scanner.

**V4. Candidate alternative** is a catalog product considered as a possible substitute.

**V5. Insight envelope** is the ordered pair `(insight, policy)` together with integrity metadata.

## Input instance

**I1.** The retailer is `Delfour`.

**I2.** The household condition is `Diabetes`.

**I3.** The scanned product is `Classic Tea Biscuits`.

**I4.** The sugar threshold is `10.0` grams per serving.

**I5.** The catalog contains the four products listed in `delfour.data.json`.

## Derivation clauses

**R1. NeedsLowSugar.** `NeedsLowSugar` holds iff the household condition is `Diabetes`.

**R2. HighSugarScanned.** `HighSugarScanned` holds iff the scanned product has `sugarPerServing ≥ 10.0`.

**R3. LowerSugarCandidate(p).** For a product `p`, `LowerSugarCandidate(p)` holds iff `p.sugarTenths < scannedProduct.sugarTenths`.

**R4. RecommendedAlternative.** `RecommendedAlternative` is the candidate product with minimum `sugarTenths` among all products `p` such that `LowerSugarCandidate(p)` holds.

**R5. AlternativeLowersSugar.** `AlternativeLowersSugar` holds iff the recommended alternative exists and has strictly lower `sugarTenths` than the scanned product.

## Governance clauses

**G1. AuthorizedUse.** `AuthorizedUse` holds iff:

1. the requested action is `odrl:use`;
2. the requested purpose is `shopping_assist`; and
3. the authorization time is not later than the expiry time.

**G2. MarketingProhibited.** `MarketingProhibited` holds iff the policy prohibits distribution for purpose `marketing`.

**G3. DutyTimely.** `DutyTimely` holds iff the duty-performance time is not later than the expiry time.

## Integrity and minimization clauses

**M1. CanonicalEnvelope.** The canonical envelope string is the JSON serialization of the ordered pair `(insight, policy)` with keys emitted in this exact sequence:

- insight: `createdAt`, `expiresAt`, `id`, `metric`, `retailer`, `scopeDevice`, `scopeEvent`, `suggestionPolicy`, `threshold`, `type`
- policy: `duty`, `permission`, `profile`, `prohibition`, `type`

For this case, `threshold` is serialized lexically as `10.0` rather than `10`, because the integrity vector is defined over the exact envelope bytes used by the specialized Delfour driver.

**M2. PayloadHashMatches.** `PayloadHashMatches` holds iff `SHA-256(CanonicalEnvelope) = declaredPayloadHashSHA256`.

**M3. SignatureVerifies.** `SignatureVerifies` holds iff the declared HMAC verifies under the agreed verification mode.

**M4. MinimizationRespected.** `MinimizationRespected` holds iff the serialized insight contains none of the forbidden terms: `diabetes`, `medical`.

**M5. ScopeComplete.** `ScopeComplete` holds iff the insight contains `scopeDevice`, `scopeEvent`, and `expiresAt`.

## Output contract

**O1. Answer.** A conforming renderer shall expose:

- the main recommendation sentence
- scanned product
- suggested alternative
- payload hash
- envelope HMAC

**O2. Reason Why.** A conforming renderer shall explain the household-to-insight desensitization and the scoped shopping purpose.

**O3. Check.** A conforming renderer shall expose a named yes/no or PASS/FAIL outcome for each of:

- signatureVerifies
- payloadHashMatches
- minimizationRespected
- scopeComplete
- authorizationAllowed
- highSugarBanner
- alternativeLowersSugar
- dutyTimingConsistent
- marketingProhibited

## Reference outcome for this instance

For the supplied instance:

- `NeedsLowSugar = true`
- `HighSugarScanned = true`
- `RecommendedAlternative = "Low-Sugar Tea Biscuits"`
- `AlternativeLowersSugar = true`

The expected ARC report and integrity values are recorded in `delfour.expected.json`.
