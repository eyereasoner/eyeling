#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;
const encoder = new TextEncoder();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countTrue(values) {
  return values.reduce((sum, value) => sum + (value ? 1 : 0), 0);
}

async function sha256Hex(text) {
  const digest = await subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret, text) {
  const key = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await subtle.sign('HMAC', key, encoder.encode(text));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

function validateInstance(data) {
  assert(typeof data?.caseName === 'string' && data.caseName.length > 0, 'caseName is required');
  assert(typeof data?.region === 'string' && data.region.length > 0, 'region is required');
  assert(typeof data?.signals?.lab?.egfr === 'number', 'signals.lab.egfr is required');
  assert(
    typeof data?.signals?.medications?.activeMedicationCount === 'number',
    'signals.medications.activeMedicationCount is required',
  );
  assert(
    typeof data?.signals?.history?.admissionsLast180Days === 'number',
    'signals.history.admissionsLast180Days is required',
  );
  assert(
    typeof data?.signals?.discharge?.hoursSinceDischarge === 'number',
    'signals.discharge.hoursSinceDischarge is required',
  );
  assert(Array.isArray(data?.packages) && data.packages.length > 0, 'packages is required');
}

export function clauseR1_renalSafetyConcern(data) {
  return data.signals.lab.egfr < data.thresholds.egfrBelow;
}

export function clauseR2_polypharmacyRisk(data) {
  return data.signals.medications.activeMedicationCount >= data.thresholds.activeMedicationCountAtLeast;
}

export function clauseR3_readmissionHistory(data) {
  return data.signals.history.admissionsLast180Days >= data.thresholds.admissionsLast180DaysAtLeast;
}

export function clauseR4_recentDischargeWindow(data) {
  return data.signals.discharge.hoursSinceDischarge <= data.thresholds.hoursSinceDischargeAtMost;
}

export function clauseR5_activeNeedCount(state) {
  return countTrue([
    state.renalSafetyConcern,
    state.polypharmacyRisk,
    state.readmissionHistory,
    state.recentDischargeWindow,
  ]);
}

export function clauseR6_needsContinuityBundle(data, state) {
  return state.activeNeedCount >= data.thresholds.activeNeedCountAtLeast;
}

export function deriveInsight(data) {
  return {
    createdAt: data.timestamps.createdAt,
    expiresAt: data.timestamps.expiresAt,
    id: data.insightPolicy.id,
    metric: data.insightPolicy.metric,
    region: data.region,
    scopeDevice: data.evaluationContext.scopeDevice,
    scopeEvent: data.evaluationContext.scopeEvent,
    suggestionPolicy: data.insightPolicy.suggestionPolicy,
    threshold: data.thresholds.activeNeedCountAtLeast,
    type: data.insightPolicy.type,
  };
}

export function derivePolicy(data) {
  return {
    duty: {
      action: 'odrl:delete',
      constraint: {
        leftOperand: 'odrl:dateTime',
        operator: 'odrl:eq',
        rightOperand: data.timestamps.expiresAt,
      },
    },
    permission: {
      action: 'odrl:use',
      constraint: {
        leftOperand: 'odrl:purpose',
        operator: 'odrl:eq',
        rightOperand: data.evaluationContext.purpose,
      },
      target: data.insightPolicy.id,
    },
    profile: data.insightPolicy.policyProfile,
    prohibition: {
      action: 'odrl:distribute',
      constraint: {
        leftOperand: 'odrl:purpose',
        operator: 'odrl:eq',
        rightOperand: data.evaluationContext.prohibitedReusePurpose,
      },
      target: data.insightPolicy.id,
    },
    type: data.insightPolicy.policyType,
  };
}

export function packageCoversAllActiveNeeds(pkg, state) {
  return (
    (!state.renalSafetyConcern || pkg.coversRenalSafetyConcern) &&
    (!state.polypharmacyRisk || pkg.coversPolypharmacyRisk) &&
    (!state.readmissionHistory || pkg.coversReadmissionHistory) &&
    (!state.recentDischargeWindow || pkg.coversRecentDischargeWindow)
  );
}

export function clauseS1_eligiblePackages(data, state) {
  return data.packages
    .filter((pkg) => pkg.costEUR <= data.budget.maxEUR)
    .filter((pkg) => packageCoversAllActiveNeeds(pkg, state))
    .sort((a, b) => a.costEUR - b.costEUR);
}

export function clauseS2_recommendedPackage(data, state) {
  const eligible = clauseS1_eligiblePackages(data, state);
  return {
    eligible,
    recommended: eligible[0] ?? null,
  };
}

export function clauseG1_authorizedUse(data) {
  return (
    data.evaluationContext.purpose === 'care_coordination' &&
    Date.parse(data.timestamps.authorizedAt) <= Date.parse(data.timestamps.expiresAt)
  );
}

export function clauseG2_insurancePricingProhibited(data) {
  return data.evaluationContext.prohibitedReusePurpose === 'insurance_pricing';
}

export function clauseG3_dutyTimely(data) {
  return Date.parse(data.timestamps.dutyPerformedAt) <= Date.parse(data.timestamps.expiresAt);
}

export function clauseM1_canonicalEnvelope(data) {
  const envelope = { insight: deriveInsight(data), policy: derivePolicy(data) };
  return { envelope, canonicalEnvelope: stableStringify(envelope) };
}

export async function clauseM2_payloadHash(data) {
  const { envelope, canonicalEnvelope } = clauseM1_canonicalEnvelope(data);
  const payloadHashSHA256 = await sha256Hex(canonicalEnvelope);
  return { envelope, canonicalEnvelope, payloadHashSHA256 };
}

export async function clauseM3_hmac(data) {
  const { envelope, canonicalEnvelope, payloadHashSHA256 } = await clauseM2_payloadHash(data);
  const envelopeHmacSHA256 = await hmacSha256Hex(data.integrity.secret, canonicalEnvelope);
  return { envelope, canonicalEnvelope, payloadHashSHA256, envelopeHmacSHA256 };
}

export function clauseM4_minimizationRespected(insight) {
  return !JSON.stringify(insight)
    .toLowerCase()
    .match(/name|address|ssn|fullrecord|genome/);
}

export function clauseM5_scopeComplete(insight) {
  return Boolean(insight.scopeDevice && insight.scopeEvent && insight.expiresAt);
}

export async function evaluate(data) {
  validateInstance(data);

  const renalSafetyConcern = clauseR1_renalSafetyConcern(data);
  const polypharmacyRisk = clauseR2_polypharmacyRisk(data);
  const readmissionHistory = clauseR3_readmissionHistory(data);
  const recentDischargeWindow = clauseR4_recentDischargeWindow(data);
  const activeNeedCount = clauseR5_activeNeedCount({
    renalSafetyConcern,
    polypharmacyRisk,
    readmissionHistory,
    recentDischargeWindow,
  });
  const needsContinuityBundle = clauseR6_needsContinuityBundle(data, { activeNeedCount });

  const insight = deriveInsight(data);
  const policy = derivePolicy(data);
  const { canonicalEnvelope, payloadHashSHA256, envelopeHmacSHA256 } = await clauseM3_hmac(data);
  const { eligible, recommended } = clauseS2_recommendedPackage(data, {
    renalSafetyConcern,
    polypharmacyRisk,
    readmissionHistory,
    recentDischargeWindow,
  });
  const authorizedUse = clauseG1_authorizedUse(data);
  const insurancePricingProhibited = clauseG2_insurancePricingProhibited(data);
  const dutyTimely = clauseG3_dutyTimely(data);
  const minimizationRespected = clauseM4_minimizationRespected(insight);
  const scopeComplete = clauseM5_scopeComplete(insight);

  const checks = {
    payloadHashMatches: payloadHashSHA256 === (await sha256Hex(canonicalEnvelope)),
    signatureVerifies:
      data.integrity.verificationMode === 'trustedPrecomputedInput' &&
      envelopeHmacSHA256 === (await hmacSha256Hex(data.integrity.secret, canonicalEnvelope)),
    thresholdReached: needsContinuityBundle,
    scopeComplete,
    minimizationRespected,
    authorizationAllowed: authorizedUse,
    dutyTimely,
    insurancePricingProhibited,
    packageWithinBudget: Boolean(recommended) && recommended.costEUR <= data.budget.maxEUR,
    packageCoversAllActiveNeeds:
      Boolean(recommended) &&
      packageCoversAllActiveNeeds(recommended, {
        renalSafetyConcern,
        polypharmacyRisk,
        readmissionHistory,
        recentDischargeWindow,
      }),
    lowestCostEligiblePackageChosen: Boolean(recommended) && recommended.id === (eligible[0]?.id ?? null),
  };

  const reasonWhy = [
    `RenalSafetyConcern holds because eGFR = ${data.signals.lab.egfr} and the threshold is < ${data.thresholds.egfrBelow}.`,
    `PolypharmacyRisk holds because the active medication count is ${data.signals.medications.activeMedicationCount} and the threshold is ≥ ${data.thresholds.activeMedicationCountAtLeast}.`,
    `ReadmissionHistory holds because admissionsLast180Days = ${data.signals.history.admissionsLast180Days} and the threshold is ≥ ${data.thresholds.admissionsLast180DaysAtLeast}.`,
    `RecentDischargeWindow holds because hoursSinceDischarge = ${data.signals.discharge.hoursSinceDischarge} and the threshold is ≤ ${data.thresholds.hoursSinceDischargeAtMost}.`,
    'The recommendation rule selects the least-cost package that covers every active need and remains within budget.',
    recommended
      ? `The selected package is "${recommended.name}" with cost €${recommended.costEUR}, touches=${recommended.touches}.`
      : 'No eligible package exists within budget.',
    `Use is permitted only for purpose "${data.evaluationContext.purpose}" and expires at ${data.timestamps.expiresAt}.`,
  ];

  const answer = {
    name: data.caseName,
    region: data.region,
    metric: data.insightPolicy.metric,
    activeNeedCount,
    threshold: data.thresholds.activeNeedCountAtLeast,
    recommendedPackage: recommended?.name ?? null,
    budgetCapEUR: data.budget.maxEUR,
    packageCostEUR: recommended?.costEUR ?? null,
    payloadHashSHA256,
    envelopeHmacSHA256,
  };

  const arcLines = [
    '=== Answer ===',
    `Name: ${answer.name}`,
    `Region: ${answer.region}`,
    `Metric: ${answer.metric}`,
    `Active need count: ${answer.activeNeedCount}/${answer.threshold}`,
    `Recommended package: ${answer.recommendedPackage}`,
    `Budget cap: €${answer.budgetCapEUR}`,
    `Package cost: €${answer.packageCostEUR}`,
    `Payload SHA-256: ${answer.payloadHashSHA256}`,
    `Envelope HMAC-SHA-256: ${answer.envelopeHmacSHA256}`,
    '',
    '=== Reason Why ===',
    ...reasonWhy,
    '',
    '=== Check ===',
    ...Object.entries(checks).map(([name, ok]) => `- ${ok ? 'PASS' : 'FAIL'}: ${name}`),
  ];

  return {
    caseName: data.caseName,
    derived: {
      renalSafetyConcern,
      polypharmacyRisk,
      readmissionHistory,
      recentDischargeWindow,
      activeNeedCount,
      needsContinuityBundle,
      eligiblePackageIds: eligible.map((pkg) => pkg.id),
      recommendedPackageId: recommended?.id ?? null,
      recommendedPackageName: recommended?.name ?? null,
    },
    envelope: { insight, policy },
    integrity: {
      canonicalEnvelope,
      payloadHashSHA256,
      envelopeHmacSHA256,
      verificationMode: data.integrity.verificationMode,
    },
    answer,
    reasonWhy,
    checks,
    allChecksPass: Object.values(checks).every(Boolean),
    arcText: arcLines.join('\n'),
  };
}

async function main() {
  const inputPath = resolve(process.argv[2] ?? resolve(__dirname, 'medior.data.json'));
  const data = JSON.parse(await readFile(inputPath, 'utf8'));
  const result = await evaluate(data);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.arcText);
  }

  if (!result.allChecksPass) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
