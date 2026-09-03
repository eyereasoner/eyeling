% Adapted from Logtalk dcgs_bypass_03-05 and 10.
% Modified for EyeProlog's harness. See test/conformance/THIRD_PARTY.md.

three_checks(X) --> {X = a}, {atom(X)}, {X == a}, [X].
grouped_checks(X) --> {X = b, atom(X)}, [X].
embedded_choice --> ({fail}; {true}), [ok].

%% goal: phrase(three_checks(X), Tokens)
%% goal: phrase(grouped_checks(X), Tokens)
%% goal: phrase(embedded_choice, Tokens)
