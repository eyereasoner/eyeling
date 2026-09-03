% Adapted from Logtalk dcgs_terminal_list_05-06.
% Modified for EyeProlog's harness. See test/conformance/THIRD_PARTY.md.

capture(X) --> [X].
duplicate(X) --> [X, X].

%% goal: phrase(capture(X), [term(a)])
%% goal: phrase(capture(value), Tokens)
%% goal: phrase(duplicate(same), Tokens)
