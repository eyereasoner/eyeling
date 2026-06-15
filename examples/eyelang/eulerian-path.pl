% Eyelet-inspired Eulerian path example using findall/3 and sort/2.
% The graph is undirected; edges are represented by identifiers so each edge is used once.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(oddVertices, 2).
materialize(path, 2).
materialize(edgeCount, 2).
materialize(reason, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Edge identifiers let the search remove each physical edge exactly once.
edge(e12, v1, v2).
edge(e13, v1, v3).
edge(e15, v1, v5).
edge(e16, v1, v6).
edge(e23, v2, v3).
edge(e24, v2, v4).
edge(e26, v2, v6).
edge(e34, v3, v4).
edge(e36, v3, v6).
edge(e45, v4, v5).
edge(e46, v4, v6).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
vertex(V) :- edge(_E, V, _U).
vertex(V) :- edge(_E, _U, V).

incident(V, E) :- edge(E, V, _U).
incident(V, E) :- edge(E, _U, V).

adjacent_by_edge(V, U, E) :- edge(E, V, U).
adjacent_by_edge(V, U, E) :- edge(E, U, V).

select(Item, [Item | Rest], Rest).
select(Item, [Head | Tail], [Head | Rest]) :-
  select(Item, Tail, Rest).

% Eulerian paths start at an odd-degree vertex when exactly two exist.
odd_degree(V) :-
  findall(E, incident(V, E), Edges),
  length(Edges, Degree),
  mod(Degree, 2, 1).

odd_vertices(Odds) :-
  findall(V, odd_degree(V), Raw),
  sort(Raw, Odds).

all_edges(Edges) :-
  findall(E, edge(E, _A, _B), Raw),
  sort(Raw, Edges).

vertices(Vertices) :-
  findall(V, vertex(V), Raw),
  sort(Raw, Vertices).

eulerian_start(Start) :-
  odd_vertices([Start, _End]).
eulerian_start(Start) :-
  odd_vertices([]),
  vertices([Start | _Rest]).

eulerian_path(Path) :-
  eulerian_start(Start),
  all_edges(Edges),
  dfs_euler(Start, [Start], Edges, ReversedPath),
  reverse(ReversedPath, Path).

% Depth-first search consumes the remaining edge-id list one edge at a time.
dfs_euler(_Current, Path, [], Path).
dfs_euler(Current, Visited, Remaining, Path) :-
  adjacent_by_edge(Current, Next, Edge),
  select(Edge, Remaining, NewRemaining),
  dfs_euler(Next, [Next | Visited], NewRemaining, Path).

oddVertices(eulerian_path_case, Odds) :-
  odd_vertices(Odds).

path(eulerian_path_case, Path) :-
  once(eulerian_path(Path)).

edgeCount(eulerian_path_case, Count) :-
  all_edges(Edges),
  length(Edges, Count).

reason(eulerian_path_case, "findall collects graph structure and sort canonicalizes vertices and edges").
