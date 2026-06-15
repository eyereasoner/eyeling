% SPEC 9.7: is_list/1 succeeds only for proper lists.
thing([a, b]).
thing(pair(a, b)).
answer(list, X) :- thing(X), is_list(X).
materialize(answer, 2).
