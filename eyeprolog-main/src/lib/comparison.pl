/** Portable comparison relations. */

:- module(comparison, [lt/2, gt/2, le/2, ge/2]).

% Numeric values and numeric text compare numerically, ISO durations compare
% component-wise, and all other values use standard term order.

% ---------- text representation helpers ----------

comparison__char_list([]).
comparison__char_list([C|Cs]) :- atom(C), atom_length(C, 1), comparison__char_list(Cs).

comparison__text_chars(Text, []) :- nonvar(Text), Text = [], !.
comparison__text_chars(Text, Chars) :-
    atom(Text),
    atom_chars(Text, Chars).
comparison__text_chars(Text, Chars) :-
    nonvar(Text),
    comparison__char_list(Text),
    Text = Chars.
comparison__text_chars(Text, Chars) :-
    var(Text),
    atom_chars(Text, Chars).

comparison__atomic_chars(Value, []) :- nonvar(Value), Value = [], !.
comparison__atomic_chars(Value, Chars) :-
    atom(Value),
    atom_chars(Value, Chars).
comparison__atomic_chars(Value, Chars) :-
    number(Value),
    number_chars(Value, Chars).
comparison__atomic_chars(Value, Chars) :-
    nonvar(Value),
    comparison__char_list(Value),
    Value = Chars.

% ---------- core helpers ----------

comparison__append([], Ys, Ys).
comparison__append([X|Xs], Ys, [X|Zs]) :- comparison__append(Xs, Ys, Zs).

comparison__member(X, [X|_]).
comparison__member(X, [_|Xs]) :- comparison__member(X, Xs).

% ---------- arithmetic helpers ----------

comparison__atom_number(Text, Number) :-
    comparison__text_chars(Text, Chars),
    catch(number_chars(Number, Chars), _, fail).

comparison__duration(Text, Years, Months, Days) :-
    comparison__text_chars(Text, ['P'|Chars]),
    Chars \= [],
    comparison__duration_fields(Chars, 0, 0, 0, Years, Months, Days).

comparison__duration_fields([], Y, M, D, Y, M, D).
comparison__duration_fields(Chars, Y0, M0, D0, Y, M, D) :-
    comparison__duration_field(Chars, Digits, Unit, Rest),
    Digits \= [],
    number_chars(N, Digits),
    comparison__duration_assign(Unit, N, Y0, M0, D0, Y1, M1, D1),
    comparison__duration_fields(Rest, Y1, M1, D1, Y, M, D).

comparison__duration_field([C|Cs], [C|Ds], Unit, Rest) :-
    char_code(C, Code), Code >= 48, Code =< 57,
    comparison__duration_field(Cs, Ds, Unit, Rest).
comparison__duration_field([Unit|Rest], [], Unit, Rest) :-
    comparison__member(Unit, ['Y', 'M', 'D']).

comparison__duration_assign('Y', N, 0, M, D, N, M, D).
comparison__duration_assign('M', N, Y, 0, D, Y, N, D).
comparison__duration_assign('D', N, Y, M, 0, Y, M, N).

comparison__duration_compare(A, B, Cmp) :-
    comparison__duration(A, AY, AM, AD),
    comparison__duration(B, BY, BM, BD),
    comparison__triple_compare(AY, AM, AD, BY, BM, BD, Cmp).

comparison__triple_compare(A, _, _, B, _, _, -1) :- A < B.
comparison__triple_compare(A, _, _, B, _, _, 1) :- A > B.
comparison__triple_compare(A, C, _, A, D, _, -1) :- C < D.
comparison__triple_compare(A, C, _, A, D, _, 1) :- C > D.
comparison__triple_compare(A, C, E, A, C, F, -1) :- E < F.
comparison__triple_compare(A, C, E, A, C, F, 1) :- E > F.
comparison__triple_compare(A, C, E, A, C, E, 0).

comparison__compare(A, B, Cmp) :-
    number(A), number(B), !,
    comparison__number_compare(A, B, Cmp).
comparison__compare(A, B, Cmp) :-
    comparison__atom_number(A, AN), comparison__atom_number(B, BN), !,
    comparison__number_compare(AN, BN, Cmp).
comparison__compare(A, B, Cmp) :-
    comparison__duration_compare(A, B, Cmp), !.
comparison__compare(A, B, -1) :- A @< B.
comparison__compare(A, B, 1) :- A @> B.
comparison__compare(A, A, 0).

comparison__number_compare(A, B, -1) :- A < B.
comparison__number_compare(A, B, 1) :- A > B.
comparison__number_compare(A, B, 0) :- A =:= B.

lt(A, B) :- comparison__compare(A, B, -1).
gt(A, B) :- comparison__compare(A, B, 1).
le(A, B) :- comparison__compare(A, B, C), C =< 0.
ge(A, B) :- comparison__compare(A, B, C), C >= 0.

