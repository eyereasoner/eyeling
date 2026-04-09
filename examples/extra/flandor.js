#!/usr/bin/env node

'use strict';

/**
 * Flandor — a macro-economic Insight Economy case for Flanders.
 *
 * The aha: nobody has to reveal their books for the region to coordinate.
 *
 * Exporters, training actors, and grid operators each keep their sensitive
 * data local. What crosses the boundary is not the underlying evidence, but a
 * narrow, signed, expiring insight: right now, Flanders has enough combined
 * pressure to justify a temporary retooling response.
 *
 * That is the Insight Economy in action. Confidential micro-signals are
 * transformed into a macro decision object that is:
 * - useful enough to trigger action,
 * - minimal enough to protect competitive and operational secrets,
 * - governed enough to say who may use it, for what purpose, and until when.
 *
 * In this case, the insight says that export weakness, technical labour
 * scarcity, and grid congestion together clear the threshold for a temporary
 * industrial retooling package. Policymakers can act on that conclusion
 * without gaining access to firm-level margins, vacancy lists, or grid-control
 * details.
 *
 * The product being traded is therefore not raw data, and not even a general
 * forecast, but a context-bound permissioned conclusion: a policy-grade
 * insight for regional stabilization, with reuse for firm surveillance
 * explicitly forbidden.
 */

const crypto = require('node:crypto');

const SECRET = 'flandor-demo-shared-secret';

const HUB_CREATED_AT = '2026-04-08T07:00:00+00:00';
const HUB_EXPIRES_AT = '2026-04-08T19:00:00+00:00';
const BOARD_AUTH_AT = '2026-04-08T09:15:00+00:00';
const BOARD_DUTY_AT = '2026-04-08T18:30:00+00:00';

const REGION = 'Flanders';

const CLUSTERS = [
  { id: 'cluster:ANT_CHEM', name: 'Antwerp chemicals', exportOrdersIndex: 84, energyIntensity: 92 },
  { id: 'cluster:GNT_MFG', name: 'Ghent manufacturing', exportOrdersIndex: 87, energyIntensity: 76 },
];

const LABOUR_MARKET = {
  technicalVacancyRateTenths: 46,
  technicalVacancyRatePct: 4.6,
};

const GRID = {
  congestionHours: 19,
  renewableCurtailmentMWh: 240,
};

const BUDGET = {
  windowName: 'Q2 resilience window',
  maxMEUR: 140,
};

const PACKAGES = [
  {
    id: 'pkg:TRAIN_070',
    name: 'Flanders Skills Sprint',
    costMEUR: 70,
    workerCoverage: 900,
    gridReliefMW: 0,
    coversExportWeakness: false,
    coversSkillsStrain: true,
    coversGridStress: false,
  },
  {
    id: 'pkg:PORT_095',
    name: 'Schelde Trade Buffer',
    costMEUR: 95,
    workerCoverage: 300,
    gridReliefMW: 10,
    coversExportWeakness: true,
    coversSkillsStrain: false,
    coversGridStress: false,
  },
  {
    id: 'pkg:RET_FLEX_120',
    name: 'Flandor Retooling Pulse',
    costMEUR: 120,
    workerCoverage: 1200,
    gridReliefMW: 85,
    coversExportWeakness: true,
    coversSkillsStrain: true,
    coversGridStress: true,
  },
  {
    id: 'pkg:CORRIDOR_165',
    name: 'Full Corridor Shock Shield',
    costMEUR: 165,
    workerCoverage: 1600,
    gridReliefMW: 110,
    coversExportWeakness: true,
    coversSkillsStrain: true,
    coversGridStress: true,
  },
];

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function hmacSha256Hex(secret, text) {
  return crypto.createHmac('sha256', secret).update(text).digest('hex');
}

function countTrue(values) {
  return values.reduce((sum, value) => sum + (value ? 1 : 0), 0);
}

function packageCoversAllNeeds(pkg, needs) {
  return (
    (!needs.exportWeakness || pkg.coversExportWeakness) &&
    (!needs.skillsStrain || pkg.coversSkillsStrain) &&
    (!needs.gridStress || pkg.coversGridStress)
  );
}

function chooseLowestCostCoveringPackage(packages, needs, maxMEUR) {
  const eligible = packages
    .filter((pkg) => pkg.costMEUR <= maxMEUR)
    .filter((pkg) => packageCoversAllNeeds(pkg, needs))
    .sort((a, b) => a.costMEUR - b.costMEUR);

  return {
    eligible,
    recommended: eligible[0] || null,
  };
}

function runDemo() {
  const exportWeakness = CLUSTERS.some((cluster) => cluster.exportOrdersIndex < 90);
  const skillsStrain = LABOUR_MARKET.technicalVacancyRateTenths > 39;
  const gridStress = GRID.congestionHours > 11;

  const activeNeedCount = countTrue([exportWeakness, skillsStrain, gridStress]);

  const insightId = 'https://example.org/insight/flandor';
  const insight = {
    createdAt: HUB_CREATED_AT,
    expiresAt: HUB_EXPIRES_AT,
    id: insightId,
    metric: 'regional_retooling_priority',
    region: REGION,
    scopeDevice: 'economic-resilience-board',
    scopeEvent: 'budget-prep-window',
    suggestionPolicy: 'lowest_cost_package_covering_all_active_needs',
    threshold: 3,
    type: 'ins:Insight',
  };

  const policy = {
    duty: {
      action: 'odrl:delete',
      constraint: {
        leftOperand: 'odrl:dateTime',
        operator: 'odrl:eq',
        rightOperand: HUB_EXPIRES_AT,
      },
    },
    permission: {
      action: 'odrl:use',
      constraint: {
        leftOperand: 'odrl:purpose',
        operator: 'odrl:eq',
        rightOperand: 'regional_stabilization',
      },
      target: insightId,
    },
    profile: 'Flandor-Insight-Policy',
    prohibition: {
      action: 'odrl:distribute',
      constraint: {
        leftOperand: 'odrl:purpose',
        operator: 'odrl:eq',
        rightOperand: 'firm_surveillance',
      },
      target: insightId,
    },
    type: 'odrl:Policy',
  };

  const envelope = { insight, policy };
  const insightJson = JSON.stringify(insight);
  const policyJson = JSON.stringify(policy);
  const envelopeJson = JSON.stringify(envelope);

  const payloadHashHex = sha256Hex(envelopeJson);
  const hmacHex = hmacSha256Hex(SECRET, envelopeJson);

  const checkHash = sha256Hex(envelopeJson);
  const checkHmac = hmacSha256Hex(SECRET, envelopeJson);

  const needs = { exportWeakness, skillsStrain, gridStress };
  const choice = chooseLowestCostCoveringPackage(PACKAGES, needs, BUDGET.maxMEUR);
  const recommended = choice.recommended;

  const scopeComplete =
    insightJson.includes('scopeDevice') &&
    insightJson.includes('scopeEvent') &&
    insightJson.includes('expiresAt');

  const minimizationOk =
    !insightJson.includes('firmName') &&
    !insightJson.includes('payroll') &&
    !insightJson.includes('salary') &&
    !insightJson.includes('invoice') &&
    !insightJson.includes('medical');

  const authorizationAllowed =
    BOARD_AUTH_AT < HUB_EXPIRES_AT && policy.permission.constraint.rightOperand === 'regional_stabilization';

  const dutyTimingOk = BOARD_DUTY_AT <= HUB_EXPIRES_AT;

  const surveillanceReuseProhibited =
    policy.prohibition.action === 'odrl:distribute' &&
    policy.prohibition.constraint.rightOperand === 'firm_surveillance';

  const packageWithinBudget = Boolean(recommended) && recommended.costMEUR <= BUDGET.maxMEUR;
  const packageCoversNeeds = Boolean(recommended) && packageCoversAllNeeds(recommended, needs);
  const cheapestEligibleChosen =
    Boolean(recommended) &&
    choice.eligible.length > 0 &&
    recommended.id === choice.eligible[0].id;

  return {
    exportWeakness,
    skillsStrain,
    gridStress,
    activeNeedCount,
    insight,
    policy,
    insightJson,
    policyJson,
    envelopeJson,
    payloadHashHex,
    hmacHex,
    checkHash,
    checkHmac,
    needs,
    choice,
    recommended,
    scopeComplete,
    minimizationOk,
    authorizationAllowed,
    dutyTimingOk,
    surveillanceReuseProhibited,
    packageWithinBudget,
    packageCoversNeeds,
    cheapestEligibleChosen,
  };
}

function renderAnswer(state) {
  const lines = [];
  lines.push('=== Answer ===');
  lines.push(`Name: Flandor`);
  lines.push(`Region: ${state.insight.region}`);
  lines.push(`Metric: ${state.insight.metric}`);
  lines.push(`Active need count: ${state.activeNeedCount}/${state.insight.threshold}`);
  lines.push(`Recommended package: ${state.recommended ? state.recommended.name : 'none'}`);
  lines.push(`Budget cap: €${BUDGET.maxMEUR}M`);
  lines.push(`Package cost: €${state.recommended ? state.recommended.costMEUR : 'n/a'}M`);
  lines.push(`Payload SHA-256: ${state.payloadHashHex}`);
  lines.push(`Envelope HMAC-SHA-256: ${state.hmacHex}`);
  return lines.join('\n');
}

function renderReasonWhy(state) {
  const lines = [];
  lines.push('=== Reason Why ===');
  lines.push(
    `Export weakness is active because at least one cluster has exportOrdersIndex < 90 ` +
      `(${CLUSTERS.map((c) => `${c.name}=${c.exportOrdersIndex}`).join(', ')}).`
  );
  lines.push(
    `Skills strain is active because technical vacancy rate is ${LABOUR_MARKET.technicalVacancyRatePct}% ` +
      `(threshold > 3.9%).`
  );
  lines.push(
    `Grid stress is active because congestion hours = ${GRID.congestionHours} ` +
      `(threshold > 11).`
  );
  lines.push(
    `The recommendation policy is "${state.insight.suggestionPolicy}", so the cheapest package that ` +
      `covers all active needs within budget is selected.`
  );
  if (state.recommended) {
    lines.push(
      `Selected package "${state.recommended.name}" covers export=${state.recommended.coversExportWeakness}, ` +
        `skills=${state.recommended.coversSkillsStrain}, grid=${state.recommended.coversGridStress}, ` +
        `cost=€${state.recommended.costMEUR}M.`
    );
  }
  lines.push(
    `Usage is permitted only for purpose "${state.policy.permission.constraint.rightOperand}" and ` +
      `the envelope expires at ${state.insight.expiresAt}.`
  );
  return lines.join('\n');
}

function renderCheck(state) {
  const checks = [
    ['payload hash matches', state.checkHash === state.payloadHashHex],
    ['hmac matches', state.checkHmac === state.hmacHex],
    ['threshold reached', state.activeNeedCount >= state.insight.threshold],
    ['scope complete', state.scopeComplete],
    ['minimization respected', state.minimizationOk],
    ['authorized purpose allowed', state.authorizationAllowed],
    ['deletion duty still on time', state.dutyTimingOk],
    ['surveillance reuse prohibited', state.surveillanceReuseProhibited],
    ['package exists within budget', state.packageWithinBudget],
    ['package covers all active needs', state.packageCoversNeeds],
    ['lowest-cost eligible package chosen', state.cheapestEligibleChosen],
  ];

  const lines = ['=== Check ==='];
  for (const [name, ok] of checks) {
    lines.push(`- ${ok ? 'PASS' : 'FAIL'}: ${name}`);
  }

  const failed = checks.filter(([, ok]) => !ok);
  return {
    text: lines.join('\n'),
    ok: failed.length === 0,
  };
}

function main() {
  const state = runDemo();
  const answer = renderAnswer(state);
  const reason = renderReasonWhy(state);
  const check = renderCheck(state);

  console.log(answer);
  console.log('');
  console.log(reason);
  console.log('');
  console.log(check.text);

  if (!check.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
