// Runtime arithmetic conversions used by library(arithmetic).
// Pure arithmetic relations stay in src/lib/arithmetic.pl.

import { COMPOUND, NUMBER, VAR, compound, copyResolved, deref, numberTerm, unify } from './term.js';
import { PrologError } from './errors.js';

function gcdBigInt(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function approximateRational(value, tolerance = 1e-6) {
  if (!Number.isFinite(value)) throw new PrologError('type_error(number)', numberTerm(String(value)));
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new PrologError('domain_error(not_less_than_zero)', numberTerm(String(tolerance)));
  if (Number.isInteger(value) && Number.isSafeInteger(value)) return [BigInt(value), 1n];
  const sign = value < 0 ? -1n : 1n;
  const target = Math.abs(value);
  let x = target;
  let hPrev2 = 0, hPrev1 = 1, kPrev2 = 1, kPrev1 = 0;
  for (let i = 0; i < 96; i++) {
    const a = Math.floor(x);
    const h = a * hPrev1 + hPrev2;
    const k = a * kPrev1 + kPrev2;
    if (!Number.isSafeInteger(h) || !Number.isSafeInteger(k) || k === 0) break;
    if (Math.abs(target - h / k) <= tolerance) {
      const n = sign * BigInt(h), d = BigInt(k), g = gcdBigInt(n, d);
      return [n / g, d / g];
    }
    const fraction = x - a;
    if (fraction === 0) {
      const n = sign * BigInt(h), d = BigInt(k), g = gcdBigInt(n, d);
      return [n / g, d / g];
    }
    [hPrev2, hPrev1] = [hPrev1, h];
    [kPrev2, kPrev1] = [kPrev1, k];
    x = 1 / fraction;
  }

  // Exact decimal-token fallback for continued fractions that exceed safe
  // JavaScript integer intermediates.
  const text = target.toString();
  const match = /^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text);
  if (!match) throw new PrologError('representation_error(rational)');
  const fractionDigits = match[2] ?? '';
  const exponent = Number(match[3] ?? 0);
  let numerator = BigInt(match[1] + fractionDigits);
  let denominator = 10n ** BigInt(fractionDigits.length);
  if (exponent > 0) numerator *= 10n ** BigInt(exponent);
  else if (exponent < 0) denominator *= 10n ** BigInt(-exponent);
  numerator *= sign;
  const g = gcdBigInt(numerator, denominator);
  return [numerator / g, denominator / g];
}

function rationalParts(term, env, tolerance = 1e-6) {
  const value = deref(term, env);
  if (value.type === VAR) throw new PrologError('instantiation_error');
  if (value.type === NUMBER) {
    if (/^-?\d+$/.test(value.name)) return [BigInt(value.name), 1n];
    return approximateRational(Number(value.name), tolerance);
  }
  if (value.type === COMPOUND && value.name === 'rdiv' && value.arity === 2) {
    const numerator = deref(value.args[0], env), denominator = deref(value.args[1], env);
    if (numerator.type !== NUMBER || denominator.type !== NUMBER ||
        !/^-?\d+$/.test(numerator.name) || !/^-?\d+$/.test(denominator.name)) {
      throw new PrologError('type_error(rational)', copyResolved(value, env));
    }
    let n = BigInt(numerator.name), d = BigInt(denominator.name);
    if (d === 0n) throw new PrologError('evaluation_error(zero_divisor)');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcdBigInt(n, d);
    return [n / g, d / g];
  }
  throw new PrologError('type_error(number)', copyResolved(value, env));
}

function rationalTerm(numerator, denominator) {
  return denominator === 1n
    ? numberTerm(numerator.toString())
    : compound('rdiv', [numberTerm(numerator.toString()), numberTerm(denominator.toString())]);
}

function* numberToRationalBuiltin({ goal, env }) {
  const [numerator, denominator] = rationalParts(goal.args[0], env);
  const next = env.clone();
  if (unify(goal.args[1], rationalTerm(numerator, denominator), next)) yield next;
}

function* numberToRationalToleranceBuiltin({ goal, env }) {
  const epsilonTerm = deref(goal.args[0], env);
  if (epsilonTerm.type === VAR) throw new PrologError('instantiation_error');
  if (epsilonTerm.type !== NUMBER) throw new PrologError('type_error(number)', copyResolved(epsilonTerm, env));
  const epsilon = Number(epsilonTerm.name);
  if (!Number.isFinite(epsilon)) throw new PrologError('type_error(number)', copyResolved(epsilonTerm, env));
  if (epsilon < 0) throw new PrologError('domain_error(not_less_than_zero)', copyResolved(epsilonTerm, env));
  const [numerator, denominator] = rationalParts(goal.args[1], env, epsilon);
  const next = env.clone();
  if (unify(goal.args[2], rationalTerm(numerator, denominator), next)) yield next;
}

function* rationalPartsBuiltin({ goal, env }) {
  const [numerator, denominator] = rationalParts(goal.args[0], env);
  const next = env.clone();
  if (unify(goal.args[1], numberTerm(numerator.toString()), next) &&
      unify(goal.args[2], numberTerm(denominator.toString()), next)) yield next;
}

export const arithmeticHostBuiltins = {
  register(registry) {
    registry.add('eyeprolog__number_to_rational', 2, numberToRationalBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__number_to_rational', 3, numberToRationalToleranceBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__rational_numerator_denominator', 3, rationalPartsBuiltin, { deterministic: true, eyePrologLibrary: true });
  },
};
