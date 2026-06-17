% Reference 9.2: goldbach_pair/3 enumerates prime decompositions in ascending first prime order.
answer(pair, pair(P, Q)) :- goldbach_pair(28, P, Q).
materialize(answer, 2).
