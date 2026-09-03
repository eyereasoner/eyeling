% From The Art of EyeProlog, Chapter 17 — The same relation, a different computation.
:- use_module(library(lists)).

adult(Person) :- person(Person), age(Person, Age), (Age >= 18).

adult(Person) :- (Age >= 18), age(Person, Age), person(Person).
