% From The Art of EyeProlog, Chapter 23 — Unfolding and folding.
:- use_module(library(lists)).

adult(Person) :-
  recorded_age(Person, Age),
  adult_age(Age).

adult_age(Age) :- (Age >= 18).
