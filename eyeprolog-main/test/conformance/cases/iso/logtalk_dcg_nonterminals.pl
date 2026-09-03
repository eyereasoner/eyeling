% Adapted from Logtalk dcgs_non_terminal_01-03 and dcgs_metacall_01-02.
% Modified for EyeProlog's harness. See test/conformance/THIRD_PARTY.md.

token(X) --> [X].
pair(X, Y) --> token(X), token(Y).
delegate(Body) --> Body.
via_call(X) --> call(token(X)).

%% goal: phrase(pair(a, b), X)
%% goal: phrase(delegate([x, y]), X)
%% goal: phrase(via_call(z), X)
