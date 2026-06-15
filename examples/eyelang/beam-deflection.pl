% Engineering example: cantilever beam tip deflection.
%
% The tip deflection for a point load at the free end is F*L^3/(3*E*I).

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(type, 2).
materialize(tipDeflection_m, 2).
materialize(tipDeflection_mm, 2).
materialize(limit_mm, 2).
materialize(status, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
beam(beam1, force_N, 1200.0).
beam(beam1, length_m, 2.5).
beam(beam1, elasticModulus_Pa, 200000000000.0).
beam(beam1, secondMoment_m4, 0.000008).
limit(beam1, maxDeflection_mm, 5.0).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
tip_deflection_m(Beam, Deflection) :-
  beam(Beam, force_N, Force),
  beam(Beam, length_m, Length),
  beam(Beam, elasticModulus_Pa, ElasticModulus),
  beam(Beam, secondMoment_m4, SecondMoment),
  pow(Length, 3.0, LengthCubed),
  mul(Force, LengthCubed, Numerator),
  mul(3.0, ElasticModulus, ThreeE),
  mul(ThreeE, SecondMoment, Denominator),
  div(Numerator, Denominator, Deflection).

tip_deflection_mm(Beam, DeflectionMm) :-
  tip_deflection_m(Beam, DeflectionM),
  mul(DeflectionM, 1000.0, DeflectionMm).

type(Beam, cantilever_beam) :-
  beam(Beam, force_N, _Force).

tipDeflection_m(Beam, DeflectionM) :-
  tip_deflection_m(Beam, DeflectionM).

tipDeflection_mm(Beam, DeflectionMm) :-
  tip_deflection_mm(Beam, DeflectionMm).

limit_mm(Beam, Limit) :-
  limit(Beam, maxDeflection_mm, Limit).

status(Beam, within_deflection_limit) :-
  tip_deflection_mm(Beam, DeflectionMm),
  limit(Beam, maxDeflection_mm, Limit),
  le(DeflectionMm, Limit).
