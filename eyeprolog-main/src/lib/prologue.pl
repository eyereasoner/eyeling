/** Predicates proposed by the ISO Prolog Prologue working draft.

    This legacy compatibility module is a facade over the canonical library
    organization shared with Scryer and Trealla. Keeping one implementation
    owner per predicate lets applications combine library(prologue) with the
    specialized libraries without import conflicts.
*/

:- module(prologue, [
    member/2,
    append/3,
    length/2,
    between/3,
    select/3,
    succ/2,
    maplist/2,
    maplist/3,
    maplist/4,
    maplist/5,
    maplist/6,
    maplist/7,
    maplist/8,
    nth0/3,
    nth0/4,
    nth1/3,
    nth1/4,
    call_nth/2,
    freeze/2,
    foldl/4,
    foldl/5,
    foldl/6,
    countall/2
]).

:- use_module(library(lists), [
    member/2,
    append/3,
    length/2,
    select/3,
    maplist/2,
    maplist/3,
    maplist/4,
    maplist/5,
    maplist/6,
    maplist/7,
    maplist/8,
    nth0/3,
    nth0/4,
    nth1/3,
    nth1/4,
    foldl/4,
    foldl/5,
    foldl/6
]).
:- use_module(library(between), [between/3]).
:- use_module(library(iso_ext), [succ/2, call_nth/2, countall/2]).
:- use_module(library(freeze), [freeze/2]).
