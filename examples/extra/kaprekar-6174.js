#!/usr/bin/env node
'use strict';

function digits4(n) {
  return [
    Math.floor(n / 1000) % 10,
    Math.floor(n / 100) % 10,
    Math.floor(n / 10) % 10,
    n % 10,
  ];
}

function sort4(digits, descending) {
  digits.sort((a, b) => (descending ? b - a : a - b));
}

function build4(d) {
  return d[0] * 1000 + d[1] * 100 + d[2] * 10 + d[3];
}

function hasTwoDistinctDigits(n) {
  const d = digits4(n);
  for (let i = 1; i < 4; i += 1) if (d[i] !== d[0]) return true;
  return false;
}

function kaprekarStep(n) {
  const hi = digits4(n);
  const lo = [...hi];
  sort4(hi, true);
  sort4(lo, false);
  return build4(hi) - build4(lo);
}

function kaprekarTrace(start, cap) {
  const out = [];
  let cur = start;
  while (out.length < cap) {
    out.push(cur);
    if (cur === 6174) break;
    cur = kaprekarStep(cur);
  }
  return out;
}

function fmt4(n) {
  return String(n).padStart(4, '0');
}

function main() {
  let validStarts = 0;
  let repdigits = 0;
  let maxIterations = 0;
  let worstCaseStarts = 0;
  const hist = new Array(8).fill(0);
  let worstTrace = [];
  const leadingTrace = kaprekarTrace(2111, 16);
  let allReach = true;
  let boundOk = true;

  for (let start = 0; start <= 9999; start += 1) {
    if (!hasTwoDistinctDigits(start)) {
      repdigits += 1;
      continue;
    }
    const trace = kaprekarTrace(start, 16);
    const steps = trace.length ? trace.length - 1 : 0;
    validStarts += 1;
    if (trace[trace.length - 1] !== 6174) allReach = false;
    if (steps > 7) boundOk = false;
    if (steps < 8) hist[steps] += 1;
    if (steps > maxIterations) {
      maxIterations = steps;
      worstCaseStarts = 1;
      worstTrace = trace.slice();
    } else if (steps === maxIterations) {
      worstCaseStarts += 1;
    }
  }

  const fixedPointOk = kaprekarStep(6174) === 6174;
  const histTotal = hist.reduce((sum, n) => sum + n, 0);
  const histogramOk = histTotal === validStarts;
  const ok = fixedPointOk && allReach && boundOk && histogramOk;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push('Every valid four-digit start tested reaches 6174, and all of them do so within seven iterations.');
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push("The program applies Kaprekar's routine to every non-repdigit start, records the iteration count, and keeps witness traces.");
  lines.push(`valid starts checked: ${validStarts}`);
  lines.push(`repdigits excluded  : ${repdigits}`);
  lines.push(`max iterations      : ${maxIterations}`);
  lines.push(`worst-case starts   : ${worstCaseStarts}`);
  lines.push(`worst trace         : ${worstTrace.map(fmt4).join(' -> ')}`);
  lines.push(`leading-zero trace  : ${leadingTrace.map(fmt4).join(' -> ')}`);
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`6174 fixed point    : ${fixedPointOk ? 'yes' : 'no'}`);
  lines.push(`all starts reach it : ${allReach ? 'yes' : 'no'}`);
  lines.push(`bound <= 7 verified : ${boundOk ? 'yes' : 'no'}`);
  lines.push(`histogram total ok  : ${histogramOk ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
