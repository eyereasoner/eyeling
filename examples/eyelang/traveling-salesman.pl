% Traveling salesman problem, adapted from Eyelet input/traveling-salesman.pl.
% The optimal tour matches Eyelet output-swipl/traveling-salesman.pl.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(optimalTour, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% The target list fixes the city set; weighted_hamiltonian_path/4 searches tours.
target_cities([aaa, bbb, ccc, ddd, eee, fff, ggg]).

distance(aaa, bbb, 10).
distance(aaa, ccc, 15).
distance(aaa, ddd, 20).
distance(aaa, eee, 25).
distance(aaa, fff, 30).
distance(bbb, ccc, 35).
distance(bbb, ddd, 40).
distance(bbb, eee, 20).
distance(bbb, fff, 25).
distance(ccc, ddd, 30).
distance(ccc, eee, 15).
distance(ccc, fff, 10).
distance(ddd, eee, 10).
distance(ddd, fff, 35).
distance(ddd, ggg, 5).
distance(eee, fff, 20).

% Distances are stored once; distance2/3 makes the graph undirected.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
distance2(A, B, D) :-
  distance(A, B, D).
distance2(A, B, D) :-
  distance(B, A, D).

permutation([], []).
permutation(List, [X|Perm]) :-
  select(X, List, Rest),
  permutation(Rest, Perm).

total_distance([_Last], 0).
total_distance([X, Y|Tail], D) :-
  distance2(X, Y, D1),
  total_distance([Y|Tail], D2),
  add(D1, D2, D).

tsp(Cities, Tour, Distance) :-
  weighted_hamiltonian_path(distance, Cities, Tour, Distance).

% Materialized output keeps only the minimum-distance candidate.
optimalTour(Cities, Optimal) :-
  target_cities(Cities),
  findall([T, D], tsp(Cities, T, D), Solutions),
  min_distance(Solutions, Optimal).

min_distance([Sol|Sols], Optimal) :-
  min_distance_acc(Sols, Sol, Optimal).

min_distance_acc([], Best, Best).
min_distance_acc([[_T, D]|Rest], [_BestTour, BestDistance], Optimal) :-
  lt(D, BestDistance),
  min_distance_acc(Rest, [_T, D], Optimal).
min_distance_acc([[_T, D]|Rest], [BestTour, BestDistance], Optimal) :-
  ge(D, BestDistance),
  min_distance_acc(Rest, [BestTour, BestDistance], Optimal).
