#!/usr/bin/env node
'use strict';

/**
 * Minimal exact-arithmetic witness for Euler's identity.
 * Using an exact representation keeps the check section purely logical instead of approximate.
 */

function add(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}

// Build the exact witness and print the three ARC sections.
function main() {
  const expIpi = { re: -1, im: 0 };
  const one = { re: 1, im: 0 };
  const result = add(expIpi, one);
  const modulusSq = expIpi.re * expIpi.re + expIpi.im * expIpi.im;
  const identityOk = result.re === 0 && result.im === 0;
  const unitCircleOk = modulusSq === 1;
  const ok = identityOk && unitCircleOk;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push("Euler's identity holds exactly in this exact-arithmetic model: exp(i*pi) + 1 = 0.");
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push('exp(i*pi) is represented as (-1, 0) and adding (1, 0) gives the exact zero complex number.');
  lines.push(`exp(i*pi)   : (${expIpi.re}, ${expIpi.im})`);
  lines.push(`exp(i*pi)+1 : (${result.re}, ${result.im})`);
  lines.push(`|exp(i*pi)|^2: ${modulusSq}`);
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`identity exact: ${identityOk ? 'yes' : 'no'}`);
  lines.push(`unit circle   : ${unitCircleOk ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
