/** List relations, following the library(lists) organization used by Scryer. */

:- module(lists, [
    member/2,
    memberchk/2,
    select/3,
    selectchk/3,
    subtract/3,
    union/3,
    intersection/3,
    is_set/1,
    append/2,
    append/3,
    last/2,
    same_length/2,
    nth0/3,
    nth0/4,
    nth1/3,
    nth1/4,
    reverse/2,
    length/2,
    exclude/3,
    include/3,
    maplist/2,
    maplist/3,
    maplist/4,
    maplist/5,
    maplist/6,
    maplist/7,
    maplist/8,
    maplist/9,
    tasklist/2,
    tasklist/3,
    tasklist/4,
    tasklist/5,
    tasklist/6,
    tasklist/7,
    tasklist/8,
    foldl/4,
    foldl/5,
    foldl/6,
    transpose/2,
    sum_list/2,
    list_max/2,
    list_min/2,
    min_list/2,
    max_list/2,
    list_to_set/2,
    permutation/2,
    set_nth0/4,
    take/3,
    drop/3,
    slice/4
]).

:- meta_predicate(maplist(1, '?')).
:- meta_predicate(maplist(2, '?', '?')).
:- meta_predicate(maplist(3, '?', '?', '?')).
:- meta_predicate(maplist(4, '?', '?', '?', '?')).
:- meta_predicate(maplist(5, '?', '?', '?', '?', '?')).
:- meta_predicate(maplist(6, '?', '?', '?', '?', '?', '?')).
:- meta_predicate(maplist(7, '?', '?', '?', '?', '?', '?', '?')).
:- meta_predicate(maplist(8, '?', '?', '?', '?', '?', '?', '?', '?')).
:- meta_predicate(foldl(3, '?', '?', '?')).
:- meta_predicate(foldl(4, '?', '?', '?', '?')).
:- meta_predicate(foldl(5, '?', '?', '?', '?', '?')).
:- meta_predicate(include(1, '?', '?')).
:- meta_predicate(exclude(1, '?', '?')).
:- meta_predicate(tasklist(1, '?')).
:- meta_predicate(tasklist(2, '?', '?')).
:- meta_predicate(tasklist(3, '?', '?', '?')).
:- meta_predicate(tasklist(4, '?', '?', '?', '?')).
:- meta_predicate(tasklist(5, '?', '?', '?', '?', '?')).
:- meta_predicate(tasklist(6, '?', '?', '?', '?', '?', '?')).
:- meta_predicate(tasklist(7, '?', '?', '?', '?', '?', '?', '?')).


% Common pure-Prolog library predicates for EyeProlog.
%
% The common Trealla/Scryer-facing surface can be imported explicitly with
% use_module(library(lists)); EyeProlog may also autoload those common
% indicators when an otherwise undefined unqualified call is encountered.
% EyeProlog-specific helpers remain explicit and are diagnosed by --warnings.

maplist(_, []).
maplist(Closure, [A|As]) :-
    call(Closure, A),
    maplist(Closure, As).

maplist(_, [], []).
maplist(Closure, [A|As], [B|Bs]) :-
    call(Closure, A, B),
    maplist(Closure, As, Bs).

maplist(_, [], [], []).
maplist(Closure, [A|As], [B|Bs], [C|Cs]) :-
    call(Closure, A, B, C),
    maplist(Closure, As, Bs, Cs).

maplist(_, [], [], [], []).
maplist(Closure, [A|As], [B|Bs], [C|Cs], [D|Ds]) :-
    call(Closure, A, B, C, D),
    maplist(Closure, As, Bs, Cs, Ds).

maplist(_, [], [], [], [], []).
maplist(Closure, [A|As], [B|Bs], [C|Cs], [D|Ds], [E|Es]) :-
    call(Closure, A, B, C, D, E),
    maplist(Closure, As, Bs, Cs, Ds, Es).

maplist(_, [], [], [], [], [], []).
maplist(Closure, [A|As], [B|Bs], [C|Cs], [D|Ds], [E|Es], [F|Fs]) :-
    call(Closure, A, B, C, D, E, F),
    maplist(Closure, As, Bs, Cs, Ds, Es, Fs).

maplist(_, [], [], [], [], [], [], []).
maplist(Closure, [A|As], [B|Bs], [C|Cs], [D|Ds], [E|Es], [F|Fs], [G|Gs]) :-
    call(Closure, A, B, C, D, E, F, G),
    maplist(Closure, As, Bs, Cs, Ds, Es, Fs, Gs).


maplist(_, [], [], [], [], [], [], [], []).
maplist(Closure, [A|As], [B|Bs], [C|Cs], [D|Ds], [E|Es], [F|Fs], [G|Gs], [H|Hs]) :-
    eyeprolog__call8(Closure, A, B, C, D, E, F, G, H),
    maplist(Closure, As, Bs, Cs, Ds, Es, Fs, Gs, Hs).

include(_, [], []).
include(Predicate, [X|Xs], Included) :-
    ( call(Predicate, X) -> Included = [X|Rest] ; Included = Rest ),
    include(Predicate, Xs, Rest).

exclude(_, [], []).
exclude(Predicate, [X|Xs], Excluded) :-
    ( call(Predicate, X) -> Excluded = Rest ; Excluded = [X|Rest] ),
    exclude(Predicate, Xs, Rest).

% Trealla runs tasklist/* items through its task scheduler.  EyeProlog has no
% task scheduler, so the compatibility surface deliberately uses deterministic
% sequential maplist semantics while preserving solutions and failures.
tasklist(Goal, A) :- maplist(Goal, A).
tasklist(Goal, A, B) :- maplist(Goal, A, B).
tasklist(Goal, A, B, C) :- maplist(Goal, A, B, C).
tasklist(Goal, A, B, C, D) :- maplist(Goal, A, B, C, D).
tasklist(Goal, A, B, C, D, E) :- maplist(Goal, A, B, C, D, E).
tasklist(Goal, A, B, C, D, E, F) :- maplist(Goal, A, B, C, D, E, F).
tasklist(Goal, A, B, C, D, E, F, G) :- maplist(Goal, A, B, C, D, E, F, G).

append([], []).
append([Xs|Xss], Ys) :-
    append(Xs, Rest, Ys),
    append(Xss, Rest).

append([], Ys, Ys).
append([X|Xs], Ys, [X|Zs]) :- append(Xs, Ys, Zs).

member(X, [X|_]).
member(X, [_|Xs]) :- member(X, Xs).

memberchk(X, Xs) :- member(X, Xs), !.

select(X, [X|Xs], Xs).
select(X, [Y|Ys], [Y|Zs]) :- select(X, Ys, Zs).

selectchk(X, Xs, Rest) :- select(X, Xs, Rest), !.

subtract([], _, []) :- !.
subtract([X|Xs], Ys, Rest) :- memberchk(X, Ys), !, subtract(Xs, Ys, Rest).
subtract([X|Xs], Ys, [X|Rest]) :- subtract(Xs, Ys, Rest).

union([], Ys, Ys).
union([X|Xs], Ys, Union) :- member(X, Ys), !, union(Xs, Ys, Union).
union([X|Xs], Ys, [X|Union]) :- union(Xs, Ys, Union).

intersection([], _, []).
intersection([X|Xs], Ys, [X|Intersection]) :- member(X, Ys), !, intersection(Xs, Ys, Intersection).
intersection([_|Xs], Ys, Intersection) :- intersection(Xs, Ys, Intersection).

is_set(Set) :-
    sort(Set, Sorted),
    length(Set, Length),
    length(Sorted, Length).

last([X], X).
last([_|Xs], X) :- last(Xs, X).

same_length([], []).
same_length([_|Xs], [_|Ys]) :- same_length(Xs, Ys).

nth0(N, List, Elem) :- nth0(N, List, Elem, _).

nth0(N, List, Elem, Rest) :-
    lists__integer_or_variable(N),
    ( var(N) -> lists__nth0(N, List, Elem, Rest)
    ; lists__not_less_than_zero(N),
      lists__nth0(N, List, Elem, Rest)
    ).

lists__nth0(0, [Elem|Rest], Elem, Rest).
lists__nth0(N, [X|Xs], Elem, [X|Rest]) :-
    var(N),
    lists__nth0(N0, Xs, Elem, Rest),
    N is N0 + 1.
lists__nth0(N, [X|Xs], Elem, [X|Rest]) :-
    nonvar(N),
    N > 0,
    N0 is N - 1,
    lists__nth0(N0, Xs, Elem, Rest).

nth1(N, List, Elem) :- nth1(N, List, Elem, _).

nth1(N, List, Elem, Rest) :-
    N \== 0,
    nth0(N, [_|List], Elem, [_|Rest]),
    N \== 0.

reverse(List, Reversed) :- lists__reverse(List, [], Reversed).

% Keep the common lists:length/2 relation fully relational.  In particular,
% length(List, Length) with both arguments variable enumerates lists of
% increasing length, as required by portable generators such as the issue #28
% number_chars/2 stress test.
length(List, Length) :-
    nonvar(Length), !,
    lists__integer(Length),
    lists__not_less_than_zero(Length),
    lists__length_fixed(Length, List).
length(List, Length) :-
    lists__length_generate(List, 0, Length).

foldl(_, [], Acc, Acc).
foldl(Closure, [A|As], Acc0, Acc) :-
    call(Closure, A, Acc0, Acc1),
    foldl(Closure, As, Acc1, Acc).

foldl(_, [], [], Acc, Acc).
foldl(Closure, [A|As], [B|Bs], Acc0, Acc) :-
    call(Closure, A, B, Acc0, Acc1),
    foldl(Closure, As, Bs, Acc1, Acc).

foldl(_, [], [], [], Acc, Acc).
foldl(Closure, [A|As], [B|Bs], [C|Cs], Acc0, Acc) :-
    call(Closure, A, B, C, Acc0, Acc1),
    foldl(Closure, As, Bs, Cs, Acc1, Acc).

transpose([], []).
transpose([[]|Rows], []) :- lists__all_empty(Rows).
transpose([[X|Xs]|Rows], [[X|Heads]|Columns]) :-
    maplist(lists__list_first_rest, Rows, Heads, Tails),
    transpose([Xs|Tails], Columns).

lists__all_empty([]).
lists__all_empty([[]|Rows]) :- lists__all_empty(Rows).

lists__list_first_rest([X|Xs], X, Xs).

sum_list(List, Sum) :- lists__sum_list(List, 0, Sum).

list_max([X|Xs], Max) :- foldl(lists__list_max, Xs, X, Max).
lists__list_max(X, Max0, Max) :- Max is max(X, Max0).

list_min([X|Xs], Min) :- foldl(lists__list_min, Xs, X, Min).
lists__list_min(X, Min0, Min) :- Min is min(X, Min0).

min_list([X|Xs], Min) :- lists__min_list(Xs, X, Min).

max_list([X|Xs], Max) :- lists__max_list(Xs, X, Max).

list_to_set(List, Set) :- lists__list_to_set(List, [], Set).

permutation(Xs, Ys) :-
    same_length(Xs, Ys),
    lists__permutation(Xs, Ys).

lists__permutation([], []).
lists__permutation(List, [First|Perm]) :-
    select(First, List, Rest),
    lists__permutation(Rest, Perm).


set_nth0(0, [_|Xs], X, [X|Xs]).
set_nth0(N, [Y|Ys], X, [Y|Zs]) :-
    N > 0,
    N1 is N - 1,
    set_nth0(N1, Ys, X, Zs).

take(0, _, []).
take(N, [X|Xs], [X|Ys]) :-
    N > 0,
    N1 is N - 1,
    take(N1, Xs, Ys).

drop(0, Xs, Xs).
drop(N, [_|Xs], Ys) :-
    N > 0,
    N1 is N - 1,
    drop(N1, Xs, Ys).

slice(Start, Count, List, Slice) :-
    drop(Start, List, Tail),
    take(Count, Tail, Slice).

lists__reverse([], Acc, Acc).
lists__reverse([X|Xs], Acc, Out) :- lists__reverse(Xs, [X|Acc], Out).

lists__length_fixed(0, []).
lists__length_fixed(N, [_|Xs]) :-
    N > 0,
    N1 is N - 1,
    lists__length_fixed(N1, Xs).

lists__length_generate([], N, N).
lists__length_generate([_|Xs], N0, N) :-
    N1 is N0 + 1,
    lists__length_generate(Xs, N1, N).

lists__integer(X) :- integer(X), !.
lists__integer(X) :- var(X), !, 0 is X.
% arg/3 performs the ISO integer type check before inspecting its term.
lists__integer(X) :- arg(X, type_check, _).

lists__integer_or_variable(X) :- var(X), !.
lists__integer_or_variable(X) :- lists__integer(X).

lists__not_less_than_zero(X) :- X >= 0, !.
% atom_length/2 reports domain_error(not_less_than_zero) for a negative value.
lists__not_less_than_zero(X) :- atom_length('', X).

lists__sum_list([], Sum, Sum).
lists__sum_list([X|Xs], Acc, Sum) :- Next is Acc + X, lists__sum_list(Xs, Next, Sum).

lists__min_list([], Min, Min).
lists__min_list([X|Xs], Current, Min) :- X @< Current, lists__min_list(Xs, X, Min).
lists__min_list([X|Xs], Current, Min) :- X @>= Current, lists__min_list(Xs, Current, Min).

lists__max_list([], Max, Max).
lists__max_list([X|Xs], Current, Max) :- X @> Current, lists__max_list(Xs, X, Max).
lists__max_list([X|Xs], Current, Max) :- X @=< Current, lists__max_list(Xs, Current, Max).

lists__list_to_set([], _, []).
lists__list_to_set([X|Xs], Seen, Set) :-
    lists__identical_member(X, Seen), !,
    lists__list_to_set(Xs, Seen, Set).
lists__list_to_set([X|Xs], Seen, [X|Set]) :-
    lists__list_to_set(Xs, [X|Seen], Set).

lists__identical_member(X, [Y|_]) :- X == Y.
lists__identical_member(X, [_|Ys]) :- lists__identical_member(X, Ys).
