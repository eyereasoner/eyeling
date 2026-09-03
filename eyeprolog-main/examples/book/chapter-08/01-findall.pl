% From The Art of EyeProlog, Chapter 8.
:- use_module(library(aggregate)).
:- use_module(library(lists)).
:- use_module(library(iso_ext)).

findall(Template, Goal, List).
countall(Goal, Count).
sumall(Value, Goal, Sum).
