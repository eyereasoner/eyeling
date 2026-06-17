% Reference 9.5: n_queens/2 enumerates finite board solutions.
answer(solution, Qs) :- n_queens(4, Qs).
materialize(answer, 2).
