/** Scryer-compatible pair helpers used by CLP(Z). */

:- module(pairs, [
    pairs_keys_values/3,
    pairs_keys/2,
    pairs_values/2,
    group_pairs_by_key/2,
    map_list_to_pairs/3
]).

:- meta_predicate(map_list_to_pairs(2, ?, ?)).

pairs_keys_values([], [], []).
pairs_keys_values([A-B|ABs], [A|As], [B|Bs]) :-
    pairs_keys_values(ABs, As, Bs).

pairs_keys(Pairs, Keys) :- pairs_keys_values(Pairs, Keys, _).
pairs_values(Pairs, Values) :- pairs_keys_values(Pairs, _, Values).

map_list_to_pairs(Pred, List, Pairs) :-
    pairs__map_list_to_pairs(List, Pred, Pairs).

pairs__map_list_to_pairs([], _, []).
pairs__map_list_to_pairs([Head|Tail0], Pred, [Key-Head|Tail]) :-
    call(Pred, Head, Key),
    pairs__map_list_to_pairs(Tail0, Pred, Tail).

group_pairs_by_key([], []).
group_pairs_by_key([K-V|Pairs0], [K-[V|Values]|Pairs]) :-
    pairs__same_key(K, Pairs0, Values, Pairs1),
    group_pairs_by_key(Pairs1, Pairs).

pairs__same_key(K0, [K1-V|Pairs0], [V|Values], Pairs) :-
    K0 == K1, !,
    pairs__same_key(K0, Pairs0, Values, Pairs).
pairs__same_key(_, Pairs, [], Pairs).
