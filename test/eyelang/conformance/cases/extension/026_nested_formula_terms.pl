% SPEC 9.9: formula helpers enumerate nested comma formula members.
formula(((name(a, "A"), knows(a, b)), likes(b, c))).
answer(atom, A) :- formula(F), formula_atom(F, A).
answer(binary, exposed(S, P, O)) :- formula(F), formula_binary(F, S, P, O).
materialize(answer, 2).
