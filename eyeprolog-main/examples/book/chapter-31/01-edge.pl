% From The Art of EyeProlog, Chapter 31 — Positive and negative observers.
:- use_module(library(lists)).

edge(a, b).
edge(b, c).

path(X, Y) :- edge(X, Y).
path(X, Z) :- edge(X, Y), path(Y, Z).
