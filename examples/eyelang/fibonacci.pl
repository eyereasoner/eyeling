% Memoize the fast-doubling helper: several requested Fibonacci numbers reuse
% the same half-size subproblems.
% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(fibonacci, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
memoize(fib_pair, 3).

% BigInt Fibonacci via fast doubling, implemented in Prolog using generic
% decimal add/sub/mul built-ins.  The result predicate follows Eyeling's
% fibonacci.n3 output shape: N fibonacci Value.
fib_case(0).
fib_case(1).
fib_case(10).
fib_case(100).
fib_case(1000).
fib_case(10000).

% Derivation rules: each rule below contributes one logical step toward the displayed results.
fib(N, Value) :- fib_pair(N, Value, _Next).

fib_pair(0, 0, 1).
fib_pair(N, F, G) :-
  gt(N, 0),
  div(N, 2, Half),
  fib_pair(Half, A, B),
  mul(B, 2, TwoB),
  sub(TwoB, A, TwoBMinusA),
  mul(A, TwoBMinusA, C),
  mul(A, A, AA),
  mul(B, B, BB),
  add(AA, BB, D),
  mod(N, 2, 0),
  eq(F, C),
  eq(G, D).
fib_pair(N, F, G) :-
  gt(N, 0),
  div(N, 2, Half),
  fib_pair(Half, A, B),
  mul(B, 2, TwoB),
  sub(TwoB, A, TwoBMinusA),
  mul(A, TwoBMinusA, C),
  mul(A, A, AA),
  mul(B, B, BB),
  add(AA, BB, D),
  mod(N, 2, 1),
  add(C, D, Next),
  eq(F, D),
  eq(G, Next).

fibonacci(N, Value) :-
  fib_case(N),
  fib(N, Value).
