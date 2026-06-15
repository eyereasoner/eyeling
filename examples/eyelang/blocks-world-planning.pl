% Blocks-world planning without cut.
%
% A finite-depth planner searches for a five-move plan over five blocks.  States
% are sorted lists of on(Block, Support) facts so equality and visited-state
% checks are purely structural.

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(status, 2).
materialize(plan, 2).
materialize(finalState, 2).
materialize(blockCount, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
initial([on(a, table), on(b, a), on(c, b), on(d, c), on(e, d)]).
goal([on(a, table), on(b, a), on(c, table), on(d, c), on(e, d)]).

block(a).
block(b).
block(c).
block(d).
block(e).

support(table, _State).
% Derivation rules: each rule below contributes one logical step toward the displayed results.
support(Block, State) :-
  block(Block),
  member(on(Block, _Below), State).

clear(Block, State) :-
  not(member(on(_Other, Block), State)).

clear_support(table, _State).
clear_support(Block, State) :-
  block(Block),
  clear(Block, State).

move(State, move(Block, From, To), NewState) :-
  member(on(Block, From), State),
  clear(Block, State),
  support(To, State),
  clear_support(To, State),
  neq(Block, To),
  neq(From, To),
  select(on(Block, From), State, Rest),
  sort([on(Block, To)|Rest], NewState).

plan(State, Goal, 0, _Visited, [], State) :-
  eq(State, Goal).

plan(State, Goal, Depth, Visited, [Move|Moves], Final) :-
  gt(Depth, 0),
  move(State, Move, Next),
  not_member(Next, Visited),
  sub(Depth, 1, RestDepth),
  plan(Next, Goal, RestDepth, [Next|Visited], Moves, Final).

five_move_plan(Moves, Final) :-
  initial(Start),
  goal(Goal),
  sort(Start, SortedStart),
  sort(Goal, SortedGoal),
  plan(SortedStart, SortedGoal, 5, [SortedStart], Moves, Final).

status(blocks_world, planned) :-
  once(five_move_plan(_Moves, _Final)).

plan(blocks_world, Moves) :-
  once(five_move_plan(Moves, _Final)).

finalState(blocks_world, Final) :-
  once(five_move_plan(_Moves, Final)).

blockCount(blocks_world, Count) :-
  findall(Block, block(Block), Blocks),
  length(Blocks, Count).
