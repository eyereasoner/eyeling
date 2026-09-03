% From The Art of EyeProlog, Chapter 3.
:- use_module(library(lists)).

eligible(Person) :-
  age(Person, Years),
  (Years >= 18),
  registered(Person).
