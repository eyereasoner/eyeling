% From The Art of EyeProlog, Chapter 31 — Properties over finite domains.
:- use_module(library(between), [between/3]).
:- use_module(library(lists)).

double(N, D) :- (D is N + N).

double_is_even(N) :-
  double(N, D),
  (0 is D mod 2).

bounded_double_law :-
  \+ bounded_double_counterexample.

bounded_double_counterexample :-
  between(-100, 100, N),
  \+ double_is_even(N).
