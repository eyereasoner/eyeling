% Memoize scoped family projection and recursive labels; cousin derivation asks
% for the same generation and branch facts many times.
% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(generation, 2).
materialize(branch, 2).
materialize(cousin, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
memoize(family_statement, 3).
memoize(generation, 2).
memoize(branch, 2).

% Family-cousins derivation adapted from Eyeling family-cousins.n3.
% Generation numbers are derived from parent links; branch labels distinguish
% descendants of Bob from descendants of Carol.
% The family tree and seed branch labels are quoted as a small formula term, so
% the rules derive from scoped family data rather than global relationship facts.

family_graph(familyGraph, (
  parent(adam, bob),
  parent(adam, carol),
  parent(bob, dave),
  parent(bob, eve),
  parent(carol, frank),
  parent(carol, grace),
  parent(dave, heidi),
  parent(eve, ivan),
  parent(frank, judy),
  seedBranch(dave, b),
  seedBranch(eve, b),
  seedBranch(frank, c),
  seedBranch(grace, c)
)).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
family_statement(S, P, O) :- family_graph(familyGraph, Formula), formula_binary(Formula, S, P, O).

parent(Parent, Child) :- family_statement(Parent, parent, Child).
branch(Person, Branch) :- family_statement(Person, seedBranch, Branch).

different(b, c).
different(c, b).

generation(adam, 0).
generation(Child, Next) :-
  parent(Parent, Child),
  generation(Parent, Gen),
  add(Gen, 1, Next).

branch(Child, Branch) :-
  parent(Parent, Child),
  branch(Parent, Branch).

derived_branch(Child, Branch) :-
  parent(Parent, Child),
  branch(Parent, Branch).

cousin(X, Y) :-
  generation(X, Gen),
  generation(Y, Gen),
  branch(X, BX),
  branch(Y, BY),
  different(BX, BY).

branch(Person, Branch) :- derived_branch(Person, Branch).
