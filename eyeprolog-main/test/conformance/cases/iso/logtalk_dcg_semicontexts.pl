% Adapted from Logtalk dcgs_push_back_list_01-08.
% Modified for EyeProlog's harness. See test/conformance/THIRD_PARTY.md.

look_ahead(X), [X] --> [X].
replace, [a, b] --> [foo].
push_one(X), [X] --> [X].
push_pair(X, Y), [X, Y] --> [X, Y].

%% goal: phrase(look_ahead(a), [a], Rest)
%% goal: phrase(replace, [foo, tail], Rest)
%% goal: phrase(push_one(x), [x], Rest)
%% goal: phrase(push_pair(a, b), [a, b], Rest)
