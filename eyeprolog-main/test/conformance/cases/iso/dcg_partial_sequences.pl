% Part 3 phrase/3 accepts partial terminal sequences and preserves their tail.
%% goal: partial_sequence(X0)

partial_sequence(one) :-
    phrase([a], [a|Tail], Tail),
    Tail = [rest].
partial_sequence(two) :-
    phrase([a, b], [a, b|Tail], Tail),
    Tail = [rest].
partial_sequence(empty) :-
    phrase([], Tail, Tail),
    Tail = [rest].
