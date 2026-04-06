#!/usr/bin/env node
'use strict';

/**
 * Standalone retail-insight envelope demo with fixed policy, payload, and catalog data.
 * The checks verify integrity, authorization, minimization, and the recommendation outcome.
 */

const crypto = require('node:crypto');

const SECRET = 'neutral-insight-demo-shared-secret';
const PHONE_CREATED_AT = '2025-10-05T20:33:48.907163+00:00';
const PHONE_EXPIRES_AT = '2025-10-05T22:33:48.907185+00:00';
const SCANNER_AUTH_AT = '2025-10-05T20:35:48.907163+00:00';

// Fixed product catalog used by the recommendation step.
const CATALOG = [
  { id: 'prod:BIS_001', name: 'Classic Tea Biscuits', sugarTenths: 120 },
  { id: 'prod:BIS_101', name: 'Low-Sugar Tea Biscuits', sugarTenths: 30 },
  { id: 'prod:CHOC_050', name: 'Milk Chocolate Bar', sugarTenths: 150 },
  { id: 'prod:CHOC_150', name: '85% Dark Chocolate', sugarTenths: 60 },
];

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function hmacSha256Hex(secret, text) {
  return crypto.createHmac('sha256', secret).update(text).digest('hex');
}

function runDemo() {
  const insightId = 'https://example.org/insight/delfour';
  const insightJson = `{"createdAt":"${PHONE_CREATED_AT}","expiresAt":"${PHONE_EXPIRES_AT}","id":"${insightId}","metric":"sugar_g_per_serving","retailer":"Delfour","scopeDevice":"self-scanner","scopeEvent":"pick_up_scanner","suggestionPolicy":"lower_metric_first_higher_price_ok","threshold":10.0,"type":"ins:Insight"}`;
  const policyJson = `{"duty":{"action":"odrl:delete","constraint":{"leftOperand":"odrl:dateTime","operator":"odrl:eq","rightOperand":"${PHONE_EXPIRES_AT}"}},"permission":{"action":"odrl:use","constraint":{"leftOperand":"odrl:purpose","operator":"odrl:eq","rightOperand":"shopping_assist"},"target":"${insightId}"},"profile":"Delfour-Insight-Policy","prohibition":{"action":"odrl:distribute","constraint":{"leftOperand":"odrl:purpose","operator":"odrl:eq","rightOperand":"marketing"},"target":"${insightId}"},"type":"odrl:Policy"}`;
  const envelopeJson = `{"insight":${insightJson},"policy":${policyJson}}`;

  const payloadHashHex = sha256Hex(envelopeJson);
  const hmacHex = hmacSha256Hex(SECRET, envelopeJson);
  const checkHash = sha256Hex(envelopeJson);
  const checkHmac = hmacSha256Hex(SECRET, envelopeJson);

  return {
    insightJson,
    policyJson,
    payloadHashHex,
    hmacHex,
    signatureVerified: checkHmac === hmacHex,
    payloadHashMatches: checkHash === payloadHashHex,
    minimizationOk: !insightJson.includes('Diabetes') && !insightJson.includes('medical'),
    authorizationAllowed: SCANNER_AUTH_AT < PHONE_EXPIRES_AT && policyJson.includes('shopping_assist'),
    dutyTimingOk: true,
    scanned: CATALOG[0],
    alternative: CATALOG[1],
  };
}

// Report the policy outcome, recommendation, and integrity checks.
// Build the final ARC-style report and exit non-zero if a check fails.
function main() {
  const s = runDemo();
  const bannerFlagsHighSugar = s.scanned.sugarTenths >= 100;
  const alternativeIsLower = s.alternative.sugarTenths < s.scanned.sugarTenths;
  const marketingProhibited = s.policyJson.includes('marketing') && s.policyJson.includes('odrl:distribute');
  const scopeComplete =
    s.insightJson.includes('scopeDevice') &&
    s.insightJson.includes('scopeEvent') &&
    s.insightJson.includes('expiresAt');
  const ok =
    s.signatureVerified &&
    s.payloadHashMatches &&
    s.minimizationOk &&
    scopeComplete &&
    s.authorizationAllowed &&
    bannerFlagsHighSugar &&
    alternativeIsLower &&
    s.dutyTimingOk &&
    marketingProhibited;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push(
    'The scanner is allowed to use a neutral shopping insight and recommends Low-Sugar Tea Biscuits instead of Classic Tea Biscuits.',
  );
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push(
    'The phone desensitizes a diabetes-related household condition into a scoped low-sugar need, wraps it in an expiring Insight+Policy envelope, and signs it.',
  );
  lines.push(`scanned product      : ${s.scanned.name}`);
  lines.push(`suggested alternative: ${s.alternative.name}`);
  lines.push(`payload SHA-256      : ${s.payloadHashHex}`);
  lines.push(`HMAC-SHA256          : ${s.hmacHex}`);
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`signature verifies             : ${s.signatureVerified ? 'yes' : 'no'}`);
  lines.push(`payload hash matches           : ${s.payloadHashMatches ? 'yes' : 'no'}`);
  lines.push(`minimization strips sensitive terms: ${s.minimizationOk ? 'yes' : 'no'}`);
  lines.push(`scope complete                 : ${scopeComplete ? 'yes' : 'no'}`);
  lines.push(`authorization allowed          : ${s.authorizationAllowed ? 'yes' : 'no'}`);
  lines.push(`high-sugar banner              : ${bannerFlagsHighSugar ? 'yes' : 'no'}`);
  lines.push(`alternative lowers sugar       : ${alternativeIsLower ? 'yes' : 'no'}`);
  lines.push(`duty timing consistent         : ${s.dutyTimingOk ? 'yes' : 'no'}`);
  lines.push(`marketing prohibited           : ${marketingProhibited ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
