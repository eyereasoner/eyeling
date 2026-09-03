% From The Art of EyeProlog, Chapter 32 — Follow bindings from left to right.
:- use_module(library(lists)).

eligible(Person) :-
  (Age >= 18),
  age(Person, Age).
