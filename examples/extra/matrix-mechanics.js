#!/usr/bin/env node
'use strict';

/**
 * Toy matrix-mechanics example over 2x2 matrices.
 * It highlights spectrum, involution, and a non-zero commutator in a compact exact model.
 */

function m2(a11, a12, a21, a22) {
  return { a11, a12, a21, a22 };
}

function mul(a, b) {
  return m2(
    a.a11 * b.a11 + a.a12 * b.a21,
    a.a11 * b.a12 + a.a12 * b.a22,
    a.a21 * b.a11 + a.a22 * b.a21,
    a.a21 * b.a12 + a.a22 * b.a22,
  );
}

function sub(a, b) {
  return m2(a.a11 - b.a11, a.a12 - b.a12, a.a21 - b.a21, a.a22 - b.a22);
}

function trace(a) {
  return a.a11 + a.a22;
}

function det(a) {
  return a.a11 * a.a22 - a.a12 * a.a21;
}

// Evaluate the tiny model exactly, then verify the expected algebraic properties.
function main() {
  const H = m2(1, 0, 0, 2);
  const X = m2(0, 1, 1, 0);
  const HX = mul(H, X);
  const XH = mul(X, H);
  const C = sub(HX, XH);
  const commutatorNonzero = !!(C.a11 || C.a12 || C.a21 || C.a22);
  const spectrumOk = trace(H) === 3 && det(H) === 2;
  const XX = mul(X, X);
  const involution = XX.a11 === 1 && XX.a12 === 0 && XX.a21 === 0 && XX.a22 === 1;
  const ok = spectrumOk && involution && commutatorNonzero;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push(
    'In this toy matrix-mechanics model, the Hamiltonian has two discrete energy levels and does not commute with a second observable.',
  );
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push(`H  = [[${H.a11},${H.a12}],[${H.a21},${H.a22}]]`);
  lines.push(`X  = [[${X.a11},${X.a12}],[${X.a21},${X.a22}]]`);
  lines.push(`HX = [[${HX.a11},${HX.a12}],[${HX.a21},${HX.a22}]]`);
  lines.push(`XH = [[${XH.a11},${XH.a12}],[${XH.a21},${XH.a22}]]`);
  lines.push(`[H,X] = [[${C.a11},${C.a12}],[${C.a21},${C.a22}]]`);
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`trace/determinant match energy levels: ${spectrumOk ? 'yes' : 'no'}`);
  lines.push(`X^2 = I                           : ${involution ? 'yes' : 'no'}`);
  lines.push(`[H,X] != 0                        : ${commutatorNonzero ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
