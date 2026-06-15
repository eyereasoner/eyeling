% Ambitious STEM example: Hohmann transfer design from Earth orbit to Mars orbit.
%
% The rules combine orbital mechanics, numerical math, and engineering-style
% mission constraints. Distances are in kilometres, speeds in kilometres per
% second, and time in days.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(transferSemiMajorAxis_km, 2).
materialize(departureDeltaV_km_s, 2).
materialize(arrivalDeltaV_km_s, 2).
materialize(totalDeltaV_km_s, 2).
materialize(transferTime_days, 2).
materialize(status, 2).
materialize(reason, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
mission(mars_hohmann, centralBodyMu_km3_s2, 132712440018.0).
mission(mars_hohmann, departureOrbitRadius_km, 149597870.7).
mission(mars_hohmann, arrivalOrbitRadius_km, 227939200.0).
mission(mars_hohmann, deltaVBudget_km_s, 6.0).
mission(mars_hohmann, pi, 3.141592653589793).
mission(mars_hohmann, secondsPerDay, 86400.0).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
semi_major_axis(Mission, Axis) :-
  mission(Mission, departureOrbitRadius_km, R1),
  mission(Mission, arrivalOrbitRadius_km, R2),
  add(R1, R2, Sum),
  div(Sum, 2.0, Axis).

circular_speed_at_departure(Mission, Speed) :-
  mission(Mission, centralBodyMu_km3_s2, Mu),
  mission(Mission, departureOrbitRadius_km, Radius),
  div(Mu, Radius, SpeedSquared),
  pow(SpeedSquared, 0.5, Speed).

circular_speed_at_arrival(Mission, Speed) :-
  mission(Mission, centralBodyMu_km3_s2, Mu),
  mission(Mission, arrivalOrbitRadius_km, Radius),
  div(Mu, Radius, SpeedSquared),
  pow(SpeedSquared, 0.5, Speed).

transfer_speed_at_departure(Mission, Speed) :-
  mission(Mission, centralBodyMu_km3_s2, Mu),
  mission(Mission, departureOrbitRadius_km, Radius),
  semi_major_axis(Mission, Axis),
  div(2.0, Radius, TwiceOverRadius),
  div(1.0, Axis, OneOverAxis),
  sub(TwiceOverRadius, OneOverAxis, Bracket),
  mul(Mu, Bracket, SpeedSquared),
  pow(SpeedSquared, 0.5, Speed).

transfer_speed_at_arrival(Mission, Speed) :-
  mission(Mission, centralBodyMu_km3_s2, Mu),
  mission(Mission, arrivalOrbitRadius_km, Radius),
  semi_major_axis(Mission, Axis),
  div(2.0, Radius, TwiceOverRadius),
  div(1.0, Axis, OneOverAxis),
  sub(TwiceOverRadius, OneOverAxis, Bracket),
  mul(Mu, Bracket, SpeedSquared),
  pow(SpeedSquared, 0.5, Speed).

departure_delta_v(Mission, DeltaV) :-
  transfer_speed_at_departure(Mission, TransferSpeed),
  circular_speed_at_departure(Mission, CircularSpeed),
  sub(TransferSpeed, CircularSpeed, DeltaV).

arrival_delta_v(Mission, DeltaV) :-
  circular_speed_at_arrival(Mission, CircularSpeed),
  transfer_speed_at_arrival(Mission, TransferSpeed),
  sub(CircularSpeed, TransferSpeed, DeltaV).

total_delta_v(Mission, Total) :-
  departure_delta_v(Mission, Depart),
  arrival_delta_v(Mission, Arrive),
  add(Depart, Arrive, Total).

transfer_time_days(Mission, Days) :-
  semi_major_axis(Mission, Axis),
  mission(Mission, centralBodyMu_km3_s2, Mu),
  mission(Mission, pi, Pi),
  mission(Mission, secondsPerDay, SecondsPerDay),
  pow(Axis, 3.0, AxisCubed),
  div(AxisCubed, Mu, TimeFactor),
  pow(TimeFactor, 0.5, HalfPeriodBase),
  mul(Pi, HalfPeriodBase, Seconds),
  div(Seconds, SecondsPerDay, Days).

within_delta_v_budget(Mission) :-
  total_delta_v(Mission, Total),
  mission(Mission, deltaVBudget_km_s, Budget),
  le(Total, Budget).

transferSemiMajorAxis_km(Mission, Axis) :-
  semi_major_axis(Mission, Axis).

departureDeltaV_km_s(Mission, DeltaV) :-
  departure_delta_v(Mission, DeltaV).

arrivalDeltaV_km_s(Mission, DeltaV) :-
  arrival_delta_v(Mission, DeltaV).

totalDeltaV_km_s(Mission, Total) :-
  total_delta_v(Mission, Total).

transferTime_days(Mission, Days) :-
  transfer_time_days(Mission, Days).

status(Mission, feasible_reference_transfer) :-
  within_delta_v_budget(Mission).

reason(Mission, "total Hohmann transfer delta-v is within the mission budget") :-
  within_delta_v_budget(Mission).
