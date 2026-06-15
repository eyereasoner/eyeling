% Hamiltonian path, adapted from Eyelet's input/hamiltonian-path.pl.
%
% The graph is the same six-vertex undirected graph.  eyelang spells the finite
% vertex set directly and derives every path that visits each vertex exactly
% once.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(hasHamiltonianPath, 2).
materialize(hamiltonianPath, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
memoize(adjacent, 2).

edge(v1, v2).
edge(v1, v3).
edge(v1, v5).
edge(v1, v6).
edge(v2, v3).
edge(v2, v4).
edge(v2, v6).
edge(v3, v4).
edge(v3, v6).
edge(v4, v5).
edge(v4, v6).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
adjacent(V, U) :- edge(V, U).
adjacent(V, U) :- edge(U, V).

vertex(v1).
vertex(v2).
vertex(v3).
vertex(v4).
vertex(v5).
vertex(v6).

hamiltonian_path([A, B, C, D, E, F]) :-
  vertex(A),
  vertex(B), adjacent(A, B), not_member(B, [A]),
  vertex(C), adjacent(B, C), not_member(C, [A, B]),
  vertex(D), adjacent(C, D), not_member(D, [A, B, C]),
  vertex(E), adjacent(D, E), not_member(E, [A, B, C, D]),
  vertex(F), adjacent(E, F), not_member(F, [A, B, C, D, E]).

hasHamiltonianPath(graph, true) :-
  hamiltonian_path(_Path).

hamiltonianPath(graph, Path) :-
  hamiltonian_path(Path).
