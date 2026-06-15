% EYE reasoning-inspired example: greatest common divisor and Bézout identity.
%
% This ports the extended Euclidean algorithm idea into ordinary eyelang rules.
% Each case derives gcd(a,b), coefficients s,t, and validation checks for
% a*s + b*t = gcd(a,b) and divisibility.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(gcd, 2).
materialize(bezoutCoefficients, 2).
materialize(check, 2).
materialize(status, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
case(c1, 48, 18).
case(c2, 101, 462).
case(c3, 0, 5).
case(c4, 270, 192).
case(c5, -27, 36).
case(c6, 123456, 7890).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
answer(Case, Gcd, S, T) :-
  case(Case, A, B),
  extended_gcd(A, B, Gcd, S, T).

bezout_ok(Case) :-
  case(Case, A, B),
  answer(Case, Gcd, S, T),
  mul(A, S, AS),
  mul(B, T, BT),
  add(AS, BT, Gcd).

divides_ok(Case) :-
  case(Case, A, B),
  answer(Case, Gcd, S, T),
  mod(A, Gcd, 0),
  mod(B, Gcd, 0).

nonnegative_ok(Case) :-
  answer(Case, Gcd, S, T),
  ge(Gcd, 0).

gcd(Case, Gcd) :- answer(Case, Gcd, S, T).
bezoutCoefficients(Case, [S, T]) :- answer(Case, Gcd, S, T).
check(Case, bezout_identity) :- bezout_ok(Case).
check(Case, divides_inputs) :- divides_ok(Case).
check(Case, nonnegative_gcd) :- nonnegative_ok(Case).
status(Case, done) :- answer(Case, Gcd, S, T), bezout_ok(Case), divides_ok(Case), nonnegative_ok(Case).
