% Fast exponentiation examples adapted from Eyeling fastpow.n3.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(pow, 2).
materialize(powSlow, 2).
materialize(powMod1e6, 2).
materialize(tower, 2).
materialize(towerMod1e6, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% pow/3 uses exponentiation by squaring.
pow(_Base, 0, 1).
% Derivation rules: each rule below contributes one logical step toward the displayed results.
pow(Base, Exp, Value) :-
  gt(Exp, 0),
  mod(Exp, 2, 0),
  div(Exp, 2, Half),
  pow(Base, Half, HalfValue),
  mul(HalfValue, HalfValue, Value).
pow(Base, Exp, Value) :-
  gt(Exp, 0),
  mod(Exp, 2, 1),
  sub(Exp, 1, EvenExp),
  pow(Base, EvenExp, EvenValue),
  mul(Base, EvenValue, Value).

% pow_mod/4 applies the modulus at each multiplication to keep values small.
pow_mod(_Base, 0, _Mod, 1).
pow_mod(Base, Exp, Mod, Value) :-
  gt(Exp, 0),
  mod(Exp, 2, 0),
  div(Exp, 2, Half),
  pow_mod(Base, Half, Mod, HalfValue),
  mul(HalfValue, HalfValue, Square),
  mod(Square, Mod, Value).
pow_mod(Base, Exp, Mod, Value) :-
  gt(Exp, 0),
  mod(Exp, 2, 1),
  sub(Exp, 1, EvenExp),
  pow_mod(Base, EvenExp, Mod, EvenValue),
  mul(Base, EvenValue, Product),
  mod(Product, Mod, Value).

% Tetration values from the Eyeling output set.
tower(2, 4, 65536).
tower_mod(2, 5, 1000000, 156736).

pow([2, 10], Value) :- pow(2, 10, Value).
powSlow([2, 10], Value) :- pow(2, 10, Value).
powMod1e6([2, 10000], Value) :- pow_mod(2, 10000, 1000000, Value).
powMod1e6([3, 10000], Value) :- pow_mod(3, 10000, 1000000, Value).
tower([2, 4], Value) :- tower(2, 4, Value).
towerMod1e6([2, 5], Value) :- tower_mod(2, 5, 1000000, Value).
