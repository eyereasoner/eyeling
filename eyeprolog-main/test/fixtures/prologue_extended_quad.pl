% Finite examples and arity coverage for Prologue p.p.7 through p.p.11.

?- maplist(same2, [a], [a]).
   true.
?- maplist(same3, [a], [a], [a]).
   true.
?- maplist(same4, [a], [a], [a], [a]).
   true.
?- maplist(same5, [a], [a], [a], [a], [a]).
   true.
?- maplist(same6, [a], [a], [a], [a], [a], [a]).
   true.
?- maplist(same7, [a], [a], [a], [a], [a], [a], [a]).
   true.

?- nth0(1, [a,b,c], E).
   E = b.
?- nth0(N, [a,b,c], E).
   N = 0, E = a
;  N = 1, E = b
;  N = 2, E = c.
?- nth0(0, [A,B|non_list], E).
   A = E.
?- nth0(2, Es, E).
   Es = [_A,_B,E|_C].
?- nth0(N, Es, E).
   N = 0, Es = [E|_A]
;  N = 1, Es = [_A,E|_B]
;  N = 2, Es = [_A,_B,E|_C]
;  N = 3, Es = [_A,_B,_C,E|_D]
;  ... .
?- nth0(non_integer, Es, E).
   type_error(integer, non_integer).
?- nth0(-1, Es, E).
   domain_error(not_less_than_zero, -1).
?- nth0(N, [[]|Es], Es).
   N = 0, Es = []
;  sto, loops.
?- nth0(1, [a,b,c], E, Es).
   E = b, Es = [a,c].
?- nth1(0, Es, E).
   false.
?- nth1(2, [a,b,c], E, Es).
   E = b, Es = [a,c].

?- call_nth(N = 1, N).
   N = 1.
?- call_nth(N = -1, N).
   false.
?- call_nth(repeat, 1+1).
   type_error(integer, 1+1).
?- call_nth(inex, 0).
   existence_error(procedure, _), unexpected.
?- call_nth(G, non_integer).
   instantiation_error.
?- call_nth(1, -1).
   type_error(callable, 1).

?- foldl(append, [[1,2],[3],[4,5]], [], Xs).
   Xs = [4,5,3,1,2].
?- foldl(add2, [1,2], [10,20], 0, S).
   S = 33.
?- foldl(add3, [1,2], [10,20], [100,200], 0, S).
   S = 333.

?- countall((X=1;X=2), N).
   N = 2.
?- countall((true;true), N).
   N = 2.
?- countall(G, N).
   instantiation_error.
?- countall((length(L,5),nth0(_,L,_),nth0(_,L,_)), N).
   N = 25.
?- countall(N=1, N).
   N = 1.
?- countall(N=non_integer, N).
   N = 1.
?- countall(false, 1).
   false.
?- countall(false, -1).
   domain_error(not_less_than_zero, -1).
?- countall(false, non_integer).
   type_error(integer, non_integer).
?- countall(G, -1).
   domain_error(not_less_than_zero, -1).
?- countall(1, -1).
   domain_error(not_less_than_zero, -1).
