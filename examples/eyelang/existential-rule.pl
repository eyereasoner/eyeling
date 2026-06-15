% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(is, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Existential-rule example adapted from Eyeling existential-rule.n3.
% Eyeling creates blank-node witnesses.  eyelang has Herbrand terms only, so the
% witness is represented explicitly by a deterministic Skolem-style term.

type(socrates, human).
type(plato, human).

witness(socrates, sk_0).
witness(plato, sk_1).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
is(Person, Witness) :-
  type(Person, human),
  witness(Person, Witness).
