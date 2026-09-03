% call//1 requires an instantiated callable closure at execution time.
invoke(Goal) --> call(Goal).
%% goal: phrase(invoke(Goal), [])
