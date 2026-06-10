'use strict';

const USE_COLOR = !process.env.NO_COLOR && (
  process.stdout.isTTY ||
  (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0')
);

const C = USE_COLOR
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', n: '\x1b[0m' }
  : { g: '', r: '', y: '', dim: '', n: '' };

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;

  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1).padStart(4, '0');
  return `${minutes}m ${seconds}s`;
}

function durationSuffix(ms) {
  return ms == null ? '' : ` ${C.dim}(${formatDuration(ms)})${C.n}`;
}

function sequenceLabel(n) {
  return String(n).padStart(3, '0');
}

function result(status, n, description, ms) {
  const color = status === 'OK' ? C.g : C.r;
  const stream = status === 'OK' ? console.log : console.error;
  stream(`${color}${status}${C.n} ${sequenceLabel(n)} ${description}${durationSuffix(ms)}`);
}

function pass(n, description, ms) {
  result('OK', n, description, ms);
}

function failResult(n, description, ms) {
  result('FAIL', n, description, ms);
}

function info(msg, ms) {
  console.log(`${C.y}==${C.n} ${msg}${durationSuffix(ms)}`);
}

function warn(msg) {
  console.log(`${C.y}SKIP${C.n} ${msg}`);
}

function detail(msg) {
  console.log(`${C.dim}${msg}${C.n}`);
}

module.exports = {
  C,
  detail,
  durationSuffix,
  failResult,
  formatDuration,
  info,
  pass,
  sequenceLabel,
  warn,
};
