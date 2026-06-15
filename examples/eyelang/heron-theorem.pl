% Heron's theorem: area = sqrt(s(s-a)(s-b)(s-c)).

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(semiperimeter, 2).
materialize(heronProduct, 2).
materialize(area, 2).
materialize(status, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% 13-14-15 is a classic integer-sided triangle with area 84.
triangle(field_plot, 13, 14, 15).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
semiperimeter(Triangle, S) :-
  triangle(Triangle, A, B, C),
  add(A, B, AB),
  add(AB, C, Sum),
  div(Sum, 2, S).

% Area is obtained by taking the square root of this Heron product.
heron_product(Triangle, Product) :-
  triangle(Triangle, A, B, C),
  semiperimeter(Triangle, S),
  sub(S, A, SA),
  sub(S, B, SB),
  sub(S, C, SC),
  mul(S, SA, T1),
  mul(T1, SB, T2),
  mul(T2, SC, Product).

area(Triangle, Area) :-
  heron_product(Triangle, Product),
  pow(Product, 0.5, Area).

heronProduct(Triangle, P) :- heron_product(Triangle, P).
status(Triangle, valid_survey_triangle) :- area(Triangle, A), gt(A, 0).
