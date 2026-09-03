% From The Art of EyeProlog, Chapter 23.
:- use_module(library(lists)).

adult(Person) :-
  recorded_age(Person, Age),
  (Age >= 18).
