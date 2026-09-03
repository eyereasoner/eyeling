% From The Art of EyeProlog, Chapter 26 — Answers are existential witnesses.
:- use_module(library(between), [between/3]).
:- use_module(library(lists)).

triple(A, B, C) :-
  between(1, 20, A),
  between(A, 20, B),
  between(B, 20, C),
  (AA is A * A),
  (BB is B * B),
  (Sum is AA + BB),
  (Sum is C * C).
