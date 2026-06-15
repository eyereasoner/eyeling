% Quadratic formula over sample equations.
%
% Each equation is represented as a*x^2 + b*x + c = 0.  The example uses
% eyelang arithmetic predicates to derive the discriminant and the two roots.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(discriminant, 2).
materialize(root, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
equation(eq1, 1.0, -5.0, 6.0).
equation(eq2, 2.0, -4.0, -6.0).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
discriminant(Case, D) :-
  equation(Case, A, B, C),
  pow(B, 2.0, B2),
  mul(4.0, A, FourA),
  mul(FourA, C, FourAC),
  sub(B2, FourAC, D).

sqrt_discriminant(Case, S) :-
  discriminant(Case, D),
  ge(D, 0.0),
  pow(D, 0.5, S).

negative_b(Case, NB) :-
  equation(Case, _A, B, _C),
  neg(B, NB).

denominator(Case, Den) :-
  equation(Case, A, _B, _C),
  mul(2.0, A, Den).

root_plus(Case, Root) :-
  negative_b(Case, NB),
  sqrt_discriminant(Case, S),
  denominator(Case, Den),
  add(NB, S, Numerator),
  div(Numerator, Den, Root).

root_minus(Case, Root) :-
  negative_b(Case, NB),
  sqrt_discriminant(Case, S),
  denominator(Case, Den),
  sub(NB, S, Numerator),
  div(Numerator, Den, Root).


root(Case, Root) :-
  root_plus(Case, Root).

root(Case, Root) :-
  root_minus(Case, Root).
