% Hamiltonian cycle without cut.
%
% The graph has eight vertices and enough chords to create a non-trivial search
% space.  The first vertex is fixed to avoid rotational duplicates; the two
% cycle directions are still distinct, so the count is for cycles from a fixed
% start in traversal order.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(status, 2).
materialize(witness, 2).
materialize(vertexCount, 2).
materialize(cycleCountFromA, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
edge(a, b).
edge(a, f).
edge(a, g).
edge(a, h).
edge(b, c).
edge(b, d).
edge(b, g).
edge(b, h).
edge(c, d).
edge(c, e).
edge(c, g).
edge(d, e).
edge(d, g).
edge(d, h).
edge(e, f).
edge(f, g).
edge(g, h).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
adjacent(X, Y) :- edge(X, Y).
adjacent(X, Y) :- edge(Y, X).

vertices([a, b, c, d, e, f, g, h]).

hamiltonian_cycle(Cycle) :-
  vertices(Vertices),
  hamiltonian_cycle(edge, Vertices, Cycle).

status(hamiltonian_cycle, exists) :-
  once(hamiltonian_cycle(_Cycle)).

witness(hamiltonian_cycle, Cycle) :-
  once(hamiltonian_cycle(Cycle)).

vertexCount(hamiltonian_cycle, Count) :-
  vertices(Vertices),
  length(Vertices, Count).

cycleCountFromA(hamiltonian_cycle, Count) :-
  findall(Cycle, hamiltonian_cycle(Cycle), Cycles),
  length(Cycles, Count).
