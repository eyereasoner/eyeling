% SPEC 10.1: memoize/2 is a declaration and does not change answers.
materialize(reach, 2).
memoize(reach_any, 2).
edge(a, b).
edge(b, c).
reach_any(X, Y) :- edge(X, Y).
reach_any(X, Z) :- edge(X, Y), reach_any(Y, Z).
reach(a, Y) :- reach_any(a, Y).
