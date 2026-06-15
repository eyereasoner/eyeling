// Small dense-matrix arithmetic builtins.
// These are reusable numeric kernels for ground matrices; when arguments are not
// ground proper numeric lists, user-defined matrix predicates remain available.
import { deref, isDecimalInteger, listFromItems, numberTerm, numberTextFromDouble, parseFiniteNumber, properListItems, unify } from '../term.js';

export const matrixBuiltins = {
  register(registry) {
    registry.add('matrix_sum', 2, matrixSum, { deterministic: true, fallbackWhenNotReady: true, ready: matrixPairReady });
    registry.add('matrix_multiply', 2, matrixMultiply, { deterministic: true, fallbackWhenNotReady: true, ready: matrixPairReady });
    registry.add('cholesky_decomposition', 2, choleskyDecomposition, { deterministic: true, fallbackWhenNotReady: true, ready: firstMatrixReady });
    registry.add('determinant', 2, determinant, { deterministic: true, fallbackWhenNotReady: true, ready: firstMatrixReady });
    registry.add('matrix_inv_triang', 2, matrixInvTriang, { deterministic: true, fallbackWhenNotReady: true, ready: firstMatrixReady });
    registry.add('matrix_inversion', 2, matrixInversion, { deterministic: true, fallbackWhenNotReady: true, ready: firstMatrixReady });
  }
};

function firstMatrixReady(goal, env) { return parseMatrix(goal.args[0], env) !== null; }
function matrixPairReady(goal, env) { return parseMatrixPair(goal.args[0], env) !== null; }

function* matrixSum({ goal, env }) {
  const pair = parseMatrixPair(goal.args[0], env);
  if (!pair) return;
  const [a, b] = pair;
  if (!sameShape(a, b)) return;
  const out = a.map((row, i) => row.map((cell, j) => addNum(cell, b[i][j])));
  yield* unifyMatrix(goal.args[1], out, env);
}

function* matrixMultiply({ goal, env }) {
  const pair = parseMatrixPair(goal.args[0], env);
  if (!pair) return;
  const out = multiplyMatrices(pair[0], pair[1]);
  if (!out) return;
  yield* unifyMatrix(goal.args[1], out, env);
}

function* choleskyDecomposition({ goal, env }) {
  const matrix = parseMatrix(goal.args[0], env);
  const out = cholesky(matrix);
  if (!out) return;
  yield* unifyMatrix(goal.args[1], out, env);
}

function* determinant({ goal, env }) {
  const matrix = parseMatrix(goal.args[0], env);
  const l = cholesky(matrix);
  if (!l) return;
  let prod = num(1n);
  for (let i = l.length - 1; i >= 0; i--) prod = mulNum(l[i][i], prod);
  const det = mulNum(prod, prod);
  const next = env.clone();
  if (unify(goal.args[1], numTerm(det), next)) yield next;
}

function* matrixInvTriang({ goal, env }) {
  const matrix = parseMatrix(goal.args[0], env);
  const out = invertLowerTriangular(matrix);
  if (!out) return;
  yield* unifyMatrix(goal.args[1], out, env);
}

function* matrixInversion({ goal, env }) {
  const matrix = parseMatrix(goal.args[0], env);
  const l = cholesky(matrix);
  if (!l) return;
  const li = invertLowerTriangular(l);
  if (!li) return;
  const lit = transpose(li);
  const out = multiplyMatrices(lit, li);
  if (!out) return;
  yield* unifyMatrix(goal.args[1], out, env);
}

function cholesky(a) {
  if (!isSquare(a)) return null;
  const n = a.length;
  const l = Array.from({ length: n }, () => Array.from({ length: n }, () => num(0n)));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = num(0n);
      for (let k = 0; k < j; k++) sum = addNum(sum, mulNum(l[i][k], l[j][k]));
      if (j === i) {
        const v2 = subNum(a[i][i], sum);
        const v = Math.sqrt(toNumber(v2));
        if (!Number.isFinite(v)) return null;
        l[i][j] = num(v);
      } else {
        const numerator = subNum(a[i][j], sum);
        l[i][j] = divNum(numerator, l[j][j]);
      }
    }
  }
  return l;
}

function invertLowerTriangular(l) {
  if (!isSquare(l)) return null;
  const n = l.length;
  const previous = [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      if (j > i) row.push(num(0n));
      else if (i === j) row.push(divNum(num(1), l[i][i]));
      else {
        let sum = num(0n);
        for (let k = j; k < i; k++) sum = addNum(sum, mulNum(l[i][k], previous[k][j]));
        row.push(divNum(negNum(sum), l[i][i]));
      }
    }
    previous.push(row);
    out.push(row);
  }
  return out;
}

function multiplyMatrices(a, b) {
  if (!a.length || !b.length || !a[0].length || !b[0].length) return null;
  const rows = a.length, inner = a[0].length, cols = b[0].length;
  if (b.length !== inner || a.some((row) => row.length !== inner) || b.some((row) => row.length !== cols)) return null;
  const out = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      let total = num(0n);
      for (let k = inner - 1; k >= 0; k--) total = addNum(mulNum(a[i][k], b[k][j]), total);
      row.push(total);
    }
    out.push(row);
  }
  return out;
}

function transpose(a) {
  if (!a.length) return [];
  return a[0].map((_, i) => a.map((row) => row[i]));
}

function sameShape(a, b) {
  return a.length === b.length && a.every((row, i) => row.length === b[i].length);
}

function isSquare(a) {
  return Array.isArray(a) && a.length > 0 && a.every((row) => row.length === a.length);
}

function parseMatrixPair(term, env) {
  const pair = properListItems(term, env);
  if (!pair || pair.length !== 2) return null;
  const a = parseMatrix(pair[0], env), b = parseMatrix(pair[1], env);
  return a && b ? [a, b] : null;
}

function parseMatrix(term, env) {
  const rows = properListItems(term, env);
  if (!rows) return null;
  const matrix = [];
  let width = null;
  for (const rowTerm of rows) {
    const rowItems = properListItems(rowTerm, env);
    if (!rowItems) return null;
    if (width == null) width = rowItems.length;
    else if (width !== rowItems.length) return null;
    const row = [];
    for (const item of rowItems) {
      const n = parseNum(item, env);
      if (!n) return null;
      row.push(n);
    }
    matrix.push(row);
  }
  return matrix;
}

function parseNum(term, env) {
  const value = deref(term, env);
  if (value.type !== 'number') return null;
  if (isDecimalInteger(value.name)) return num(BigInt(value.name));
  const f = parseFiniteNumber(value.name);
  return f == null ? null : num(f);
}

function* unifyMatrix(target, matrix, env) {
  const next = env.clone();
  if (unify(target, matrixTerm(matrix), next)) yield next;
}

function matrixTerm(matrix) {
  return listFromItems(matrix.map((row) => listFromItems(row.map(numTerm))));
}

function numTerm(value) {
  if (value.kind === 'int') return numberTerm(value.value.toString());
  return numberTerm(numberTextFromDouble(value.value));
}

function num(value) {
  return typeof value === 'bigint' ? { kind: 'int', value } : { kind: 'float', value: Number(value) };
}

function toNumber(value) {
  return value.kind === 'int' ? Number(value.value) : value.value;
}

function addNum(a, b) {
  if (a.kind === 'int' && b.kind === 'int') return num(a.value + b.value);
  return num(toNumber(a) + toNumber(b));
}
function subNum(a, b) {
  if (a.kind === 'int' && b.kind === 'int') return num(a.value - b.value);
  return num(toNumber(a) - toNumber(b));
}
function mulNum(a, b) {
  if (a.kind === 'int' && b.kind === 'int') return num(a.value * b.value);
  return num(toNumber(a) * toNumber(b));
}
function divNum(a, b) {
  if (b.kind === 'int' && b.value === 0n) return num(Number.NaN);
  if (b.kind === 'float' && b.value === 0) return num(Number.NaN);
  if (a.kind === 'int' && b.kind === 'int' && a.value % b.value === 0n) return num(a.value / b.value);
  return num(toNumber(a) / toNumber(b));
}
function negNum(a) {
  return a.kind === 'int' ? num(-a.value) : num(-a.value);
}
