// Sudoku-specific helpers used by the example suite.
// The cover9/1 optimization prunes invalid row blocks early while leaving the declarative fallback available.
import { deref, lexicalValue, listFromItems, numberTerm, properListItems, unify } from '../term.js';

export const sudokuBuiltins = {
  register(registry) {
    registry.add('sudoku', 2, sudoku);
    registry.add('cover9', 1, cover9, { deterministic: true, ready: cover9Ready });
  }
};


function cover9Ready(goal, env) {
  const items = properListItems(goal.args[0], env);
  if (!items || items.length !== 9) return false;
  for (const item of items) {
    const text = lexicalValue(item, env);
    if (!/^[1-9]$/.test(text ?? '')) return false;
  }
  return true;
}

function* cover9({ goal, env }) {
  // cover9/1 succeeds exactly when a nine-cell block contains each digit once.
  // The bit mask makes this a constant-time duplicate check after the list is ground.
  const items = properListItems(goal.args[0], env);
  if (!items || items.length !== 9) return;
  let mask = 0;
  for (const item of items) {
    const text = lexicalValue(item, env);
    if (!/^[1-9]$/.test(text ?? '')) return;
    const bit = 1 << (Number(text) - 1);
    if (mask & bit) return;
    mask |= bit;
  }
  if (mask === 0x1ff) yield env;
}

function* sudoku({ solver, goal, env }) {
  const cells = parseGrid(goal.args[0], env);
  if (!cells) return;
  const masks = initMasks(cells);
  if (!masks) return;
  for (const solved of search(cells, masks)) {
    const next = env.clone();
    if (unify(goal.args[1], solutionTerm(solved), next)) yield next;
    if (solver.solutionsSeen >= solver.solutionLimit) return;
  }
}

function parseGrid(term, env) {
  const resolved = deref(term, env);
  if (['atom', 'string', 'number'].includes(resolved.type)) return parseGridString(resolved.name);
  const rows = properListItems(term, env);
  if (!rows || rows.length !== 9) return null;
  const cells = [];
  for (const row of rows) {
    const cols = properListItems(row, env);
    if (!cols || cols.length !== 9) return null;
    for (const cell of cols) {
      const text = lexicalValue(cell, env);
      if (!/^\d+$/.test(text ?? '')) return null;
      const value = Number(text);
      if (value < 0 || value > 9) return null;
      cells.push(value);
    }
  }
  return cells;
}

function parseGridString(text) {
  if (!text || text.length !== 81) return null;
  const cells = [];
  for (const ch of text) {
    if (ch === '.' || ch === '_') cells.push(0);
    else if (ch >= '0' && ch <= '9') cells.push(Number(ch));
    else return null;
  }
  return cells;
}

function initMasks(cells) {
  const row = Array(9).fill(0), col = Array(9).fill(0), box = Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const value = cells[i];
    if (value === 0) continue;
    const r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    const bit = 1 << (value - 1);
    if ((row[r] & bit) || (col[c] & bit) || (box[b] & bit)) return null;
    row[r] |= bit; col[c] |= bit; box[b] |= bit;
  }
  return { row, col, box };
}

function popcount(mask) {
  let n = 0;
  while (mask) { n += mask & 1; mask >>= 1; }
  return n;
}

function* search(cells, masks) {
  // Choose the empty cell with the fewest legal candidates. This MRV heuristic
  // is the main reason the compiled sudoku/2 helper stays fast.
  const all = 0x1ff;
  let best = -1, bestCandidates = 0, bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (cells[i] !== 0) continue;
    const r = Math.floor(i / 9), c = i % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    const candidates = all & ~(masks.row[r] | masks.col[c] | masks.box[b]);
    const count = popcount(candidates);
    if (count === 0) return;
    if (count < bestCount) {
      best = i; bestCandidates = candidates; bestCount = count;
      if (count === 1) break;
    }
  }
  if (best < 0) {
    yield cells.slice();
    return;
  }
  const r = Math.floor(best / 9), c = best % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
  for (let value = 1; value <= 9; value++) {
    const bit = 1 << (value - 1);
    if (!(bestCandidates & bit)) continue;
    cells[best] = value;
    masks.row[r] |= bit; masks.col[c] |= bit; masks.box[b] |= bit;
    yield* search(cells, masks);
    masks.box[b] &= ~bit; masks.col[c] &= ~bit; masks.row[r] &= ~bit;
    cells[best] = 0;
  }
}

function solutionTerm(cells) {
  const rows = [];
  for (let r = 0; r < 9; r++) {
    const items = [];
    for (let c = 0; c < 9; c++) items.push(numberTerm(cells[r * 9 + c]));
    rows.push(listFromItems(items));
  }
  return listFromItems(rows);
}
