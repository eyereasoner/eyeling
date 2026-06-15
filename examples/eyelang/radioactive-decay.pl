% Science example: radioactive decay.
%
% Activity remaining after elapsed time is initial_activity * 0.5^(t/half_life).

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(halfLivesElapsed, 2).
materialize(remainingActivity_Bq, 2).
materialize(decayedActivity_Bq, 2).
materialize(status, 2).
materialize(reason, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
sample(iodine_sample, initial_activity_bq, 80.0).
sample(iodine_sample, half_life_h, 8.0).
sample(iodine_sample, elapsed_h, 16.0).
threshold(iodine_sample, low_activity_bq, 25.0).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
half_lives(Sample, Count) :-
  sample(Sample, elapsed_h, Elapsed),
  sample(Sample, half_life_h, HalfLife),
  div(Elapsed, HalfLife, Count).

remaining_fraction(Sample, Fraction) :-
  half_lives(Sample, Count),
  pow(0.5, Count, Fraction).

remaining_activity(Sample, Remaining) :-
  sample(Sample, initial_activity_bq, Initial),
  remaining_fraction(Sample, Fraction),
  mul(Initial, Fraction, Remaining).

decayed_activity(Sample, Decayed) :-
  sample(Sample, initial_activity_bq, Initial),
  remaining_activity(Sample, Remaining),
  sub(Initial, Remaining, Decayed).

low_activity(Sample) :-
  remaining_activity(Sample, Remaining),
  threshold(Sample, low_activity_bq, Limit),
  lt(Remaining, Limit).

halfLivesElapsed(Sample, Count) :-
  half_lives(Sample, Count).

remainingActivity_Bq(Sample, Remaining) :-
  remaining_activity(Sample, Remaining).

decayedActivity_Bq(Sample, Decayed) :-
  decayed_activity(Sample, Decayed).

status(Sample, low_activity) :-
  low_activity(Sample).

reason(Sample, "two half-lives leave one quarter of the initial activity") :-
  low_activity(Sample).
