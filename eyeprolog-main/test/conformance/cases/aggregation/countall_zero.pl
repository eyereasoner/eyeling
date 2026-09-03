:- set_prolog_flag(unknown, fail).

%% goal: answer(X0)

answer(N) :- countall(missing(X), N).
