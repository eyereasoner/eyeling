% Cryptarithmetic without cut.
%
% Two column-pruned puzzles are included.  SEND + MORE = MONEY is the classic
% eight-letter puzzle, and DONALD + GERALD = ROBERT uses all ten digits across
% a six-column addition.  Each column constraint is applied as soon as possible
% so the finite digit search prunes early without cut.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(status, 2).
materialize(assignment, 2).
materialize(equation, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
send_more_money(solution(S, E, N, D, M, O, R, Y), Send, More, Money) :-
  alphametic_sum(
    [s, e, n, d, m, o, r, y],
    [[s, e, n, d], [m, o, r, e]],
    [m, o, n, e, y],
    [S, E, N, D, M, O, R, Y],
    [Send, More, Money]
  ).

donald_gerald_robert(solution(D, O, N, A, L, G, E, R, B, T), Donald, Gerald, Robert) :-
  alphametic_sum(
    [d, o, n, a, l, g, e, r, b, t],
    [[d, o, n, a, l, d], [g, e, r, a, l, d]],
    [r, o, b, e, r, t],
    [D, O, N, A, L, G, E, R, B, T],
    [Donald, Gerald, Robert]
  ).

status(send_more_money, solved) :-
  once(send_more_money(_Solution, _Send, _More, _Money)).

assignment(send_more_money, Solution) :-
  once(send_more_money(Solution, _Send, _More, _Money)).

equation(send_more_money, plus(Send, More, Money)) :-
  once(send_more_money(_Solution, Send, More, Money)).

status(donald_gerald_robert, solved) :-
  once(donald_gerald_robert(_Solution, _Donald, _Gerald, _Robert)).

assignment(donald_gerald_robert, Solution) :-
  once(donald_gerald_robert(Solution, _Donald, _Gerald, _Robert)).

equation(donald_gerald_robert, plus(Donald, Gerald, Robert)) :-
  once(donald_gerald_robert(_Solution, Donald, Gerald, Robert)).
