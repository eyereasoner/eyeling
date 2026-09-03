% Adapted from Logtalk dcgs_if_the_else_01-06 and dcgs_bypass_06-07.
% Modified for EyeProlog's harness. See test/conformance/THIRD_PARTY.md.

select --> ([x] -> [then] ; [else]).
after_prefix --> [start], ([x] -> [yes] ; [no]).
condition_sequence --> ([a], [b] -> [c] ; [d]).
embedded_condition --> ({true} -> [yes] ; [no]).

%% goal: phrase(select, [x, then])
%% goal: phrase(select, [else])
%% goal: phrase(after_prefix, [start, x, yes])
%% goal: phrase(after_prefix, [start, no])
%% goal: phrase(condition_sequence, [a, b, c])
%% goal: phrase(condition_sequence, [d])
%% goal: phrase(embedded_condition, X)
