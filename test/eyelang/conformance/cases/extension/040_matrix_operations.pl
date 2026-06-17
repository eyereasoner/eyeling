% Reference 9.2: matrix helpers handle small ground numeric matrices.
answer(sum, M) :- matrix_sum([[[1, 2], [3, 4]], [[5, 6], [7, 8]]], M).
answer(product, M) :- matrix_multiply([[[1, 2], [3, 4]], [[2, 0], [1, 2]]], M).
answer(determinant, D) :- determinant([[4, 2], [2, 3]], D).
materialize(answer, 2).
