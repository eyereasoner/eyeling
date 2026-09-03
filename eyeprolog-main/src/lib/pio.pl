/** Pure I/O through DCGs.

    This is the eager, portable core shared by the Scryer and Trealla pio
    libraries. Grammar descriptions stay declarative; only opening, reading,
    writing, and closing streams are effectful.
*/

:- module(pio, [
    phrase_from_file/2,
    phrase_from_file/3,
    phrase_from_stream/2,
    phrase_to_file/2,
    phrase_to_file/3,
    phrase_to_stream/2
]).

:- use_module(library(error), [must_be/2]).
:- use_module(library(charsio), [get_n_chars/3]).

:- meta_predicate(phrase_from_file(2, '?')).
:- meta_predicate(phrase_from_file(2, '?', '?')).
:- meta_predicate(phrase_from_stream(2, '?')).
:- meta_predicate(phrase_to_file(2, '?')).
:- meta_predicate(phrase_to_file(2, '?', '?')).
:- meta_predicate(phrase_to_stream(2, '?')).

phrase_from_file(Grammar, File) :-
    phrase_from_file(Grammar, File, []).

phrase_from_file(Grammar, File, Options) :-
    must_be(list, Options),
    setup_call_cleanup(
        eyeprolog__pio_open_chars(File, read, Stream, Options),
        ( get_n_chars(Stream, _, Chars), phrase(Grammar, Chars) ),
        close(Stream)
    ).


phrase_from_stream(Grammar, Stream) :-
    get_n_chars(Stream, _, Chars),
    phrase(Grammar, Chars).

phrase_to_file(Grammar, File) :-
    phrase_to_file(Grammar, File, []).

phrase_to_file(Grammar, File, Options) :-
    must_be(list, Options),
    setup_call_cleanup(
        eyeprolog__pio_open_chars(File, write, Stream, Options),
        phrase_to_stream(Grammar, Stream),
        close(Stream)
    ).

phrase_to_stream(Grammar, Stream) :-
    phrase(Grammar, Units),
    ( stream_property(Stream, type(binary)) -> pio__put_bytes(Units, Stream)
    ; pio__put_chars(Units, Stream)
    ).

pio__put_chars([], _).
pio__put_chars([Char|Chars], Stream) :-
    put_char(Stream, Char),
    pio__put_chars(Chars, Stream).

pio__put_bytes([], _).
pio__put_bytes([Byte|Bytes], Stream) :-
    put_byte(Stream, Byte),
    pio__put_bytes(Bytes, Stream).
