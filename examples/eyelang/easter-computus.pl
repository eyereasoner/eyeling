% Adapted from Eyeling's easter.n3.
% Gregorian computus for a sample decade, with independent range/window checks.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(easterDate, 2).
materialize(computusRemainders, 2).
materialize(legalGregorianWindow, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Sample years for which the computed Easter date is materialized.
case(y2026, 2026).
case(y2027, 2027).
case(y2028, 2028).
case(y2029, 2029).
case(y2030, 2030).
case(y2031, 2031).
case(y2032, 2032).
case(y2033, 2033).
case(y2034, 2034).
case(y2035, 2035).

% These checks document the legal ranges of intermediate computus values.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
valid_golden(N) :- between(0, 18, N).
valid_epact(N) :- between(0, 29, N).
valid_weekday(N) :- between(0, 6, N).
legal_easter_date(3, D) :- between(22, 31, D).
legal_easter_date(4, D) :- between(1, 25, D).
month_name(3, march).
month_name(4, april).

% Butcher/Meeus-style integer arithmetic, kept explicit for proof readability.
computus(Case, Year, Month, Day, J, K, Q, R, V, Z) :-
  case(Case, Year),
  mod(Year, 19, J),
  div(Year, 100, K),
  mod(Year, 100, H),
  div(K, 4, M),
  mod(K, 4, N),
  add(K, 8, KP8),
  div(KP8, 25, P),
  sub(K, P, KminusP),
  add(KminusP, 1, KminusPplus1),
  div(KminusPplus1, 3, Q),
  mul(19, J, NineteenJ),
  add(NineteenJ, K, T1),
  sub(T1, M, T2),
  sub(T2, Q, T3),
  add(T3, 15, T4),
  mod(T4, 30, R),
  div(H, 4, S),
  mod(H, 4, U),
  mul(2, N, TwoN),
  mul(2, S, TwoS),
  add(32, TwoN, L1),
  add(L1, TwoS, L2),
  sub(L2, R, L3),
  sub(L3, U, L4),
  mod(L4, 7, V),
  mul(11, R, ElevenR),
  mul(22, V, TwentyTwoV),
  add(J, ElevenR, W1),
  add(W1, TwentyTwoV, W2),
  div(W2, 451, W),
  mul(7, W, SevenW),
  add(R, V, X1),
  sub(X1, SevenW, X2),
  add(X2, 114, X3),
  div(X3, 31, Month),
  mod(X3, 31, Z),
  add(Z, 1, Day).

checks_pass(Case) :-
  computus(Case, _Year, Month, Day, J, _K, _Q, R, V, _Z),
  valid_golden(J),
  valid_epact(R),
  valid_weekday(V),
  month_name(Month, _Name),
  legal_easter_date(Month, Day).

easterDate(Case, date(Year, MonthName, Day)) :-
  computus(Case, Year, Month, Day, _J, _K, _Q, _R, _V, _Z),
  month_name(Month, MonthName).

computusRemainders(Case, remainders(J, R, V)) :-
  computus(Case, _Year, _Month, _Day, J, _K, _Q, R, V, _Z).

legalGregorianWindow(Case, true) :-
  checks_pass(Case).
