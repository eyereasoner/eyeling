?- call_nth(true, Nth).
   Nth = 1.
?- call_nth(false, Nth).
   false.
?- call_nth(repeat, Nth).
   Nth = 1
;  Nth = 2
;  Nth = 3
;  Nth = 4
;  Nth = 5
;  ... .
?- call_nth(( N = 1 ; N = 2 ), Nth).
   N = 1, Nth = 1
;  N = 2, Nth = 2.
?- call_nth(true, non_integer).
   type_error(integer,non_integer).
?- call_nth(true, 1.0).
   type_error(integer,1.0).
?- call_nth(true, 0).
   false.
?- call_nth(repeat, 0).
   false.
?- call_nth(repeat, -1).
   domain_error(not_less_than_zero,-1).
?- call_nth(length(L,N), 3).
   L = [_A,_B], N = 2.
?- call_nth(inex, 0).
   false.
?- call_nth(1, 0).
   false.
?- call_nth(V, 0).
   false.
