score(alpha, 7).
score(beta, 3).
score(gamma, 5).
answer(min, result(BestS, Best)) :- aggregate_min(S, item(Name, S), score(Name, S), BestS, Best).
materialize(answer, 2).
