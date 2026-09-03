% Synthetic Eyelet fixed-point benchmark.
% The chain is intentionally moderate: large enough to exercise repeated
% forward-rule rounds without making the default benchmark suite unwieldy.

reach(0).
edge(0, 1).
edge(1, 2).
edge(2, 3).
edge(3, 4).
edge(4, 5).
edge(5, 6).
edge(6, 7).
edge(7, 8).
edge(8, 9).
edge(9, 10).
edge(10, 11).
edge(11, 12).
edge(12, 13).
edge(13, 14).
edge(14, 15).
edge(15, 16).
edge(16, 17).
edge(17, 18).
edge(18, 19).
edge(19, 20).
edge(20, 21).
edge(21, 22).
edge(22, 23).
edge(23, 24).
edge(24, 25).
edge(25, 26).
edge(26, 27).
edge(27, 28).
edge(28, 29).
edge(29, 30).
edge(30, 31).
edge(31, 32).
edge(32, 33).
edge(33, 34).
edge(34, 35).
edge(35, 36).
edge(36, 37).
edge(37, 38).
edge(38, 39).
edge(39, 40).
edge(40, 41).
edge(41, 42).
edge(42, 43).
edge(43, 44).
edge(44, 45).
edge(45, 46).
edge(46, 47).
edge(47, 48).
edge(48, 49).
edge(49, 50).

reach(Y) :+ reach(X), edge(X, Y).
true :+ reach(50).
