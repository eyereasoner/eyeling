% Chandy-Misra dining philosophers trace adapted from Eyeling dining-philosophers.n3.
% Requests and sends are derived; KeepFork facts copy forks that are not sent.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(dp_type, 2).
materialize(dp_in, 2).
materialize(dp_from, 2).
materialize(dp_to, 2).
materialize(dp_fork, 2).
materialize(dp_philosopher, 2).
materialize(dp_mealNo, 2).
materialize(dp_inSlot, 2).
materialize(dp_usesFork, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
left_fork(dp_P1, dp_F51). right_fork(dp_P1, dp_F12).
left_fork(dp_P2, dp_F12). right_fork(dp_P2, dp_F23).
left_fork(dp_P3, dp_F23). right_fork(dp_P3, dp_F34).
left_fork(dp_P4, dp_F34). right_fork(dp_P4, dp_F45).
left_fork(dp_P5, dp_F45). right_fork(dp_P5, dp_F51).

slot(dp_C0, dp_s1, 1). after_sends(dp_C0, dp_C1). after_eat(dp_C1, dp_C2).
slot(dp_C2, dp_s2, 1). after_sends(dp_C2, dp_C3). after_eat(dp_C3, dp_C4).
slot(dp_C4, dp_s3, 1). after_sends(dp_C4, dp_C5). after_eat(dp_C5, dp_C6).
slot(dp_C6, dp_s4, 2). after_sends(dp_C6, dp_C7). after_eat(dp_C7, dp_C8).
slot(dp_C8, dp_s5, 2). after_sends(dp_C8, dp_C9). after_eat(dp_C9, dp_C10).
slot(dp_C10, dp_s6, 2). after_sends(dp_C10, dp_C11). after_eat(dp_C11, dp_C12).
slot(dp_C12, dp_s7, 3). after_sends(dp_C12, dp_C13). after_eat(dp_C13, dp_C14).
slot(dp_C14, dp_s8, 3). after_sends(dp_C14, dp_C15). after_eat(dp_C15, dp_C16).
slot(dp_C16, dp_s9, 3). after_sends(dp_C16, dp_C17). after_eat(dp_C17, dp_C18).

hungry(dp_C0, dp_P1). hungry(dp_C0, dp_P3).
hungry(dp_C2, dp_P2). hungry(dp_C2, dp_P4).
hungry(dp_C4, dp_P5).
hungry(dp_C6, dp_P1). hungry(dp_C6, dp_P3).
hungry(dp_C8, dp_P2). hungry(dp_C8, dp_P4).
hungry(dp_C10, dp_P5).
hungry(dp_C12, dp_P1). hungry(dp_C12, dp_P3).
hungry(dp_C14, dp_P2). hungry(dp_C14, dp_P4).
hungry(dp_C16, dp_P5).

start_state(dp_C0, dp_F12, dp_P1, dp_Dirty).
start_state(dp_C0, dp_F23, dp_P2, dp_Dirty).
start_state(dp_C0, dp_F34, dp_P3, dp_Dirty).
start_state(dp_C0, dp_F45, dp_P4, dp_Dirty).
start_state(dp_C0, dp_F51, dp_P1, dp_Dirty).
start_state(dp_C2, dp_F12, dp_P1, dp_Dirty).
start_state(dp_C2, dp_F23, dp_P3, dp_Dirty).
start_state(dp_C2, dp_F34, dp_P3, dp_Dirty).
start_state(dp_C2, dp_F45, dp_P4, dp_Dirty).
start_state(dp_C2, dp_F51, dp_P1, dp_Dirty).
start_state(dp_C4, dp_F12, dp_P2, dp_Dirty).
start_state(dp_C4, dp_F23, dp_P2, dp_Dirty).
start_state(dp_C4, dp_F34, dp_P4, dp_Dirty).
start_state(dp_C4, dp_F45, dp_P4, dp_Dirty).
start_state(dp_C4, dp_F51, dp_P1, dp_Dirty).
start_state(dp_C6, dp_F12, dp_P2, dp_Dirty).
start_state(dp_C6, dp_F23, dp_P2, dp_Dirty).
start_state(dp_C6, dp_F34, dp_P4, dp_Dirty).
start_state(dp_C6, dp_F45, dp_P5, dp_Dirty).
start_state(dp_C6, dp_F51, dp_P5, dp_Dirty).
start_state(dp_C8, dp_F12, dp_P1, dp_Dirty).
start_state(dp_C8, dp_F23, dp_P3, dp_Dirty).
start_state(dp_C8, dp_F34, dp_P3, dp_Dirty).
start_state(dp_C8, dp_F45, dp_P5, dp_Dirty).
start_state(dp_C8, dp_F51, dp_P1, dp_Dirty).
start_state(dp_C10, dp_F12, dp_P2, dp_Dirty).
start_state(dp_C10, dp_F23, dp_P2, dp_Dirty).
start_state(dp_C10, dp_F34, dp_P4, dp_Dirty).
start_state(dp_C10, dp_F45, dp_P4, dp_Dirty).
start_state(dp_C10, dp_F51, dp_P1, dp_Dirty).
start_state(dp_C12, dp_F12, dp_P2, dp_Dirty).
start_state(dp_C12, dp_F23, dp_P2, dp_Dirty).
start_state(dp_C12, dp_F34, dp_P4, dp_Dirty).
start_state(dp_C12, dp_F45, dp_P5, dp_Dirty).
start_state(dp_C12, dp_F51, dp_P5, dp_Dirty).
start_state(dp_C14, dp_F12, dp_P1, dp_Dirty).
start_state(dp_C14, dp_F23, dp_P3, dp_Dirty).
start_state(dp_C14, dp_F34, dp_P3, dp_Dirty).
start_state(dp_C14, dp_F45, dp_P5, dp_Dirty).
start_state(dp_C14, dp_F51, dp_P1, dp_Dirty).
start_state(dp_C16, dp_F12, dp_P2, dp_Dirty).
start_state(dp_C16, dp_F23, dp_P2, dp_Dirty).
start_state(dp_C16, dp_F34, dp_P4, dp_Dirty).
start_state(dp_C16, dp_F45, dp_P4, dp_Dirty).
start_state(dp_C16, dp_F51, dp_P1, dp_Dirty).
keep(dp_C0, dp_F12). keep(dp_C0, dp_F34). keep(dp_C0, dp_F45). keep(dp_C0, dp_F51).
keep(dp_C2, dp_F45). keep(dp_C2, dp_F51).
keep(dp_C4, dp_F12). keep(dp_C4, dp_F23). keep(dp_C4, dp_F34).
keep(dp_C6, dp_F45).
keep(dp_C8, dp_F51).
keep(dp_C10, dp_F12). keep(dp_C10, dp_F23). keep(dp_C10, dp_F34).
keep(dp_C12, dp_F45).
keep(dp_C14, dp_F51).
keep(dp_C16, dp_F12). keep(dp_C16, dp_F23). keep(dp_C16, dp_F34).

meal_handle(dp_P1, 1, dp_mP1_1). meal_handle(dp_P1, 2, dp_mP1_2). meal_handle(dp_P1, 3, dp_mP1_3).
meal_handle(dp_P2, 1, dp_mP2_1). meal_handle(dp_P2, 2, dp_mP2_2). meal_handle(dp_P2, 3, dp_mP2_3).
meal_handle(dp_P3, 1, dp_mP3_1). meal_handle(dp_P3, 2, dp_mP3_2). meal_handle(dp_P3, 3, dp_mP3_3).
meal_handle(dp_P4, 1, dp_mP4_1). meal_handle(dp_P4, 2, dp_mP4_2). meal_handle(dp_P4, 3, dp_mP4_3).
meal_handle(dp_P5, 1, dp_mP5_1). meal_handle(dp_P5, 2, dp_mP5_2). meal_handle(dp_P5, 3, dp_mP5_3).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
request(C, P, Q, F) :-
  hungry(C, P), left_fork(P, F), start_state(C, F, Q, _Cleanliness), neq(Q, P).
request(C, P, Q, F) :-
  hungry(C, P), right_fork(P, F), start_state(C, F, Q, _Cleanliness), neq(Q, P).

send_fork(C, Q, P, F) :-
  request(C, P, Q, F), start_state(C, F, Q, dp_Dirty).

after_send_state(CS, F, P, dp_Clean) :-
  after_sends(C, CS), send_fork(C, _Q, P, F).
after_send_state(CS, F, H, Cleanliness) :-
  after_sends(C, CS), keep(C, F), start_state(C, F, H, Cleanliness).

meal(M, P, N, S) :-
  after_sends(C, CS), slot(C, S, N), hungry(C, P), meal_handle(P, N, M),
  left_fork(P, LF), right_fork(P, RF),
  after_send_state(CS, LF, P, _LeftCleanliness),
  after_send_state(CS, RF, P, _RightCleanliness).

dp_type(request(C, P, Q, F), dp_Request) :- request(C, P, Q, F).
dp_in(request(C, P, Q, F), C) :- request(C, P, Q, F).
dp_from(request(C, P, Q, F), P) :- request(C, P, Q, F).
dp_to(request(C, P, Q, F), Q) :- request(C, P, Q, F).
dp_fork(request(C, P, Q, F), F) :- request(C, P, Q, F).

dp_type(send(C, Q, P, F), dp_SendFork) :- send_fork(C, Q, P, F).
dp_in(send(C, Q, P, F), C) :- send_fork(C, Q, P, F).
dp_from(send(C, Q, P, F), Q) :- send_fork(C, Q, P, F).
dp_to(send(C, Q, P, F), P) :- send_fork(C, Q, P, F).
dp_fork(send(C, Q, P, F), F) :- send_fork(C, Q, P, F).

dp_type(M, dp_Meal) :- meal(M, _P, _N, _S).
dp_philosopher(M, P) :- meal(M, P, _N, _S).
dp_mealNo(M, N) :- meal(M, _P, N, _S).
dp_inSlot(M, S) :- meal(M, _P, _N, S).
dp_usesFork(M, LF) :- meal(M, P, _N, _S), left_fork(P, LF).
dp_usesFork(M, RF) :- meal(M, P, _N, _S), right_fork(P, RF).
