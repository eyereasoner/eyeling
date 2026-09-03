/** Scryer-compatible DCG helpers.

    EyeProlog already provides phrase/2-3 and ISO-style grammar expansion in the
    runtime.  This module supplies the sequence combinators used by Scryer's
    declarative libraries and exports the built-in phrase predicates under the
    expected module name.
*/

:- module(dcgs, [
    phrase/2,
    phrase/3,
    phrase//2,
    phrase//3,
    seq//1,
    seqq//1,
    '...'//0,
    ('-->')/2
]).



:- meta_predicate(phrase(3, '?', '?', '?')).
:- meta_predicate(phrase(4, '?', '?', '?', '?')).

% phrase//2 and phrase//3 add one or two arguments to a DCG nonterminal.
% EyeProlog's normal DCG expansion already appends the two list arguments, so
% these wrappers only need ordinary call/N meta-invocation.
phrase(Grammar, Arg, S0, S) :-
    call(Grammar, Arg, S0, S).

phrase(Grammar, Arg1, Arg2, S0, S) :-
    call(Grammar, Arg1, Arg2, S0, S).

seq([]) --> [].
seq([Element|Elements]) --> [Element], seq(Elements).

seqq([]) --> [].
seqq([Elements|Sequences]) --> seq(Elements), seqq(Sequences).

'...'(Cs0, Cs) :-
    nonvar(Cs0),
    eyeprolog__dcg_proper_list(Cs0),
    !,
    eyeprolog__dcg_any_suffix(Cs0, Cs).
'...'(Cs0, Cs) :-
    Cs0 = Cs.
'...'([_|Rest], Cs) :-
    '...'(Rest, Cs).


% Exported only to reserve the grammar-rule operator as in Scryer.
'-->'(_, _) :- throw(error(existence_error(procedure, ('-->')/2), ('-->')/2)).
