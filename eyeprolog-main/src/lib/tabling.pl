/** Common Scryer/Trealla tabling interface.

    EyeProlog tables predicates only when requested explicitly with
    `:- table ...`.  The library keeps the portable start_tabling/2 and
    abolish_all_tables/0 and abolish_table/1 surface used by Scryer/Trealla-compatible source.
*/

:- module(tabling, [start_tabling/2, abolish_all_tables/0, abolish_table/1, op(1150, fx, table)]).

:- meta_predicate(start_tabling(?, 0)).

start_tabling(_, Worker) :-
    call(Worker).

abolish_all_tables :-
    eyeprolog__abolish_all_tables.


abolish_table(Spec) :-
    ( var(Spec) -> throw(error(instantiation_error, abolish_table/1))
    ; tabling__abolish_table(Spec)
    ).

tabling__abolish_table((A,B)) :- !,
    tabling__abolish_table(A),
    tabling__abolish_table(B).
tabling__abolish_table(Name//Arity) :-
    atom(Name), integer(Arity), Arity >= 0, !,
    ExpandedArity is Arity + 2,
    tabling__abolish_table(Name/ExpandedArity).
tabling__abolish_table(Name/Arity) :-
    atom(Name), integer(Arity), Arity >= 0, !,
    ( eyeprolog__abolish_table(Name, Arity) -> true
    ; throw(error(existence_error(table, Name/Arity), abolish_table/1))
    ).
tabling__abolish_table(Spec) :-
    throw(error(type_error(predicate_indicator, Spec), abolish_table/1)).
