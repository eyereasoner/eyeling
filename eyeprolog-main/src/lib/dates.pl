/** Portable ISO date and duration relations. */

:- module(dates, [difference/3]).

% ---------- text representation helpers ----------

dates__char_list([]).
dates__char_list([C|Cs]) :- atom(C), atom_length(C, 1), dates__char_list(Cs).

dates__text_chars(Text, []) :- nonvar(Text), Text = [], !.
dates__text_chars(Text, Chars) :-
    atom(Text),
    atom_chars(Text, Chars).
dates__text_chars(Text, Chars) :-
    nonvar(Text),
    dates__char_list(Text),
    Text = Chars.
dates__text_chars(Text, Chars) :-
    var(Text),
    atom_chars(Text, Chars).

dates__atomic_chars(Value, []) :- nonvar(Value), Value = [], !.
dates__atomic_chars(Value, Chars) :-
    atom(Value),
    atom_chars(Value, Chars).
dates__atomic_chars(Value, Chars) :-
    number(Value),
    number_chars(Value, Chars).
dates__atomic_chars(Value, Chars) :-
    nonvar(Value),
    dates__char_list(Value),
    Value = Chars.

% ---------- core helpers ----------

dates__append([], Ys, Ys).
dates__append([X|Xs], Ys, [X|Zs]) :- dates__append(Xs, Ys, Zs).

dates__member(X, [X|_]).
dates__member(X, [_|Xs]) :- dates__member(X, Xs).


% ---------- dates ----------

difference(EndText, StartText, Duration) :-
    dates__date(EndText, EY0, EM0, ED0),
    dates__date(StartText, SY, SM, SD),
    dates__date_not_before(EY0, EM0, ED0, SY, SM, SD),
    dates__borrow_days(EY0, EM0, ED0, SD, EY1, EM1, ED1),
    dates__borrow_months(EY1, EM1, SM, EY2, EM2),
    Y is EY2 - SY,
    M is EM2 - SM,
    D is ED1 - SD,
    dates__format_duration(Y, M, D, Duration).

dates__date(Text, Y, M, D) :-
    dates__text_chars(Text, [Y1,Y2,Y3,Y4,'-',M1,M2,'-',D1,D2|_]),
    number_chars(Y, [Y1,Y2,Y3,Y4]),
    number_chars(M, [M1,M2]),
    number_chars(D, [D1,D2]),
    M >= 1, M =< 12,
    dates__days_in_month(Y, M, MaxD),
    D >= 1, D =< MaxD.

dates__date_not_before(EY, _, _, SY, _, _) :- EY > SY.
dates__date_not_before(Y, EM, _, Y, SM, _) :- EM > SM.
dates__date_not_before(Y, M, ED, Y, M, SD) :- ED >= SD.

dates__borrow_days(EY, EM, ED, SD, EY, EM, ED) :- ED >= SD.
dates__borrow_days(EY0, EM0, ED0, SD, EY, EM, ED) :-
    ED0 < SD,
    dates__previous_month(EY0, EM0, PY, PM),
    dates__days_in_month(PY, PM, Days),
    ED is ED0 + Days,
    EY = PY,
    EM = PM.

dates__borrow_months(EY, EM, SM, EY, EM) :- EM >= SM.
dates__borrow_months(EY0, EM0, SM, EY, EM) :-
    EM0 < SM,
    EY is EY0 - 1,
    EM is EM0 + 12.

dates__previous_month(Y, M, Y, PM) :- M > 1, PM is M - 1.
dates__previous_month(Y, 1, PY, 12) :- PY is Y - 1.

dates__days_in_month(Y, 2, 29) :- dates__leap_year(Y).
dates__days_in_month(Y, 2, 28) :- \+ dates__leap_year(Y).
dates__days_in_month(_, M, 30) :- dates__member(M, [4,6,9,11]).
dates__days_in_month(_, M, 31) :- dates__member(M, [1,3,5,7,8,10,12]).

dates__leap_year(Y) :- 0 is Y mod 400.
dates__leap_year(Y) :- Y mod 100 =\= 0, 0 is Y mod 4.

dates__format_duration(0, 0, 0, Duration) :-
    dates__text_chars(Duration, ['P','0','D']).
dates__format_duration(Y, M, D, Duration) :-
    Magnitude is abs(Y) + abs(M) + abs(D), Magnitude > 0,
    dates__duration_part(Y, 'Y', YC),
    dates__duration_part(M, 'M', MC),
    dates__duration_part(D, 'D', DC),
    dates__append(['P'|YC], MC, A),
    dates__append(A, DC, Chars),
    dates__text_chars(Duration, Chars).

dates__duration_part(0, _, []).
dates__duration_part(N, Unit, Chars) :-
    N =\= 0,
    number_chars(N, Digits),
    dates__append(Digits, [Unit], Chars).


