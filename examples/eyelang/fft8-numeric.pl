% Adapted from Eyeling's fft8-numeric.n3.
% A radix-2 FFT over explicit complex pairs c(Re, Im).

% Output declarations: materialize/2 selects the relations written to this example's golden output.
materialize(fft, 2).
materialize(dcComponent, 2).

% Program structure: facts set up the scenario, and rules derive the materialized conclusions.
% Twiddle factors are encoded as complex pairs c(Real, Imag).
w8(0, c(1.0, 0.0)).
w8(1, c(0.7071067811865476, -0.7071067811865476)).
w8(2, c(0.0, -1.0)).
w8(3, c(-0.7071067811865476, -0.7071067811865476)).
w8(4, c(-1.0, 0.0)).
w8(5, c(-0.7071067811865476, 0.7071067811865476)).
w8(6, c(0.0, 1.0)).
w8(7, c(0.7071067811865476, 0.7071067811865476)).

% Complex arithmetic is expressed through ordinary numeric built-ins.
% Derivation rules: each rule below contributes one logical step toward the displayed results.
c_add(c(AR, AI), c(BR, BI), c(CR, CI)) :-
  add(AR, BR, CR),
  add(AI, BI, CI).

c_sub(c(AR, AI), c(BR, BI), c(CR, CI)) :-
  sub(AR, BR, CR),
  sub(AI, BI, CI).

c_mul(c(AR, AI), c(BR, BI), c(CR, CI)) :-
  mul(AR, BR, AC),
  mul(AI, BI, BD),
  sub(AC, BD, CR),
  mul(AR, BI, AD),
  mul(AI, BR, BC),
  add(AD, BC, CI).

fft1([X], [c(X, 0.0)]).

fft2([X0, X1], [Y0, Y1]) :-
  fft1([X0], [E0]),
  fft1([X1], [O0]),
  c_add(E0, O0, Y0),
  c_sub(E0, O0, Y1).

fft4([X0, X1, X2, X3], [Y0, Y1, Y2, Y3]) :-
  fft2([X0, X2], [E0, E1]),
  fft2([X1, X3], [O0, O1]),
  w8(2, W1),
  c_mul(W1, O1, T1),
  c_add(E0, O0, Y0),
  c_add(E1, T1, Y1),
  c_sub(E0, O0, Y2),
  c_sub(E1, T1, Y3).

% Split even/odd samples, transform halves, then combine with W8 factors.
fft8([X0, X1, X2, X3, X4, X5, X6, X7], [Y0, Y1, Y2, Y3, Y4, Y5, Y6, Y7]) :-
  fft4([X0, X2, X4, X6], [E0, E1, E2, E3]),
  fft4([X1, X3, X5, X7], [O0, O1, O2, O3]),
  w8(1, W1),
  w8(2, W2),
  w8(3, W3),
  c_mul(W1, O1, T1),
  c_mul(W2, O2, T2),
  c_mul(W3, O3, T3),
  c_add(E0, O0, Y0),
  c_add(E1, T1, Y1),
  c_add(E2, T2, Y2),
  c_add(E3, T3, Y3),
  c_sub(E0, O0, Y4),
  c_sub(E1, T1, Y5),
  c_sub(E2, T2, Y6),
  c_sub(E3, T3, Y7).

wave(ramp8, [0, 1, 2, 3, 4, 5, 6, 7]).
wave(alternating8, [1, -1, 1, -1, 1, -1, 1, -1]).

fft(Wave, Spectrum) :-
  wave(Wave, Samples),
  fft8(Samples, Spectrum).

dcComponent(Wave, DC) :-
  wave(Wave, Samples),
  fft8(Samples, [DC|_]).
