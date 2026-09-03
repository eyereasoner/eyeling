% From The Art of EyeProlog, Chapter 4.
:- table ancestor/2.

ancestor(X, Y) :- parent(X, Y).
ancestor(X, Z) :- parent(X, Y), ancestor(Y, Z).
