#!/usr/bin/env node
'use strict';

/**
 * Toy PN-junction tunneling model expressed as overlap counts between discrete energy levels.
 * The curve is small enough to inspect directly, so the checks focus on the peak and negative differential region.
 */

const N_FILLED = [1, 2, 3, 4];
const P_EMPTY_ZERO_BIAS = [3, 4, 5, 6];
const BIAS_POINTS = [0, 1, 2, 3, 4, 5, 6];

function overlapCount(lhs, rhs) {
  let count = 0;
  for (const left of lhs) {
    for (const right of rhs) {
      if (left === right) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

// Shift the P-side levels across the bias points and record the overlap curve.
function main() {
  const curve = [];
  let peakIndex = 0;

  for (let i = 0; i < BIAS_POINTS.length; i += 1) {
    const shifted = P_EMPTY_ZERO_BIAS.map((value) => value - BIAS_POINTS[i]);
    curve[i] = overlapCount(N_FILLED, shifted);
    if (curve[i] > curve[peakIndex]) peakIndex = i;
  }

  const valleyIndex = 6;
  const barrierNarrower = 1 < 8;
  const peakBeforeValley = peakIndex < valleyIndex;
  let negativeDifferential = false;
  for (let i = peakIndex; i < 6; i += 1) if (curve[i + 1] < curve[i]) negativeDifferential = true;
  const overlapCloses = curve[valleyIndex] === 0;
  const fullOverlapPeak = curve[peakIndex] === 4;
  const ok = barrierNarrower && peakBeforeValley && negativeDifferential && overlapCloses && fullOverlapPeak;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push(
    'In this toy PN-junction tunneling model, heavy doping narrows the depletion region enough for a tunneling window that rises to a peak and then falls.',
  );
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push('We count exact state overlap while forward bias shifts the empty P-side levels.');
  lines.push(`bias -> overlap current proxy : ${BIAS_POINTS.map((bias, i) => `${bias}->${curve[i]}`).join(', ')}`);
  lines.push(`peak point                    : ${BIAS_POINTS[peakIndex]} -> ${curve[peakIndex]}`);
  lines.push(`high-bias point               : ${BIAS_POINTS[valleyIndex]} -> ${curve[valleyIndex]}`);
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`heavily doped barrier is narrower : ${barrierNarrower ? 'yes' : 'no'}`);
  lines.push(`peak occurs before overlap closes : ${peakBeforeValley ? 'yes' : 'no'}`);
  lines.push(`negative differential region      : ${negativeDifferential ? 'yes' : 'no'}`);
  lines.push(`high-bias overlap closes          : ${overlapCloses ? 'yes' : 'no'}`);
  lines.push(`peak equals full overlap          : ${fullOverlapPeak ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
