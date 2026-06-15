% Age checker adapted from Eyeling.
%
% Is the age of a person above some duration?

% Person data.
% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(birthDay, 2).
materialize(duration, 2).
materialize(ageAbove, 2).
materialize(is, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
birthDay(patH, "1944-08-21").
duration(check, "P80Y").

% A person is above a duration if the local date minus the birthday is greater
% than that duration.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
ageAbove(S, A) :-
  birthDay(S, B),
  duration(check, A),
  local_time(D),
  difference(D, B, F),
  gt(F, A).

% Test mirroring the Eyeling example.
is(test, true) :-
  ageAbove(S, "P80Y").
