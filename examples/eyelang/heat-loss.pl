% Engineering example: one-dimensional conductive heat loss through a wall.
%
% Thermal resistance is L/(k*A), and heat loss is DeltaT/R.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(type, 2).
materialize(temperatureDifference_K, 2).
materialize(thermalResistance_K_W, 2).
materialize(heatLoss_W, 2).
materialize(status, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
wall(wall1, conductivity_W_mK, 0.8).
wall(wall1, area_m2, 12.0).
wall(wall1, thickness_m, 0.2).
wall(wall1, indoor_C, 21.0).
wall(wall1, outdoor_C, -4.0).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
temperature_difference(Wall, DeltaT) :-
  wall(Wall, indoor_C, Indoor),
  wall(Wall, outdoor_C, Outdoor),
  sub(Indoor, Outdoor, DeltaT).

thermal_resistance(Wall, Resistance) :-
  wall(Wall, thickness_m, Thickness),
  wall(Wall, conductivity_W_mK, Conductivity),
  wall(Wall, area_m2, Area),
  mul(Conductivity, Area, Conductance),
  div(Thickness, Conductance, Resistance).

heat_loss(Wall, HeatLoss) :-
  temperature_difference(Wall, DeltaT),
  thermal_resistance(Wall, Resistance),
  div(DeltaT, Resistance, HeatLoss).

type(Wall, conduction_heat_loss) :-
  wall(Wall, thickness_m, _Thickness).

temperatureDifference_K(Wall, DeltaT) :-
  temperature_difference(Wall, DeltaT).

thermalResistance_K_W(Wall, Resistance) :-
  thermal_resistance(Wall, Resistance).

heatLoss_W(Wall, HeatLoss) :-
  heat_loss(Wall, HeatLoss).

status(Wall, high_heat_loss) :-
  heat_loss(Wall, HeatLoss),
  gt(HeatLoss, 1000.0).
