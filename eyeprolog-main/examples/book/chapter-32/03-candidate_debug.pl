% From The Art of EyeProlog, Chapter 32 — Create diagnostic relations.
:- use_module(library(lists)).

candidate_debug(Person, Age) :-
  age(Person, Age).

adult_debug(Person, Age) :-
  candidate_debug(Person, Age),
  (Age >= 18).
