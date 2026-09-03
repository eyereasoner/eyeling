% From The Art of EyeProlog, Chapter 17.
:- use_module(library(lists)).

path(X, Y) :- edge(X, Y).
path(X, Z) :- edge(X, Y), path(Y, Z).
