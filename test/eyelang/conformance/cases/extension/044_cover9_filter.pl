% SPEC 9.5: cover9/1 accepts exactly the digits 1 through 9 once.
answer(ok, yes) :- cover9([1, 2, 3, 4, 5, 6, 7, 8, 9]).
answer(candidate, X) :- row(X), cover9(X).
row([1, 2, 3, 4, 5, 6, 7, 8, 9]).
row([1, 1, 2, 3, 4, 5, 6, 7, 8]).
materialize(answer, 2).
