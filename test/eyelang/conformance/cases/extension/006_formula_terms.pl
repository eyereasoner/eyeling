% SPEC 9.9: formula_atom/2 and formula_binary/4 over comma formula data.
formula((name(alice, "Alice"), knows(alice, bob))).
answer(atom, A) :- formula(F), formula_atom(F, A).
answer(binary, exposed(S, P, O)) :- formula(F), formula_binary(F, S, P, O).
materialize(answer, 2).
