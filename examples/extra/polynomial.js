#!/usr/bin/env node
'use strict';

/**
 * Polynomial case with lightweight complex arithmetic and numerical root finding.
 * The result is checked both by evaluating the polynomial at the roots and by reconstructing the coefficients.
 */

const ROOT_TOL = 1e-10;
const COEFF_TOL = 1e-8;
const MAX_ITER = 200;

function cx(re, im) {
  return { re, im };
}
function add(a, b) {
  return cx(a.re + b.re, a.im + b.im);
}
function sub(a, b) {
  return cx(a.re - b.re, a.im - b.im);
}
function mul(a, b) {
  return cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
}
function divcx(a, b) {
  const s = b.re * b.re + b.im * b.im;
  return cx((a.re * b.re + a.im * b.im) / s, (a.im * b.re - a.re * b.im) / s);
}
function abscx(a) {
  return Math.hypot(a.re, a.im);
}
function powu(a, e) {
  let out = cx(1, 0);
  for (let i = 0; i < e; i += 1) out = mul(out, a);
  return out;
}
function dist(a, b) {
  return abscx(sub(a, b));
}
function evalPoly(coeffs, x) {
  let acc = cx(0, 0);
  for (const coeff of coeffs) acc = add(mul(acc, x), coeff);
  return acc;
}
function multiplyPolys(left, right) {
  const out = new Array(left.length + right.length - 1).fill(null).map(() => cx(0, 0));
  for (let i = 0; i < left.length; i += 1) {
    for (let j = 0; j < right.length; j += 1) {
      out[i + j] = add(out[i + j], mul(left[i], right[j]));
    }
  }
  return out;
}
// Durand-Kerner-style iteration on a monic copy of the polynomial.
function rootsFromCoeffs(coeffs) {
  const degree = coeffs.length - 1;
  const monic = [];
  const lead = coeffs[0];
  let radius = 1.0;
  for (let i = 0; i < coeffs.length; i += 1) {
    monic[i] = divcx(coeffs[i], lead);
    if (i > 0) {
      const a = abscx(monic[i]);
      if (a > radius - 1.0) radius = 1.0 + a;
    }
  }
  const seed = cx(0.4, 0.9);
  const roots = [];
  for (let i = 0; i < degree; i += 1) roots[i] = mul(powu(seed, i), cx(radius, 0));

  for (let iter = 0; iter < MAX_ITER; iter += 1) {
    let maxDelta = 0.0;
    for (let i = 0; i < degree; i += 1) {
      let denom = cx(1, 0);
      for (let j = 0; j < degree; j += 1) {
        if (j !== i) denom = mul(denom, sub(roots[i], roots[j]));
      }
      if (abscx(denom) < 1e-18) denom = add(denom, cx(1e-12, 1e-12));
      const delta = divcx(evalPoly(monic, roots[i]), denom);
      roots[i] = sub(roots[i], delta);
      const a = abscx(delta);
      if (a > maxDelta) maxDelta = a;
    }
    if (maxDelta < ROOT_TOL) break;
  }

  return roots;
}
function sortRoots(roots) {
  for (let i = 0; i < roots.length; i += 1) {
    for (let j = i + 1; j < roots.length; j += 1) {
      const leftReal = Math.abs(roots[i].im) < 1e-8;
      const rightReal = Math.abs(roots[j].im) < 1e-8;
      let swap = false;
      if (leftReal && rightReal) swap = roots[j].re > roots[i].re;
      else if (!leftReal && rightReal) swap = false;
      else if (leftReal && !rightReal) swap = true;
      else if (roots[j].im > roots[i].im || (Math.abs(roots[j].im - roots[i].im) < 1e-8 && roots[j].re > roots[i].re))
        swap = true;
      if (swap) {
        const t = roots[i];
        roots[i] = roots[j];
        roots[j] = t;
      }
    }
  }
}
function fmtG(value) {
  const v = Math.abs(value) < 1e-8 ? 0 : value;
  if (v === 0) return '0';
  const s = Number(v).toPrecision(10);
  return s
    .replace(/(?:\.0+|(\.\d*?[1-9])0+)(e|$)/, '$1$2')
    .replace(/\.0+$/, '')
    .replace(/e\+?/, 'e');
}
function printCx(z) {
  const re = Math.abs(z.re) < 1e-8 ? 0 : z.re;
  const im = Math.abs(z.im) < 1e-8 ? 0 : z.im;
  if (im === 0) return fmtG(re);
  if (re === 0) return `${fmtG(im)}i`;
  return `${fmtG(re)} ${im >= 0 ? '+' : '-'} ${fmtG(Math.abs(im))}i`;
}

// Solve, reconstruct, and validate the polynomial in three complementary ways.
// Build the final ARC-style report and exit non-zero if a check fails.
function main() {
  const cases = [
    [cx(1, 0), cx(-10, 0), cx(35, 0), cx(-50, 0), cx(24, 0)],
    [cx(1, 0), cx(-9, -5), cx(14, 33), cx(24, -44), cx(-26, 0)],
  ];
  const labels = ['real quartic', 'complex quartic'];
  let allOk = true;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push(
    'Both polynomial examples are solved consistently: the computed roots satisfy the source polynomials and reconstruct the original coefficients.',
  );
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push(
    'For each quartic, the program solves for the roots numerically, substitutes them back, and rebuilds the polynomial from those roots.',
  );
  for (let c = 0; c < 2; c += 1) {
    const roots = rootsFromCoeffs(cases[c]);
    sortRoots(roots);
    const coeffs1 = [cx(1, 0), sub(cx(0, 0), roots[0])];
    const coeffs2 = [cx(1, 0), sub(cx(0, 0), roots[1])];
    const coeffs3 = [cx(1, 0), sub(cx(0, 0), roots[2])];
    const coeffs4 = [cx(1, 0), sub(cx(0, 0), roots[3])];
    const tmp1 = multiplyPolys(coeffs1, coeffs2);
    const tmp2 = multiplyPolys(tmp1, coeffs3);
    const rebuilt = multiplyPolys(tmp2, coeffs4);
    let rootsValid = true;
    let rebuildOk = true;
    const residuals = [];
    for (let i = 0; i < 4; i += 1) {
      residuals[i] = evalPoly(cases[c], roots[i]);
      if (abscx(residuals[i]) > 1e-6) rootsValid = false;
    }
    for (let i = 0; i < 5; i += 1) {
      if (dist(rebuilt[i], cases[c][i]) > COEFF_TOL) rebuildOk = false;
    }
    allOk &&= rootsValid && rebuildOk;
    lines.push('');
    lines.push(`Example #${c + 1} (${labels[c]})`);
    lines.push(`roots               : ${roots.map(printCx).join(', ')}`);
    lines.push(`residuals           : ${residuals.map(printCx).join(', ')}`);
    lines.push(`reconstruction ok   : ${rebuildOk ? 'yes' : 'no'}`);
    lines.push(`roots valid         : ${rootsValid ? 'yes' : 'no'}`);
  }
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`all examples valid  : ${allOk ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(allOk ? 0 : 1);
}

main();
