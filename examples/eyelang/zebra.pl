% Zebra puzzle, adapted from Eyelet's input/zebra.pl.
%
% Five houses are represented as house(Color, Nationality, Pet, Beverage,
% Cigarette).  The answer is the classic one: the Norwegian drinks water and the
% Japanese owns the zebra.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(waterDrinker, 2).
materialize(zebraOwner, 2).
materialize(solved, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
zebra(WaterDrinker, ZebraOwner) :-
  eq(Houses, [_, _, _, _, _]),
  first(Houses, house(_, norwegian, _, _, _)),
  third(Houses, house(_, _, _, milk, _)),
  adjacent(house(_, norwegian, _, _, _), house(blue, _, _, _, _), Houses),
  next_to(house(ivory, _, _, _, _), house(green, _, _, _, _), Houses),
  member(house(red, english, _, _, _), Houses),
  member(house(green, _, _, coffee, _), Houses),
  member(house(yellow, _, _, _, kools), Houses),
  member(house(_, spanish, dog, _, _), Houses),
  member(house(_, ukrainian, _, tea, _), Houses),
  member(house(_, _, snail, _, old_gold), Houses),
  adjacent(house(_, _, _, _, chesterfields), house(_, _, fox, _, _), Houses),
  adjacent(house(_, _, _, _, kools), house(_, _, horse, _, _), Houses),
  member(house(_, _, _, orange_juice, lucky_strike), Houses),
  member(house(_, japanese, _, _, parliaments), Houses),
  member(house(_, WaterDrinker, _, water, _), Houses),
  member(house(_, ZebraOwner, zebra, _, _), Houses).

first([X|_], X).
third([_, _, X|_], X).

adjacent(A, B, List) :- next_to(A, B, List).
adjacent(A, B, List) :- next_to(B, A, List).

next_to(X, Y, [X, Y|_]).
next_to(X, Y, [_|Zs]) :- next_to(X, Y, Zs).

waterDrinker(zebraPuzzle, WaterDrinker) :- zebra(WaterDrinker, _ZebraOwner).
zebraOwner(zebraPuzzle, ZebraOwner) :- zebra(_WaterDrinker, ZebraOwner).
solved(zebraPuzzle, true) :- zebra(norwegian, japanese).
