% From The Art of EyeProlog, Chapter 33 — Pattern 2: Normalize at the boundary.
:- use_module(library(strings)).
:- use_module(library(lists)).

source_role(person_7, 'Doctor').

canonical_role(Person, clinician) :-
  source_role(Person, Text),
  lowercase(Text, doctor).
