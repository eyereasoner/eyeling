% From The Art of EyeProlog, Chapter 40 — Embedded quad tests.
color(red).
color(green).

colors ?- color(X).
   X = red
;  X = green.

?- color(blue).
   false.
