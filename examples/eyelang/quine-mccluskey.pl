% Eyelet-inspired Quine-McCluskey minimization using findall/3 and sort/2.
% Problem: f(A,B,C,D) = Sigma m(1,3,7,11,15) + d(0,2,5).

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(primeImplicants, 2).
materialize(minimalCover, 2).
materialize(equation, 2).
materialize(reason, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
minterm(1).
minterm(3).
minterm(7).
minterm(11).
minterm(15).

dont_care(0).
dont_care(2).
dont_care(5).

bits(0, [0, 0, 0, 0]).
bits(1, [0, 0, 0, 1]).
bits(2, [0, 0, 1, 0]).
bits(3, [0, 0, 1, 1]).
bits(4, [0, 1, 0, 0]).
bits(5, [0, 1, 0, 1]).
bits(6, [0, 1, 1, 0]).
bits(7, [0, 1, 1, 1]).
bits(8, [1, 0, 0, 0]).
bits(9, [1, 0, 0, 1]).
bits(10, [1, 0, 1, 0]).
bits(11, [1, 0, 1, 1]).
bits(12, [1, 1, 0, 0]).
bits(13, [1, 1, 0, 1]).
bits(14, [1, 1, 1, 0]).
bits(15, [1, 1, 1, 1]).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
initial_pattern(P) :- minterm(M), bits(M, P).
initial_pattern(P) :- dont_care(D), bits(D, P).

combine(A, B, R) :-
  diff_count(A, B, 0, 1, [], Rev),
  reverse(Rev, R).

diff_count([], [], Count, Count, Acc, Acc).
diff_count([X | A], [X | B], Count, Max, Acc, R) :-
  diff_count(A, B, Count, Max, [X | Acc], R).
diff_count([X | A], [Y | B], Count, Max, Acc, R) :-
  neq(X, Y),
  add(Count, 1, Next),
  le(Next, Max),
  diff_count(A, B, Next, Max, [x | Acc], R).

combined_once(P) :-
  initial_pattern(A),
  initial_pattern(B),
  combine(A, B, P).

combined_twice(P) :-
  combined_once(A),
  combined_once(B),
  combine(A, B, P).

used_initial(P) :-
  initial_pattern(Q),
  combine(P, Q, _R).

used_once(P) :-
  combined_once(Q),
  combine(P, Q, _R).

prime(P) :-
  initial_pattern(P),
  not(used_initial(P)).
prime(P) :-
  combined_once(P),
  not(used_once(P)).
prime(P) :-
  combined_twice(P).

prime_implicants(Primes) :-
  minterms(Minterms),
  dont_cares(DontCares),
  bit_table(Bits),
  qm_prime_implicants(Minterms, DontCares, Bits, Primes).

covers([], []).
covers([x | Pattern], [_Bit | Bits]) :-
  covers(Pattern, Bits).
covers([Bit | Pattern], [Bit | Bits]) :-
  neq(Bit, x),
  covers(Pattern, Bits).

covers_int(Pattern, Int) :-
  bits(Int, Bits),
  covers(Pattern, Bits).

covers_all(_Cover, []).
covers_all(Cover, [M | Minterms]) :-
  member(P, Cover),
  covers_int(P, M),
  covers_all(Cover, Minterms).

minterms(Minterms) :-
  findall(M, minterm(M), Raw),
  sort(Raw, Minterms).

dont_cares(DontCares) :-
  findall(D, dont_care(D), Raw),
  sort(Raw, DontCares).

bit_table(Bits) :-
  findall(bit(N, Pattern), bits(N, Pattern), Bits).

pair_from([A | Rest], A, B) :-
  member(B, Rest).
pair_from([_Head | Rest], A, B) :-
  pair_from(Rest, A, B).

cover_candidate(Cover) :-
  prime_implicants(Primes),
  pair_from(Primes, A, B),
  sort([A, B], Cover),
  minterms(Minterms),
  covers_all(Cover, Minterms).

minimal_cover(Cover) :-
  minterms(Minterms),
  dont_cares(DontCares),
  bit_table(Bits),
  qm_minimal_cover(Minterms, DontCares, Bits, Cover).

primeImplicants(quine_mccluskey, Primes) :-
  prime_implicants(Primes).

minimalCover(quine_mccluskey, Cover) :-
  minimal_cover(Cover).

equation(quine_mccluskey, "f = ~A~B + CD") :-
  minimal_cover([[0, 0, x, x], [x, x, 1, 1]]).

reason(quine_mccluskey, "findall builds implicant sets and sort removes duplicates before cover selection").
