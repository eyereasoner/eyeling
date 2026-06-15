% Math example: least-squares linear regression.
%
% The rules reduce a list of points to sufficient statistics, then derive the
% fitted slope, intercept, and coefficient of determination R^2.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(slope, 2).
materialize(intercept, 2).
materialize(rSquared, 2).
materialize(status, 2).
materialize(reason, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
dataset(regression1, [point(1.0, 2.0), point(2.0, 3.0), point(3.0, 5.0), point(4.0, 4.0)]).
threshold(regression1, minimum_r_squared, 0.60).

stats([], 0.0, 0.0, 0.0, 0.0, 0.0, 0.0).
% Derivation rules: each rule below contributes one logical step toward the displayed results.
stats([point(X, Y)|Rest], N, SumX, SumY, SumXX, SumXY, SumYY) :-
  stats(Rest, N0, SumX0, SumY0, SumXX0, SumXY0, SumYY0),
  add(N0, 1.0, N),
  add(SumX0, X, SumX),
  add(SumY0, Y, SumY),
  mul(X, X, XX),
  add(SumXX0, XX, SumXX),
  mul(X, Y, XY),
  add(SumXY0, XY, SumXY),
  mul(Y, Y, YY),
  add(SumYY0, YY, SumYY).

sufficient_statistics(Data, N, SumX, SumY, SumXX, SumXY, SumYY) :-
  dataset(Data, Points),
  stats(Points, N, SumX, SumY, SumXX, SumXY, SumYY).

slope(Data, Slope) :-
  sufficient_statistics(Data, N, SumX, SumY, SumXX, SumXY, _SumYY),
  mul(N, SumXY, NSumXY),
  mul(SumX, SumY, SumXSumY),
  sub(NSumXY, SumXSumY, Numerator),
  mul(N, SumXX, NSumXX),
  mul(SumX, SumX, SumXSquared),
  sub(NSumXX, SumXSquared, Denominator),
  div(Numerator, Denominator, Slope).

intercept(Data, Intercept) :-
  sufficient_statistics(Data, N, SumX, SumY, _SumXX, _SumXY, _SumYY),
  slope(Data, Slope),
  mul(Slope, SumX, SlopeSumX),
  sub(SumY, SlopeSumX, Numerator),
  div(Numerator, N, Intercept).

r_squared(Data, R2) :-
  sufficient_statistics(Data, N, SumX, SumY, SumXX, SumXY, SumYY),
  mul(N, SumXY, NSumXY),
  mul(SumX, SumY, SumXSumY),
  sub(NSumXY, SumXSumY, NumeratorBase),
  pow(NumeratorBase, 2.0, Numerator),
  mul(N, SumXX, NSumXX),
  mul(SumX, SumX, SumXSquared),
  sub(NSumXX, SumXSquared, XSpread),
  mul(N, SumYY, NSumYY),
  mul(SumY, SumY, SumYSquared),
  sub(NSumYY, SumYSquared, YSpread),
  mul(XSpread, YSpread, Denominator),
  div(Numerator, Denominator, R2).

accepted_fit(Data) :-
  r_squared(Data, R2),
  threshold(Data, minimum_r_squared, Minimum),
  ge(R2, Minimum).



rSquared(Data, R2) :-
  r_squared(Data, R2).

status(Data, accepted_linear_fit) :-
  accepted_fit(Data).

reason(Data, "R squared meets the minimum explanatory-power threshold") :-
  accepted_fit(Data).
