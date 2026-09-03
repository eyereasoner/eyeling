% From The Art of EyeProlog, Chapter 17.
:- use_module(library(lists)).

% Poor control: recursion starts before one list cell is exposed.
bad_member(X, List) :- bad_member(X, Rest), (List = [_ | Rest]).
