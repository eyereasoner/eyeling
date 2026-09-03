/*
    Author:        Ulrich Neumerkel
    E-mail:        ulrich@complang.tuwien.ac.at
    Copyright (C): 2009 Ulrich Neumerkel. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY Ulrich Neumerkel ``AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL Ulrich Neumerkel OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The views and conclusions contained in the software and documentation
are those of the authors and should not be interpreted as representing
official policies, either expressed or implied, of Ulrich Neumerkel.

Adapted for EyeProlog from Scryer Prolog library(lambda):
https://github.com/mthom/scryer-prolog/blob/master/src/lib/lambda.pl
*/

/** Lambda expressions for higher-order programming based on call/N.

    Supported forms follow Scryer Prolog library(lambda):

        Free+\X1^X2^...^XN^Goal
             \X1^X2^...^XN^Goal

    The second form is shorthand for a lambda with no explicitly shared free
    variables. Variables not listed in Free are copied afresh for each call.
*/

:- module(lambda, [
    (^)/3, (^)/4, (^)/5, (^)/6, (^)/7, (^)/8, (^)/9, (^)/10,
    (\)/1, (\)/2, (\)/3, (\)/4, (\)/5, (\)/6, (\)/7, (\)/8,
    (+\)/2, (+\)/3, (+\)/4, (+\)/5, (+\)/6, (+\)/7, (+\)/8, (+\)/9
]).

% Scryer exports this operator from library(lambda). EyeProlog applies module
% operator directives while loading the library, so importing the module makes
% the same syntax available to the importing compilation unit and REPL state.
:- op(201, xfx, +\).

:- meta_predicate(^(?, 0, ?)).
:- meta_predicate(^(?, 1, ?, ?)).
:- meta_predicate(^(?, 2, ?, ?, ?)).
:- meta_predicate(^(?, 3, ?, ?, ?, ?)).
:- meta_predicate(^(?, 4, ?, ?, ?, ?, ?)).
:- meta_predicate(^(?, 5, ?, ?, ?, ?, ?, ?)).
:- meta_predicate(^(?, 6, ?, ?, ?, ?, ?, ?, ?)).
:- meta_predicate(^(?, 7, ?, ?, ?, ?, ?, ?, ?, ?)).
:- meta_predicate(\(0)).
:- meta_predicate(\(1, ?)).
:- meta_predicate(\(2, ?, ?)).
:- meta_predicate(\(3, ?, ?, ?)).
:- meta_predicate(\(4, ?, ?, ?, ?)).
:- meta_predicate(\(5, ?, ?, ?, ?, ?)).
:- meta_predicate(\(6, ?, ?, ?, ?, ?, ?)).
:- meta_predicate(\(7, ?, ?, ?, ?, ?, ?, ?)).
:- meta_predicate(+\(?, 0)).
:- meta_predicate(+\(?, 1, ?)).
:- meta_predicate(+\(?, 2, ?, ?)).
:- meta_predicate(+\(?, 3, ?, ?, ?)).
:- meta_predicate(+\(?, 4, ?, ?, ?, ?)).
:- meta_predicate(+\(?, 5, ?, ?, ?, ?, ?)).
:- meta_predicate(+\(?, 6, ?, ?, ?, ?, ?, ?)).
:- meta_predicate(+\(?, 7, ?, ?, ?, ?, ?, ?, ?)).

^(V1, C0, V1) :- lambda__no_hat_call(C0).
^(V1, C1, V1, V2) :- call(C1, V2).
^(V1, C2, V1, V2, V3) :- call(C2, V2, V3).
^(V1, C3, V1, V2, V3, V4) :- call(C3, V2, V3, V4).
^(V1, C4, V1, V2, V3, V4, V5) :- call(C4, V2, V3, V4, V5).
^(V1, C5, V1, V2, V3, V4, V5, V6) :- call(C5, V2, V3, V4, V5, V6).
^(V1, C6, V1, V2, V3, V4, V5, V6, V7) :- call(C6, V2, V3, V4, V5, V6, V7).
^(V1, C7, V1, V2, V3, V4, V5, V6, V7, V8) :- call(C7, V2, V3, V4, V5, V6, V7, V8).

\(FC0) :- copy_term(FC0, C0), lambda__no_hat_call(C0).
\(FC1, V1) :- copy_term(FC1, C1), call(C1, V1).
\(FC2, V1, V2) :- copy_term(FC2, C2), call(C2, V1, V2).
\(FC3, V1, V2, V3) :- copy_term(FC3, C3), call(C3, V1, V2, V3).
\(FC4, V1, V2, V3, V4) :- copy_term(FC4, C4), call(C4, V1, V2, V3, V4).
\(FC5, V1, V2, V3, V4, V5) :- copy_term(FC5, C5), call(C5, V1, V2, V3, V4, V5).
\(FC6, V1, V2, V3, V4, V5, V6) :- copy_term(FC6, C6), call(C6, V1, V2, V3, V4, V5, V6).
\(FC7, V1, V2, V3, V4, V5, V6, V7) :- copy_term(FC7, C7), call(C7, V1, V2, V3, V4, V5, V6, V7).

+\(GV, FC0) :- copy_term(GV+FC0, GV+C0), lambda__no_hat_call(C0).
+\(GV, FC1, V1) :- copy_term(GV+FC1, GV+C1), call(C1, V1).
+\(GV, FC2, V1, V2) :- copy_term(GV+FC2, GV+C2), call(C2, V1, V2).
+\(GV, FC3, V1, V2, V3) :- copy_term(GV+FC3, GV+C3), call(C3, V1, V2, V3).
+\(GV, FC4, V1, V2, V3, V4) :- copy_term(GV+FC4, GV+C4), call(C4, V1, V2, V3, V4).
+\(GV, FC5, V1, V2, V3, V4, V5) :- copy_term(GV+FC5, GV+C5), call(C5, V1, V2, V3, V4, V5).
+\(GV, FC6, V1, V2, V3, V4, V5, V6) :- copy_term(GV+FC6, GV+C6), call(C6, V1, V2, V3, V4, V5, V6).
+\(GV, FC7, V1, V2, V3, V4, V5, V6, V7) :- copy_term(GV+FC7, GV+C7), call(C7, V1, V2, V3, V4, V5, V6, V7).

lambda__no_hat_call(Goal) :-
    nonvar(Goal),
    Goal = (_^_),
    !,
    throw(error(existence_error(lambda_parameter, Goal), _)).
lambda__no_hat_call(Goal) :- call(Goal).
