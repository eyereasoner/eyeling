% From The Art of EyeProlog, Chapter 40.
?- dif(X,Y), X = a.
   true, unexpected.
   X = a, unexpected.
   X = a, maybe.
   maybe, unexpected.
