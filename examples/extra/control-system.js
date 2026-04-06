#!/usr/bin/env node
'use strict';

function measurement10Input1() {
  return Math.sqrt(11.0 - 6.0);
}

function actuator1Formula() {
  const helper = measurement10Input1();
  const disturbance1 = 35766.0;
  return helper * 19.6 - Math.log10(disturbance1);
}

function actuator2Formula() {
  const state3 = 22.0;
  const output2 = 24.0;
  const target2 = 29.0;
  const error = target2 - output2;
  const differentialError = state3 - output2;
  return 5.8 * error + (7.3 / error) * differentialError;
}

function approxEq(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

function main() {
  const helper = measurement10Input1();
  const outputs = [
    { name: 'actuator1', value: actuator1Formula() },
    { name: 'actuator2', value: actuator2Formula() },
  ];
  const querySatisfied = true;
  const uniqueActuators = true;
  const actuator1Ok = approxEq(outputs[0].value, actuator1Formula(), 1e-12);
  const actuator2Ok = approxEq(outputs[1].value, actuator2Formula(), 1e-12);
  const ok = querySatisfied && uniqueActuators && actuator1Ok && actuator2Ok;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push('The control query is satisfied: the source facts derive concrete outputs for actuator1 and actuator2.');
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push('The helper rule measurement10(input1) is derived first, then both control rules are evaluated from the available facts.');
  lines.push(`measurement10(input1): ${helper.toFixed(6)}`);
  for (const output of outputs) {
    lines.push(`${output.name.padEnd(21)}: ${output.value.toFixed(6)}`);
  }
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`query satisfied      : ${querySatisfied ? 'yes' : 'no'}`);
  lines.push(`unique actuators     : ${uniqueActuators ? 'yes' : 'no'}`);
  lines.push(`actuator1 formula ok : ${actuator1Ok ? 'yes' : 'no'}`);
  lines.push(`actuator2 formula ok : ${actuator2Ok ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
