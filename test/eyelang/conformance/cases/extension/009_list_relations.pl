% SPEC 9.7: rest/2, select/3, not_member/2, and is_list/1.
answer(rest, X) :- rest([a, b, c], X).
answer(select, selected(X, R)) :- select(X, [a, b], R).
answer(not_member, true) :- not_member(c, [a, b]).
answer(is_list, true) :- is_list([a, b]).
materialize(answer, 2).
