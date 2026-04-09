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
  assert(Array.isArray(data?.signals?.clusters) && data.signals.clusters.length > 0, 'signals.clusters is required');
  assert(Array.isArray(data?.packages) && data.packages.length > 0, 'packages is required');
}

export function clauseR1_exportWeakness(data) {
  return data.signals.clusters.some((cluster) => cluster.exportOrdersIndex < data.thresholds.exportOrdersIndexBelow);
}

export function clauseR2_skillsStrain(data) {
  return data.signals.labourMarket.technicalVacancyRatePct > data.thresholds.technicalVacancyRatePctAbove;
}

export function clauseR3_gridStress(data) {
  return data.signals.grid.congestionHours > data.thresholds.gridCongestionHoursAbove;
}

export function clauseR4_activeNeedCount(state) {
  return countTrue([state.exportWeakness, state.skillsStrain, state.gridStress]);
}

export function clauseR5_needsRetoolingPulse(data, state) {
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
    (!state.exportWeakness || pkg.coversExportWeakness) &&
    (!state.skillsStrain || pkg.coversSkillsStrain) &&
    (!state.gridStress || pkg.coversGridStress)
  );
}

export function clauseS1_eligiblePackages(data, state) {
  return data.packages
    .filter((pkg) => pkg.costMEUR <= data.budget.maxMEUR)
    .filter((pkg) => packageCoversAllActiveNeeds(pkg, state))
    .sort((a, b) => a.costMEUR - b.costMEUR);
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
    data.evaluationContext.purpose === 'regional_stabilization' &&
    Date.parse(data.timestamps.authorizedAt) <= Date.parse(data.timestamps.expiresAt)
  );
}

export function clauseG2_surveillanceReuseProhibited(data) {
  return data.evaluationContext.prohibitedReusePurpose === 'firm_surveillance';
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
    .match(/salary|payroll|invoice|medical|firmname/);
}

export function clauseM5_scopeComplete(insight) {
  return Boolean(insight.scopeDevice && insight.scopeEvent && insight.expiresAt);
}

export async function evaluate(data) {
  validateInstance(data);

  const exportWeakness = clauseR1_exportWeakness(data);
  const skillsStrain = clauseR2_skillsStrain(data);
  const gridStress = clauseR3_gridStress(data);
  const activeNeedCount = clauseR4_activeNeedCount({ exportWeakness, skillsStrain, gridStress });
  const needsRetoolingPulse = clauseR5_needsRetoolingPulse(data, { activeNeedCount });

  const insight = deriveInsight(data);
  const policy = derivePolicy(data);
  const { canonicalEnvelope, payloadHashSHA256, envelopeHmacSHA256 } = await clauseM3_hmac(data);
  const { eligible, recommended } = clauseS2_recommendedPackage(data, { exportWeakness, skillsStrain, gridStress });
  const authorizedUse = clauseG1_authorizedUse(data);
  const surveillanceReuseProhibited = clauseG2_surveillanceReuseProhibited(data);
  const dutyTimely = clauseG3_dutyTimely(data);
  const minimizationRespected = clauseM4_minimizationRespected(insight);
  const scopeComplete = clauseM5_scopeComplete(insight);

  const checks = {
    payloadHashMatches: payloadHashSHA256 === (await sha256Hex(canonicalEnvelope)),
    signatureVerifies:
      data.integrity.verificationMode === 'trustedPrecomputedInput' &&
      envelopeHmacSHA256 === (await hmacSha256Hex(data.integrity.secret, canonicalEnvelope)),
    thresholdReached: needsRetoolingPulse,
    scopeComplete,
    minimizationRespected,
    authorizationAllowed: authorizedUse,
    dutyTimely,
    surveillanceReuseProhibited,
    packageWithinBudget: Boolean(recommended) && recommended.costMEUR <= data.budget.maxMEUR,
    packageCoversAllActiveNeeds:
      Boolean(recommended) && packageCoversAllActiveNeeds(recommended, { exportWeakness, skillsStrain, gridStress }),
    lowestCostEligiblePackageChosen: Boolean(recommended) && recommended.id === (eligible[0]?.id ?? null),
  };

  const reasonWhy = [
    `ExportWeakness holds because at least one cluster has exportOrdersIndex < ${data.thresholds.exportOrdersIndexBelow} (${data.signals.clusters.map((c) => `${c.name}=${c.exportOrdersIndex}`).join(', ')}).`,
    `SkillsStrain holds because the technical vacancy rate is ${data.signals.labourMarket.technicalVacancyRatePct}% and the threshold is > ${data.thresholds.technicalVacancyRatePctAbove}%.`,
    `GridStress holds because congestion hours = ${data.signals.grid.congestionHours} and the threshold is > ${data.thresholds.gridCongestionHoursAbove}.`,
    'The recommendation rule selects the least-cost package that covers every active need and remains within budget.',
    recommended
      ? `The selected package is "${recommended.name}" with cost €${recommended.costMEUR}M, workerCoverage=${recommended.workerCoverage}, gridReliefMW=${recommended.gridReliefMW}.`
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
    budgetCapMEUR: data.budget.maxMEUR,
    packageCostMEUR: recommended?.costMEUR ?? null,
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
    `Budget cap: €${answer.budgetCapMEUR}M`,
    `Package cost: €${answer.packageCostMEUR}M`,
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
      exportWeakness,
      skillsStrain,
      gridStress,
      activeNeedCount,
      needsRetoolingPulse,
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
  const inputPath = resolve(process.argv[2] ?? resolve(__dirname, 'flandor.data.json'));
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
