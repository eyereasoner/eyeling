#!/usr/bin/env node
'use strict';

/**
 * Large taxonomy reachability case compiled down to a queue-based propagation over integer identifiers.
 * This avoids generic rule interpretation while preserving the same answer / reason / check structure.
 */

const MAX_N = 100000;
const RULE_COUNT = 100002;
const EXPECTED_TYPE_FACTS = 3 * MAX_N + 2;
const EXPECTED_DERIVED_FACTS = EXPECTED_TYPE_FACTS + 1;

function insertFlag(arr, index) {
  if (arr[index]) return false;
  arr[index] = 1;
  return true;
}

// Run a specialized breadth-first propagation over the class ladder.
function main() {
  const nSeen = new Uint8Array(MAX_N + 1);
  const iSeen = new Uint8Array(MAX_N + 1);
  const jSeen = new Uint8Array(MAX_N + 1);
  let a2Seen = false;
  let goalSeen = false;

  const queue = [];
  let head = 0;

  function enqueueClass(kind, index) {
    let inserted = false;
    if (kind === 0) inserted = insertFlag(nSeen, index);
    else if (kind === 1) inserted = insertFlag(iSeen, index);
    else if (kind === 2) inserted = insertFlag(jSeen, index);
    else if (!a2Seen) {
      a2Seen = true;
      inserted = true;
    }
    if (inserted) queue.push({ kind, index });
  }

  enqueueClass(0, 0);

  while (head < queue.length) {
    const cur = queue[head++];
    if (cur.kind === 0 && cur.index < MAX_N) {
      const next = cur.index + 1;
      enqueueClass(0, next);
      enqueueClass(1, next);
      enqueueClass(2, next);
    } else if (cur.kind === 0 && cur.index === MAX_N) {
      enqueueClass(3, 0);
    } else if (cur.kind === 3) {
      goalSeen = true;
    }
  }

  let typeFacts = 0;
  for (let i = 0; i <= MAX_N; i += 1) {
    if (nSeen[i]) typeFacts += 1;
    if (i > 0 && iSeen[i]) typeFacts += 1;
    if (i > 0 && jSeen[i]) typeFacts += 1;
  }
  if (a2Seen) typeFacts += 1;
  const derivedFacts = typeFacts + (goalSeen ? 1 : 0);
  const countOk = typeFacts === EXPECTED_TYPE_FACTS && derivedFacts === EXPECTED_DERIVED_FACTS;
  const ok = goalSeen && !!nSeen[MAX_N] && a2Seen && countOk;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push(
    'The deep taxonomy chain reaches the goal from the seed fact after deriving the full class ladder up to N(100000).',
  );
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push(
    'Starting from Ind:N(0), each N(i) derives N(i+1), I(i+1), and J(i+1); N(100000) then derives A2 and the goal.',
  );
  lines.push('seed facts    : 1');
  lines.push(`rules         : ${RULE_COUNT}`);
  lines.push(`derived facts : ${derivedFacts}`);
  lines.push(`type facts    : ${typeFacts}`);
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`goal reached  : ${goalSeen ? 'yes' : 'no'}`);
  lines.push(`N(100000) seen: ${nSeen[MAX_N] ? 'yes' : 'no'}`);
  lines.push(`A2 derived    : ${a2Seen ? 'yes' : 'no'}`);
  lines.push(`count formula : ${countOk ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
