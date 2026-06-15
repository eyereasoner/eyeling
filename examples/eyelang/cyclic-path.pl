% Cyclic transitive closure. The graph contains a directed cycle, but eyelang's
% variant loop guard prevents recursive proof search from revisiting the same
% active subgoal forever.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(path, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
arc(a, b).
arc(b, c).
arc(c, d).
arc(d, a).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
path(X, Y) :- arc(X, Y).
path(X, Z) :- arc(X, Y), path(Y, Z).
