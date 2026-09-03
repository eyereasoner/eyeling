% From The Art of EyeProlog, Chapter 29 — Examples suggest; proofs compel.
:- use_module(library(between), [between/3]).
:- use_module(library(lists)).

counterexample_to_odd_square(N) :-
  between(1, 100, N),
  (1 is N mod 2),
  (Square is N * N),
  (Remainder is Square mod 2),
  (Remainder \= 1).
