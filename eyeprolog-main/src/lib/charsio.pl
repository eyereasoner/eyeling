/** High-level character I/O shared by Scryer and Trealla. */

:- module(charsio, [
    char_type/2,
    chars_utf8bytes/2,
    get_line_to_chars/3,
    get_single_char/1,
    get_n_chars/3,
    read_from_chars/2,
    read_term_from_chars/3,
    write_term_to_chars/3,
    chars_base64/3
]).

:- use_module(library(error), [can_be/2]).
:- use_module(library(lists), [append/2, length/2, maplist/2, maplist/3]).
:- use_module(library(dcgs), [phrase/2]).

char_type(Char, Type) :- eyeprolog__char_type(Char, Type).

% Scryer-compatible relation between character lists and UTF-8 octets.
chars_utf8bytes(Chars, Bytes) :-
    ( var(Chars) ->
        once(phrase(charsio__decode_utf8(Chars), Bytes))
    ; charsio__utf8_encode_all(Chars, Nested),
      append(Nested, Bytes)
    ).

charsio__utf8_encode_all([], []).
charsio__utf8_encode_all([Char|Chars], [Bytes|Rest]) :-
    atom(Char), atom_length(Char, 1),
    char_code(Char, Code),
    charsio__code_utf8(Code, Bytes),
    charsio__utf8_encode_all(Chars, Rest).

charsio__code_utf8(Code, [Code]) :- Code < 0x80, !.
charsio__code_utf8(Code, [B1,B2]) :-
    Code < 0x800, !,
    B1 is 0xC0 \/ (Code >> 6),
    B2 is 0x80 \/ (Code /\ 0x3F).
charsio__code_utf8(Code, [B1,B2,B3]) :-
    Code < 0x10000, Code < 0xD800, !,
    B1 is 0xE0 \/ (Code >> 12),
    B2 is 0x80 \/ ((Code >> 6) /\ 0x3F),
    B3 is 0x80 \/ (Code /\ 0x3F).
charsio__code_utf8(Code, [B1,B2,B3]) :-
    Code > 0xDFFF, Code < 0x10000, !,
    B1 is 0xE0 \/ (Code >> 12),
    B2 is 0x80 \/ ((Code >> 6) /\ 0x3F),
    B3 is 0x80 \/ (Code /\ 0x3F).
charsio__code_utf8(Code, [B1,B2,B3,B4]) :-
    Code < 0x110000,
    B1 is 0xF0 \/ (Code >> 18),
    B2 is 0x80 \/ ((Code >> 12) /\ 0x3F),
    B3 is 0x80 \/ ((Code >> 6) /\ 0x3F),
    B4 is 0x80 \/ (Code /\ 0x3F).

charsio__decode_utf8([]) --> [].
charsio__decode_utf8([Char|Chars]) -->
    charsio__utf8_code(Code),
    { char_code(Char, Code) },
    charsio__decode_utf8(Chars).

charsio__utf8_code(Code) --> [B], { B >= 0, B < 0x80, Code = B }, !.
charsio__utf8_code(Code) --> [B1,B2],
    { B1 /\ 0xE0 =:= 0xC0, B2 /\ 0xC0 =:= 0x80,
      Code is ((B1 /\ 0x1F) << 6) \/ (B2 /\ 0x3F), Code >= 0x80 }, !.
charsio__utf8_code(Code) --> [B1,B2,B3],
    { B1 /\ 0xF0 =:= 0xE0, B2 /\ 0xC0 =:= 0x80, B3 /\ 0xC0 =:= 0x80,
      Code is ((B1 /\ 0x0F) << 12) \/ ((B2 /\ 0x3F) << 6) \/ (B3 /\ 0x3F),
      Code >= 0x800, (Code < 0xD800 ; Code > 0xDFFF) }, !.
charsio__utf8_code(Code) --> [B1,B2,B3,B4],
    { B1 /\ 0xF8 =:= 0xF0, B2 /\ 0xC0 =:= 0x80, B3 /\ 0xC0 =:= 0x80, B4 /\ 0xC0 =:= 0x80,
      Code is ((B1 /\ 7) << 18) \/ ((B2 /\ 0x3F) << 12) \/ ((B3 /\ 0x3F) << 6) \/ (B4 /\ 0x3F),
      Code >= 0x10000, Code < 0x110000 }.


get_single_char(Char) :- get_char(Char).

get_line_to_chars(Stream, Chars0, Chars) :-
    get_char(Stream, Char),
    (   Char == end_of_file -> Chars0 = Chars
    ;   Chars0 = [Char|Rest],
        ( Char == '\n' -> Rest = Chars
        ; get_line_to_chars(Stream, Rest, Chars)
        )
    ).

get_n_chars(Stream, N, Chars) :-
    can_be(integer, N),
    (   var(N) ->
        charsio__to_eof(Stream, Chars),
        length(Chars, N)
    ;   N >= 0,
        charsio__count(Stream, N, Chars)
    ).

charsio__count(_, 0, []) :- !.
charsio__count(Stream, N, Chars) :-
    N > 0,
    get_char(Stream, Char),
    (   Char == end_of_file -> Chars = []
    ;   Chars = [Char|Rest],
        N1 is N - 1,
        charsio__count(Stream, N1, Rest)
    ).

charsio__to_eof(Stream, Chars) :-
    get_char(Stream, Char),
    (   Char == end_of_file -> Chars = []
    ;   Chars = [Char|Rest], charsio__to_eof(Stream, Rest)
    ).


read_from_chars(Chars, Term) :-
    eyeprolog__read_from_chars(Chars, Term).

read_term_from_chars(Chars, Term, Options) :-
    eyeprolog__read_term_from_chars(Chars, Term, Options).

write_term_to_chars(Term, Options, Chars) :-
    eyeprolog__write_term_to_chars(Term, Options, Chars).

chars_base64(Chars, Base64, Options) :-
    eyeprolog__chars_base64(Chars, Base64, Options).
