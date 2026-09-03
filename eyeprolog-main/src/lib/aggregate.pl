/** Portable solution aggregation relations. */

/* Trealla-compatible aggregate_all/3 and aggregate/3 behavior is adapted
   from Trealla Prolog library/aggregate.pl (MIT),
   Copyright (c) 2020 Andrew George Davison. */

:- module(aggregate, [
    sumall/3, aggregate_min/5, aggregate_max/5,
    aggregate_all/3, aggregate/3
]).

:- meta_predicate(sumall('?', 0, '?')).
:- meta_predicate(aggregate_all('?', 0, '?')).
:- meta_predicate(aggregate('?', 0, '?')).
:- meta_predicate(aggregate_min('?', '?', 0, '?', '?')).
:- meta_predicate(aggregate_max('?', '?', 0, '?', '?')).

sumall(Expression, Goal, Sum) :-
    findall(Value, (Goal, Value is Expression), Values),
    aggregate__sum_list(Values, 0, Sum).

aggregate_min(Key, Value, Goal, BestKey, BestValue) :-
    findall(Key-Value, Goal, Pairs),
    keysort(Pairs, [BestKey-BestValue|_]).

aggregate_max(Key, Value, Goal, BestKey, BestValue) :-
    findall(Key-Value, Goal, Pairs),
    aggregate__reverse(Pairs, [], ReversePairs),
    keysort(ReversePairs, Sorted),
    aggregate__last_pair(Sorted, BestKey-BestValue).

aggregate__sum_list([], Sum, Sum).
aggregate__sum_list([X|Xs], Acc, Sum) :-
    Next is Acc + X,
    aggregate__sum_list(Xs, Next, Sum).

aggregate__reverse([], Acc, Acc).
aggregate__reverse([X|Xs], Acc, Out) :- aggregate__reverse(Xs, [X|Acc], Out).

aggregate__last_pair([Pair], Pair).
aggregate__last_pair([_|Pairs], Pair) :- aggregate__last_pair(Pairs, Pair).


% Trealla-compatible aggregate templates.  These are source-level relations;
% EyeProlog keeps its older sumall/3 and aggregate_min/max helpers alongside
% them for backward compatibility.
aggregate_all(Aggregate, Goal, Result) :-
    aggregate__init(Aggregate, Template, Initial),
    findall(Template, Goal, Values),
    aggregate__compute(Values, Aggregate, Initial, Result).

aggregate(Aggregate, Goal, Result) :-
    aggregate__init(Aggregate, Template, Initial),
    bagof(Template, Goal, Values),
    aggregate__compute(Values, Aggregate, Initial, Result).

aggregate__compute([], Aggregate, Initial, Result) :-
    aggregate__finish(Aggregate, Initial, Result).
aggregate__compute([Value|Values], Aggregate, Acc0, Result) :-
    aggregate__next(Aggregate, Acc0, Value, Acc),
    aggregate__compute(Values, Aggregate, Acc, Result).

aggregate__init(Aggregate, _, _) :- var(Aggregate), !,
    throw(error(instantiation_error, aggregate/3)).
aggregate__init(count, '', 0) :- !.
aggregate__init(sum(X), X, 0) :- !.
aggregate__init(mul(X), X, 1) :- !.
aggregate__init(min(X), X, sup) :- !.
aggregate__init(max(X), X, inf) :- !.
aggregate__init(bag(X), X, []) :- !.
aggregate__init(set(X), X, []) :- !.
aggregate__init((F,G), (X,Y), (A,B)) :- !,
    aggregate__init(F, X, A),
    aggregate__init(G, Y, B).
aggregate__init(Aggregate, _, _) :-
    throw(error(type_error(aggregate, Aggregate), aggregate/3)).

aggregate__next(count, A, '', C) :- C is A + 1.
aggregate__next(sum(_), A, B, C) :- C is A + B.
aggregate__next(mul(_), A, B, C) :- C is A * B.
aggregate__next(min(_), A, B, C) :- aggregate__min(A, B, C).
aggregate__next(max(_), A, B, C) :- aggregate__max(A, B, C).
aggregate__next(bag(_), A, B, [B|A]).
aggregate__next(set(_), A, B, [B|A]).
aggregate__next((F,G), (A,B), (X,Y), (C,D)) :-
    aggregate__next(F, A, X, C),
    aggregate__next(G, B, Y, D).

aggregate__finish(count, A, A).
aggregate__finish(sum(_), A, A).
aggregate__finish(mul(_), A, A).
aggregate__finish(min(_), A, A).
aggregate__finish(max(_), A, A).
aggregate__finish(bag(_), A, B) :- aggregate__reverse(A, [], B).
aggregate__finish(set(_), A, B) :- aggregate__reverse(A, [], R), sort(R, B).
aggregate__finish((F,G), (X,Y), (A,B)) :-
    aggregate__finish(F, X, A),
    aggregate__finish(G, Y, B).

aggregate__min(sup, X, X) :- !.
aggregate__min(X, sup, X) :- !.
aggregate__min(inf, _, inf) :- !.
aggregate__min(_, inf, inf) :- !.
aggregate__min(X, Y, R) :- R is min(X, Y).

aggregate__max(inf, X, X) :- !.
aggregate__max(X, inf, X) :- !.
aggregate__max(sup, _, sup) :- !.
aggregate__max(_, sup, sup) :- !.
aggregate__max(X, Y, R) :- R is max(X, Y).
