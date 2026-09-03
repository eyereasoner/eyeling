% From The Art of EyeProlog, Chapter 32 — Compare specification and implementation.
:- use_module(library(between), [between/3]).
:- use_module(library(lists)).

reference_square(N, S) :-
  between(0, 20, N),
  (S is N * N).

optimized_square(N, S) :-
  between(0, 20, N),
  (S is N * N).

disagreement(N, S) :-
  reference_square(N, S),
  \+ optimized_square(N, S).
