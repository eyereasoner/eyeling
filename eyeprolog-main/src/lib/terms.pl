/** Term helpers compatible with the Scryer library surface used by CLP(Z). */

:- module(terms, [numbervars/3, copy_term_nat/2]).

:- use_module(library(error), [must_be/2, can_be/2]).

copy_term_nat(Term, Copy) :- copy_term(Term, Copy).

numbervars(Term, N0, N) :-
    must_be(integer, N0),
    can_be(integer, N),
    term_variables(Term, Variables),
    terms__numbervars(Variables, N0, N).

terms__numbervars([], N, N).
terms__numbervars(['$VAR'(N0)|Variables], N0, N) :-
    N1 is N0 + 1,
    terms__numbervars(Variables, N1, N).
