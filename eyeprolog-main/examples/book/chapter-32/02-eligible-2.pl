% From The Art of EyeProlog, Chapter 32.
:- use_module(library(lists)).

eligible(Person) :-
  age(Person, Age),
  (Age >= 18).
