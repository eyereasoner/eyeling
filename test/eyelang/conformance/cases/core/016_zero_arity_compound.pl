% SPEC 4, 5.3: zero-arity compounds are written and matched with parentheses.
status(nil(), ok).
answer(value, X) :- status(X, ok).
materialize(answer, 2).
