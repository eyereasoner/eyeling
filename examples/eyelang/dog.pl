% The output reports only the compliance obligation derived below.
% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(mustHave, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Dog-license example adapted from Eyeling dog.n3.
% A subject with more than four dogs must have a dog license.

hasDog(alice, dog1).
hasDog(alice, dog2).
hasDog(alice, dog3).
hasDog(alice, dog4).
hasDog(alice, dog5).
hasDog(bob, dog6).
hasDog(bob, dog7).

% countall/2 counts all matching dogs for the same subject.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
dogCount(Subject, Count) :-
  hasDog(Subject, _Any),
  countall(hasDog(Subject, _Dog), Count).

mustHave(Subject, dogLicense) :-
  dogCount(Subject, Count),
  gt(Count, 4).
