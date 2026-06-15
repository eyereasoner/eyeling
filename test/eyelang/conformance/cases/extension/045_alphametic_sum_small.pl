% SPEC 9.5: alphametic_sum/5 enumerates unique digit assignments for column addition.
answer(solution, result(Digits, Values)) :- alphametic_sum([a, b], [[a], [a]], [b], Digits, Values).
materialize(answer, 2).
