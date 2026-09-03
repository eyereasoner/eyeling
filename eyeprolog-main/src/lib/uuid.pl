/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
   The uuidv4/1, uuidv4_string/1, uuid_string/2 interface and conversion are
   adapted from Scryer Prolog's public-domain library(uuid), written by
   Adrián Arroyo.  EyeProlog retains its explicit-state uuid/3 extension.
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - */

/** UUID version 4 generation and conversion. */

:- module(uuid, [uuid/3, uuidv4/1, uuidv4_string/1, uuid_string/2]).

:- use_module(library(random), [random/3, random_integer/3]).

uuidv4(Uuid) :-
    uuid__random_bytes(16, Bytes),
    Bytes = [B1, B2, B3, B4, B5, B6, B7, B8,
             B9, B10, B11, B12, B13, B14, B15, B16],
    NewTimeHi is 64 + B7 mod 16,
    NewClockSeqHi is 128 + B9 mod 64,
    Uuid = [B1, B2, B3, B4, B5, B6, NewTimeHi, B8,
            NewClockSeqHi, B10, B11, B12, B13, B14, B15, B16].

uuidv4_string(String) :-
    uuidv4(Uuid),
    uuid_string(Uuid, String).

uuid_string(Uuid, String) :-
    Uuid = [B1, B2, B3, B4, B5, B6, B7, B8,
            B9, B10, B11, B12, B13, B14, B15, B16],
    uuid__append(S1, ['-'|Tail1], String),
    uuid__length(S1, 8),
    uuid__append(S2, ['-'|Tail2], Tail1),
    uuid__length(S2, 4),
    uuid__append(S3, ['-'|Tail3], Tail2),
    uuid__length(S3, 4),
    uuid__append(S4, ['-'|S5], Tail3),
    uuid__length(S4, 4),
    uuid__length(S5, 12),
    uuid__hex_bytes(S1, [B1, B2, B3, B4]),
    uuid__hex_bytes(S2, [B5, B6]),
    uuid__hex_bytes(S3, [B7, B8]),
    uuid__hex_bytes(S4, [B9, B10]),
    uuid__hex_bytes(S5, [B11, B12, B13, B14, B15, B16]).

uuid__random_bytes(0, []) :- !.
uuid__random_bytes(N, [Byte|Bytes]) :-
    random_integer(0, 256, Byte),
    N1 is N - 1,
    uuid__random_bytes(N1, Bytes).

uuid__hex_bytes([], []).
uuid__hex_bytes([High,Low|Hex], [Byte|Bytes]) :-
    uuid__hex_value(High, HighValue),
    uuid__hex_value(Low, LowValue),
    Byte is HighValue * 16 + LowValue,
    uuid__hex_bytes(Hex, Bytes).

uuid__hex_value(Char, Value) :-
    nonvar(Value), !,
    Value >= 0,
    Value < 16,
    uuid__hex_digit(Value, Char).
uuid__hex_value(Char, Value) :-
    uuid__hex_digit(Value, Char).

% Seed-threaded UUID version 4 generation. The version and variant nibbles are
% fixed by RFC 9562; all other nibbles come from random/3. Reusing Seed0
% reproduces the same UUID, while threading Seed produces a deterministic
% sequence of different UUIDs.
uuid(Seed0, UUID, Seed) :-
    uuid__uuid_hex(8, Seed0, Group1, Seed1),
    uuid__uuid_hex(4, Seed1, Group2, Seed2),
    uuid__uuid_hex(3, Seed2, Group3, Seed3),
    random(Seed3, _, Seed4),
    VariantValue is 8 + Seed4 mod 4,
    uuid__hex_digit(VariantValue, Variant),
    uuid__uuid_hex(3, Seed4, Group4, Seed5),
    uuid__uuid_hex(12, Seed5, Group5, Seed),
    uuid__append(Group1, ['-'|Tail1], Chars),
    uuid__append(Group2, ['-','4'|Tail2], Tail1),
    uuid__append(Group3, ['-',Variant|Tail3], Tail2),
    uuid__append(Group4, ['-'|Group5], Tail3),
    atom_chars(UUID, Chars).

uuid__uuid_hex(0, Seed, [], Seed).
uuid__uuid_hex(Count, Seed0, [Digit|Digits], Seed) :-
    Count > 0,
    random(Seed0, _, Seed1),
    Value is Seed1 mod 16,
    uuid__hex_digit(Value, Digit),
    NextCount is Count - 1,
    uuid__uuid_hex(NextCount, Seed1, Digits, Seed).

uuid__hex_digit(0, '0').
uuid__hex_digit(1, '1').
uuid__hex_digit(2, '2').
uuid__hex_digit(3, '3').
uuid__hex_digit(4, '4').
uuid__hex_digit(5, '5').
uuid__hex_digit(6, '6').
uuid__hex_digit(7, '7').
uuid__hex_digit(8, '8').
uuid__hex_digit(9, '9').
uuid__hex_digit(10, a).
uuid__hex_digit(11, b).
uuid__hex_digit(12, c).
uuid__hex_digit(13, d).
uuid__hex_digit(14, e).
uuid__hex_digit(15, f).

uuid__append([], Ys, Ys).
uuid__append([X|Xs], Ys, [X|Zs]) :- uuid__append(Xs, Ys, Zs).

uuid__length([], 0).
uuid__length([_|Xs], N) :-
    N > 0,
    N1 is N - 1,
    uuid__length(Xs, N1).
