% SPEC 9.6: atom and string built-ins.
answer(atom_concat, X) :- atom_concat(eye, lang, X).
answer(str_concat, X) :- str_concat("eye", "lang", X).
answer(contains, true) :- contains("eyelang", "lang").
answer(not_contains, true) :- not_contains("eyelang", "cat").
materialize(answer, 2).
