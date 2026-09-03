// ISO arithmetic evaluation and comparison semantics.
import {
  ATOM, COMPOUND, NUMBER, VAR, atom, compound, deref, isDecimalInteger,
  numberTerm, numberTextFromDouble, unify,
} from './term.js';
import { PrologError } from './errors.js';

function integerResource(operation) {
  try {
    return operation();
  } catch (error) {
    // With bounded=false, integer operations have no language-level numeric
    // representation bound.  A finite host can nevertheless exhaust storage
    // (V8 reports oversized BigInt powers/shifts as RangeError).  Keep that
    // implementation resource boundary inside the ISO error model.
    if (error?.name === 'RangeError') throw new PrologError('resource_error(memory)');
    throw error;
  }
}

function evaluate(term, env, options = {}) {
  term = deref(term, env);
  if (term.type === VAR) throw new PrologError('instantiation_error');
  if (term.type === NUMBER) {
    if (isDecimalInteger(term.name)) return { integer: true, value: BigInt(term.name) };
    const value = Number(term.name);
    if (!Number.isFinite(value)) throw new PrologError('evaluation_error(float_overflow)');
    return { integer: false, value };
  }
  if (term.type === ATOM) {
    if (term.name === 'pi') return { integer: false, value: Math.PI };
    if (term.name === 'e' && options.isoStrict !== true) return { integer: false, value: Math.E };
    throw new PrologError('type_error(evaluable)', compound('/', [atom(term.name), numberTerm(0)]));
  }
  if (term.type !== COMPOUND) throw new PrologError('type_error(evaluable)', term);

  let args;
  if (options.isoStrict === true) {
    // ISO 7.9.2(b) gives a direct variable argument precedence over the other
    // expression errors of the same compound expression. Check the direct
    // arguments before selecting an implementation-dependent evaluation order.
    const operands = term.args.map((arg) => deref(arg, env));
    if (operands.some((arg) => arg.type === VAR)) throw new PrologError('instantiation_error');
    // Once the direct-variable precedence is satisfied, each operand is
    // itself an expression. An atom such as foo therefore fails as the
    // non-evaluable functor foo/0 (7.9.2(c)); it is not a numeric value that
    // can subsequently trigger type_error(number,...). STC #69 corrects the
    // misleading 9.1.7 example accordingly.
    args = operands.map((arg) => evaluate(arg, env, options));
  } else {
    // Preserve the normal EyeProlog profile's established left-to-right
    // evaluator and diagnostics; the stricter prescribed errors belong to
    // the explicit ISO profile.
    args = term.args.map((arg) => evaluate(arg, env, options));
  }
  return evaluateOperation(term, args, options);
}

function evaluateOperation(term, args, options = {}) {
  const name = term.name;
  const arity = term.arity;
  if (arity === 1 && (name === '+' || name === '-')) {
    return name === '+' ? args[0] : args[0].integer
      ? { integer: true, value: -args[0].value }
      : { integer: false, value: -args[0].value };
  }
  if (arity === 1 && name === '\\') {
    if (!args[0].integer) throw new PrologError('type_error(integer)', numericTerm(args[0]));
    return { integer: true, value: ~args[0].value };
  }
  if (arity === 1 && ['abs', 'sign', 'float', 'truncate', 'round', 'ceiling', 'floor',
    'float_integer_part', 'float_fractional_part',
    'sin', 'cos', 'atan', 'asin', 'acos', 'tan', 'exp', 'log', 'sqrt'].includes(name)) {
    // These six conversion/rounding functors have float-only input templates
    // in 9.1.1/9.1.6. They therefore require type_error(float,...) when their
    // evaluated argument has integer type, before any I->F conversion.
    if (options.isoStrict === true && [
      'truncate', 'round', 'ceiling', 'floor',
      'float_integer_part', 'float_fractional_part',
    ].includes(name) && args[0].integer) {
      // These functors have only F->I or F->F templates.  In particular,
      // float_integer_part/1 and float_fractional_part/1 must reject an
      // integer by type before any I->F conversion is attempted; otherwise a
      // sufficiently large (but valid, unbounded) integer can be misreported
      // as float_overflow instead of type_error(float,...).
      throw new PrologError('type_error(float)', numericTerm(args[0]));
    }
    if (name === 'abs' && args[0].integer) return { integer: true, value: args[0].value < 0n ? -args[0].value : args[0].value };
    if (name === 'sign' && args[0].integer) return { integer: true, value: args[0].value < 0n ? -1n : args[0].value > 0n ? 1n : 0n };
    const a = Number(args[0].value);
    // The int-exp -> float templates first apply the processor's I->F
    // conversion. With unbounded integers that conversion can overflow even
    // though the integer itself is representable. Do not let a host math
    // function observe +/-Infinity and turn the required float-overflow into
    // a different result (for example atan(Huge) = pi/2).
    if (options.isoStrict === true && args[0].integer && !Number.isFinite(a)) {
      throw new PrologError('evaluation_error(float_overflow)');
    }
    if (name === 'truncate' || name === 'round' || name === 'ceiling' || name === 'floor') {
      const fn = name === 'truncate' ? Math.trunc : name === 'round' ? Math.round : name === 'ceiling' ? Math.ceil : Math.floor;
      return { integer: true, value: BigInt(fn(a)) };
    }
    if (name === 'float_integer_part' || name === 'float_fractional_part') {
      if (args[0].integer) throw new PrologError('type_error(float)', numericTerm(args[0]));
      const value = name === 'float_integer_part' ? Math.trunc(a) : a - Math.trunc(a);
      return { integer: false, value };
    }
    const fn = name === 'float' ? (x) => x : name === 'abs' ? Math.abs : name === 'sign' ? Math.sign : Math[name];
    const value = fn(a);
    if (Number.isNaN(value) || (name === 'log' && a === 0)) throw new PrologError('evaluation_error(undefined)');
    if (!Number.isFinite(value)) throw new PrologError('evaluation_error(float_overflow)');
    // Unlike the implementation-defined resultF choice for ordinary floating
    // arithmetic, exp/1 has an explicit exceptional condition when its
    // mathematical non-zero result is too small to represent. Math.exp()
    // signals that boundary by rounding the positive result to zero.
    if (options.isoStrict === true && name === 'exp' && value === 0) {
      throw new PrologError('evaluation_error(underflow)');
    }
    return { integer: false, value };
  }
  if (arity !== 2) throw new PrologError('type_error(evaluable)', compound('/', [atom(name), numberTerm(arity)]));
  const bothInteger = args[0].integer && args[1].integer;
  const a = args[0].value, b = args[1].value;
  if (name === 'gcd' && options.isoStrict !== true) {
    if (!bothInteger) {
      const invalid = !args[0].integer ? args[0] : args[1];
      throw new PrologError('type_error(integer)', numericTerm(invalid));
    }
    return { integer: true, value: integerResource(() => {
      let x = a < 0n ? -a : a;
      let y = b < 0n ? -b : b;
      while (y !== 0n) [x, y] = [y, x % y];
      return x;
    }) };
  }
  if (['//', 'div', 'mod', 'rem', '/\\', '\\/', 'xor', '<<', '>>'].includes(name) && !bothInteger) {
    const invalid = !args[0].integer ? args[0] : args[1];
    throw new PrologError('type_error(integer)', numericTerm(invalid));
  }
  if (bothInteger && name === '^') {
    if (b >= 0n) return { integer: true, value: integerResource(() => a ** b) };
    if (a === 0n) throw new PrologError('evaluation_error(undefined)');
    if (a === 1n) return { integer: true, value: 1n };
    if (a === -1n) return { integer: true, value: (-b) % 2n === 0n ? 1n : -1n };
    // Corrigendum 3: the defined real result needs a floating-point base.
    throw new PrologError('type_error(float)', numericTerm(args[0]));
  }
  if (bothInteger && ['+', '-', '*', '//', 'div', 'mod', 'rem', '/\\', '\\/', 'xor', '<<', '>>'].includes(name)) {
    if ((name === '//' || name === 'div' || name === 'mod' || name === 'rem') && b === 0n) throw new PrologError('evaluation_error(zero_divisor)');
    if (name === '+') return { integer: true, value: integerResource(() => a + b) };
    if (name === '-') return { integer: true, value: integerResource(() => a - b) };
    if (name === '*') return { integer: true, value: integerResource(() => a * b) };
    if (name === '//') return { integer: true, value: integerResource(() => a / b) };
    if (name === 'div') {
      return { integer: true, value: integerResource(() => {
        const quotient = a / b;
        const remainder = a % b;
        return remainder !== 0n && ((a < 0n) !== (b < 0n)) ? quotient - 1n : quotient;
      }) };
    }
    if (name === 'rem') return { integer: true, value: integerResource(() => a % b) };
    if (name === 'mod') return { integer: true, value: integerResource(() => ((a % b) + b) % b) };
    if (name === '/\\') return { integer: true, value: integerResource(() => a & b) };
    if (name === '\\/') return { integer: true, value: integerResource(() => a | b) };
    if (name === 'xor') return { integer: true, value: integerResource(() => a ^ b) };
    if (name === '<<') return { integer: true, value: integerResource(() => a << b) };
    if (name === '>>') return { integer: true, value: integerResource(() => a >> b) };
  }
  // Power has prescribed exceptional conditions that depend on the evaluated
  // operand values/types and therefore precede any I->F conversion needed by
  // the selected floating template. Checking these first matters with
  // unbounded integers: conversion overflow must not hide an already-satisfied
  // undefined-power condition.
  const aNegative = args[0].integer ? a < 0n : a < 0;
  const aZero = args[0].integer ? a === 0n : a === 0;
  const bNegative = args[1].integer ? b < 0n : b < 0;
  if (options.isoStrict === true && name === '**' && aNegative && !args[1].integer) {
    // Corrigendum 3 corrects the operand name in 9.3.1.3(c): **/2 requires
    // an integer-typed exponent for a negative base. A float such as 2.0 is
    // still not an integer value of the required type here.
    throw new PrologError('evaluation_error(undefined)');
  }
  if (options.isoStrict === true && name === '^' && aNegative && !args[1].integer && !Number.isInteger(b)) {
    // Corrigendum 2 ^/2 additionally accepts a float with an integer value.
    throw new PrologError('evaluation_error(undefined)');
  }
  if ((name === '**' || name === '^') && aZero && bNegative) {
    throw new PrologError('evaluation_error(undefined)');
  }

  const x = Number(a), y = Number(b);
  if ((!Number.isFinite(x) || !Number.isFinite(y)) && name !== 'max' && name !== 'min') {
    throw new PrologError('evaluation_error(float_overflow)');
  }
  if (name === '/' && y === 0) throw new PrologError('evaluation_error(zero_divisor)');
  let value;
  if (name === 'max' || name === 'min') {
    const cmp = compareArithmeticValues(args[0], args[1]);
    const chooseLeft = name === 'max' ? cmp >= 0 : cmp <= 0;
    return chooseLeft ? args[0] : args[1];
  }
  if (name === 'atan2') {
    if (x === 0 && y === 0) throw new PrologError('evaluation_error(undefined)');
    value = Math.atan2(x, y);
  }
  else if (name === '+') value = x + y;
  else if (name === '-') value = x - y;
  else if (name === '*') value = x * y;
  else if (name === '/') value = x / y;
  else if (name === '**' || name === '^') value = Math.pow(x, y);
  else throw new PrologError('type_error(evaluable)', compound('/', [atom(name), numberTerm(arity)]));
  if (Number.isNaN(value)) throw new PrologError('evaluation_error(undefined)');
  if (!Number.isFinite(value)) throw new PrologError('evaluation_error(float_overflow)');
  // Part 1 **/2 and Corrigendum 2 ^/2 prescribe underflow when a
  // mathematically non-zero floating power is too small. A non-zero finite
  // base cannot have an exact zero power result, so a host result of +/-0 is
  // the observable underflow boundary. Zero raised to a positive power remains
  // the ordinary exact zero case.
  if (options.isoStrict === true && (name === '**' || name === '^') && value === 0 && x !== 0) {
    throw new PrologError('evaluation_error(underflow)');
  }
  return { integer: false, value };
}
export function arithmeticValueTerm(value) {
  return value.integer ? numberTerm(value.value.toString()) : numberTerm(numberTextFromDouble(value.value));
}
function numericTerm(value) {
  return arithmeticValueTerm(value);
}
export function evaluateArithmetic(term, env, options = {}) {
  return evaluate(term, env, options);
}
function compareIntegerToFloat(integerValue, floatValue) {
  if (!Number.isFinite(floatValue)) throw new PrologError('evaluation_error(float_overflow)');

  // Do not round an unbounded integer through JavaScript Number before a
  // mixed arithmetic comparison.  Every integral IEEE-754 double can be
  // converted back to the exact integer value it represents; fractional
  // doubles necessarily have magnitude below 2^53, so their truncation is
  // also exact.  This preserves mathematical ordering across the I/F boundary
  // (STC #50), e.g. 9007199254740993 > 9007199254740992.0.
  if (Number.isInteger(floatValue)) {
    const floatInteger = BigInt(floatValue);
    return integerValue < floatInteger ? -1 : integerValue > floatInteger ? 1 : 0;
  }

  const truncated = BigInt(Math.trunc(floatValue));
  if (integerValue < truncated) return -1;
  if (integerValue > truncated) return 1;
  return floatValue > 0 ? -1 : 1;
}

export function compareArithmeticValues(left, right) {
  const a = left.value;
  const b = right.value;
  if (left.integer && right.integer) return a < b ? -1 : a > b ? 1 : 0;
  if (left.integer) return compareIntegerToFloat(a, b);
  if (right.integer) return -compareIntegerToFloat(b, a);
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareStrictIsoArithmeticValues(left, right) {
  if (left.integer === right.integer) return compareArithmeticValues(left, right);

  // ISO/IEC 13211-1:1995 8.7 specifies mixed arithmetic comparisons by
  // floatI->F conversion of the integer operand.  That conversion can round
  // an otherwise exact integer and can itself overflow.  Normal EyeProlog
  // deliberately keeps its later exact cross-type comparison extension; the
  // strict profile follows the Part 1 operation table.
  const leftValue = left.integer ? Number(left.value) : left.value;
  const rightValue = right.integer ? Number(right.value) : right.value;
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
    throw new PrologError('evaluation_error(float_overflow)');
  }
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}
export function* isBuiltin({ solver, goal, env }) {
  const result = arithmeticValueTerm(evaluateArithmetic(goal.args[1], env, { isoStrict: solver?.isoStrict === true }));
  const next = env.clone();
  if (unify(goal.args[0], result, next)) yield next;
}
export function arithmeticComparison(test) {
  return function* ({ solver, goal, env }) {
    const options = { isoStrict: solver?.isoStrict === true };
    const left = evaluateArithmetic(goal.args[0], env, options);
    const right = evaluateArithmetic(goal.args[1], env, options);
    const cmp = solver?.isoStrict === true
      ? compareStrictIsoArithmeticValues(left, right)
      : compareArithmeticValues(left, right);
    if (test(cmp)) yield env;
  };
}
