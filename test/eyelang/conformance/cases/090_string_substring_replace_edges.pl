% Reference 9.6: substring and replace have finite boundary behavior.
materialize(answer, 2).
answer(prefix, X) :- substring("eyelang", 0, 3, X).
answer(middle, X) :- substring("eyelang", 3, 2, X).
answer(suffix, X) :- substring("eyelang", 5, 2, X).
answer(empty_at_end, X) :- substring("eyelang", 7, 0, X).
answer(out_of_range_rejected, ok) :- not(substring("eyelang", 6, 2, X)).
answer(replace_all, X) :- replace("banana", "na", "NA", X).
answer(replace_missing, X) :- replace("banana", "x", "y", X).
