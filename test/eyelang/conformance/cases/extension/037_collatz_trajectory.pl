% Reference 9.2: collatz_trajectory/2 returns the full path to 1.
answer(path, T) :- collatz_trajectory(6, T).
materialize(answer, 2).
