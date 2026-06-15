% Eyelet-inspired combinations example using findall/3 and sort/2.
% The source-level select/3 relation remains an ordinary eyelang rule.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(combinations, 2).
materialize(count, 2).
materialize(reason, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% select/3 nondeterministically removes one item from a list.
select(Item, [Item | Rest], Rest).
% Derivation rules: each rule below contributes one logical step toward the displayed results.
select(Item, [Head | Tail], [Head | Rest]) :-
  select(Item, Tail, Rest).

% combination/3 builds an unordered K-combination by repeated selection.
combination(0, _Items, []).
combination(I, Items, Combination) :-
  gt(I, 0),
  select(Item, Items, Remaining),
  sub(I, 1, J),
  combination(J, Remaining, Partial),
  sort([Item | Partial], Combination).

% findall collects all generation orders; sort canonicalizes and deduplicates.
unique_combinations(K, Items, Unique) :-
  findall(C, combination(K, Items, C), All),
  sort(All, Unique).

combinations(combinations_5_choose_3, Unique) :-
  unique_combinations(3, [1, 2, 3, 4, 5], Unique).

count(combinations_5_choose_3, Count) :-
  unique_combinations(3, [1, 2, 3, 4, 5], Unique),
  length(Unique, Count).

reason(combinations_5_choose_3, "findall gathers generated combinations and sort removes duplicates").
