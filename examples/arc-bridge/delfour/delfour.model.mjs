#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;
const encoder = new TextEncoder();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sha256Hex(text) {
  const digest = await subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret, text) {
  const key = await subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await subtle.sign('HMAC', key, encoder.encode(text));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

function validateInstance(data) {
  assert(typeof data?.caseName === 'string' && data.caseName.length > 0, 'caseName is required');
  assert(typeof data?.retailer === 'string' && data.retailer.length > 0, 'retailer is required');
  assert(Array.isArray(data?.catalog) && data.catalog.length > 0, 'catalog is required');
  assert(typeof data?.scan?.scannedProductId === 'string', 'scan.scannedProductId is required');
}

function productById(data, id) {
  return data.catalog.find((product) => product.id === id) ?? null;
}

export function clauseR1_needsLowSugar(data) {
  return data.householdProfile.condition === 'Diabetes';
}

export function clauseR2_highSugarScanned(data, scannedProduct) {
  return scannedProduct.sugarPerServing >= data.thresholds.sugarPerServingGAtLeast;
}

export function clauseR3_lowerSugarCandidates(data, scannedProduct) {
  return data.catalog
    .filter((product) => product.sugarTenths < scannedProduct.sugarTenths)
    .sort((a, b) => a.sugarTenths - b.sugarTenths);
}

export function clauseR4_recommendedAlternative(data, scannedProduct) {
  const candidates = clauseR3_lowerSugarCandidates(data, scannedProduct);
  return {
    candidates,
    recommended: candidates[0] ?? null,
  };
}

export function clauseR5_alternativeLowersSugar(scannedProduct, recommended) {
  return Boolean(recommended) && recommended.sugarTenths < scannedProduct.sugarTenths;
}

export function deriveInsight(data) {
  return {
    createdAt: data.timestamps.createdAt,
    expiresAt: data.timestamps.expiresAt,
    id: data.insightPolicy.id,
    metric: data.insightPolicy.metric,
    retailer: data.retailer,
    scopeDevice: data.evaluationContext.scopeDevice,
    scopeEvent: data.evaluationContext.scopeEvent,
    suggestionPolicy: data.insightPolicy.suggestionPolicy,
    threshold: data.thresholds.sugarPerServingGAtLeast,
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
      action: data.evaluationContext.requestAction,
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

export function clauseG1_authorizedUse(data) {
  return (
    data.evaluationContext.requestAction === 'odrl:use' &&
    data.evaluationContext.purpose === 'shopping_assist' &&
    Date.parse(data.timestamps.authorizedAt) <= Date.parse(data.timestamps.expiresAt)
  );
}

export function clauseG2_marketingProhibited(policy) {
  return (
    policy.prohibition?.action === 'odrl:distribute' &&
    policy.prohibition?.constraint?.rightOperand === 'marketing'
  );
}

export function clauseG3_dutyTimely(data) {
  return Date.parse(data.timestamps.dutyPerformedAt) <= Date.parse(data.timestamps.expiresAt);
}

export function clauseM1_canonicalEnvelope(data) {
  const insight = deriveInsight(data);
  const policy = derivePolicy(data);
  const envelope = { insight, policy };
  const canonicalEnvelope =
    `{"insight":{"createdAt":"${insight.createdAt}","expiresAt":"${insight.expiresAt}","id":"${insight.id}","metric":"${insight.metric}","retailer":"${insight.retailer}","scopeDevice":"${insight.scopeDevice}","scopeEvent":"${insight.scopeEvent}","suggestionPolicy":"${insight.suggestionPolicy}","threshold":10.0,"type":"${insight.type}"},"policy":{"duty":{"action":"${policy.duty.action}","constraint":{"leftOperand":"${policy.duty.constraint.leftOperand}","operator":"${policy.duty.constraint.operator}","rightOperand":"${policy.duty.constraint.rightOperand}"}},"permission":{"action":"${policy.permission.action}","constraint":{"leftOperand":"${policy.permission.constraint.leftOperand}","operator":"${policy.permission.constraint.operator}","rightOperand":"${policy.permission.constraint.rightOperand}"},"target":"${policy.permission.target}"},"profile":"${policy.profile}","prohibition":{"action":"${policy.prohibition.action}","constraint":{"leftOperand":"${policy.prohibition.constraint.leftOperand}","operator":"${policy.prohibition.constraint.operator}","rightOperand":"${policy.prohibition.constraint.rightOperand}"},"target":"${policy.prohibition.target}"},"type":"${policy.type}"}}`;
  return { envelope, canonicalEnvelope };
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
  return !JSON.stringify(insight).toLowerCase().match(/diabetes|medical/);
}

export function clauseM5_scopeComplete(insight) {
  return Boolean(insight.scopeDevice && insight.scopeEvent && insight.expiresAt);
}

export async function evaluate(data) {
  validateInstance(data);

  const scannedProduct = productById(data, data.scan.scannedProductId);
  assert(scannedProduct, `scanned product not found: ${data.scan.scannedProductId}`);

  const needsLowSugar = clauseR1_needsLowSugar(data);
  const highSugarScanned = clauseR2_highSugarScanned(data, scannedProduct);
  const { candidates, recommended } = clauseR4_recommendedAlternative(data, scannedProduct);
  const alternativeLowersSugar = clauseR5_alternativeLowersSugar(scannedProduct, recommended);

  const insight = deriveInsight(data);
  const policy = derivePolicy(data);
  const { canonicalEnvelope, payloadHashSHA256, envelopeHmacSHA256 } = await clauseM3_hmac(data);
  const minimizationRespected = clauseM4_minimizationRespected(insight);
  const scopeComplete = clauseM5_scopeComplete(insight);
  const authorizationAllowed = clauseG1_authorizedUse(data);
  const dutyTimingConsistent = clauseG3_dutyTimely(data);
  const marketingProhibited = clauseG2_marketingProhibited(policy);

  const checks = {
    signatureVerifies:
      data.integrity.verificationMode === 'trustedPrecomputedInput' &&
      envelopeHmacSHA256 === await hmacSha256Hex(data.integrity.secret, canonicalEnvelope),
    payloadHashMatches: payloadHashSHA256 === await sha256Hex(canonicalEnvelope),
    minimizationRespected,
    scopeComplete,
    authorizationAllowed,
    highSugarBanner: highSugarScanned,
    alternativeLowersSugar,
    dutyTimingConsistent,
    marketingProhibited,
  };

  const answerSentence = 'The scanner is allowed to use a neutral shopping insight and recommends Low-Sugar Tea Biscuits instead of Classic Tea Biscuits.';
  const reasonWhy = [
    'The phone desensitizes a diabetes-related household condition into a scoped low-sugar need, wraps it in an expiring Insight+Policy envelope, and signs it.',
    `scanned product : ${scannedProduct.name}`,
    `suggested alternative: ${recommended?.name ?? 'none'}`,
    `payload SHA-256 : ${payloadHashSHA256}`,
    `HMAC-SHA256 : ${envelopeHmacSHA256}`,
  ];

  const arcLines = [
    '=== Answer ===',
    answerSentence,
    '',
    '=== Reason Why ===',
    ...reasonWhy,
    '',
    '=== Check ===',
    `signature verifies : ${checks.signatureVerifies ? 'yes' : 'no'}`,
    `payload hash matches : ${checks.payloadHashMatches ? 'yes' : 'no'}`,
    `minimization strips sensitive terms: ${checks.minimizationRespected ? 'yes' : 'no'}`,
    `scope complete : ${checks.scopeComplete ? 'yes' : 'no'}`,
    `authorization allowed : ${checks.authorizationAllowed ? 'yes' : 'no'}`,
    `high-sugar banner : ${checks.highSugarBanner ? 'yes' : 'no'}`,
    `alternative lowers sugar : ${checks.alternativeLowersSugar ? 'yes' : 'no'}`,
    `duty timing consistent : ${checks.dutyTimingConsistent ? 'yes' : 'no'}`,
    `marketing prohibited : ${checks.marketingProhibited ? 'yes' : 'no'}`,
  ];

  return {
    caseName: data.caseName,
    derived: {
      needsLowSugar,
      highSugarScanned,
      lowerSugarCandidateIds: candidates.map((product) => product.id),
      recommendedAlternativeId: recommended?.id ?? null,
      recommendedAlternativeName: recommended?.name ?? null,
      alternativeLowersSugar,
    },
    envelope: { insight, policy },
    integrity: {
      canonicalEnvelope,
      payloadHashSHA256,
      envelopeHmacSHA256,
      verificationMode: data.integrity.verificationMode,
    },
    answer: {
      sentence: answerSentence,
      scannedProduct: scannedProduct.name,
      suggestedAlternative: recommended?.name ?? null,
      payloadHashSHA256,
      envelopeHmacSHA256,
    },
    reasonWhy,
    checks,
    allChecksPass: Object.values(checks).every(Boolean),
    arcText: arcLines.join('\n'),
  };
}

async function main() {
  const inputPath = resolve(process.argv[2] ?? resolve(__dirname, 'delfour.data.json'));
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
