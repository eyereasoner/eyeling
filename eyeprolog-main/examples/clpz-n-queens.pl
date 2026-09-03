:- use_module(library(clpz)).
:- use_module(library(lists), [length/2]).

% The list position is a column and its value is a row. Domains, global
% distinctness, and delayed diagonal constraints describe the puzzle before
% labeling searches the remaining finite alternatives.
%
% The checked eight-queens goal verifies a known witness with the same relational
% model. A smaller four-queens query exercises actual search and multiple-solution
% enumeration without making the default example suite a CLP(Z) benchmark.

%% goal: queens8_solution(X0)
%% goal: queens(4, X0)

queens8_solution(Rows) :-
  Rows = [1, 5, 8, 6, 3, 7, 2, 4],
  queens(8, Rows).

queens(Size, Rows) :-
  length(Rows, Size),
  Rows ins 1..Size,
  all_distinct(Rows),
  safe_diagonals(Rows),
  labeling([ff], Rows).

safe_diagonals([]).
safe_diagonals([Row|Rows]) :-
  safe_from(Row, Rows, 1),
  safe_diagonals(Rows).

safe_from(_, [], _).
safe_from(Row, [Other|Rows], Distance) :-
  Row #\= Other + Distance,
  Row #\= Other - Distance,
  NextDistance is Distance + 1,
  safe_from(Row, Rows, NextDistance).
