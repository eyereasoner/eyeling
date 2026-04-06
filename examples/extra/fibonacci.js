#!/usr/bin/env node
'use strict';

/**
 * Exact Fibonacci benchmark using BigInt throughout.
 * The main path is iterative, while fast doubling is used as an independent cross-check.
 */

function fibonacciIterative(n) {
  let a = 0n;
  let b = 1n;
  for (let i = 0; i < n; i += 1) {
    const t = a + b;
    a = b;
    b = t;
  }
  return a;
}

// Independent cross-check based on the fast-doubling identities.
function fastDoubling(n) {
  if (n === 0) return [0n, 1n];
  const [a, b] = fastDoubling(Math.floor(n / 2));
  const c = a * (2n * b - a);
  const d = a * a + b * b;
  if (n % 2 === 0) return [c, d];
  return [d, c + d];
}

// Compute the requested values, then verify a few known identities and size facts.
function main() {
  const targets = [0, 1, 10, 100, 1000, 10000];
  const vals = targets.map((n) => fibonacciIterative(n));

  const f10Ok = vals[2] === 55n;
  const f1000Str = vals[4].toString();
  const f10000Str = vals[5].toString();
  const f1000Digits = f1000Str.length;
  const f10000Digits = f10000Str.length;

  let fastOk = true;
  for (let i = 0; i < targets.length; i += 1) {
    const [a] = fastDoubling(targets[i]);
    if (a !== vals[i]) fastOk = false;
  }

  const f99 = fibonacciIterative(99);
  const f100 = fibonacciIterative(100);
  const f101 = fibonacciIterative(101);
  const cassiniOk = f101 * f99 === f100 * f100 + 1n;
  const f10000Last3Ok = f10000Str.endsWith('875');

  const ok = f10Ok && fastOk && cassiniOk && f1000Digits === 209 && f10000Digits === 2090 && f10000Last3Ok;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push('The requested Fibonacci values are computed exactly, up to F(10000).');
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push(
    'The main computation uses the defining recurrence F(n+1)=F(n)+F(n-1), and the results are cross-checked with fast doubling.',
  );
  for (let i = 0; i < targets.length; i += 1) {
    lines.push(`value[${i}]          : F(${targets[i]}) = ${vals[i].toString()}`);
  }
  lines.push(`digits in F(1000)   : ${f1000Digits}`);
  lines.push(`digits in F(10000)  : ${f10000Digits}`);
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`F(10) = 55            : ${f10Ok ? 'yes' : 'no'}`);
  lines.push(`fast doubling agrees  : ${fastOk ? 'yes' : 'no'}`);
  lines.push(`Cassini at n=100      : ${cassiniOk ? 'yes' : 'no'}`);
  lines.push(`F(1000) has 209 digits: ${f1000Digits === 209 ? 'yes' : 'no'}`);
  lines.push(`F(10000) has 2090 digits: ${f10000Digits === 2090 ? 'yes' : 'no'}`);
  lines.push(`F(10000) ends in 875  : ${f10000Last3Ok ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
