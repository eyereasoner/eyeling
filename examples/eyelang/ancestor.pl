% Basic recursive relation example.
% Both input facts and derived recursive answers are printed.
% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(parent, 2).
materialize(ancestor, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Direct parent facts form a simple chain.
parent(pat, jan).
parent(jan, lies).
parent(lies, emma).

% Base case: every parent is also an ancestor.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
ancestor(X, Y) :-
  parent(X, Y).

% Recursive case: walk one parent edge and continue through the chain.
ancestor(X, Z) :-
  parent(X, Y),
  ancestor(Y, Z).
