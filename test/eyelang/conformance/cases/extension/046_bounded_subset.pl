% Reference 9.5: bounded_subset/7 enumerates subsets within budget and risk caps.
projects([p(a, 5, 3, 1), p(b, 4, 2, 2), p(c, 7, 5, 3)]).
answer(selection, result(Names, Value, Cost, Risk)) :- projects(Ps), bounded_subset(Ps, 5, 3, Names, Value, Cost, Risk).
materialize(answer, 2).
