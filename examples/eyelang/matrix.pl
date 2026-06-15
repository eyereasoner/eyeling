% Matrix operations example, adapted from Eyelet's input/matrix.pl.
%
% The operations and sample cases follow the Trealla output reference from
% Eyelet: determinant, inversion, triangular inversion, multiplication, sum,
% and Cholesky decomposition.  Results are derived by generic matrix rules, not
% asserted as output facts.

% --- small list helpers -----------------------------------------------------

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(result, 2).
materialize(checksConsistentWithTreallaReference, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
nth0(0, [H|_T], H).
% Derivation rules: each rule below contributes one logical step toward the displayed results.
nth0(N, [_H|T], V) :-
  gt(N, 0),
  sub(N, 1, N1),
  nth0(N1, T, V).

flatten_matrix([], []).
flatten_matrix([Row|Rows], Flat) :-
  flatten_matrix(Rows, Tail),
  append(Row, Tail, Flat).

list0(0, []).
list0(N, [0|T]) :-
  gt(N, 0),
  sub(N, 1, N1),
  list0(N1, T).

take(0, Rest, [], Rest).
take(N, [H|T], [H|Row], Rest) :-
  gt(N, 0),
  sub(N, 1, N1),
  take(N1, T, Row, Rest).

identify_rows([], _N, []).
identify_rows(Elems, N, [Row|Rows]) :-
  take(N, Elems, Row, Rest),
  identify_rows(Rest, N, Rows).

get_v(I, J, N, Flat, V) :-
  mul(I, N, IN),
  add(IN, J, E),
  nth0(E, Flat, V).

set_v(I, J, N, Flat, NewFlat, V) :-
  mul(I, N, IN),
  add(IN, J, E),
  set_nth0(E, Flat, V, NewFlat).

% --- basic matrix operations ------------------------------------------------

row_sum([], [], []).
row_sum([A|As], [B|Bs], [C|Cs]) :-
  add(A, B, C),
  row_sum(As, Bs, Cs).

matrix_sum([[], []], []).
matrix_sum([[RowA|RowsA], [RowB|RowsB]], [Row|Rows]) :-
  row_sum(RowA, RowB, Row),
  matrix_sum([RowsA, RowsB], Rows).

row_diff([], [], []).
row_diff([A|As], [B|Bs], [C|Cs]) :-
  sub(A, B, C),
  row_diff(As, Bs, Cs).

matrix_diff([], [], []).
matrix_diff([RowA|RowsA], [RowB|RowsB], [Row|Rows]) :-
  row_diff(RowA, RowB, Row),
  matrix_diff(RowsA, RowsB, Rows).

row_mult_scal([], _V, []).
row_mult_scal([A|As], V, [B|Bs]) :-
  mul(A, V, B),
  row_mult_scal(As, V, Bs).

matrix_mult_scal([], _V, []).
matrix_mult_scal([Row|Rows], V, [Scaled|ScaledRows]) :-
  row_mult_scal(Row, V, Scaled),
  matrix_mult_scal(Rows, V, ScaledRows).

row_div_scal([], _V, []).
row_div_scal([A|As], V, [B|Bs]) :-
  div(A, V, B),
  row_div_scal(As, V, Bs).

matrix_div_scal([], _V, []).
matrix_div_scal([Row|Rows], V, [Scaled|ScaledRows]) :-
  row_div_scal(Row, V, Scaled),
  matrix_div_scal(Rows, V, ScaledRows).

transpose_matrix([], []).
transpose_matrix([[]|_Rows], []).
transpose_matrix(Matrix, [Column|Columns]) :-
  first_column(Matrix, Column, Rest),
  transpose_matrix(Rest, Columns).

first_column([], [], []).
first_column([[H|T]|Rows], [H|Hs], [T|Ts]) :-
  first_column(Rows, Hs, Ts).

dot_product([], [], 0).
dot_product([X|Xs], [Y|Ys], D) :-
  dot_product(Xs, Ys, Rest),
  mul(X, Y, XY),
  add(XY, Rest, D).

row_multiply(_Transposed, [], []).
row_multiply(Transposed, [Row|Rows], [OutRow|OutRows]) :-
  row_multiply_columns(Transposed, Row, OutRow),
  row_multiply(Transposed, Rows, OutRows).

row_multiply_columns([], _Row, []).
row_multiply_columns([Column|Columns], Row, [D|Ds]) :-
  dot_product(Row, Column, D),
  row_multiply_columns(Columns, Row, Ds).

matrix_multiply([X, Y], M) :-
  transpose_matrix(Y, T),
  row_multiply(T, X, M).

% --- Cholesky decomposition -------------------------------------------------

cholesky_decomposition(A, L) :-
  flatten_matrix(A, FlatA),
  length(FlatA, FlatLen),
  list0(FlatLen, Work0),
  length(A, N),
  cholesky_i(0, N, FlatA, Work0, Work),
  identify_rows(Work, N, L).

cholesky_i(I, N, _A, L, L) :-
  ge(I, N).
cholesky_i(I, N, A, L, LOut) :-
  lt(I, N),
  cholesky_j(0, I, N, A, L, L1),
  add(I, 1, I1),
  cholesky_i(I1, N, A, L1, LOut).

cholesky_j(J, I, N, A, L, LOut) :-
  eq(J, I),
  cholesky_k(0, I, I, N, 0, S, L),
  get_v(I, I, N, A, Aii),
  sub(Aii, S, V2),
  pow(V2, 0.5, V),
  set_v(I, I, N, L, LOut, V).
cholesky_j(J, I, N, A, L, LOut) :-
  lt(J, I),
  cholesky_k(0, J, I, N, 0, S, L),
  get_v(I, J, N, A, Aij),
  get_v(J, J, N, L, Ljj),
  sub(Aij, S, Numerator),
  div(Numerator, Ljj, V),
  set_v(I, J, N, L, L1, V),
  add(J, 1, J1),
  cholesky_j(J1, I, N, A, L1, LOut).

cholesky_k(K, J, _I, _N, S, S, _L) :-
  ge(K, J).
cholesky_k(K, J, I, N, S0, S, L) :-
  lt(K, J),
  get_v(I, K, N, L, Lik),
  get_v(J, K, N, L, Ljk),
  mul(Lik, Ljk, Product),
  add(S0, Product, S1),
  add(K, 1, K1),
  cholesky_k(K1, J, I, N, S1, S, L).

% --- determinant and inversion ---------------------------------------------

get_diagonal(Matrix, Diagonal) :-
  length(Matrix, N),
  get_diag(0, N, Matrix, Diagonal).

get_diag(I, N, _Matrix, []) :-
  ge(I, N).
get_diag(I, N, Matrix, [V|Vs]) :-
  lt(I, N),
  nth0(I, Matrix, Row),
  nth0(I, Row, V),
  add(I, 1, I1),
  get_diag(I1, N, Matrix, Vs).

prod_list([], 1).
prod_list([A|As], P) :-
  prod_list(As, P0),
  mul(A, P0, P).

determinant(A, Det) :-
  cholesky_decomposition(A, L),
  get_diagonal(L, Diagonal),
  prod_list(Diagonal, DetL),
  mul(DetL, DetL, Det).

matrix_inv_triang(L, Inv) :-
  length(L, N),
  build_inv_rows(0, N, L, [], Inv).

build_inv_rows(I, N, _L, _Previous, []) :-
  ge(I, N).
build_inv_rows(I, N, L, Previous, [Row|Rows]) :-
  lt(I, N),
  build_inv_row(0, N, I, L, Previous, Row),
  append(Previous, [Row], NextPrevious),
  add(I, 1, I1),
  build_inv_rows(I1, N, L, NextPrevious, Rows).

build_inv_row(J, N, _I, _L, _Previous, []) :-
  ge(J, N).
build_inv_row(J, N, I, L, Previous, [V|Vs]) :-
  lt(J, N),
  lower_inverse_value(I, J, N, L, Previous, V),
  add(J, 1, J1),
  build_inv_row(J1, N, I, L, Previous, Vs).

lower_inverse_value(I, J, _N, _L, _Previous, 0) :-
  gt(J, I).
lower_inverse_value(I, J, N, L, _Previous, V) :-
  eq(I, J),
  nth0(I, L, Row),
  nth0(I, Row, Diagonal),
  div(1.0, Diagonal, V).
lower_inverse_value(I, J, N, L, Previous, V) :-
  lt(J, I),
  sum_lower_inverse(J, I, J, N, L, Previous, 0, Sum),
  neg(Sum, NegSum),
  nth0(I, L, Row),
  nth0(I, Row, Diagonal),
  div(NegSum, Diagonal, V).

sum_lower_inverse(K, I, _J, _N, _L, _Previous, Sum, Sum) :-
  ge(K, I).
sum_lower_inverse(K, I, J, N, L, Previous, Sum0, Sum) :-
  lt(K, I),
  nth0(I, L, RowI),
  nth0(K, RowI, Lik),
  nth0(K, Previous, InvRowK),
  nth0(J, InvRowK, InvKj),
  mul(Lik, InvKj, Product),
  add(Sum0, Product, Sum1),
  add(K, 1, K1),
  sum_lower_inverse(K1, I, J, N, L, Previous, Sum1, Sum).

matrix_inversion(A, B) :-
  cholesky_decomposition(A, L),
  matrix_inv_triang(L, LI),
  transpose_matrix(LI, LIT),
  matrix_multiply([LIT, LI], B).

% --- sample cases mirroring Eyelet's Trealla reference output ---------------

case(det3, determinant, [[2, -1, 0], [-1, 2, -1], [0, -1, 2]]).
case(inv3, matrix_inversion, [[2, -1, 0], [-1, 2, -1], [0, -1, 2]]).
case(inv4, matrix_inversion, [[18, 22, 54, 42], [22, 70, 86, 62], [54, 86, 174, 134], [42, 62, 134, 106]]).
case(invtri3, matrix_inv_triang, [[2, 0, 0], [-1, 2, 0], [0, -1, 2]]).
case(mul_small, matrix_multiply, [[[1, 2], [3, 4], [5, 6]], [[1, 1, 1], [1, 1, 1]]]).
case(mul_identity_check, matrix_multiply, [[[18, 22, 54, 42], [22, 70, 86, 62], [54, 86, 174, 134], [42, 62, 134, 106]], [[2.515624999999984, 0.4843749999999933, -1.296874999999973, 0.3593749999999767], [0.4843749999999933, 0.1406249999999978, -0.3281249999999918, 0.1406249999999936], [-1.296874999999973, -0.3281249999999918, 1.015624999999971, -0.5781249999999781], [0.3593749999999767, 0.1406249999999936, -0.5781249999999781, 0.5156249999999853]]]).
case(sum_small, matrix_sum, [[[1, 2], [3, 4], [5, 6]], [[1, 2], [3, 4], [5, 6]]]).
case(chol3, cholesky_decomposition, [[25, 15, -5], [15, 18, 0], [-5, 0, 11]]).
case(chol4, cholesky_decomposition, [[18, 22, 54, 42], [22, 70, 86, 62], [54, 86, 174, 134], [42, 62, 134, 106]]).

result(Case, determinant(Matrix, Det)) :-
  case(Case, determinant, Matrix),
  determinant(Matrix, Det).

result(Case, matrix_inversion(Matrix, Inverse)) :-
  case(Case, matrix_inversion, Matrix),
  matrix_inversion(Matrix, Inverse).

result(Case, matrix_inv_triang(Matrix, Inverse)) :-
  case(Case, matrix_inv_triang, Matrix),
  matrix_inv_triang(Matrix, Inverse).

result(Case, matrix_multiply(Inputs, Product)) :-
  case(Case, matrix_multiply, Inputs),
  matrix_multiply(Inputs, Product).

result(Case, matrix_sum(Inputs, Sum)) :-
  case(Case, matrix_sum, Inputs),
  matrix_sum(Inputs, Sum).

result(Case, cholesky_decomposition(Matrix, L)) :-
  case(Case, cholesky_decomposition, Matrix),
  cholesky_decomposition(Matrix, L).

checksConsistentWithTreallaReference(matrix, true) :-
  determinant([[2, -1, 0], [-1, 2, -1], [0, -1, 2]], Det),
  gt(Det, 3.9999),
  lt(Det, 4.0001),
  matrix_multiply([[[1, 2], [3, 4], [5, 6]], [[1, 1, 1], [1, 1, 1]]], [[3, 3, 3], [7, 7, 7], [11, 11, 11]]),
  matrix_sum([[[1, 2], [3, 4], [5, 6]], [[1, 2], [3, 4], [5, 6]]], [[2, 4], [6, 8], [10, 12]]),
  cholesky_decomposition([[25, 15, -5], [15, 18, 0], [-5, 0, 11]], [[5.0, 0, 0], [3.0, 3.0, 0], [-1.0, 1.0, 3.0]]).
