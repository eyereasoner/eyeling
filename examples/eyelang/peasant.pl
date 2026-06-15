% Peasant multiplication and exponentiation cases, adapted from Eyelet
% input/peasant.pl.  The selected answers match Eyelet output-swipl/peasant.pl.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(prod, 2).
materialize(pow, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Inputs are explicit so the example does not enumerate an unbounded domain.
want_prod([3, 0]).
want_prod([5, 6]).
want_prod([238, 13]).
want_prod([8367238, 27133]).
want_prod([62713345408367238, 40836723862713345]).
want_prod([4083672386271334562713345408367238, 4083672386271334562713345408367238]).

want_pow([3, 0]).
want_pow([5, 6]).
want_pow([238, 13]).
want_pow([8367238, 2713]).

% The arithmetic itself is delegated to the native numeric built-ins.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
prod([A, B], C) :-
  want_prod([A, B]),
  mul(A, B, C).

pow([A, B], C) :-
  want_pow([A, B]),
  pow(A, B, C).
