% p.p.1 member/2

?- member(X, [1,2]).
   X = 1
;  X = 2.

?- member(1, L).
   L = [1|_]
;  L = [_,1|_]
;  L = [_,_,1|_]
;  ... . % Ad infinitum.

?- member(X, [Y,Z|nonlist]).
   X = Y
;  X = Z.

?- member(X, nonlist).
   false.

?- member(X, X).
   sto,  % undefined, STO 7.3.3
   true
|  sto,
   loops.

% p.p.2 append/3

?- append([a,b],[c,d], Xs).
   Xs = [a,b,c,d].

?- append([a], nonlist, Xs).
   Xs = [a|nonlist].

?- append([a], Ys, Zs).
   Zs = [a|Ys].

?- append(Xs, Ys, [a,b,c]).
   Xs = [], Ys = [a,b,c]
;  Xs = [a], Ys = [b,c]
;  Xs = [a,b], Ys = [c]
;  Xs = [a,b,c], Ys = [].

% p.p.3 length/2

?- length([a,b,c], Length).
   Length = 3.

?- length(List, 5).
   List = [_,_,_,_,_].

?- length(List, Length).
   List = [], Length = 0
;  List = [_], Length = 1
;  List = [_,_], Length = 2
;  ... . % Ad infinitum.

% p.p.4 between/3

?- between(1, 2, 0).
   false.

?- between(1, 2, I).
   I = 1
;  I = 2.

?- between(2, 1, I).
   false.

?- between(I, I, 0).
   instantiation_error.

?- between(1, I, 0).
   instantiation_error.

?- between(I, -1, 0).
   instantiation_error.

?- between(1, c, 0).
   type_error(integer,c).

?- between(1+1,2,I).
   type_error(integer,1+1).

% p.p.5 select/3

?- select(X, [1,2], Xs).
   X = 1, Xs = [2]
;  X = 2, Xs = [1].

?- select(X, [Y|nonlist], Xs).
   X = Y, Xs = nonlist.

?- select(E, Xs, Xs).
   sto.

% p.p.6 succ/2

?- succ(X, S).
   instantiation_error.

?- succ(X, X).
   instantiation_error.

?- succ(0, S).
   S = 1.

?- succ(1, 1+1).
   type_error(integer, 1+1).

?- succ(X, 0).
   false.

?- succ(-1, S).
   domain_error(not_less_than_zero, -1).

?- current_prolog_flag(max_integer, Max),
   ( integer(Max) -> succ(Max, S) ; true ).
   evaluation_error(int_overflow)
|  Max = unbounded.

% p.p.7

?- maplist(>(3), [1, 2]).
   true.

?- maplist(>(3), [1, 2, 3]).
   false.

?- maplist(=(X), Xs).
   Xs = []
;  Xs = [X]
;  Xs = [X, X]
;  Xs = [X, X, X]
;  ... . % Ad infinitum.
