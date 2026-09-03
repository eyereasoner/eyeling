% Adapted from Logtalk dcgs_terminal_list_01-06 and
% dcgs_terminal_string_01-03. Modified for EyeProlog's harness.
% See test/conformance/THIRD_PARTY.md.

empty --> [].
one(X) --> [X].
mixed --> [[], {}, 3, 3.2, a(b)].
letters --> "abc".
letters_or_q --> "abc" | "q".

%% goal: phrase(empty, [])
%% goal: phrase(one(value), [value])
%% goal: phrase(mixed, [[], {}, 3, 3.2, a(b)])
%% goal: phrase(letters, X)
%% goal: phrase(letters_or_q, X)
