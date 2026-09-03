:- set_prolog_flag(unknown, fail).

%% goal: answer(X0)

p(a).
r(c).
answer(ok) :- \+ q(a), \+ r(b).
