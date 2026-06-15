% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(isIndeedMoreInterestingThan, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Backward rule example adapted from Eyeling backward.n3.
% Eyeling writes the interestingness rule backward; eyelang records the same
% relation as an ordinary rule whose body is the numeric comparison.

% Derivation rules: each rule below contributes one logical step toward the displayed results.
moreInterestingThan(X, Y) :- gt(X, Y).

isIndeedMoreInterestingThan(5, 3) :- moreInterestingThan(5, 3).
