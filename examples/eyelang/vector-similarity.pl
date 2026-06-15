% Vector dot product, Euclidean norm, and cosine similarity.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(dotProduct, 2).
materialize(normA, 2).
materialize(normB, 2).
materialize(cosineSimilarity, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Two named vectors form the single cosine-similarity case.
vector(pair1, a, [1.0, 2.0, 3.0]).
vector(pair1, b, [4.0, -5.0, 6.0]).

% Recursive list folds compute dot products and sums of squares.
dot([], [], 0.0).
% Derivation rules: each rule below contributes one logical step toward the displayed results.
dot([A|As], [B|Bs], Dot) :-
  mul(A, B, Product),
  dot(As, Bs, Rest),
  add(Product, Rest, Dot).

sum_squares([], 0.0).
sum_squares([X|Xs], Total) :-
  pow(X, 2.0, Squared),
  sum_squares(Xs, Rest),
  add(Squared, Rest, Total).

norm(Vector, Norm) :-
  sum_squares(Vector, SumSquares),
  pow(SumSquares, 0.5, Norm).

% cosine = dot(A,B) / (norm(A) * norm(B)).
cosine_similarity(Case, Similarity) :-
  vector(Case, a, A),
  vector(Case, b, B),
  dot(A, B, Dot),
  norm(A, NormA),
  norm(B, NormB),
  mul(NormA, NormB, Denominator),
  div(Dot, Denominator, Similarity).

dotProduct(Case, Dot) :-
  vector(Case, a, A),
  vector(Case, b, B),
  dot(A, B, Dot).

normA(Case, NormA) :-
  vector(Case, a, A),
  norm(A, NormA).

normB(Case, NormB) :-
  vector(Case, b, B),
  norm(B, NormB).

cosineSimilarity(Case, Similarity) :-
  cosine_similarity(Case, Similarity).
