% Reference 9.6: atom and string built-ins.
answer(str_concat, X) :- str_concat("eye", "lang", X).
answer(contains, true) :- contains("eyelang", "lang").
materialize(answer, 2).
