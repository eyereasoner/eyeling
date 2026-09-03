/** Compatibility hooks and declarative debugging.

    The three operator predicates are reused from the identical Scryer and
    Trealla library(debug) sources. Blackboard state follows Scryer and lives in library(iso_ext).
*/

:- module(debug, [debug/1, debug/3, nodebug/1, bb_get/2, bb_put/2, bb_b_put/2,
                  op(900, fx, $), op(900, fx, $-), op(950, fy, *),
                  (*)/1, ($)/1, ($-)/1]).

:- op(900, fx, $).
:- op(900, fx, $-).
:- op(950, fy, *).

:- use_module(library(format), [portray_clause/1]).
:- use_module(library(iso_ext), [bb_get/2, bb_put/2, bb_b_put/2]).

:- meta_predicate(debug(+, +, +)).
:- meta_predicate(*(0)).
:- meta_predicate($(0)).
:- meta_predicate($-(0)).

debug(_).
debug(_, _, _).
nodebug(_).

$-(Goal) :-
    catch(Goal, Exception,
          ( portray_clause(exception:Exception:Goal), throw(Exception) )).

$(Goal) :-
    portray_clause(call:Goal),
    $-Goal,
    portray_clause(exit:Goal).

*(_).
