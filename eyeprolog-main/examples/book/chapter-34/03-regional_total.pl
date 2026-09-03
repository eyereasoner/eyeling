% From The Art of EyeProlog, Chapter 34.
:- use_module(library(lists)).

regional_total(Region, Total) :-
  bagof(Amount, Seller^sale(Region, Seller, Amount), Amounts),
  sum_amounts(Amounts, Total).
