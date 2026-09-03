/*  Attributed variables compatibility layer.

    The public surface follows Scryer Prolog library(atts). EyeProlog keeps the
    actual attribute store and verify_attributes/3 scheduling in the generic
    annotated-variable runtime, so libraries can use put_atts/2 and get_atts/2
    without code-generation term expansion.
*/

:- module(atts, [
    put_atts/2,
    get_atts/2,
    put_attr/3,
    get_attr/3,
    del_attr/2,
    term_attributed_variables/2,
    call_residue_vars/2
]).
:- op(1199, fx, attribute).
:- meta_predicate(call_residue_vars(0, '?')).

term_attributed_variables(Term, Variables) :-
    '$term_attributed_variables'(Term, Variables).

call_residue_vars(Goal, Variables) :-
    eyeprolog__call_residue_vars(Goal, Variables).
