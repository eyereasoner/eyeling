% Deontic logic: obligations, prohibitions, compensations, and violations.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(violation, 2).
materialize(compensation, 2).
materialize(status, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Facts state what the actor was obliged/prohibited to do and what happened.
actor(alice).
action(share_record).
action(delete_unneeded_copy).

obliged(alice, obtain_consent).
prohibited(alice, share_record).
compensates(share_record, notify_dpo).

performed(alice, share_record).
performed(alice, notify_dpo).
not_performed(alice, obtain_consent).
not_performed(alice, delete_unneeded_copy).

% Missing an obligation and performing a prohibited action are both violations.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
violation(Actor, missed_obligation(Action)) :-
  obliged(Actor, Action),
  not_performed(Actor, Action).

violation(Actor, prohibited_action(Action)) :-
  prohibited(Actor, Action),
  performed(Actor, Action).

% Some prohibited actions can be repaired by a configured compensation action.
compensated_violation(Actor, Action, Compensation) :-
  prohibited(Actor, Action),
  performed(Actor, Action),
  compensates(Action, Compensation),
  performed(Actor, Compensation).

uncompensated_violation(Actor, missed_obligation(Action)) :-
  violation(Actor, missed_obligation(Action)).

uncompensated_violation(Actor, prohibited_action(Action)) :-
  violation(Actor, prohibited_action(Action)),
  not(compensated_violation(Actor, Action, _Compensation)).


compensation(Actor, compensation(Action, Compensation)) :-
  compensated_violation(Actor, Action, Compensation).

status(Actor, requires_review) :-
  uncompensated_violation(Actor, _Violation).
