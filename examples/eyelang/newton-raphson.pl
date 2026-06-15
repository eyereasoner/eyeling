% Newton-Raphson root finding, adapted from Eyelet input/newton-raphson.pl.
% The selected roots match Eyelet output-swipl/newton-raphson.pl.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(findRoot, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
want_root([1, 1.0, 1.0e-15]).
want_root([2, 2.0, 1.0e-15]).
want_root([3, 3.0, 1.0e-15]).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
findRoot(Input, Root) :-
  want_root(Input),
  find_root(Input, Root).

% f(1, X) = X^2 - 2
f(1, X, Y) :-
  mul(X, X, XX),
  sub(XX, 2, Y).

% f(2, X) = log(X) - 1
f(2, X, Y) :-
  log(X, LX),
  sub(LX, 1, Y).

% f(3, X) = sin(X)
f(3, X, Y) :-
  sin(X, Y).

fd(1, X, Y) :-
  mul(2, X, Y).
fd(2, X, Y) :-
  div(1, X, Y).
fd(3, X, Y) :-
  cos(X, Y).

find_root([N, X, Tolerance], X) :-
  f(N, X, FX),
  abs(FX, AFX),
  lt(AFX, Tolerance).
find_root([N, X, Tolerance], Root) :-
  f(N, X, FX),
  abs(FX, AFX),
  ge(AFX, Tolerance),
  fd(N, X, FDX),
  div(FX, FDX, Step),
  sub(X, Step, NewX),
  find_root([N, NewX, Tolerance], Root).
