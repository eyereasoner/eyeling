% Good cobbler, adapted from Eyeling's examples/good-cobbler.n3.
%
% The Eyeling result is a quoted assertion saying that joe is a good Cobbler.
% Here the quoted assertion is represented as an eyelang term.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(is, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
assertedIs(joe, good(cobbler)).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
is(test, is(X, good(Y))) :-
  assertedIs(X, good(Y)).
