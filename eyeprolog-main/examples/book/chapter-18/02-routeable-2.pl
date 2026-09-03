% From The Art of EyeProlog, Chapter 18.
:- use_module(library(lists)).

routeable(Parcel, Hub) :-
  destination_zone(Parcel, Zone),
  serves(Hub, Zone),
  package_class(Parcel, Class),
  accepts(Hub, Class).
