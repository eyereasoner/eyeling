% Towers of Hanoi adapted from Eyeling hanoi.n3.
% Output is the complete list of moves for size 3.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(answer, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
memoize(hanoi, 5).

hanoi(0, _From, _To, _Via, []).
% Derivation rules: each rule below contributes one logical step toward the displayed results.
hanoi(N, From, To, Via, Moves) :-
  gt(N, 0),
  sub(N, 1, N1),
  hanoi(N1, From, Via, To, Before),
  hanoi(N1, Via, To, From, After),
  append(Before, [[From, To]|After], Moves).

answer(3, Moves) :-
  hanoi(3, left, right, center, Moves).
