score(alpha, 7).
score(beta, 7).
score(gamma, 5).
answer(max, result(Key, BestName)) :- aggregate_max([S, Name], Name, score(Name, S), Key, BestName).
materialize(answer, 2).
