'use strict';

// Example-specific builtin module for examples/queens.n3.
//
// The N3 file keeps the example interface declarative:
//   (16 0) queens:render ?Text
//   (16 0) queens:count  ?Count
//
// This JavaScript module supplies the intentionally specialized hot loop. The
// solver is the same 32-bit bit-mask kernel used in the standalone queens.js
// benchmark: columns and diagonals are represented as integer masks, so a whole
// row's legal moves are computed with a few bitwise operations.
//
// Why use a builtin instead of pure N3 rules?
//   * A pure N3 generator for 16-Queens would create an enormous search tree.
//   * The builtin keeps the example useful for performance demonstrations.
//   * It also shows the intended pattern for expensive domain-specific kernels:
//     put the tight computation in a custom builtin, then let N3 describe how
//     the result is connected to the rest of the knowledge graph.
//
module.exports = ({ registerBuiltin, internLiteral, unifyTerm, applySubstTerm, parseNumericLiteralInfo, terms }) => {
  const { ListTerm } = terms;
  const NS = 'http://example.org/queens#';

  // Cache by "N/MAX_PRINT" because the same N3 run may ask for both the count
  // and the rendered report. Without this, queens:count and queens:render would
  // solve the same board twice.
  const resultCache = new Map();

  function integerValue(term) {
    const info = parseNumericLiteralInfo(term);
    if (!info) return null;
    if (info.kind === 'bigint') {
      const n = Number(info.value);
      return Number.isSafeInteger(n) ? n : null;
    }
    if (info.kind === 'number' && Number.isInteger(info.value)) return info.value;
    return null;
  }

  function solveNQueens(n, maxPrint) {
    if (!Number.isInteger(n) || n <= 0 || n > 31) {
      throw new RangeError('queens:count expects 1 <= N <= 31');
    }
    if (!Number.isInteger(maxPrint) || maxPrint < 0) {
      throw new RangeError('queens:count expects MAX_PRINT >= 0');
    }

    // JavaScript bitwise operators work on signed 32-bit integers. N <= 31 is
    // therefore the safe range for this compact benchmark implementation.
    const allColumns = Math.pow(2, n) - 1;
    const board = new Array(n).fill(-1);
    const printed = [];
    let count = 0;

    function boardText() {
      const lines = [];
      for (let row = 0; row < n; row++) {
        const cells = [];
        for (let col = 0; col < n; col++) cells.push(col === board[row] ? 'Q' : '.');
        lines.push(cells.join(' '));
      }
      lines.push(`As column positions by row: [${board.map((col) => col + 1).join(', ')}]`);
      return lines.join('\n');
    }

    function search(row, columns, diagLeft, diagRight) {
      if (row === n) {
        count++;
        if (count <= maxPrint) printed.push(`Solution ${count}:\n${boardText()}`);
        return;
      }

      // All legal columns for this row in one expression.
      let available = allColumns & ~(columns | diagLeft | diagRight);
      while (available !== 0) {
        // Pick and clear the lowest set bit.
        const position = available & -available;
        available ^= position;

        board[row] = Math.clz32(position) ^ 31;
        search(row + 1, columns | position, (diagLeft | position) << 1, (diagRight | position) >> 1);
        board[row] = -1;
      }
    }

    search(0, 0, 0, 0);
    return { count, printed };
  }

  registerBuiltin(NS + 'count', ({ goal, subst }) => {
    const subject = applySubstTerm(goal.s, subst);
    if (!(subject instanceof ListTerm) || subject.elems.length !== 2) return [];

    const n = integerValue(applySubstTerm(subject.elems[0], subst));
    const maxPrint = integerValue(applySubstTerm(subject.elems[1], subst));
    if (n == null || maxPrint == null) return [];

    const key = `${n}/${maxPrint}`;
    let result = resultCache.get(key);
    if (!result) {
      result = solveNQueens(n, maxPrint);
      resultCache.set(key, result);
    }
    const { count } = result;
    const lit = internLiteral(String(count));
    const next = unifyTerm(goal.o, lit, subst);
    return next ? [next] : [];
  });

  registerBuiltin(NS + 'render', ({ goal, subst }) => {
    const subject = applySubstTerm(goal.s, subst);
    if (!(subject instanceof ListTerm) || subject.elems.length !== 2) return [];

    const n = integerValue(applySubstTerm(subject.elems[0], subst));
    const maxPrint = integerValue(applySubstTerm(subject.elems[1], subst));
    if (n == null || maxPrint == null) return [];

    const key = `${n}/${maxPrint}`;
    let result = resultCache.get(key);
    if (!result) {
      result = solveNQueens(n, maxPrint);
      resultCache.set(key, result);
    }
    const { count, printed } = result;
    const body = [
      `Solving ${n}-Queens...`,
      `Printing at most ${maxPrint} solution(s).`,
      '',
      ...printed,
      ...(printed.length ? [''] : []),
      `Total solutions for ${n}-Queens: ${count}`,
      '',
    ].join('\n');

    // Eyeling string literals are represented by their quoted lexical form.
    const lit = internLiteral(JSON.stringify(body));
    const next = unifyTerm(goal.o, lit, subst);
    return next ? [next] : [];
  });
};
