/** Formatting relations shared with the Scryer/Trealla library interface. */

:- module(format, [
    format_//2,
    format/2,
    format/3,
    portray_clause_//1,
    portray_clause/1,
    portray_clause/2,
    listing/1
]).

:- use_module(library(dcgs), [seq//1]).

format(Template, Arguments) :-
    format(user_output, Template, Arguments).

format(Stream, Template, Arguments) :-
    phrase(format_(Template, Arguments), Chars),
    format__put_chars(Chars, Stream).

format_(Template, Arguments) -->
    { format__chars(Template, Chars) },
    format__dcg(Chars, Arguments).

format__chars(Template, Chars) :-
    atom(Template), !,
    atom_chars(Template, Chars).
format__chars(Chars, Chars).

format__dcg([], []) --> [].
format__dcg(['~','~'|Chars], Args) --> !, ['~'], format__dcg(Chars, Args).
format__dcg(['~',n|Chars], Args) --> !, ['\n'], format__dcg(Chars, Args).
format__dcg(['~',Control|Chars], [Arg|Args]) -->
    { format__term_control(Control),
      eyeprolog__term_chars(Control, Arg, Text)
    }, !,
    seq(Text),
    format__dcg(Chars, Args).
format__dcg([Char|Chars], Args) --> [Char], format__dcg(Chars, Args).

format__term_control(w).
format__term_control(q).
format__term_control(a).
format__term_control(d).

portray_clause_(Clause) -->
    { eyeprolog__term_chars(q, Clause, Chars) },
    seq(Chars), ['.','\n'].

portray_clause(Clause) :-
    portray_clause(user_output, Clause).

portray_clause(Stream, Clause) :-
    phrase(portray_clause_(Clause), Chars),
    format__put_chars(Chars, Stream).

listing(Name/Arity) :-
    functor(Head, Name, Arity),
    ( clause(Head, Body),
      portray_clause((Head :- Body)),
      fail
    ; true
    ).

format__put_chars([], _).
format__put_chars([Char|Chars], Stream) :-
    put_char(Stream, Char),
    format__put_chars(Chars, Stream).
