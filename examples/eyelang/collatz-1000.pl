% Memoize trajectories because different start values quickly merge into
% shared Collatz tails.
% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(collatzTrajectory, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Collatz trajectory benchmark adapted from Eyeling collatz-1000.n3.
% The reusable builtin keeps this large output example focused on data volume
% rather than recursive integer arithmetic overhead.

% Derivation rules: each rule below contributes one logical step toward the displayed results.
collatzTrajectory(N, Trajectory) :-
  between(1, 1000, N),
  collatz_trajectory(N, Trajectory).
