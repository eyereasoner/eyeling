/** Integer arithmetic helpers used by Scryer's CLP(Z) source. */

:- module(arithmetic, [
    expmod/4,
    lcm/3,
    lsb/2,
    msb/2,
    number_to_rational/2,
    number_to_rational/3,
    popcount/2,
    rational_numerator_denominator/3
]).

:- use_module(library(error), [must_be/2, domain_error/3]).



% Scryer-compatible modular exponentiation and least common multiple.
expmod(Base, Expo, Mod, Result) :-
    must_be(integer, Base),
    must_be(integer, Expo),
    must_be(integer, Mod),
    ( Expo < 0 -> domain_error(not_less_than_zero, Expo, expmod/4)
    ; arithmetic__expmod(Base, Expo, Mod, 1, Result)
    ).

arithmetic__expmod(_, _, 1, _, 0) :- !.
arithmetic__expmod(_, 0, _, Result, Result) :- !.
arithmetic__expmod(Base0, Expo0, Mod, Acc0, Result) :-
    ( Expo0 /\ 1 =:= 1 -> Acc is (Acc0 * Base0) mod Mod ; Acc = Acc0 ),
    Expo is Expo0 >> 1,
    Base is (Base0 * Base0) mod Mod,
    arithmetic__expmod(Base, Expo, Mod, Acc, Result).

lcm(A, B, Lcm) :-
    must_be(integer, A),
    must_be(integer, B),
    ( A =:= 0, B =:= 0 -> Lcm = 0
    ; Lcm is abs(B) // gcd(A, B) * abs(A)
    ).

lsb(X, N) :-
    must_be(integer, X),
    ( X < 1 -> domain_error(not_less_than_one, X, lsb/2)
    ; Low is X /\ (-X), arithmetic__msb(Low, -1, N)
    ).

msb(X, N) :-
    must_be(integer, X),
    ( X < 1 -> domain_error(not_less_than_one, X, msb/2)
    ; Shifted is X >> 1, arithmetic__msb(Shifted, 0, N)
    ).

arithmetic__msb(0, N, N) :- !.
arithmetic__msb(X, N0, N) :-
    X1 is X >> 1,
    N1 is N0 + 1,
    arithmetic__msb(X1, N1, N).

popcount(X, Count) :-
    must_be(integer, X),
    ( X < 0 -> domain_error(not_less_than_zero, X, popcount/2)
    ; arithmetic__popcount(X, 0, Count)
    ).

arithmetic__popcount(0, Count, Count) :- !.
arithmetic__popcount(X, Count0, Count) :-
    Bit is X /\ 1,
    Count1 is Count0 + Bit,
    X1 is X >> 1,
    arithmetic__popcount(X1, Count1, Count).


% Rational-form compatibility. EyeProlog currently has integer and float
% processor values; non-integral results are represented canonically as the
% ordinary term rdiv(Numerator, Denominator).
number_to_rational(Number, Rational) :-
    eyeprolog__number_to_rational(Number, Rational).

number_to_rational(Epsilon, Number, Rational) :-
    eyeprolog__number_to_rational(Epsilon, Number, Rational).

rational_numerator_denominator(Rational, Numerator, Denominator) :-
    eyeprolog__rational_numerator_denominator(Rational, Numerator, Denominator).
