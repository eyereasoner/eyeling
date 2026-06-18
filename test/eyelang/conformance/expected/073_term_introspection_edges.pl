answer(functor_atom, pair(alpha, 0)).
answer(functor_number, pair(42, 0)).
answer(functor_string, pair("hi", 0)).
answer(arg_nested, edge(a, b)).
answer(compose_nested, outer(inner(a), [b, c])).
answer(decompose_zero, pair(z, [])).
answer(arg_zero_rejected, ok).
answer(arg_too_large_rejected, ok).
