#!/usr/bin/env node
'use strict';

const ACTION = {
  PROVIDE_SECONDARY_USE_DATA: 0,
  DOWNLOAD: 1,
  REMOVE_DIRECT_IDENTIFIERS: 2,
  PROCESS_ONLY_IN_SECURE_ENVIRONMENT: 3,
};

const CONSTRAINT_KEY = {
  PURPOSE: 0,
  HAS_DATA_PERMIT: 1,
  RESPECT_OPT_OUT_SECONDARY_USE: 2,
  STATISTICALLY_ANONYMISED: 3,
};

function actionName(a) {
  switch (a) {
    case ACTION.PROVIDE_SECONDARY_USE_DATA:
      return 'provideSecondaryUseData';
    case ACTION.DOWNLOAD:
      return 'download';
    case ACTION.REMOVE_DIRECT_IDENTIFIERS:
      return 'removeDirectIdentifiers';
    case ACTION.PROCESS_ONLY_IN_SECURE_ENVIRONMENT:
      return 'processOnlyInSecureEnvironment';
    default:
      return '?';
  }
}

const NEEDS = [
  { id: 'Need_RequireDataPermit', importance: 20, description: 'Secondary use should be authorised via an EHDS Data Permit.' },
  { id: 'Need_RespectOptOutSecondaryUse', importance: 25, description: 'Respect the EHDS right to opt out from secondary use.' },
  { id: 'Need_SecureProcessingEnvironment', importance: 18, description: 'Secondary-use processing must occur within a secure processing environment.' },
  { id: 'Need_StatisticallyAnonymisedSecondaryUse', importance: 15, description: 'Secondary use should use statistically anonymised data.' },
];

const P1_C = [{ key: CONSTRAINT_KEY.PURPOSE, value: 'HealthcareScientificResearch' }];
const P2_C = [{ key: CONSTRAINT_KEY.PURPOSE, value: 'TrainTestAndEvaluateHealthAlgorithms' }];
const P4_D = [{ action: ACTION.REMOVE_DIRECT_IDENTIFIERS }];

const PERMISSIONS = [
  { id: 'PermSecondaryUseDUA', clauseId: 'H1', action: ACTION.PROVIDE_SECONDARY_USE_DATA, constraints: P1_C, duties: [] },
  { id: 'PermSecondaryUseAllPatients', clauseId: 'H2', action: ACTION.PROVIDE_SECONDARY_USE_DATA, constraints: P2_C, duties: [] },
  { id: 'PermDownloadLocalCopy', clauseId: 'H3', action: ACTION.DOWNLOAD, constraints: [], duties: [] },
  { id: 'PermProvidePseudonymisedData', clauseId: 'H4', action: ACTION.PROVIDE_SECONDARY_USE_DATA, constraints: [], duties: P4_D },
];

const MISSING = {
  MISSING_DATA_PERMIT: 0,
  MISSING_OPT_OUT: 1,
  MISSING_SECURE_ENV: 2,
  MISSING_STAT_ANON: 3,
};

const RULES = [
  { ruleId: 'R1', permissionId: 'PermSecondaryUseDUA', clauseId: 'H1', needId: 'Need_RequireDataPermit', baseScore: 80, riskSource: 'Secondary use permitted without EHDS Data Permit.', mitigation: 'Require an EHDS Data Permit before secondary use.', missing: MISSING.MISSING_DATA_PERMIT },
  { ruleId: 'R2', permissionId: 'PermSecondaryUseAllPatients', clauseId: 'H2', needId: 'Need_RespectOptOutSecondaryUse', baseScore: 75, riskSource: 'Opt-out from secondary use not explicitly respected.', mitigation: 'Exclude records of persons who exercised the EHDS opt-out.', missing: MISSING.MISSING_OPT_OUT },
  { ruleId: 'R3', permissionId: 'PermDownloadLocalCopy', clauseId: 'H3', needId: 'Need_SecureProcessingEnvironment', baseScore: 70, riskSource: 'Local download permitted; secure processing environment not required.', mitigation: 'Require processing only within a secure processing environment.', missing: MISSING.MISSING_SECURE_ENV },
  { ruleId: 'R4', permissionId: 'PermProvidePseudonymisedData', clauseId: 'H4', needId: 'Need_StatisticallyAnonymisedSecondaryUse', baseScore: 65, riskSource: 'Statistical anonymisation safeguard missing for secondary use.', mitigation: 'Require statistically anonymised data for secondary use.', missing: MISSING.MISSING_STAT_ANON },
];

function findNeed(id) {
  return NEEDS.find((need) => need.id === id) || null;
}

function findPerm(id) {
  return PERMISSIONS.find((permission) => permission.id === id) || null;
}

function hasConstraint(permission, key) {
  return permission.constraints.some((constraint) => constraint.key === key);
}

function hasDuty(permission, action) {
  return permission.duties.some((duty) => duty.action === action);
}

function missing(permission, kind) {
  switch (kind) {
    case MISSING.MISSING_DATA_PERMIT:
      return !hasConstraint(permission, CONSTRAINT_KEY.HAS_DATA_PERMIT);
    case MISSING.MISSING_OPT_OUT:
      return !hasConstraint(permission, CONSTRAINT_KEY.RESPECT_OPT_OUT_SECONDARY_USE);
    case MISSING.MISSING_SECURE_ENV:
      return !hasDuty(permission, ACTION.PROCESS_ONLY_IN_SECURE_ENVIRONMENT);
    case MISSING.MISSING_STAT_ANON:
      return !hasConstraint(permission, CONSTRAINT_KEY.STATISTICALLY_ANONYMISED);
    default:
      return false;
  }
}

function main() {
  const risks = [];
  for (const rule of RULES) {
    const permission = findPerm(rule.permissionId);
    const need = findNeed(rule.needId);
    if (permission && need && missing(permission, rule.missing)) {
      const raw = rule.baseScore + need.importance;
      const score = raw > 100 ? 100 : raw;
      risks.push({
        clauseId: rule.clauseId,
        permissionId: rule.permissionId,
        needId: rule.needId,
        action: permission.action,
        needImportance: need.importance,
        scoreRaw: raw,
        score,
        riskSource: rule.riskSource,
        mitigation: rule.mitigation,
      });
    }
  }

  risks.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.clauseId.localeCompare(b.clauseId);
  });

  let scoreFormulaOk = true;
  let sortedOk = true;
  let mitigationsOk = true;
  for (let i = 0; i < risks.length; i += 1) {
    const rule = RULES[i];
    const need = findNeed(rule.needId);
    const expected = Math.min(rule.baseScore + need.importance, 100);
    if (risks.length > 0 && risks[i].score !== expected) scoreFormulaOk = false;
    if (!risks[i].mitigation) mitigationsOk = false;
    if (i + 1 < risks.length && risks[i].score < risks[i + 1].score) sortedOk = false;
  }

  const topPairOk =
    risks.length >= 2 &&
    risks[0].clauseId === 'H1' &&
    risks[0].score === 100 &&
    risks[1].clauseId === 'H2' &&
    risks[1].score === 100;

  const ok = risks.length === 4 && scoreFormulaOk && sortedOk && topPairOk && mitigationsOk;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push('The EHDS secondary-use agreement yields four ranked risks; H1 and H2 normalize to score 100, followed by H3 at 88 and H4 at 80.');
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push('The agreement instantiates concrete clauses, permissions, patient needs, and rule applications. A risk appears when a permission is missing a required safeguard.');
  for (let i = 0; i < risks.length; i += 1) {
    const risk = risks[i];
    lines.push(`Risk #${i + 1}`);
    lines.push(`  clause        : ${risk.clauseId}`);
    lines.push(`  permission    : ${risk.permissionId}`);
    lines.push(`  action        : ${actionName(risk.action)}`);
    lines.push(`  violated need : ${risk.needId}`);
    lines.push(`  score raw     : ${risk.scoreRaw}`);
    lines.push(`  score         : ${risk.score}`);
    lines.push(`  source        : ${risk.riskSource}`);
    lines.push(`  mitigation    : ${risk.mitigation}`);
  }
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`risk count = 4          : ${risks.length === 4 ? 'yes' : 'no'}`);
  lines.push(`score formula recomputes: ${scoreFormulaOk ? 'yes' : 'no'}`);
  lines.push(`ranking sorted desc     : ${sortedOk ? 'yes' : 'no'}`);
  lines.push(`expected top pair       : ${topPairOk ? 'yes' : 'no'}`);
  lines.push(`every risk has mitigation: ${mitigationsOk ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
