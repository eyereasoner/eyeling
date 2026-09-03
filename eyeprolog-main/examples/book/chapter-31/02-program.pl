% From The Art of EyeProlog, Chapter 31.
unexpected_path :-
  path(a, d).

expected_absence :-
  \+ unexpected_path.
