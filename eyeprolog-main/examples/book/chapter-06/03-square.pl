% From The Art of EyeProlog, Chapter 6.
:- use_module(library(lists)).

square(N, Square) :-
  between(1, 10, N),
  (Square is N * N).
