% SPEC 9.5: cnf_model/3 enumerates satisfying truth assignments for a CNF.
answer(model, M) :- cnf_model([a, b], [[pos(a), pos(b)], [neg(a)]], M).
materialize(answer, 2).
