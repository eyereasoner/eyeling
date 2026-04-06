#!/usr/bin/env node
'use strict';

const ALL_MASK = 0x1FF;
const DEFAULT_PUZZLE =
  '100007090030020008009600500005300900010080002600004000300000010040000007007000300';

function popcount16(x) {
  let c = 0;
  while (x) {
    x &= x - 1;
    c += 1;
  }
  return c;
}

function digitMask(d) {
  return 1 << (d - 1);
}

function boxIndex(r, c) {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

function pushMove(state, move) {
  state.moves.push(move);
}

function cloneState(src) {
  return {
    cells: src.cells.slice(),
    rowUsed: src.rowUsed.slice(),
    colUsed: src.colUsed.slice(),
    boxUsed: src.boxUsed.slice(),
    moves: src.moves.map((move) => ({ ...move })),
  };
}

function place(state, idx, value) {
  if (state.cells[idx] !== 0) return state.cells[idx] === value;
  const r = Math.floor(idx / 9);
  const c = idx % 9;
  const b = boxIndex(r, c);
  const bit = digitMask(value);
  if ((state.rowUsed[r] | state.colUsed[c] | state.boxUsed[b]) & bit) return false;
  state.cells[idx] = value;
  state.rowUsed[r] |= bit;
  state.colUsed[c] |= bit;
  state.boxUsed[b] |= bit;
  return true;
}

function candidates(state, idx) {
  const r = Math.floor(idx / 9);
  const c = idx % 9;
  const b = boxIndex(r, c);
  return ALL_MASK & ~(state.rowUsed[r] | state.colUsed[c] | state.boxUsed[b]);
}

function parsePuzzle(text) {
  if (text.length !== 81) return null;
  const out = new Array(81).fill(0);
  for (let i = 0; i < 81; i += 1) {
    const ch = text[i];
    if (ch >= '1' && ch <= '9') out[i] = ch.charCodeAt(0) - 48;
    else if (ch === '0' || ch === '.' || ch === '_') out[i] = 0;
    else return null;
  }
  return out;
}

function stateFromPuzzle(puzzle) {
  const state = {
    cells: new Array(81).fill(0),
    rowUsed: new Array(9).fill(0),
    colUsed: new Array(9).fill(0),
    boxUsed: new Array(9).fill(0),
    moves: [],
  };
  for (let i = 0; i < 81; i += 1) {
    if (puzzle[i] && !place(state, i, puzzle[i])) return null;
  }
  return state;
}

function propagateSingles(state, stats) {
  for (;;) {
    let progress = false;
    for (let idx = 0; idx < 81; idx += 1) {
      if (state.cells[idx] !== 0) continue;
      const mask = candidates(state, idx);
      const count = popcount16(mask);
      if (count === 0) return false;
      if (count === 1) {
        let digit = 0;
        for (let d = 1; d <= 9; d += 1) {
          if (mask & digitMask(d)) {
            digit = d;
            break;
          }
        }
        pushMove(state, { index: idx, value: digit, candidatesMask: mask, forced: true });
        if (!place(state, idx, digit)) return false;
        stats.forcedMoves += 1;
        progress = true;
      }
    }
    if (!progress) return true;
  }
}

function selectUnfilledCell(state) {
  let found = false;
  let bestCount = 10;
  let bestIdx = -1;
  let bestMask = 0;
  for (let idx = 0; idx < 81; idx += 1) {
    if (state.cells[idx] !== 0) continue;
    const mask = candidates(state, idx);
    const count = popcount16(mask);
    if (count < bestCount) {
      bestCount = count;
      bestIdx = idx;
      bestMask = mask;
      found = true;
      if (count === 2) break;
    }
  }
  return found ? { idx: bestIdx, mask: bestMask } : null;
}

function solve(state, stats, depth) {
  stats.recursiveNodes += 1;
  if (depth > stats.maxDepth) stats.maxDepth = depth;
  if (!propagateSingles(state, stats)) {
    stats.backtracks += 1;
    return false;
  }
  const selected = selectUnfilledCell(state);
  if (!selected) return true;
  for (let d = 1; d <= 9; d += 1) {
    if (!(selected.mask & digitMask(d))) continue;
    const next = cloneState(state);
    pushMove(next, { index: selected.idx, value: d, candidatesMask: selected.mask, forced: false });
    stats.guessedMoves += 1;
    if (place(next, selected.idx, d) && solve(next, stats, depth + 1)) {
      state.cells = next.cells;
      state.rowUsed = next.rowUsed;
      state.colUsed = next.colUsed;
      state.boxUsed = next.boxUsed;
      state.moves = next.moves;
      return true;
    }
  }
  stats.backtracks += 1;
  return false;
}

function countSolutions(state, limit, countRef) {
  if (countRef.count >= limit) return;
  const dummy = {
    forcedMoves: 0,
    guessedMoves: 0,
    recursiveNodes: 0,
    backtracks: 0,
    maxDepth: 0,
  };
  if (!propagateSingles(state, dummy)) return;
  const selected = selectUnfilledCell(state);
  if (!selected) {
    countRef.count += 1;
    return;
  }
  for (let d = 1; d <= 9; d += 1) {
    if (!(selected.mask & digitMask(d))) continue;
    const next = cloneState(state);
    if (place(next, selected.idx, d)) countSolutions(next, limit, countRef);
    if (countRef.count >= limit) return;
  }
}

function unitComplete(vals) {
  let seen = 0;
  for (const v of vals) {
    if (v < 1 || v > 9) return false;
    const bit = digitMask(v);
    if (seen & bit) return false;
    seen |= bit;
  }
  return seen === ALL_MASK;
}

function replayMovesAreLegal(puzzle, solved) {
  const state = stateFromPuzzle(puzzle);
  if (!state) return false;
  for (const move of solved.moves) {
    if (state.cells[move.index] !== 0) return false;
    const mask = candidates(state, move.index);
    if (mask !== move.candidatesMask) return false;
    if (!(mask & digitMask(move.value))) return false;
    if (move.forced && popcount16(mask) !== 1) return false;
    if (!place(state, move.index, move.value)) return false;
  }
  return true;
}

function boardLines(cells) {
  const lines = [];
  for (let r = 0; r < 9; r += 1) {
    if (r > 0 && r % 3 === 0) lines.push('');
    let line = '';
    for (let c = 0; c < 9; c += 1) {
      if (c > 0 && c % 3 === 0) line += '| ';
      const v = cells[r * 9 + c];
      line += v === 0 ? '. ' : `${v} `;
    }
    lines.push(line);
  }
  return lines;
}

function main() {
  const puzzle = parsePuzzle(DEFAULT_PUZZLE);
  if (!puzzle) process.exit(1);
  const initial = stateFromPuzzle(puzzle);
  if (!initial) process.exit(1);

  const stats = {
    givens: 0,
    blanks: 0,
    forcedMoves: 0,
    guessedMoves: 0,
    recursiveNodes: 0,
    backtracks: 0,
    maxDepth: 0,
  };
  for (let i = 0; i < 81; i += 1) {
    if (puzzle[i]) stats.givens += 1;
    else stats.blanks += 1;
  }

  const solved = cloneState(initial);
  const solvedOk = solve(solved, stats, 0);

  const countState = cloneState(initial);
  const countRef = { count: 0 };
  countSolutions(countState, 2, countRef);
  const solutionCount = countRef.count;
  const unique = solutionCount === 1;

  let givensPreserved = true;
  let rowsOk = true;
  let colsOk = true;
  let boxesOk = true;
  let replayOk = false;

  if (solvedOk) {
    for (let i = 0; i < 81; i += 1) if (puzzle[i] && puzzle[i] !== solved.cells[i]) givensPreserved = false;
    for (let r = 0; r < 9; r += 1) {
      const row = [];
      for (let c = 0; c < 9; c += 1) row.push(solved.cells[r * 9 + c]);
      if (!unitComplete(row)) rowsOk = false;
    }
    for (let c = 0; c < 9; c += 1) {
      const col = [];
      for (let r = 0; r < 9; r += 1) col.push(solved.cells[r * 9 + c]);
      if (!unitComplete(col)) colsOk = false;
    }
    for (let b = 0; b < 9; b += 1) {
      const br = Math.floor(b / 3) * 3;
      const bc = (b % 3) * 3;
      const box = [];
      for (let dr = 0; dr < 3; dr += 1) {
        for (let dc = 0; dc < 3; dc += 1) {
          box.push(solved.cells[(br + dr) * 9 + (bc + dc)]);
        }
      }
      if (!unitComplete(box)) boxesOk = false;
    }
    replayOk = replayMovesAreLegal(puzzle, solved);
  }

  const ok = solvedOk && givensPreserved && rowsOk && colsOk && boxesOk && replayOk && unique;

  const lines = [];
  lines.push('=== Answer ===');
  lines.push(unique ? 'The puzzle is solved, and the completed grid is the unique valid Sudoku solution.' : 'The puzzle is solved, and the completed grid is a valid Sudoku solution.');
  lines.push('');
  lines.push('Puzzle');
  lines.push(...boardLines(puzzle));
  lines.push('');
  lines.push('Completed grid');
  if (solvedOk) lines.push(...boardLines(solved.cells));
  lines.push('');
  lines.push('=== Reason Why ===');
  lines.push('The solver combines constraint propagation with depth-first search. It fills forced singles immediately and branches on the blank cell with the fewest candidates.');
  lines.push(`givens             : ${stats.givens}`);
  lines.push(`blanks             : ${stats.blanks}`);
  lines.push(`forced placements  : ${stats.forcedMoves}`);
  lines.push(`guesses            : ${stats.guessedMoves}`);
  lines.push(`search nodes       : ${stats.recursiveNodes}`);
  lines.push(`backtracks         : ${stats.backtracks}`);
  lines.push(`solution unique    : ${unique ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('=== Check ===');
  lines.push(`solver found solution           : ${solvedOk ? 'yes' : 'no'}`);
  lines.push(`givens preserved                : ${givensPreserved ? 'yes' : 'no'}`);
  lines.push(`rows complete                   : ${rowsOk ? 'yes' : 'no'}`);
  lines.push(`columns complete                : ${colsOk ? 'yes' : 'no'}`);
  lines.push(`boxes complete                  : ${boxesOk ? 'yes' : 'no'}`);
  lines.push(`recorded placements replay legally: ${replayOk ? 'yes' : 'no'}`);
  lines.push(`uniqueness check                : ${unique ? 'yes' : 'no'}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(ok ? 0 : 1);
}

main();
