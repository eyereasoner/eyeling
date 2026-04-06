#!/usr/bin/env node
'use strict';

/**
 * Toy transistor-switch calculation in millivolts, microamps, and ohms.
 * Two input cases are enough to demonstrate the OFF and saturated ON states and verify the arithmetic.
 */

const VCC_MV = 5000;
const VIN_LOW_MV = 0;
const VIN_HIGH_MV = 5000;
const VBE_ON_MV = 700;
const VCE_SAT_MV = 200;
const RB_OHMS = 10000;
const RL_OHMS = 1000;
const BETA = 100;

// Evaluate one DC operating point using simple cutoff / active / saturation logic.
function evaluateState(inputMv) {
  if (inputMv <= VBE_ON_MV) {
    return {
      inputMv,
      baseCurrentUa: 0,
      collectorGainLimitUa: 0,
      collectorLoadLimitUa: 0,
      collectorCurrentUa: 0,
      loadVoltageMv: 0,
      collectorEmitterVoltageMv: VCC_MV,
      cutoff: true,
      saturation: false,
    };
  }
  const ib = Math.floor(((inputMv - VBE_ON_MV) * 1000) / RB_OHMS);
  const gainLimit = ib * BETA;
  const loadLimit = Math.floor(((VCC_MV - VCE_SAT_MV) * 1000) / RL_OHMS);
  const ic = Math.min(gainLimit, loadLimit);
  const sat = gainLimit >= loadLimit;
  const loadV = Math.floor((ic * RL_OHMS) / 1000);
  const vce = sat ? VCE_SAT_MV : VCC_MV - loadV;
  return {
    inputMv,
    baseCurrentUa: ib,
    collectorGainLimitUa: gainLimit,
    collectorLoadLimitUa: loadLimit,
    collectorCurrentUa: ic,
    loadVoltageMv: loadV,
    collectorEmitterVoltageMv: vce,
    cutoff: false,
    saturation: sat,
  };
}

function stateName(state) {
  return state.cutoff ? 'cutoff / OFF' : state.saturation ? 'saturation / ON' : 'active / linear';
}

// Compare the low-input and high-input operating points and verify the switching story.
function main() {
  const low = evaluateState(VIN_LOW_MV);
  const high = evaluateState(VIN_HIGH_MV);
  const lowCutoff = low.cutoff && low.collectorCurrentUa === 0 && low.collectorEmitterVoltageMv === VCC_MV;
  const highSat = high.saturation && high.collectorEmitterVoltageMv === VCE_SAT_MV;
  const switchingCleanly = low.cutoff && high.saturation;
  const loadLimited =
    high.collectorCurrentUa === high.collectorLoadLimitUa && high.collectorGainLimitUa > high.collectorLoadLimitUa;
  const ohmOk = high.loadVoltageMv === Math.floor((high.collectorCurrentUa * RL_OHMS) / 1000);
  const ok = lowCutoff && highSat && switchingCleanly && loadLimited && ohmOk;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push(
    'In this toy transistor-switch model, a low input leaves the transistor OFF and a high input drives it ON in saturation.',
  );
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push(`low input state   : ${stateName(low)}`);
  lines.push(`high input state  : ${stateName(high)}`);
  lines.push(`high base current : ${high.baseCurrentUa} uA`);
  lines.push(`high collector Ic : ${high.collectorCurrentUa} uA`);
  lines.push(`load-limited Ic   : ${high.collectorLoadLimitUa} uA`);
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`low input cutoff                : ${lowCutoff ? 'yes' : 'no'}`);
  lines.push(`high input saturation           : ${highSat ? 'yes' : 'no'}`);
  lines.push(`switching states differ         : ${switchingCleanly ? 'yes' : 'no'}`);
  lines.push(`on-state current is load-limited: ${loadLimited ? 'yes' : 'no'}`);
  lines.push(`load voltage matches Ohm's law  : ${ohmOk ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
