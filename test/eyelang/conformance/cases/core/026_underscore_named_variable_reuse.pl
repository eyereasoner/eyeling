% Reference 3.4, 5.1: variables beginning with underscore are named variables unless exactly _.
pair(a, a).
pair(a, b).
answer(shared, _Value) :- pair(_Value, _Value).
materialize(answer, 2).
