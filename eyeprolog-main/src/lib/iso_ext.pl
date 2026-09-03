/** Widely implemented extensions to the ISO Prolog core. */

:- module(iso_ext, [
    bb_b_put/2,
    bb_get/2,
    bb_put/2,
    call_cleanup/2,
    call_with_inference_limit/3,
    call_nth/2,
    call_residue_vars/2,
    countall/2,
    copy_term_nat/2,
    copy_term/3,
    forall/2,
    partial_string/1,
    partial_string/3,
    partial_string_tail/2,
    setup_call_cleanup/3,
    succ/2,
    cfor/3,
    findall/4,
    variant/2,
    time/1
]).

:- use_module(library(atts), [call_residue_vars/2]).
:- use_module(library(terms), [copy_term_nat/2]).

:- meta_predicate(call_cleanup(0, 0)).
:- meta_predicate(call_with_inference_limit(0, '?', '?')).
:- meta_predicate(call_nth(0, '?')).
:- meta_predicate(call_residue_vars(0, '?')).
:- meta_predicate(setup_call_cleanup(0, 0, 0)).
:- meta_predicate(countall(0, '?')).
:- meta_predicate(forall(0, 0)).
:- meta_predicate(findall('?', 0, '?', '?')).
:- meta_predicate(time(0)).



% Scryer-compatible blackboard interface. bb_put/2 is non-backtrackable;
% bb_b_put/2 is trailed in the current environment. bb_get/2 sees either.
bb_put(Key, Value) :- eyeprolog__bb_global_put(Key, Value).
bb_b_put(Key, Value) :- eyeprolog__bb_b_put(Key, Value).
bb_get(Key, Value) :- eyeprolog__bb_get(Key, Value), !.
bb_get(Key, Value) :- eyeprolog__bb_global_get(Key, Value).

call_with_inference_limit(Goal, Limit, Result) :-
    eyeprolog__call_with_inference_limit(Goal, Limit, Result).

% EyeProlog represents strings as ordinary character lists. These predicates
% therefore use the logical list equivalent of Scryer's compact partial-string
% representation while preserving the same public relation.
partial_string(String, List0, List) :-
    iso_ext__proper_chars(String),
    iso_ext__append(String, List, List0).

partial_string(String) :-
    nonvar(String),
    iso_ext__char_list_tail(String, _).

partial_string_tail(String, Tail) :-
    ( nonvar(String), iso_ext__char_list_tail(String, Tail) -> true
    ; throw(error(type_error(partial_string, String), partial_string_tail/2))
    ).

% copy_term/3 is the Scryer surface for a copy plus residual attribute goals.
% The current generic fallback is exact for ordinary terms; attributed modules
% can still use call_residue_vars/2 and term_attributed_variables/2 directly.
copy_term(Term, Copy, Goals) :-
    eyeprolog__copy_term_3(Term, Copy, Goals).

% The organization and predicate contracts follow library(iso_ext) in
% Trealla. Most definitions use only EyeProlog's ISO profile. time/1 is the
% deliberate exception: its private adapter supplies monotonic host timing and
% writes the measurement while the public wrapper keeps normal meta semantics.

call_nth(Goal, Nth) :- eyeprolog__call_nth(Goal, Nth).

countall(Goal, Count) :- eyeprolog__countall(Goal, Count).

forall(Condition, Action) :-
    \+ (Condition, \+ Action).

succ(X, S) :-
    var(X), !,
    ( var(S) -> 0 is S
    ; iso_ext__integer(S),
      iso_ext__not_less_than_zero(S),
      S > 0,
      X is S - 1
    ).
succ(X, S) :-
    iso_ext__integer(X),
    iso_ext__not_less_than_zero(X),
    ( var(S) -> S is X + 1
    ; iso_ext__integer(S),
      iso_ext__not_less_than_zero(S),
      S =:= X + 1
    ).

cfor(LowerExpression, UpperExpression, Value) :-
    Lower is LowerExpression,
    Upper is UpperExpression,
    iso_ext__between(Lower, Upper, Value).

findall(Template, Goal, Bag, Tail) :-
    findall(Template, Goal, Prefix),
    iso_ext__append(Prefix, Tail, Bag),
    !.

variant(X, Y) :-
    copy_term(X-Y, CopyX-CopyY),
    subsumes_term(CopyX, CopyY),
    subsumes_term(CopyY, CopyX).

% Trealla-compatible timing wrapper. The private adapter measures the callable
% while this Prolog wrapper supplies normal module/meta-predicate semantics.
time(Goal) :- eyeprolog__time(Goal).


iso_ext__call_all([]).
iso_ext__call_all([Goal|Goals]) :-
    call(Goal),
    iso_ext__call_all(Goals).

iso_ext__length([], N, N).
iso_ext__length([_|Xs], N0, N) :-
    N1 is N0 + 1,
    iso_ext__length(Xs, N1, N).

iso_ext__between(Lower, Upper, Lower) :- Lower =< Upper.
iso_ext__between(Lower, Upper, Value) :-
    Lower < Upper,
    Next is Lower + 1,
    iso_ext__between(Next, Upper, Value).

iso_ext__append([], Ys, Ys).
iso_ext__append([X|Xs], Ys, [X|Zs]) :- iso_ext__append(Xs, Ys, Zs).

iso_ext__integer(X) :- integer(X), !.
iso_ext__integer(X) :- var(X), !, 0 is X.
iso_ext__integer(X) :- arg(X, type_check, _).

iso_ext__not_less_than_zero(X) :- X >= 0, !.
iso_ext__not_less_than_zero(X) :- atom_length('', X).


iso_ext__proper_chars([]).
iso_ext__proper_chars([C|Cs]) :- atom(C), atom_length(C, 1), iso_ext__proper_chars(Cs).

iso_ext__char_list_tail([], []).
iso_ext__char_list_tail([C|Cs], Tail) :-
    atom(C), atom_length(C, 1),
    ( var(Cs) -> Tail = Cs ; iso_ext__char_list_tail(Cs, Tail) ).
