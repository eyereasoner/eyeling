% SAT solving without cut.
%
% A compact DPLL-style example for a finite CNF formula.  The program first
% generates truth assignments, then checks every clause declaratively.  This
% larger instance has eight variables and twelve clauses, so it is still small
% enough for full model collection but no longer a toy four-variable search.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(status, 2).
materialize(witness, 2).
materialize(modelCount, 2).
materialize(variableCount, 2).
materialize(clauseCount, 2).
materialize(reason, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
problem(sat_instance,
  [a, b, c, d, e, f, g, h],
  [
    [pos(a), pos(b)],
    [neg(a), pos(c)],
    [neg(b), pos(d)],
    [pos(c), pos(d)],
    [neg(c), pos(e)],
    [neg(d), pos(f)],
    [pos(e), pos(f)],
    [neg(e), pos(g)],
    [neg(f), pos(h)],
    [pos(g), pos(h)],
    [neg(g), pos(a)],
    [neg(h), pos(b)]
  ]).

truth(false).
truth(true).

assignment([], []).
% Derivation rules: each rule below contributes one logical step toward the displayed results.
assignment([Var|Vars], [value(Var, Truth)|Rest]) :-
  truth(Truth),
  assignment(Vars, Rest).

literal_true(pos(Var), Assignment) :-
  member(value(Var, true), Assignment).
literal_true(neg(Var), Assignment) :-
  member(value(Var, false), Assignment).

clause_true([Literal|_Rest], Assignment) :-
  literal_true(Literal, Assignment).
clause_true([_Literal|Rest], Assignment) :-
  clause_true(Rest, Assignment).

cnf_true([], _Assignment).
cnf_true([Clause|Clauses], Assignment) :-
  clause_true(Clause, Assignment),
  cnf_true(Clauses, Assignment).

model(Name, Assignment) :-
  problem(Name, Variables, Clauses),
  cnf_model(Variables, Clauses, Assignment).

status(sat_instance, satisfiable) :-
  once(model(sat_instance, _Assignment)).

witness(sat_instance, Assignment) :-
  once(model(sat_instance, Assignment)).

modelCount(sat_instance, Count) :-
  findall(Assignment, model(sat_instance, Assignment), Models),
  length(Models, Count).

variableCount(sat_instance, Count) :-
  problem(sat_instance, Variables, _Clauses),
  length(Variables, Count).

clauseCount(sat_instance, Count) :-
  problem(sat_instance, _Variables, Clauses),
  length(Clauses, Count).

reason(sat_instance, "finite 8-variable CNF search succeeds without cut").
