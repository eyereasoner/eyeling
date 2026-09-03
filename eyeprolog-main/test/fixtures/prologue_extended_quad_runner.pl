:- use_module(library(prologue)).

same2(X, X).
same3(X, X, X).
same4(X, X, X, X).
same5(X, X, X, X, X).
same6(X, X, X, X, X, X).
same7(X, X, X, X, X, X, X).

add2(X, Y, S0, S) :- S is S0 + X + Y.
add3(X, Y, Z, S0, S) :- S is S0 + X + Y + Z.

:- include('prologue_extended_quad.pl').
