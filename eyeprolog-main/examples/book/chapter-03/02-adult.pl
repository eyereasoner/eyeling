% From The Art of EyeProlog, Chapter 3.
:- use_module(library(lists)).

adult(Person) :-
  age(Person, Years),
  (Years >= 18).
