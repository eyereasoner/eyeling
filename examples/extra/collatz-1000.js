#!/usr/bin/env node
'use strict';

/**
 * Specialized Collatz sweep for start values 1..10000.
 * The program keeps the arithmetic direct and reports both evidence and sanity checks in ARC style.
 */

const MAX_START = 10000;
const SAMPLE_START = 27;

function collatzStep(n) {
  return n % 2 === 0 ? n / 2 : 3 * n + 1;
}

function collatzTrace(start) {
  const trace = [start];
  let cur = start;
  while (cur !== 1) {
    cur = collatzStep(cur);
    trace.push(cur);
  }
  return trace;
}

function traceFollowsRule(trace) {
  if (trace.length === 0 || trace[trace.length - 1] !== 1) return false;
  for (let i = 0; i + 1 < trace.length; i += 1) {
    if (collatzStep(trace[i]) !== trace[i + 1]) return false;
  }
  return true;
}

// Evaluate every start value and collect both witnesses and summary statistics.
function evaluate() {
  const memo = new Array(MAX_START + 1).fill(0);
  const known = new Array(MAX_START + 1).fill(false);
  known[1] = true;
  memo[1] = 0;

  const report = {
    startsChecked: 0,
    allReachOne: true,
    maxSteps: 0,
    maxStepsStart: 1,
    highestPeak: 1,
    peakStart: 1,
    sampleTraceSteps: 0,
    sampleTracePeak: 0,
    sampleTraceRuleValid: false,
    maxStepsWitnessVerified: false,
    peakWitnessVerified: false,
  };

  for (let start = 1; start <= MAX_START; start += 1) {
    report.startsChecked += 1;
    const trace = collatzTrace(start);
    if (trace.length === 0 || trace[trace.length - 1] !== 1) report.allReachOne = false;

    let peak = start;
    for (const value of trace) if (value > peak) peak = value;

    const path = [];
    let cur = start;
    while (!(cur <= MAX_START && known[cur])) {
      path.push(cur);
      cur = collatzStep(cur);
    }

    let steps = memo[cur];
    for (let i = path.length - 1; i >= 0; i -= 1) {
      steps += 1;
      const value = path[i];
      if (value <= MAX_START) {
        known[value] = true;
        memo[value] = steps;
      }
    }

    if (steps > report.maxSteps) {
      report.maxSteps = steps;
      report.maxStepsStart = start;
    }
    if (peak > report.highestPeak) {
      report.highestPeak = peak;
      report.peakStart = start;
    }
  }

  const sample = collatzTrace(SAMPLE_START);
  const hardest = collatzTrace(report.maxStepsStart);
  const highest = collatzTrace(report.peakStart);

  report.sampleTraceSteps = sample.length ? sample.length - 1 : 0;
  report.sampleTracePeak = SAMPLE_START;
  for (const value of sample) if (value > report.sampleTracePeak) report.sampleTracePeak = value;
  report.sampleTraceRuleValid = traceFollowsRule(sample);
  report.maxStepsWitnessVerified = hardest.length > 0 && hardest.length - 1 === report.maxSteps;

  let peakCheck = report.peakStart;
  for (const value of highest) if (value > peakCheck) peakCheck = value;
  report.peakWitnessVerified = peakCheck === report.highestPeak;

  return report;
}

// Build the final ARC-style report and exit non-zero if a check fails.
function main() {
  const r = evaluate();
  const ok = r.allReachOne && r.sampleTraceRuleValid && r.maxStepsWitnessVerified && r.peakWitnessVerified;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push(`For starts 1..=${MAX_START}, every tested value reaches 1 under the Collatz map.`);
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push(
    'The program applies the standard Collatz rule, memoizes stopping times, and tracks the hardest witnesses.',
  );
  lines.push(`starts checked      : ${r.startsChecked}`);
  lines.push(`max steps           : ${r.maxSteps}`);
  lines.push(`max-steps start     : ${r.maxStepsStart}`);
  lines.push(`highest peak        : ${r.highestPeak}`);
  lines.push(`peak start          : ${r.peakStart}`);
  lines.push(`trace(27) steps     : ${r.sampleTraceSteps}`);
  lines.push(`trace(27) peak      : ${r.sampleTracePeak}`);
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`all reach 1         : ${r.allReachOne ? 'yes' : 'no'}`);
  lines.push(`trace(27) valid     : ${r.sampleTraceRuleValid ? 'yes' : 'no'}`);
  lines.push(`max-steps witness ok: ${r.maxStepsWitnessVerified ? 'yes' : 'no'}`);
  lines.push(`peak witness ok     : ${r.peakWitnessVerified ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
