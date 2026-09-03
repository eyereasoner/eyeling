% From The Art of EyeProlog, Chapter 24 — Existence, one witness, and all witnesses.
:- use_module(library(lists)).

reachable(From, To).
once(simple_path(From, To, Path)).
findall(Path, simple_path(From, To, Path), Paths).
