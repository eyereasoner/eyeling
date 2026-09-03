/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   format_time//2 is reused from the common Scryer/Trealla library(time),
   written by Markus Triska.  current_time/1 and sleep/1 use small
   EyeProlog host adapters; time/1 and statistics/2 reuse existing runtime
   services.
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */

/** Predicates for reasoning about time. */

:- module(time, [max_sleep_time/1, sleep/1, time/1, current_time/1, format_time//2, statistics/2]).

:- meta_predicate(time(0)).

:- use_module(library(dcgs), [seq//1]).
:- use_module(library(error), [domain_error/3]).
:- use_module(library(lists), [member/2]).
:- use_module(library(iso_ext), [time/1]).

max_sleep_time(0xfffffffffffffbff).

sleep(Seconds) :-
    ( number(Seconds), Seconds > 0xfffffffffffffbff ->
        throw(error(representation_error(max_sleep_time), sleep/1))
    ; eyeprolog__sleep(Seconds)
    ).

% time/1 is re-exported from library(iso_ext); statistics/2 is a
% normal-profile runtime predicate. This matches the Scryer module surface
% without duplicating either implementation.

current_time(T) :-
    eyeprolog__current_time(T).

format_time([], _) --> [].
format_time(['%','%'|Fs], T) --> !, ['%'], format_time(Fs, T).
format_time(['%',Spec|Fs], T) --> !,
    (   { member(Spec=Value, T) } ->
        seq(Value)
    ;   { domain_error(time_specifier, Spec, format_time//2) }
    ),
    format_time(Fs, T).
format_time([F|Fs], T) --> [F], format_time(Fs, T).
