/** Sufficient-instantiation tests compatible with Scryer library(si). */

:- module(si, [
    atom_si/1,
    integer_si/1,
    atomic_si/1,
    list_si/1,
    character_si/1,
    term_si/1,
    chars_si/1,
    dif_si/2,
    not_si/1,
    when_si/2
]).

:- meta_predicate(not_si(0)).
:- meta_predicate(when_si(+, 0)).

atom_si(A) :- ( var(A) -> throw(error(instantiation_error, atom_si/1)) ; atom(A) ).
integer_si(I) :- ( var(I) -> throw(error(instantiation_error, integer_si/1)) ; integer(I) ).
atomic_si(A) :- ( var(A) -> throw(error(instantiation_error, atomic_si/1)) ; atomic(A) ).

list_si(List) :- si__list(List).
si__list([]).
si__list([_|Tail]) :- !, si__list(Tail).
si__list(Term) :-
    ( var(Term) -> throw(error(instantiation_error, list_si/1)) ; fail ).

character_si(C) :-
    ( var(C) -> throw(error(instantiation_error, character_si/1))
    ; atom(C), atom_length(C, 1)
    ).

term_si(Term) :-
    ( ground(Term) -> acyclic_term(Term)
    ; throw(error(instantiation_error, term_si/1))
    ).

chars_si(Chars) :-
    list_si(Chars),
    si__chars(Chars).
si__chars([]).
si__chars([C|Cs]) :- character_si(C), si__chars(Cs).

dif_si(X, Y) :-
    X \== Y,
    ( X \= Y -> true ; throw(error(instantiation_error, dif_si/2)) ).

not_si(Goal) :- term_si(Goal), \+ Goal.

when_si(Condition, Goal) :-
    ( si__condition(Condition) ->
        ( call(Condition) -> call(Goal)
        ; throw(error(instantiation_error, when_si/2)) )
    ; throw(error(domain_error(when_condition_si, Condition), when_si/2))
    ).

si__condition(Condition) :- var(Condition), !, throw(error(instantiation_error, when_si/2)).
si__condition(ground(_)).
si__condition(nonvar(_)).
si__condition((A,B)) :- si__condition(A), si__condition(B).
si__condition((A;B)) :- si__condition(A), si__condition(B).
