% From The Art of EyeProlog, Chapter 21 — Failure rewinds choices, not facts.
:- use_module(library(lists)).

eligible(Person) :-
  applicant(Person),
  age(Person, Age),
  (Age >= 18),
  verified(Person).
