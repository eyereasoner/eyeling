/**
 * Eyeling Reasoner — time
 *
 * Date/time parsing and formatting helpers (e.g., xsd:dateTime handling) used
 * by time-related builtins and normalization code.
 */

'use strict';

// Deterministic time support used by time:* builtins.
// This logic is kept in its own module so the core engine stays focused.

// If set, overrides time:localTime across the whole run.
// Store as xsd:dateTime *lexical* string (no quotes).
let fixedNowLex = null;

// If not fixed, memoize one value per run to avoid re-firing rules.
let runNowLex = null;

function localIsoDateTimeString(d) {
  function pad(n, width = 2) {
    return String(n).padStart(width, '0');
  }
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const min = d.getMinutes();
  const sec = d.getSeconds();
  const ms = d.getMilliseconds();
  const offsetMin = -d.getTimezoneOffset(); // minutes east of UTC
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const oh = Math.floor(abs / 60);
  const om = abs % 60;
  const msPart = ms ? '.' + String(ms).padStart(3, '0') : '';
  return (
    pad(year, 4) +
    '-' +
    pad(month) +
    '-' +
    pad(day) +
    'T' +
    pad(hour) +
    ':' +
    pad(min) +
    ':' +
    pad(sec) +
    msPart +
    sign +
    pad(oh) +
    ':' +
    pad(om)
  );
}

function utcIsoDateTimeStringFromEpochSeconds(sec) {
  const ms = sec * 1000;
  const d = new Date(ms);
  function pad(n, w = 2) {
    return String(n).padStart(w, '0');
  }
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours();
  const min = d.getUTCMinutes();
  const s2 = d.getUTCSeconds();
  const ms2 = d.getUTCMilliseconds();
  const msPart = ms2 ? '.' + String(ms2).padStart(3, '0') : '';
  return (
    pad(year, 4) +
    '-' +
    pad(month) +
    '-' +
    pad(day) +
    'T' +
    pad(hour) +
    ':' +
    pad(min) +
    ':' +
    pad(s2) +
    msPart +
    '+00:00'
  );
}

function getNowLex() {
  if (fixedNowLex) return fixedNowLex;
  if (runNowLex) return runNowLex;
  runNowLex = localIsoDateTimeString(new Date());
  return runNowLex;
}

function setFixedNowLex(v) {
  fixedNowLex = v ? String(v) : null;
  // When fixed changes, clear memoized run value.
  runNowLex = null;
}

function resetRunNowLex() {
  runNowLex = null;
}

module.exports = {
  getNowLex,
  setFixedNowLex,
  resetRunNowLex,
  utcIsoDateTimeStringFromEpochSeconds,
};
