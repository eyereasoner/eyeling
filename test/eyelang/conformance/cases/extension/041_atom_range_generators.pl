% SPEC 9.5: atom range helpers generate prefixed atoms deterministically.
answer(single, X) :- atom_range(n, 2, 4, X).
answer(multiple, X) :- atom_ranges([a, b], 1, 2, X).
answer(bound_check, yes) :- atom_range(n, 2, 4, n3).
materialize(answer, 2).
