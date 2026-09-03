/** Portable text conversion and pattern relations. */

:- module(strings, [
    matches/3,
    split/3,
    replace/4,
    lowercase/2,
    uppercase/2,
    trim/2,
    number_string/2,
    atom_string/2,
    term_string/2,
    string_concat/3,
    contains/2,
    matches/2,
    join/3,
    substring/4
]).

% ---------- text representation helpers ----------

strings__char_list([]).
strings__char_list([C|Cs]) :- atom(C), atom_length(C, 1), strings__char_list(Cs).

strings__text_chars(Text, []) :- nonvar(Text), Text = [], !.
strings__text_chars(Text, Chars) :-
    atom(Text),
    atom_chars(Text, Chars).
strings__text_chars(Text, Chars) :-
    nonvar(Text),
    strings__char_list(Text),
    Text = Chars.
strings__text_chars(Text, Chars) :-
    var(Text),
    atom_chars(Text, Chars).

strings__atomic_chars(Value, []) :- nonvar(Value), Value = [], !.
strings__atomic_chars(Value, Chars) :-
    atom(Value),
    atom_chars(Value, Chars).
strings__atomic_chars(Value, Chars) :-
    number(Value),
    number_chars(Value, Chars).
strings__atomic_chars(Value, Chars) :-
    nonvar(Value),
    strings__char_list(Value),
    Value = Chars.

% ---------- core helpers ----------

strings__append([], Ys, Ys).
strings__append([X|Xs], Ys, [X|Zs]) :- strings__append(Xs, Ys, Zs).

strings__member(X, [X|_]).
strings__member(X, [_|Xs]) :- strings__member(X, Xs).


% ---------- portable named-capture matcher ----------
%
% matches/3 supports the portable subset used by EyeProlog examples:
% literals, ^/$ anchors, named groups (?<name>...), optional named groups ?,
% \w+, \S+, bracket classes with + or {N}, and literal group bodies.  Captures are returned as
% the same conjunction-of-Name(Value) context shape as before.

matches(Text, Pattern, Context) :-
    strings__text_chars(Text, TextChars),
    strings__text_chars(Pattern, PatternChars),
    strings__regex_parse(PatternChars, StartAnchor, EndAnchor, Tokens),
    strings__has_capture(Tokens),
    strings__regex_start(StartAnchor, TextChars, Candidate),
    strings__regex_tokens(Tokens, Candidate, Rest, Captures),
    strings__regex_end(EndAnchor, Rest),
    !,
    strings__captures_context(Captures, Context).

strings__regex_start(yes, Chars, Chars).
strings__regex_start(no, Chars, Chars).
strings__regex_start(no, [_|Cs], Candidate) :- strings__regex_start(no, Cs, Candidate).

strings__regex_end(yes, []).
strings__regex_end(no, _).

strings__regex_parse(Chars0, Start, End, Tokens) :-
    strings__strip_start_anchor(Chars0, Start, Chars1),
    strings__strip_end_anchor(Chars1, End, Chars2),
    strings__regex_tokens_parse(Chars2, Tokens).

strings__strip_start_anchor(['^'|Cs], yes, Cs).
strings__strip_start_anchor(Cs, no, Cs).

strings__strip_end_anchor(Cs0, yes, Cs) :- strings__append(Cs, ['$'], Cs0).
strings__strip_end_anchor(Cs, no, Cs) :- \+ strings__append(_, ['$'], Cs).

strings__regex_tokens_parse([], []).
strings__regex_tokens_parse(['('|Cs], [capture(Name, Kind, Optional)|Tokens]) :-
    Cs = ['?','<'|AfterOpen],
    strings__take_until('>', AfterOpen, NameChars, AfterName),
    NameChars \= [],
    atom_chars(Name, NameChars),
    strings__take_until(')', AfterName, Body, AfterGroup),
    strings__capture_kind(Body, Kind),
    strings__optional_marker(AfterGroup, Optional, Rest),
    strings__regex_tokens_parse(Rest, Tokens).
strings__regex_tokens_parse(['('|_], _) :- fail.
strings__regex_tokens_parse([C|Cs], [literal(C)|Tokens]) :-
    C \= '(',
    strings__regex_tokens_parse(Cs, Tokens).

strings__take_until(Stop, [Stop|Rest], [], Rest).
strings__take_until(Stop, [C|Cs], [C|Out], Rest) :-
    C \= Stop,
    strings__take_until(Stop, Cs, Out, Rest).

strings__optional_marker(['?'|Rest], yes, Rest).
strings__optional_marker(Rest, no, Rest).

strings__capture_kind(Body, word_plus) :-
    Body = [Slash,'w','+'], char_code(Slash, 92).
strings__capture_kind(Body, nonspace_plus) :-
    Body = [Slash,'S','+'], char_code(Slash, 92).
strings__capture_kind(['['|Body], class_plus(Class)) :-
    strings__take_until(']', Body, Class, ['+']),
    Class \= [].
strings__capture_kind(['['|Body], class_exact(Class, Count)) :-
    strings__take_until(']', Body, Class, ['{'|CountAndClose]),
    strings__take_until('}', CountAndClose, CountChars, []),
    CountChars \= [],
    number_chars(Count, CountChars),
    integer(Count), Count > 0,
    Class \= [].
strings__capture_kind(Body, literal(Body)) :-
    Body \= [],
    \+ strings__member('(', Body),
    \+ strings__member(')', Body),
    \+ strings__member('[', Body),
    \+ strings__member(']', Body),
    \+ strings__member('+', Body),
    \+ strings__member('*', Body).

strings__has_capture([capture(_,_,_)|_]).
strings__has_capture([_|Ts]) :- strings__has_capture(Ts).

strings__regex_tokens([], Chars, Chars, []).
strings__regex_tokens([literal(C)|Ts], [C|Cs], Rest, Captures) :-
    strings__regex_tokens(Ts, Cs, Rest, Captures).
strings__regex_tokens([capture(Name,Kind,no)|Ts], Chars, Rest, [capture(Name,Value)|Captures]) :-
    strings__capture_match(Kind, Chars, After, ValueChars),
    atom_chars(Value, ValueChars),
    strings__regex_tokens(Ts, After, Rest, Captures).
strings__regex_tokens([capture(Name,Kind,yes)|Ts], Chars, Rest, [capture(Name,Value)|Captures]) :-
    strings__capture_match(Kind, Chars, After, ValueChars),
    atom_chars(Value, ValueChars),
    strings__regex_tokens(Ts, After, Rest, Captures).
strings__regex_tokens([capture(_,_,yes)|Ts], Chars, Rest, Captures) :-
    strings__regex_tokens(Ts, Chars, Rest, Captures).

strings__capture_match(literal(Literal), Chars, Rest, Literal) :- strings__append(Literal, Rest, Chars).
strings__capture_match(word_plus, Chars, Rest, Value) :- strings__take_class_plus(word, Chars, Value, Rest).
strings__capture_match(nonspace_plus, Chars, Rest, Value) :- strings__take_class_plus(nonspace, Chars, Value, Rest).
strings__capture_match(class_plus(Class), Chars, Rest, Value) :- strings__take_class_plus(class(Class), Chars, Value, Rest).
strings__capture_match(class_exact(Class, Count), Chars, Rest, Value) :- strings__take_class_exact(Count, Class, Chars, Value, Rest).

strings__take_class_plus(Kind, [C|Cs], [C|Taken], Rest) :-
    strings__class_char(Kind, C),
    strings__take_class_more(Kind, Cs, Taken, Rest).

strings__take_class_more(Kind, [C|Cs], [C|Taken], Rest) :-
    strings__class_char(Kind, C),
    strings__take_class_more(Kind, Cs, Taken, Rest).
strings__take_class_more(_, Rest, [], Rest).

strings__take_class_exact(0, _, Chars, [], Chars).
strings__take_class_exact(N, Class, [C|Cs], [C|Taken], Rest) :-
    N > 0,
    strings__class_char(class(Class), C),
    N1 is N - 1,
    strings__take_class_exact(N1, Class, Cs, Taken, Rest).

strings__class_char(alpha, C) :- char_code(C, Code), ((Code >= 65, Code =< 90) ; (Code >= 97, Code =< 122)).
strings__class_char(digit, C) :- char_code(C, Code), Code >= 48, Code =< 57.
strings__class_char(word, C) :- strings__class_char(alpha, C).
strings__class_char(word, C) :- strings__class_char(digit, C).
strings__class_char(word, '_').
strings__class_char(nonspace, C) :- char_code(C, Code), \+ strings__space_code(Code).
strings__class_char(class(Class), C) :- strings__class_spec_char(Class, C).

strings__class_spec_char([Low,'-',High|_], C) :-
    char_code(Low, LowCode), char_code(High, HighCode), char_code(C, Code),
    Code >= LowCode, Code =< HighCode.
strings__class_spec_char([X|_], X).
strings__class_spec_char([_,_,_|Rest], C) :- strings__class_spec_char(Rest, C).
strings__class_spec_char([_|Rest], C) :- strings__class_spec_char(Rest, C).

strings__captures_context([capture(Name,Value)], Term) :- Term =.. [Name, Value].
strings__captures_context([capture(Name,Value)|Rest], (Term,Context)) :-
    Rest \= [],
    Term =.. [Name, Value],
    strings__captures_context(Rest, Context).

% ---------- text/list processing ----------

string_concat(A, B, Whole) :-
    nonvar(A), nonvar(B),
    !,
    strings__text_chars(A, AC),
    strings__text_chars(B, BC),
    strings__append(AC, BC, WC),
    strings__text_chars(Whole, WC).
string_concat(A, B, Whole) :-
    nonvar(Whole),
    strings__text_chars(Whole, WC),
    strings__append(AC, BC, WC),
    strings__text_chars(A, AC),
    strings__text_chars(B, BC).

contains(Text, Needle) :-
    strings__text_chars(Text, TextChars),
    strings__text_chars(Needle, NeedleChars),
    strings__append(_, Tail, TextChars),
    strings__append(NeedleChars, _, Tail),
    !.

matches(Text, Pattern) :-
    split(Pattern, '|', Alternatives),
    strings__member(Needle, Alternatives),
    contains(Text, Needle),
    !.

split(Text, Separator, Parts) :-
    strings__text_chars(Text, TextChars),
    strings__text_chars(Separator, SeparatorChars),
    strings__split_chars(TextChars, SeparatorChars, PartChars),
    strings__parts_text(PartChars, Parts).

strings__split_chars(Chars, [], Parts) :- strings__split_each_char(Chars, Parts).
strings__split_chars(Chars, Separator, [Prefix|Parts]) :-
    Separator \= [],
    strings__append(Prefix, Tail, Chars),
    strings__append(Separator, Rest, Tail),
    !,
    strings__split_chars(Rest, Separator, Parts).
strings__split_chars(Chars, Separator, [Chars]) :- Separator \= [].

strings__split_each_char([], []).
strings__split_each_char([C|Cs], [[C]|Rest]) :- strings__split_each_char(Cs, Rest).

strings__parts_text([], []).
strings__parts_text([Chars|Rest], [Text|Texts]) :-
    strings__text_chars(Text, Chars),
    strings__parts_text(Rest, Texts).

replace(Text, Search, Replacement, Out) :-
    strings__text_chars(Search, SearchChars),
    ( SearchChars = [] -> Out = Text
    ; split(Text, Search, Parts), join(Parts, Replacement, Out)
    ).

lowercase(Text, Lower) :-
    strings__text_chars(Text, Chars),
    strings__lower_chars(Chars, LowerChars),
    strings__text_chars(Lower, LowerChars).

strings__lower_chars([], []).
strings__lower_chars([C|Cs], [L|Ls]) :-
    char_code(C, Code),
    strings__lower_code(Code, LowerCode),
    char_code(L, LowerCode),
    strings__lower_chars(Cs, Ls).

strings__lower_code(Code, Lower) :- Code >= 65, Code =< 90, Lower is Code + 32.
strings__lower_code(Code, Code) :- (Code < 65 ; Code > 90).

uppercase(Text, Upper) :-
    strings__text_chars(Text, Chars),
    strings__upper_chars(Chars, UpperChars),
    strings__text_chars(Upper, UpperChars).

strings__upper_chars([], []).
strings__upper_chars([C|Cs], [U|Us]) :-
    char_code(C, Code),
    strings__upper_code(Code, UpperCode),
    char_code(U, UpperCode),
    strings__upper_chars(Cs, Us).

strings__upper_code(Code, Upper) :- Code >= 97, Code =< 122, Upper is Code - 32.
strings__upper_code(Code, Code) :- (Code < 97 ; Code > 122).

trim(Text, Trimmed) :-
    strings__text_chars(Text, Chars),
    strings__drop_space(Chars, Left),
    strings__reverse(Left, [], Reversed),
    strings__drop_space(Reversed, RightReversed),
    strings__reverse(RightReversed, [], TrimmedChars),
    strings__text_chars(Trimmed, TrimmedChars).

strings__drop_space([C|Cs], Out) :-
    char_code(C, Code), strings__space_code(Code), !,
    strings__drop_space(Cs, Out).
strings__drop_space(Chars, Chars).

strings__space_code(9).
strings__space_code(10).
strings__space_code(11).
strings__space_code(12).
strings__space_code(13).
strings__space_code(32).

number_string(Number, Text) :-
    number(Number),
    number_chars(Number, Chars),
    strings__text_chars(Text, Chars).
number_string(Number, Text) :-
    var(Number),
    strings__text_chars(Text, Chars),
    catch(number_chars(Number, Chars), _,
        catch(( strings__integer_exponent_chars(Chars, Expanded),
                number_chars(Number, Expanded)
              ), _, fail)).

strings__integer_exponent_chars(Chars, Expanded) :-
    strings__split_exponent(Chars, Mantissa, Marker, Exponent),
    number_chars(Integer, Mantissa),
    integer(Integer),
    strings__append(Mantissa, ['.','0',Marker|Exponent], Expanded).

strings__split_exponent([e|Exponent], [], e, Exponent).
strings__split_exponent(['E'|Exponent], [], 'E', Exponent).
strings__split_exponent([C|Chars], [C|Mantissa], Marker, Exponent) :-
    strings__split_exponent(Chars, Mantissa, Marker, Exponent).

atom_string(Atom, Text) :-
    atom(Atom),
    atom_chars(Atom, Chars),
    strings__text_chars(Text, Chars).
atom_string(Atom, Text) :-
    var(Atom),
    nonvar(Text),
    strings__atomic_chars(Text, Chars),
    atom_chars(Atom, Chars).

term_string(Term, Text) :-
    nonvar(Term),
    strings__term_chars(Term, Chars),
    strings__text_chars(Text, Chars).

strings__term_chars(Term, Chars) :- number(Term), number_chars(Term, Chars).
strings__term_chars(Term, Chars) :- atom(Term), atom_chars(Term, Chars).
strings__term_chars([], ['[',']']).
strings__term_chars([H|T], Chars) :-
    strings__list_term_chars([H|T], Body),
    strings__append(['['|Body], [']'], Chars).
strings__term_chars(Term, Chars) :-
    compound(Term),
    Term \= [_|_],
    Term =.. [Name|Args],
    atom_chars(Name, NameChars),
    strings__term_args_chars(Args, ArgsChars),
    strings__append(NameChars, ['('|ArgsChars], A),
    strings__append(A, [')'], Chars).

strings__list_term_chars([H], Chars) :-
    strings__term_chars(H, Chars).
strings__list_term_chars([H|T], Chars) :-
    T = [_|_],
    strings__term_chars(H, HC),
    strings__list_term_chars(T, TC),
    strings__append(HC, [',',' '|TC], Chars).
strings__list_term_chars([H|T], Chars) :-
    T \= [], T \= [_|_],
    strings__term_chars(H, HC),
    strings__term_chars(T, TC),
    strings__append(HC, [' ','|',' '|TC], Chars).

strings__term_args_chars([A], Chars) :- strings__term_chars(A, Chars).
strings__term_args_chars([A|As], Chars) :-
    As \= [],
    strings__term_chars(A, AC),
    strings__term_args_chars(As, Rest),
    strings__append(AC, [',',' '|Rest], Chars).

join([], _, Out) :- strings__text_chars(Out, []).
join([Item|Items], Separator, Out) :-
    strings__atomic_chars(Item, ItemChars),
    strings__text_chars(Separator, SeparatorChars),
    strings__join_chars(Items, SeparatorChars, ItemChars, Chars),
    strings__text_chars(Out, Chars).

strings__join_chars([], _, Chars, Chars).
strings__join_chars([Item|Items], Separator, Prefix, Out) :-
    strings__atomic_chars(Item, ItemChars),
    strings__append(Prefix, Separator, A),
    strings__append(A, ItemChars, B),
    strings__join_chars(Items, Separator, B, Out).

substring(Text, Start, Count, Out) :-
    integer(Start), integer(Count), Start >= 0, Count >= 0,
    strings__text_chars(Text, Chars),
    strings__drop(Start, Chars, Tail),
    strings__take(Count, Tail, Slice),
    strings__text_chars(Out, Slice).


strings__reverse([], Acc, Acc).
strings__reverse([X|Xs], Acc, Out) :- strings__reverse(Xs, [X|Acc], Out).

strings__take(0, _, []).
strings__take(N, [X|Xs], [X|Ys]) :- N > 0, N1 is N - 1, strings__take(N1, Xs, Ys).

strings__drop(0, Xs, Xs).
strings__drop(N, [_|Xs], Ys) :- N > 0, N1 is N - 1, strings__drop(N1, Xs, Ys).

