% Universal Turing machine example adapted from Eyelet's input/turing.pl.
%
% The machine below adds 1 to a binary number represented as a list of bits.
% The blank tape symbol is #.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(input, 2).
materialize(output, 2).
materialize(addsOne, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
compute([], OutTape) :-
  start(_Machine, I),
  find(I, [], #, [], OutTape).

compute([Head|Tail], OutTape) :-
  start(_Machine, I),
  find(I, [], Head, Tail, OutTape).

find(State, Left, Cell, Right, OutTape) :-
  t([State, Cell, Write, Move], Next),
  move(Move, Left, Write, Right, A, B, C),
  continue(Next, A, B, C, OutTape).

continue(halt, Left, Cell, Right, OutTape) :-
  rever(Left, R),
  append(R, [Cell|Right], OutTape).

continue(State, Left, Cell, Right, OutTape) :-
  find(State, Left, Cell, Right, OutTape).

move(l, [], Cell, Right, [], #, [Cell|Right]).
move(l, [Head|Tail], Cell, Right, Tail, Head, [Cell|Right]).
move(s, Left, Cell, Right, Left, Cell, Right).
move(r, Left, Cell, [], [Cell|Left], #, []).
move(r, Left, Cell, [Head|Tail], [Cell|Left], Head, Tail).

rever([], []).
rever([A|B], C) :-
  rever(B, D),
  append(D, [A], C).

% A Turing machine to add 1 to a binary number.
start(add1, 0).
t([0, 0, 0, r], 0).
t([0, 1, 1, r], 0).
t([0, #, #, l], 1).
t([1, 0, 1, s], halt).
t([1, 1, 0, l], 1).
t([1, #, 1, s], halt).

case(case1, [1, 0, 1, 0, 0, 1]).
case(case2, [1, 0, 1, 1, 1, 1]).
case(case3, [1, 1, 1, 1, 1, 1]).
case(case4, []).

input(Case, InTape) :-
  case(Case, InTape).

output(Case, OutTape) :-
  case(Case, InTape),
  compute(InTape, OutTape).

addsOne(Case, true) :-
  case(Case, InTape),
  compute(InTape, _OutTape).
