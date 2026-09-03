% Part 3 alternatives, embedded goals, if-then-else, negation and cut.
token(X) --> [X], { atom(X) }.
choice --> [a] | [b].
guarded --> ([a] -> [b] ; [c]).
not_a --> \+ [a], [_].
committed --> ([a], ! ; [b]).

%% goal: phrase(token(a), [a])
%% goal: phrase(choice, X)
%% goal: phrase(guarded, X)
%% goal: phrase(not_a, [b])
%% goal: phrase(committed, X)
