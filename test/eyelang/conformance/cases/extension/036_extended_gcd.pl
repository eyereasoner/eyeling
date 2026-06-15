% SPEC 9.2: extended_gcd/5 returns gcd and Bezout coefficients.
answer(gcd, result(G, S, T)) :- extended_gcd(240, 46, G, S, T).
materialize(answer, 2).
