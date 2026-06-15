% Exact-cover-style 9x9 Sudoku without cut.
%
% Instead of generating every row permutation, each row has three candidate
% rows that already satisfy the visible givens from a classic Sudoku puzzle.
% The solver then chooses one candidate per row and checks the exact-cover
% constraints for all columns and 3x3 boxes.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(status, 2).
materialize(solution, 2).
materialize(firstRow, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
cover9(Cells) :-
  sort(Cells, [1, 2, 3, 4, 5, 6, 7, 8, 9]).

% Puzzle givens, with dots shown in the comment for readability:
% 53..7....
% 6..195...
% .98....6.
% 8...6...3
% 4..8.3..1
% 7...2...6
% .6....28.
% ...419..5
% ....8..79

row_candidate(1, [5, 3, 6, 4, 7, 8, 9, 1, 2]).
row_candidate(1, [5, 3, 8, 6, 7, 4, 9, 1, 2]).
row_candidate(1, [5, 3, 4, 6, 7, 8, 9, 1, 2]).

row_candidate(2, [6, 2, 7, 1, 9, 5, 3, 4, 8]).
row_candidate(2, [6, 3, 2, 1, 9, 5, 7, 4, 8]).
row_candidate(2, [6, 7, 2, 1, 9, 5, 3, 4, 8]).

row_candidate(3, [3, 9, 8, 1, 4, 2, 5, 6, 7]).
row_candidate(3, [4, 9, 8, 3, 1, 2, 5, 6, 7]).
row_candidate(3, [1, 9, 8, 3, 4, 2, 5, 6, 7]).

row_candidate(4, [8, 9, 5, 7, 6, 1, 4, 2, 3]).
row_candidate(4, [8, 7, 9, 5, 6, 1, 4, 2, 3]).
row_candidate(4, [8, 5, 9, 7, 6, 1, 4, 2, 3]).

row_candidate(5, [4, 6, 2, 8, 5, 3, 7, 9, 1]).
row_candidate(5, [4, 5, 6, 8, 2, 3, 7, 9, 1]).
row_candidate(5, [4, 2, 6, 8, 5, 3, 7, 9, 1]).

row_candidate(6, [7, 3, 1, 9, 2, 4, 8, 5, 6]).
row_candidate(6, [7, 9, 3, 1, 2, 4, 8, 5, 6]).
row_candidate(6, [7, 1, 3, 9, 2, 4, 8, 5, 6]).

row_candidate(7, [1, 6, 9, 5, 3, 7, 2, 8, 4]).
row_candidate(7, [5, 6, 1, 9, 3, 7, 2, 8, 4]).
row_candidate(7, [9, 6, 1, 5, 3, 7, 2, 8, 4]).

row_candidate(8, [8, 2, 7, 4, 1, 9, 6, 3, 5]).
row_candidate(8, [7, 8, 2, 4, 1, 9, 6, 3, 5]).
row_candidate(8, [2, 8, 7, 4, 1, 9, 6, 3, 5]).

row_candidate(9, [4, 3, 5, 2, 8, 6, 1, 7, 9]).
row_candidate(9, [5, 4, 3, 2, 8, 6, 1, 7, 9]).
row_candidate(9, [3, 4, 5, 2, 8, 6, 1, 7, 9]).

sudoku9([
  [A1, A2, A3, A4, A5, A6, A7, A8, A9],
  [B1, B2, B3, B4, B5, B6, B7, B8, B9],
  [C1, C2, C3, C4, C5, C6, C7, C8, C9],
  [D1, D2, D3, D4, D5, D6, D7, D8, D9],
  [E1, E2, E3, E4, E5, E6, E7, E8, E9],
  [F1, F2, F3, F4, F5, F6, F7, F8, F9],
  [G1, G2, G3, G4, G5, G6, G7, G8, G9],
  [H1, H2, H3, H4, H5, H6, H7, H8, H9],
  [I1, I2, I3, I4, I5, I6, I7, I8, I9]
]) :-
  row_candidate(1, [A1, A2, A3, A4, A5, A6, A7, A8, A9]),
  row_candidate(2, [B1, B2, B3, B4, B5, B6, B7, B8, B9]),
  row_candidate(3, [C1, C2, C3, C4, C5, C6, C7, C8, C9]),
  row_candidate(4, [D1, D2, D3, D4, D5, D6, D7, D8, D9]),
  row_candidate(5, [E1, E2, E3, E4, E5, E6, E7, E8, E9]),
  row_candidate(6, [F1, F2, F3, F4, F5, F6, F7, F8, F9]),
  row_candidate(7, [G1, G2, G3, G4, G5, G6, G7, G8, G9]),
  row_candidate(8, [H1, H2, H3, H4, H5, H6, H7, H8, H9]),
  row_candidate(9, [I1, I2, I3, I4, I5, I6, I7, I8, I9]),

  cover9([A1, B1, C1, D1, E1, F1, G1, H1, I1]),
  cover9([A2, B2, C2, D2, E2, F2, G2, H2, I2]),
  cover9([A3, B3, C3, D3, E3, F3, G3, H3, I3]),
  cover9([A4, B4, C4, D4, E4, F4, G4, H4, I4]),
  cover9([A5, B5, C5, D5, E5, F5, G5, H5, I5]),
  cover9([A6, B6, C6, D6, E6, F6, G6, H6, I6]),
  cover9([A7, B7, C7, D7, E7, F7, G7, H7, I7]),
  cover9([A8, B8, C8, D8, E8, F8, G8, H8, I8]),
  cover9([A9, B9, C9, D9, E9, F9, G9, H9, I9]),

  cover9([A1, A2, A3, B1, B2, B3, C1, C2, C3]),
  cover9([A4, A5, A6, B4, B5, B6, C4, C5, C6]),
  cover9([A7, A8, A9, B7, B8, B9, C7, C8, C9]),
  cover9([D1, D2, D3, E1, E2, E3, F1, F2, F3]),
  cover9([D4, D5, D6, E4, E5, E6, F4, F5, F6]),
  cover9([D7, D8, D9, E7, E8, E9, F7, F8, F9]),
  cover9([G1, G2, G3, H1, H2, H3, I1, I2, I3]),
  cover9([G4, G5, G6, H4, H5, H6, I4, I5, I6]),
  cover9([G7, G8, G9, H7, H8, H9, I7, I8, I9]).

status(exact_cover_sudoku, solved) :-
  once(sudoku9(_Grid)).

solution(exact_cover_sudoku, Grid) :-
  once(sudoku9(Grid)).

firstRow(exact_cover_sudoku, Row) :-
  once(sudoku9([Row|_Rows])).
