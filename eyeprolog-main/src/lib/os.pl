/** Trealla/Scryer common operating-system relations.

Environment keys, values, commands and argv entries are lists of characters,
matching Scryer's library(os) and EyeProlog's default chars profile.
*/

:- module(os, [
    getenv/2,
    setenv/2,
    unsetenv/1,
    shell/1,
    shell/2,
    pid/1,
    raw_argv/1,
    argv/1
]).

:- use_module(library(error), [can_be/2]).

os__chars([]).
os__chars([C|Cs]) :- atom(C), atom_length(C, 1), os__chars(Cs).

os__must_be_chars(Term) :-
    ( var(Term) -> throw(error(instantiation_error, os))
    ; os__chars(Term) -> true
    ; throw(error(type_error(list, Term), os))
    ).

getenv(Key, Value) :-
    os__must_be_chars(Key),
    can_be(list, Value),
    eyeprolog__getenv(Key, Value).

setenv(Key, Value) :-
    os__must_be_chars(Key),
    os__must_be_chars(Value),
    eyeprolog__setenv(Key, Value).

unsetenv(Key) :-
    os__must_be_chars(Key),
    eyeprolog__unsetenv(Key).

shell(Command) :- shell(Command, 0).

shell(Command, Status) :-
    os__must_be_chars(Command),
    can_be(integer, Status),
    eyeprolog__shell(Command, Status).

pid(Pid) :-
    can_be(integer, Pid),
    eyeprolog__pid(Pid).

raw_argv(Arguments) :-
    can_be(list, Arguments),
    eyeprolog__raw_argv(Arguments).

argv(Arguments) :-
    can_be(list, Arguments),
    eyeprolog__argv(Arguments).
