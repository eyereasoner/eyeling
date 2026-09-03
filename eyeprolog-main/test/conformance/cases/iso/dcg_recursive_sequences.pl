% Recursive grammar rules support both recognition and generation.

tokens([]) --> [].
tokens([X|Xs]) --> [X], tokens(Xs).

%% goal: phrase(tokens([a, b, c]), Generated)
%% goal: phrase(tokens(Parsed), [x, y])
%% goal: phrase(tokens([a, b]), [a, b, rest], Rest)
