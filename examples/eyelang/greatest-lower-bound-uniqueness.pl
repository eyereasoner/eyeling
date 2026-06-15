% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(sameGreatestLowerBound, 4).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Greatest-lower-bound uniqueness example adapted from Eyeling
% greatest-lower-bound-uniqueness.n3.
% If M and N are both greatest lower bounds of A and B, each is below the other;
% antisymmetry is represented by the ordinary derived relation sameTerm/2.

glbOf(g1, a, b).
glbOf(g2, a, b).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
lowerBoundOf(M, A, B) :- glbOf(M, A, B).

leq(L, M) :-
  glbOf(M, A, B),
  lowerBoundOf(L, A, B).

sameTerm(M, N) :-
  leq(M, N),
  leq(N, M).

sameGreatestLowerBound(A, B, M, N) :-
  glbOf(M, A, B),
  glbOf(N, A, B),
  sameTerm(M, N),
  neq(M, N).
