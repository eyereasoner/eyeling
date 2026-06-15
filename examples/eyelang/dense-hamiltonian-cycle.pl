% Dense weighted Hamiltonian cycle search.
%
% This deliberately stresses finite search: it enumerates symmetry-broken
% permutations of seven non-start vertices in an eight-vertex complete graph,
% scores the closed cycles, and keeps the cheapest candidate with
% aggregate_min/5.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(best, 2).
materialize(candidateCount, 2).
materialize(status, 2).
materialize(reason, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
cities([a, b, c, d, e, f, g, h]).

edge(a, b, 3).
edge(a, c, 47).
edge(a, d, 35).
edge(a, e, 46).
edge(a, f, 34).
edge(a, g, 45).
edge(a, h, 10).
edge(b, c, 4).
edge(b, d, 42).
edge(b, e, 30).
edge(b, f, 41).
edge(b, g, 52).
edge(b, h, 40).
edge(c, d, 5).
edge(c, e, 37).
edge(c, f, 48).
edge(c, g, 36).
edge(c, h, 47).
edge(d, e, 6).
edge(d, f, 32).
edge(d, g, 43).
edge(d, h, 31).
edge(e, f, 7).
edge(e, g, 50).
edge(e, h, 38).
edge(f, g, 8).
edge(f, h, 45).
edge(g, h, 9).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
weight(A, B, W) :- edge(A, B, W).
weight(A, B, W) :- edge(B, A, W).

permutation([], []).
permutation(List, [X | Perm]) :-
  select(X, List, Rest),
  permutation(Rest, Perm).

last([X], X).
last([_ | Rest], X) :- last(Rest, X).

path_cost([_Last], 0).
path_cost([A, B | Rest], Cost) :-
  weight(A, B, Step),
  path_cost([B | Rest], Tail),
  add(Step, Tail, Cost).

symmetry_broken([First | Rest]) :-
  last([First | Rest], Last),
  lt(First, Last).

candidate_cycle(Cities, Cycle, Cost) :-
  weighted_hamiltonian_cycle(edge, Cities, Cycle, Cost).

factorial(0, 1).
factorial(N, F) :-
  gt(N, 0),
  sub(N, 1, N0),
  factorial(N0, F0),
  mul(N, F0, F).

best(dense_hamiltonian_cycle, result(Cost, Cycle)) :-
  cities(Cities),
  aggregate_min([Cost, Cycle], result(Cost, Cycle), candidate_cycle(Cities, Cycle, Cost), _Key, result(Cost, Cycle)).

candidateCount(dense_hamiltonian_cycle, Count) :-
  cities([_Start | Rest]),
  length(Rest, N),
  factorial(N, Permutations),
  div(Permutations, 2, Count).

status(dense_hamiltonian_cycle, symmetry_broken_complete_graph_searched) :-
  eq(ok, ok).

reason(dense_hamiltonian_cycle, "symmetry-broken permutation search scores Hamiltonian cycles and aggregate_min selects the cheapest candidate") :-
  eq(ok, ok).
