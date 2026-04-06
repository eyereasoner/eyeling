#!/usr/bin/env node
'use strict';

const LIMIT = 1000;

function sieve(limit) {
  const prime = new Array(limit + 1).fill(true);
  prime[0] = false;
  prime[1] = false;
  for (let p = 2; p * p <= limit; p += 1) {
    if (!prime[p]) continue;
    for (let m = p * p; m <= limit; m += p) prime[m] = false;
  }
  return prime;
}

function collectPrimes(prime, limit) {
  const out = [];
  for (let i = 2; i <= limit; i += 1) if (prime[i]) out.push(i);
  return out;
}

function goldbachPairs(target, primes, prime) {
  let count = 0;
  for (const p of primes) {
    if (p > Math.floor(target / 2)) break;
    const q = target - p;
    if (prime[q]) count += 1;
  }
  return count;
}

function main() {
  const prime = sieve(LIMIT);
  const primes = collectPrimes(prime, LIMIT);

  let totalDecompositions = 0;
  let fewest = Number.MAX_SAFE_INTEGER;
  let most = 0;
  let richestTarget = 4;
  const hardest = [];
  let allRepresented = true;

  for (let target = 4; target <= LIMIT; target += 2) {
    const count = goldbachPairs(target, primes, prime);
    totalDecompositions += count;
    if (count === 0) allRepresented = false;
    if (count < fewest) {
      fewest = count;
      hardest.length = 0;
      hardest.push(target);
    } else if (count === fewest) {
      hardest.push(target);
    }
    if (count > most) {
      most = count;
      richestTarget = target;
    }
  }

  let bestA = 0;
  let bestB = 0;
  let bestDiff = Number.MAX_SAFE_INTEGER;
  for (const p of primes) {
    if (p > LIMIT / 2) break;
    const q = LIMIT - p;
    if (prime[q] && q >= p) {
      const diff = q - p;
      if (diff < bestDiff) {
        bestDiff = diff;
        bestA = p;
        bestB = q;
      }
    }
  }

  const primeCountOk = primes.length === 168;
  const balancedPairOk = bestA + bestB === LIMIT && prime[bestA] && prime[bestB];
  const ok = allRepresented && primeCountOk && balancedPairOk;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push('Every even integer from 4 through 1000 has at least one Goldbach decomposition in the tested range.');
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push('The program builds a prime table, enumerates unordered pairs p+q=n for each even target, and summarizes sparse and rich cases.');
  lines.push(`even targets checked : ${((LIMIT - 4) / 2) + 1}`);
  lines.push(`total decompositions : ${totalDecompositions}`);
  lines.push(`fewest decompositions: ${fewest}`);
  lines.push(`hardest targets      : ${hardest.join(', ')}`);
  lines.push(`most decompositions  : ${most}`);
  lines.push(`richest target       : ${richestTarget}`);
  lines.push(`balanced pair(1000)  : ${bestA} + ${bestB}`);
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`all represented      : ${allRepresented ? 'yes' : 'no'}`);
  lines.push(`prime count known    : ${primeCountOk ? 'yes' : 'no'}`);
  lines.push(`balanced pair valid  : ${balancedPairOk ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
