% 2x2 continuous-time stability check.
% For matrix [[a,b],[c,d]], a stable second-order linear system has
% trace < 0 and determinant > 0.  A negative discriminant indicates a
% complex-conjugate eigenvalue pair.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(trace, 2).
materialize(determinant, 2).
materialize(discriminant, 2).
materialize(eigenShape, 2).
materialize(status, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
matrix(controller_loop, -0.7, 1.2, -0.4, -0.5).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
trace(Matrix, Trace) :-
  matrix(Matrix, A, _B, _C, D),
  add(A, D, Trace).

determinant(Matrix, Determinant) :-
  matrix(Matrix, A, B, C, D),
  mul(A, D, AD),
  mul(B, C, BC),
  sub(AD, BC, Determinant).

discriminant(Matrix, Disc) :-
  trace(Matrix, T),
  determinant(Matrix, Det),
  mul(T, T, T2),
  mul(4, Det, FourDet),
  sub(T2, FourDet, Disc).

stable(Matrix) :-
  trace(Matrix, T),
  determinant(Matrix, Det),
  lt(T, 0),
  gt(Det, 0).

complex_pair(Matrix) :-
  discriminant(Matrix, Disc),
  lt(Disc, 0).

eigenShape(Matrix, complex_conjugate_pair) :- complex_pair(Matrix).
status(Matrix, asymptotically_stable) :- stable(Matrix).
