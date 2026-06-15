// Integer number-theory helpers for examples that would otherwise encode
// arithmetic algorithms with many small recursive rule calls.
// The predicates are intentionally general: extended GCD, Collatz trajectories,
// Kaprekar iteration counts, and Goldbach pair generation.
import { deref, listFromItems, numberTerm, unify } from '../term.mjs';

export const numberTheoryBuiltins = {
  register(registry) {
    registry.add('extended_gcd', 5, extendedGcd, { deterministic: true, fallbackWhenNotReady: true, ready: firstTwoIntsReady });
    registry.add('collatz_trajectory', 2, collatzTrajectory, { deterministic: true, fallbackWhenNotReady: true, ready: firstIntReady });
    registry.add('kaprekar_steps', 2, kaprekarSteps, { deterministic: true, fallbackWhenNotReady: true, ready: firstIntReady });
    registry.add('goldbach_pair', 3, goldbachPair, { fallbackWhenNotReady: true, ready: firstIntReady });
  }
};

function firstIntReady(goal, env) { return intValue(goal.args[0], env) !== null; }
function firstTwoIntsReady(goal, env) { return intValue(goal.args[0], env) !== null && intValue(goal.args[1], env) !== null; }

function* extendedGcd({ goal, env }) {
  const a = intValue(goal.args[0], env);
  const b = intValue(goal.args[1], env);
  if (a === null || b === null) return;
  const { gcd, s, t } = egcdSigned(a, b);
  const next = env.clone();
  if (unify(goal.args[2], numberTerm(gcd.toString()), next) &&
      unify(goal.args[3], numberTerm(s.toString()), next) &&
      unify(goal.args[4], numberTerm(t.toString()), next)) yield next;
}

function egcdSigned(a, b) {
  const signA = a < 0n ? -1n : 1n;
  const signB = b < 0n ? -1n : 1n;
  let oldR = absBigInt(a), r = absBigInt(b);
  let oldS = 1n, s = 0n;
  let oldT = 0n, t = 1n;
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }
  return { gcd: oldR, s: oldS * signA, t: oldT * signB };
}

function absBigInt(n) { return n < 0n ? -n : n; }

function* collatzTrajectory({ goal, env }) {
  const n = intValue(goal.args[0], env);
  if (n === null || n < 1n) return;
  const seen = [];
  let current = n;
  while (current >= 1n) {
    seen.push(numberTerm(current.toString()));
    if (current === 1n) break;
    current = current % 2n === 0n ? current / 2n : current * 3n + 1n;
    if (seen.length > 100000) return;
  }
  const next = env.clone();
  if (unify(goal.args[1], listFromItems(seen), next)) yield next;
}

function* kaprekarSteps({ goal, env }) {
  const n = intValue(goal.args[0], env);
  if (n === null || n < 0n || n > 9999n) return;
  const count = kaprekarCount(Number(n));
  if (count === null) return;
  const next = env.clone();
  if (unify(goal.args[1], numberTerm(String(count)), next)) yield next;
}

function kaprekarCount(start) {
  if (start === 6174) return 0;
  let current = start;
  for (let count = 1; count <= 100; count++) {
    const digits = String(current).padStart(4, '0').slice(-4).split('').map(Number).sort((a, b) => a - b);
    const low = digitsToNumber(digits);
    const high = digitsToNumber([...digits].reverse());
    current = high - low;
    if (current === 6174) return count;
    if (current <= 0) return null;
  }
  return null;
}

function digitsToNumber(digits) {
  return (((digits[0] * 10 + digits[1]) * 10 + digits[2]) * 10 + digits[3]);
}

function* goldbachPair({ goal, env }) {
  const n = intValue(goal.args[0], env);
  if (n === null || n < 4n || n % 2n !== 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) return;
  const limit = Number(n / 2n);
  const total = Number(n);
  for (let p = 2; p <= limit; p = p === 2 ? 3 : p + 2) {
    const q = total - p;
    if (!isPrimeNumber(p) || !isPrimeNumber(q)) continue;
    const next = env.clone();
    if (unify(goal.args[1], numberTerm(String(p)), next) && unify(goal.args[2], numberTerm(String(q)), next)) yield next;
  }
}

function isPrimeNumber(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let d = 3; d <= Math.floor(Math.sqrt(n)); d += 2) if (n % d === 0) return false;
  return true;
}

function intValue(term, env) {
  const value = deref(term, env);
  if (value.type !== 'number' || !/^-?\d+$/.test(value.name)) return null;
  return BigInt(value.name);
}
