% Floating-point arithmetic and comparisons.
% Integer-only operands continue to use arbitrary-size integer arithmetic.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(value, 2).
materialize(than, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Floating-point constants can be mixed with integer constants in built-ins.
sample(roomC, 21.5).
sample(targetC, 19.25).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
value(sum, X) :- add(1.5, 2.25, X).
value(difference, X) :- sub(10.0, 3.125, X).
value(product, X) :- mul(2.5, 4.0, X).
value(quotient, X) :- div(7.5, 2, X).
value(sqrtByPower, X) :- pow(9.0, 0.5, X).
value(mathSum, X) :- add(0.125, 0.875, X).
value(mathProduct, X) :- mul(6.0, 0.5, X).
than(warmer, targetC) :- sample(roomC, R), sample(targetC, T), gt(R, T).
% Boolean-like conclusions remain ordinary atoms.
value(comfortable, true) :- sample(roomC, R), ge(R, 21.0), le(R, 22.0).
