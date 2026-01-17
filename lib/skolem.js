/**
 * Eyeling Reasoner — skolem
 *
 * Deterministic skolemization utilities: stable key generation and skolem term
 * construction used by the engine and parser.
 */

'use strict';

// Deterministic pseudo-UUID from a string key (for log:skolem).
// Not cryptographically strong, but stable and platform-independent.

function deterministicSkolemIdFromKey(key) {
  // Four 32-bit FNV-1a style accumulators with slight variation
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  let h3 = 0x811c9dc5;
  let h4 = 0x811c9dc5;

  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);

    h1 ^= c;
    h1 = (h1 * 0x01000193) >>> 0;

    h2 ^= c + 1;
    h2 = (h2 * 0x01000193) >>> 0;

    h3 ^= c + 2;
    h3 = (h3 * 0x01000193) >>> 0;

    h4 ^= c + 3;
    h4 = (h4 * 0x01000193) >>> 0;
  }

  const hex = [h1, h2, h3, h4]
    .map((h) => h.toString(16).padStart(8, '0'))
    .join(''); // 32 hex chars

  // Format like a UUID: 8-4-4-4-12
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20)
  );
}

module.exports = {
  deterministicSkolemIdFromKey,
};
