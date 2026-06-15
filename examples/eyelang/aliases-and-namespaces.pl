% Built-ins use one native spelling each.
% Vocabulary predicate names remain ordinary user predicates.

% The materialized relations below show that built-ins can coexist with
% ordinary vocabulary predicates that happen to look namespace-like.
% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(value, 2).
materialize(ok, 2).
materialize(tail, 2).
materialize(label, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Native operations are called through their canonical predicate names.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
value(nativeMath, X) :- add(0.125, 0.875, X).
ok(nativeCompare, true) :- lt(2, 3).
ok(nativeString, true) :- matches("scoped retail insight", "retail|medical").
tail(nativeList, Tail) :- rest([a, b, c], Tail).

% These names are just user data; eyelang does not give them special meaning.
example_label(vocabularyExample, "vocabulary names are ordinary predicate names").
label(vocabularyExample, Text) :- example_label(vocabularyExample, Text).
