% Engineering example: buck-converter ripple check.
%
% A simplified continuous-conduction buck converter model computes duty cycle,
% inductor ripple current, capacitor ripple voltage, and checks design limits.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(dutyCycle, 2).
materialize(inductorRipple_A, 2).
materialize(rippleRatio, 2).
materialize(capacitorRipple_V, 2).
materialize(status, 2).
materialize(reason, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
converter(regulator1, inputVoltage_V, 24.0).
converter(regulator1, outputVoltage_V, 5.0).
converter(regulator1, loadCurrent_A, 2.0).
converter(regulator1, switchingFrequency_Hz, 500000.0).
converter(regulator1, inductance_H, 0.000022).
converter(regulator1, capacitance_F, 0.000047).
limit(regulator1, maxRippleRatio, 0.30).
limit(regulator1, maxOutputRipple_V, 0.05).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
duty_cycle(Converter, Duty) :-
  converter(Converter, outputVoltage_V, OutputVoltage),
  converter(Converter, inputVoltage_V, InputVoltage),
  div(OutputVoltage, InputVoltage, Duty).

inductor_ripple_current(Converter, RippleCurrent) :-
  converter(Converter, inputVoltage_V, InputVoltage),
  converter(Converter, outputVoltage_V, OutputVoltage),
  converter(Converter, inductance_H, Inductance),
  converter(Converter, switchingFrequency_Hz, Frequency),
  duty_cycle(Converter, Duty),
  sub(InputVoltage, OutputVoltage, VoltageAcrossInductor),
  mul(VoltageAcrossInductor, Duty, Numerator),
  mul(Inductance, Frequency, Denominator),
  div(Numerator, Denominator, RippleCurrent).

ripple_ratio(Converter, Ratio) :-
  inductor_ripple_current(Converter, RippleCurrent),
  converter(Converter, loadCurrent_A, LoadCurrent),
  div(RippleCurrent, LoadCurrent, Ratio).

capacitor_ripple_voltage(Converter, RippleVoltage) :-
  inductor_ripple_current(Converter, RippleCurrent),
  converter(Converter, switchingFrequency_Hz, Frequency),
  converter(Converter, capacitance_F, Capacitance),
  mul(8.0, Frequency, EightF),
  mul(EightF, Capacitance, Denominator),
  div(RippleCurrent, Denominator, RippleVoltage).

within_ripple_limits(Converter) :-
  ripple_ratio(Converter, Ratio),
  limit(Converter, maxRippleRatio, MaxRatio),
  lt(Ratio, MaxRatio),
  capacitor_ripple_voltage(Converter, RippleVoltage),
  limit(Converter, maxOutputRipple_V, MaxRippleVoltage),
  lt(RippleVoltage, MaxRippleVoltage).

dutyCycle(Converter, Duty) :-
  duty_cycle(Converter, Duty).

inductorRipple_A(Converter, RippleCurrent) :-
  inductor_ripple_current(Converter, RippleCurrent).

rippleRatio(Converter, Ratio) :-
  ripple_ratio(Converter, Ratio).

capacitorRipple_V(Converter, RippleVoltage) :-
  capacitor_ripple_voltage(Converter, RippleVoltage).

status(Converter, stable_ripple_design) :-
  within_ripple_limits(Converter).

reason(Converter, "inductor-current and output-voltage ripple are below design limits") :-
  within_ripple_limits(Converter).
