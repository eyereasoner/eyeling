% From The Art of EyeProlog, Chapter 22.
:- use_module(library(lists)).

tree_member(X, tree(X, _, _)).
tree_member(X, tree(_, Left, _)) :- tree_member(X, Left).
tree_member(X, tree(_, _, Right)) :- tree_member(X, Right).
