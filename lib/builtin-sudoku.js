'use strict';

module.exports = function registerSudokuBuiltins(api) {
  const { registerBuiltin, internLiteral, termToJsString, unifyTerm, terms } = api;
  const { Var } = terms;

  const SUDOKU_NS = 'http://example.org/sudoku-builtin#';
  const __sudokuReportCache = new Map();
  const __SUDOKU_ALL = 0x1ff;

  function makeStringLiteral(str) {
    return internLiteral(JSON.stringify(str));
  }

  function digitMask(v) {
    return 1 << (v - 1);
  }

  function boxIndex(r, c) {
    return Math.floor(r / 3) * 3 + Math.floor(c / 3);
  }

  function popcount(mask) {
    let n = 0;
    while (mask) {
      mask &= mask - 1;
      n += 1;
    }
    return n;
  }

  function maskToDigits(mask) {
    const out = [];
    for (let d = 1; d <= 9; d += 1) if (mask & digitMask(d)) out.push(d);
    return out;
  }

  function formatBoard(cells) {
    let out = '';
    for (let r = 0; r < 9; r += 1) {
      if (r > 0 && r % 3 === 0) out += '\n';
      for (let c = 0; c < 9; c += 1) {
        if (c > 0 && c % 3 === 0) out += '| ';
        const v = cells[r * 9 + c];
        out += v === 0 ? '. ' : `${String(v)} `;
      }
      out += '\n';
    }
    return out;
  }

  function parsePuzzle(input) {
    const filtered = [];
    for (const ch of input) {
      if (/\s/.test(ch) || ch === '|' || ch === '+') continue;
      filtered.push(ch);
    }
    if (filtered.length !== 81) {
      return { error: `Expected exactly 81 cells after removing whitespace, but found ${filtered.length}.` };
    }
    const cells = new Array(81).fill(0);
    for (let i = 0; i < 81; i += 1) {
      const ch = filtered[i];
      if (ch >= '1' && ch <= '9') cells[i] = ch.charCodeAt(0) - 48;
      else if (ch === '0' || ch === '.' || ch === '_') cells[i] = 0;
      else return { error: `Unexpected character '${ch}' at position ${i + 1}.` };
    }
    return { cells };
  }

  function attachMethods(state) {
    state.place = function place(idx, value) {
      if (this.cells[idx] !== 0) return this.cells[idx] === value;
      const row = Math.floor(idx / 9);
      const col = idx % 9;
      const bx = boxIndex(row, col);
      const bit = digitMask(value);
      if (((this.rowUsed[row] | this.colUsed[col] | this.boxUsed[bx]) & bit) !== 0) return false;
      this.cells[idx] = value;
      this.rowUsed[row] |= bit;
      this.colUsed[col] |= bit;
      this.boxUsed[bx] |= bit;
      return true;
    };

    state.candidates = function candidates(idx) {
      const row = Math.floor(idx / 9);
      const col = idx % 9;
      const bx = boxIndex(row, col);
      return __SUDOKU_ALL & ~(this.rowUsed[row] | this.colUsed[col] | this.boxUsed[bx]);
    };

    state.clone = function clone() {
      return attachMethods({
        cells: this.cells.slice(),
        rowUsed: this.rowUsed.slice(),
        colUsed: this.colUsed.slice(),
        boxUsed: this.boxUsed.slice(),
        moves: this.moves.slice(),
      });
    };

    return state;
  }

  function stateFromPuzzle(cells) {
    const state = attachMethods({
      cells: new Array(81).fill(0),
      rowUsed: new Array(9).fill(0),
      colUsed: new Array(9).fill(0),
      boxUsed: new Array(9).fill(0),
      moves: [],
    });

    for (let idx = 0; idx < 81; idx += 1) {
      const value = cells[idx];
      if (value === 0) continue;
      if (value < 1 || value > 9) {
        return { error: `Cell ${idx + 1} contains ${value}, but only digits 1-9 or 0/. are allowed.` };
      }
      if (!state.place(idx, value)) {
        const row = Math.floor(idx / 9) + 1;
        const col = (idx % 9) + 1;
        return { error: `The given clues already conflict at row ${row}, column ${col}.` };
      }
    }

    return { state };
  }

  function summarizeMoves(moves, limit) {
    if (!moves.length) return 'no placements were needed';
    const parts = [];
    for (const mv of moves.slice(0, limit)) {
      const row = Math.floor(mv.index / 9) + 1;
      const col = (mv.index % 9) + 1;
      const mode = mv.forced ? 'forced' : 'guess';
      parts.push(`r${row}c${col}=${mv.value}: ${mode}`);
    }
    if (moves.length > limit) parts.push(`… and ${moves.length - limit} more placements`);
    return parts.join(', ');
  }

  function unitIsComplete(values) {
    let seen = 0;
    for (const v of values) {
      if (v < 1 || v > 9) return false;
      const bit = digitMask(v);
      if (seen & bit) return false;
      seen |= bit;
    }
    return seen === __SUDOKU_ALL;
  }

  function replayMovesAreLegal(puzzleCells, moves) {
    const init = stateFromPuzzle(puzzleCells);
    if (init.error) return false;
    const state = init.state;
    for (const mv of moves) {
      if (state.cells[mv.index] !== 0) return false;
      const maskNow = state.candidates(mv.index);
      if (maskNow !== mv.candidatesMask) return false;
      if ((maskNow & digitMask(mv.value)) === 0) return false;
      if (mv.forced && popcount(maskNow) !== 1) return false;
      if (!state.place(mv.index, mv.value)) return false;
    }
    return true;
  }

  function propagateSingles(state, stats) {
    for (;;) {
      let progress = false;
      for (let idx = 0; idx < 81; idx += 1) {
        if (state.cells[idx] !== 0) continue;
        const mask = state.candidates(idx);
        const count = popcount(mask);
        if (count === 0) return false;
        if (count === 1) {
          const digit = maskToDigits(mask)[0];
          state.moves.push({ index: idx, value: digit, candidatesMask: mask, forced: true });
          if (!state.place(idx, digit)) return false;
          stats.forcedMoves += 1;
          progress = true;
        }
      }
      if (!progress) return true;
    }
  }

  function selectUnfilledCell(state) {
    let best = null;
    for (let idx = 0; idx < 81; idx += 1) {
      if (state.cells[idx] !== 0) continue;
      const mask = state.candidates(idx);
      const count = popcount(mask);
      if (best === null || count < best.count) best = { idx, mask, count };
      if (count === 2) break;
    }
    return best;
  }

  function solve(state, stats, depth) {
    stats.recursiveNodes += 1;
    if (depth > stats.maxDepth) stats.maxDepth = depth;
    const current = state.clone();
    if (!propagateSingles(current, stats)) {
      stats.backtracks += 1;
      return null;
    }
    const best = selectUnfilledCell(current);
    if (!best) return current;
    for (const digit of maskToDigits(best.mask)) {
      const next = current.clone();
      const candidatesMask = next.candidates(best.idx);
      next.moves.push({ index: best.idx, value: digit, candidatesMask, forced: false });
      stats.guessedMoves += 1;
      if (!next.place(best.idx, digit)) continue;
      const solved = solve(next, stats, depth + 1);
      if (solved) return solved;
    }
    stats.backtracks += 1;
    return null;
  }

  function countSolutions(state, limit, countRef) {
    if (countRef.count >= limit) return;
    const current = state.clone();
    const dummy = {
      givens: 0,
      blanks: 0,
      forcedMoves: 0,
      guessedMoves: 0,
      recursiveNodes: 0,
      backtracks: 0,
      maxDepth: 0,
    };
    if (!propagateSingles(current, dummy)) return;
    const best = selectUnfilledCell(current);
    if (!best) {
      countRef.count += 1;
      return;
    }
    for (const digit of maskToDigits(best.mask)) {
      if (countRef.count >= limit) return;
      const next = current.clone();
      if (next.place(best.idx, digit)) countSolutions(next, limit, countRef);
    }
  }

  function computeReport(term) {
    const raw = termToJsString(term);
    if (raw === null) return null;
    if (__sudokuReportCache.has(raw)) return __sudokuReportCache.get(raw);

    const parsed = parsePuzzle(raw);
    if (parsed.error) {
      const rep = { status: 'invalid-input', error: parsed.error, raw, normalized: null };
      __sudokuReportCache.set(raw, rep);
      return rep;
    }

    const normalized = parsed.cells.join('');
    const init = stateFromPuzzle(parsed.cells);
    if (init.error) {
      const rep = {
        status: 'illegal-clues',
        error: init.error,
        raw,
        normalized,
        givens: parsed.cells.filter((v) => v !== 0).length,
        blanks: parsed.cells.filter((v) => v === 0).length,
        puzzleText: formatBoard(parsed.cells),
      };
      __sudokuReportCache.set(raw, rep);
      return rep;
    }

    const initial = init.state;
    const stats = {
      givens: parsed.cells.filter((v) => v !== 0).length,
      blanks: parsed.cells.filter((v) => v === 0).length,
      forcedMoves: 0,
      guessedMoves: 0,
      recursiveNodes: 0,
      backtracks: 0,
      maxDepth: 0,
    };

    const solved = solve(initial, stats, 0);
    if (!solved) {
      const rep = {
        status: 'unsatisfiable',
        raw,
        normalized,
        givens: stats.givens,
        blanks: stats.blanks,
        recursiveNodes: stats.recursiveNodes,
        backtracks: stats.backtracks,
        puzzleText: formatBoard(parsed.cells),
      };
      __sudokuReportCache.set(raw, rep);
      return rep;
    }

    const countRef = { count: 0 };
    countSolutions(initial, 2, countRef);

    const givensPreserved = parsed.cells.every((v, i) => v === 0 || v === solved.cells[i]);
    const noBlanks = solved.cells.every((v) => v >= 1 && v <= 9);
    const rowsComplete = Array.from({ length: 9 }, (_, r) =>
      unitIsComplete(solved.cells.slice(r * 9, r * 9 + 9)),
    ).every(Boolean);
    const colsComplete = Array.from({ length: 9 }, (_, c) =>
      unitIsComplete(Array.from({ length: 9 }, (_, r) => solved.cells[r * 9 + c])),
    ).every(Boolean);
    const boxesComplete = Array.from({ length: 9 }, (_, b) => {
      const br = Math.floor(b / 3) * 3;
      const bc = (b % 3) * 3;
      const vals = [];
      for (let dr = 0; dr < 3; dr += 1) {
        for (let dc = 0; dc < 3; dc += 1) vals.push(solved.cells[(br + dr) * 9 + (bc + dc)]);
      }
      return unitIsComplete(vals);
    }).every(Boolean);
    const replayLegal = replayMovesAreLegal(parsed.cells, solved.moves);
    const proofPathGuessCount = solved.moves.filter((m) => !m.forced).length;
    const storyConsistent =
      stats.recursiveNodes >= 1 &&
      stats.maxDepth <= stats.blanks &&
      solved.moves.length === stats.blanks &&
      proofPathGuessCount <= stats.guessedMoves;

    const rep = {
      status: 'ok',
      raw,
      normalized,
      givens: stats.givens,
      blanks: stats.blanks,
      forcedMoves: stats.forcedMoves,
      guessedMoves: stats.guessedMoves,
      recursiveNodes: stats.recursiveNodes,
      backtracks: stats.backtracks,
      maxDepth: stats.maxDepth,
      unique: countRef.count === 1,
      solution: solved.cells.join(''),
      puzzleText: formatBoard(parsed.cells),
      solutionText: formatBoard(solved.cells),
      moveSummary: summarizeMoves(solved.moves, 8),
      moveCount: solved.moves.length,
      givensPreserved,
      noBlanks,
      rowsComplete,
      colsComplete,
      boxesComplete,
      replayLegal,
      storyConsistent,
    };

    __sudokuReportCache.set(raw, rep);
    return rep;
  }

  function reportFieldAsTerm(report, field) {
    if (!report) return null;
    if (field === 'status') return makeStringLiteral(report.status);
    if (field === 'error') return report.error ? makeStringLiteral(report.error) : null;
    if (field === 'normalizedPuzzle') return report.normalized ? makeStringLiteral(report.normalized) : null;
    if (field === 'solution') return report.solution ? makeStringLiteral(report.solution) : null;
    if (field === 'puzzleText') return report.puzzleText ? makeStringLiteral(report.puzzleText) : null;
    if (field === 'solutionText') return report.solutionText ? makeStringLiteral(report.solutionText) : null;
    if (field === 'moveSummary') return report.moveSummary ? makeStringLiteral(report.moveSummary) : null;
    if (field === 'givensPreservedText')
      return report.givensPreserved === undefined ? null : makeStringLiteral(report.givensPreserved ? 'OK' : 'failed');
    if (field === 'noBlanksText')
      return report.noBlanks === undefined ? null : makeStringLiteral(report.noBlanks ? 'OK' : 'failed');
    if (field === 'rowsCompleteText')
      return report.rowsComplete === undefined ? null : makeStringLiteral(report.rowsComplete ? 'OK' : 'failed');
    if (field === 'colsCompleteText')
      return report.colsComplete === undefined ? null : makeStringLiteral(report.colsComplete ? 'OK' : 'failed');
    if (field === 'boxesCompleteText')
      return report.boxesComplete === undefined ? null : makeStringLiteral(report.boxesComplete ? 'OK' : 'failed');
    if (field === 'replayLegalText')
      return report.replayLegal === undefined ? null : makeStringLiteral(report.replayLegal ? 'OK' : 'failed');
    if (field === 'storyConsistentText')
      return report.storyConsistent === undefined ? null : makeStringLiteral(report.storyConsistent ? 'OK' : 'failed');

    const boolFields = [
      'unique',
      'givensPreserved',
      'noBlanks',
      'rowsComplete',
      'colsComplete',
      'boxesComplete',
      'replayLegal',
      'storyConsistent',
    ];
    if (boolFields.includes(field))
      return report[field] === undefined ? null : internLiteral(report[field] ? 'true' : 'false');

    const numberFields = [
      'givens',
      'blanks',
      'forcedMoves',
      'guessedMoves',
      'recursiveNodes',
      'backtracks',
      'maxDepth',
      'moveCount',
    ];
    if (numberFields.includes(field)) return report[field] === undefined ? null : internLiteral(String(report[field]));

    return null;
  }

  function evalSudokuField(goal, subst, field) {
    const report = computeReport(goal.s);
    if (!report) return [];
    const term = reportFieldAsTerm(report, field);
    if (!term) return [];
    if (goal.o instanceof Var) {
      const s2 = { ...subst };
      s2[goal.o.name] = term;
      return [s2];
    }
    const s2 = unifyTerm(goal.o, term, subst);
    return s2 !== null ? [s2] : [];
  }

  const fields = [
    'status',
    'error',
    'normalizedPuzzle',
    'solution',
    'givens',
    'blanks',
    'forcedMoves',
    'guessedMoves',
    'recursiveNodes',
    'backtracks',
    'maxDepth',
    'unique',
    'givensPreserved',
    'noBlanks',
    'rowsComplete',
    'colsComplete',
    'boxesComplete',
    'replayLegal',
    'storyConsistent',
    'givensPreservedText',
    'noBlanksText',
    'rowsCompleteText',
    'colsCompleteText',
    'boxesCompleteText',
    'replayLegalText',
    'storyConsistentText',
    'moveSummary',
    'puzzleText',
    'solutionText',
    'moveCount',
  ];

  for (const field of fields) {
    registerBuiltin(SUDOKU_NS + field, ({ goal, subst }) => evalSudokuField(goal, subst, field));
  }
};
