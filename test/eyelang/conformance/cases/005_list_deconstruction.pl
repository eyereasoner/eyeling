% Reference 5.4, 12.1: list syntax and unification in rule heads.
first([X | _Rest], X).
tail([_Head | Tail], Tail).
answer(first, X) :- first([a, b, c], X).
answer(tail, Tail) :- tail([a, b, c], Tail).
materialize(answer, 2).
