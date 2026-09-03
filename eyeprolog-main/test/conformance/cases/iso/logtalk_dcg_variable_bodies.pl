% Adapted from Logtalk dcgs_metacall_01-02.
% Modified for EyeProlog's harness. See test/conformance/THIRD_PARTY.md.

delegate(Body) --> Body.
surrounded(Body) --> [left], Body, [right].
body_or_fallback(Body) --> Body | [fallback].

%% goal: phrase(delegate([a, b]), Tokens)
%% goal: phrase(surrounded([center]), Tokens)
%% goal: phrase(body_or_fallback([chosen]), Tokens)
