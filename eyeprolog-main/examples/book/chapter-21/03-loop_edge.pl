% From The Art of EyeProlog, Chapter 21.
:- use_module(library(lists)).

loop_edge(Node) :- edge(Node, Node).
