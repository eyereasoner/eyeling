/** Portable integer prime helpers. */

:- module(primes, [smallest_divisor_from/3]).

smallest_divisor_from(N, Start, Divisor) :-
    N >= 0,
    Start > 0,
    primes__smallest_divisor_fast(N, Start, Divisor).

% A deterministic Miller-Rabin screen avoids long trial scans for prime values
% in the exact range covered by bases 2,3,5,7,11,13,17. Above that range the
% implementation falls back to exact trial division, preserving semantics for
% arbitrary-size integers.
primes__smallest_divisor_fast(N, _, N) :-
    N >= 2,
    N < 341550071728321,
    primes__mr_prime(N),
    !.
primes__smallest_divisor_fast(N, Start, Divisor) :-
    primes__smallest_divisor(N, Start, Divisor).

primes__smallest_divisor(N, Candidate, N) :- Candidate * Candidate > N.
primes__smallest_divisor(N, Candidate, Candidate) :-
    Candidate * Candidate =< N,
    0 is N mod Candidate.
primes__smallest_divisor(N, Candidate, Divisor) :-
    Candidate * Candidate =< N,
    N mod Candidate =\= 0,
    Next is Candidate + 1,
    primes__smallest_divisor(N, Next, Divisor).

primes__mr_prime(2).
primes__mr_prime(3).
primes__mr_prime(N) :-
    N > 3,
    1 is N mod 2,
    primes__factor_twos(N, S, D),
    primes__mr_bases([2,3,5,7,11,13,17], N, S, D).

primes__factor_twos(N, S, D) :-
    M is N - 1,
    primes__factor_twos_loop(M, 0, S, D).

primes__factor_twos_loop(D, S, S, D) :- 1 is D mod 2.
primes__factor_twos_loop(Value, S0, S, D) :-
    0 is Value mod 2,
    Next is Value // 2,
    S1 is S0 + 1,
    primes__factor_twos_loop(Next, S1, S, D).

primes__mr_bases([], _, _, _).
primes__mr_bases([A|As], N, S, D) :-
    ( A >= N -> true ; primes__mr_passes(A, N, S, D) ),
    primes__mr_bases(As, N, S, D).

primes__mr_passes(A, N, _, D) :-
    primes__pow_mod(A, D, N, X),
    ( X =:= 1 ; X =:= N - 1 ),
    !.
primes__mr_passes(A, N, S, D) :-
    primes__pow_mod(A, D, N, X),
    primes__mr_square_chain(X, N, 1, S).

primes__mr_square_chain(X, N, R, S) :-
    R < S,
    X1 is (X * X) mod N,
    ( X1 =:= N - 1
    ; R1 is R + 1,
      primes__mr_square_chain(X1, N, R1, S)
    ).

primes__pow_mod(_, 0, _, 1).
primes__pow_mod(Base, Exp, Mod, Result) :-
    Exp > 0,
    HalfExp is Exp // 2,
    primes__pow_mod(Base, HalfExp, Mod, Half),
    Square is (Half * Half) mod Mod,
    ( 0 is Exp mod 2 -> Result = Square ; Result is (Square * Base) mod Mod ).

