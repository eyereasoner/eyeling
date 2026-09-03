/** Scryer-compatible integer generators needed by CLP(Z). */

:- module(between, [between/3, gen_int/1, gen_nat/1, numlist/2, numlist/3, repeat/1]).

:- use_module(library(error), [must_be/2, can_be/2]).

between(Lower, Upper, X) :-
    must_be(integer, Lower),
    must_be(integer, Upper),
    can_be(integer, X),
    ( nonvar(X) -> Lower =< X, X =< Upper
    ; Lower =< Upper, between__from(Lower, Upper, X)
    ).

between__from(Lower, Upper, Lower).
between__from(Lower, Upper, X) :-
    Lower < Upper,
    Next is Lower + 1,
    between__from(Next, Upper, X).

gen_nat(N) :-
    can_be(integer, N),
    ( var(N) -> between__nats(0, N) ; N >= 0 ).

between__nats(N, N).
between__nats(N0, N) :- N1 is N0 + 1, between__nats(N1, N).

gen_int(N) :-
    can_be(integer, N),
    ( var(N) -> between__ints(0, N) ; true ).

between__ints(0, 0).
between__ints(I, I) :- I > 0.
between__ints(I, N) :- I > 0, N is -I.
between__ints(I0, N) :- I1 is I0 + 1, between__ints(I1, N).

repeat(N) :-
    must_be(integer, N), N > 0,
    between__repeat(N).
between__repeat(_).
between__repeat(N0) :- N0 > 1, N is N0 - 1, between__repeat(N).

numlist(Upper, List) :- numlist(1, Upper, List).

numlist(Lower, Upper, List) :-
    must_be(integer, Lower),
    must_be(integer, Upper),
    between__numlist(Lower, Upper, List).

between__numlist(Lower, Upper, []) :- Lower > Upper, !.
between__numlist(Lower, Upper, [Lower|Rest]) :-
    Lower =< Upper,
    Next is Lower + 1,
    between__numlist(Next, Upper, Rest).
