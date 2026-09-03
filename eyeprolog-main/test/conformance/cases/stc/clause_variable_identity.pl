% STC #37: clause/2 must preserve sharing between variables in head and body.
% https://www.complang.tuwien.ac.at/ulrich/iso-prolog/stc#37
%% goal: clause_variable_identity

a(X) :- b(X).

clause_variable_identity :-
  clause(a(A), b(B)),
  A == B.
