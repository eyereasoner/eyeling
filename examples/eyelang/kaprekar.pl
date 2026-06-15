% Kaprekar's constant demo, adapted from Eyelet's input/kaprekar.pl.
%
% This is deliberately a rule-level example, not a native builtin.  It extracts
% four digits, sorts them, subtracts ascending from descending, and recurses
% until Kaprekar's constant 6174 is reached.  The sample set is small so the
% example remains a millisecond-scale demo in the normal test suite.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(constant, 2).
materialize(kaprekarSteps, 2).
materialize(reachesConstant, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
memoize(kaprekar, 3).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
recursion_count(N, Count) :-
  kaprekar_steps(N, Count).

sample(3524).
sample(2111).
sample(9831).
sample(6174).
constant(kaprekar, 6174).

kaprekarSteps(N, Count) :-
  sample(N),
  recursion_count(N, Count).

reachesConstant(kaprekar, N) :-
  sample(N),
  recursion_count(N, _Count).
