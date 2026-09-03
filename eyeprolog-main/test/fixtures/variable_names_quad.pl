1  ?- write_term(T,[quoted(true),variable_names([N=T])]).
      instantiation_error.
2  ?- N = 'X', /**/write_term(T,[quoted(true),variable_names([N=T])]).
      outputs("X"), N = 'X'.
      outputs("X"), N = ... . % Same, ignoring 'X'
3  ?- N = T, /**/write_term(T,[quoted(true),variable_names([N=T])]).
      instantiation_error.
4  ?- N = '_', /**/write_term(T,[quoted(true),variable_names([N=T])]).
      outputs("_"), N = ... .
65 ?- N = '_/*.*/', /**/write_term(T,[quoted(true),variable_names([N=T])]).
      outputs("_/*.*/"), N = ... .
5  ?- N = x, /**/write_term(T,[quoted(true),variable_names([N=T])]).
      outputs("x"), N = ... .
6  ?- N = 'x+y', /**/write_term(T,[quoted(true),variable_names([N=T])]).
      outputs("x+y"), N = ... .
50 ?- N = '))', /**/write_term(T,[quoted(true),variable_names([N=T])]).
      outputs("))"), N = ... .
7  ?- N = 7, /**/write_term(T,[quoted(true),variable_names([N=T])]).
      domain_error(write_option, variable_names(...)).
8  ?- N = 1+2, /**/write_term(T,[quoted(true),variable_names([N=T])]).
      domain_error(write_option, variable_names(...)).
9  ?- N = '$VAR'(9), /**/write_term(T,[quoted(true),variable_names([N=T])]).
      domain_error(write_option, variable_names(...)).
10 ?- T = a, /**/write_term(T,[quoted(true),variable_names([N=T])]).
      instantiation_error.
11 ?- T = a, N = 'Any', /**/write_term(T,[quoted(true),variable_names([N=T])]).
      outputs("a"), T = ..., N = ... .
12 ?- T = '$VAR'(9), N = '_', /**/write_term(T,[quoted(true),variable_names([N=T])]).
      outputs("'$VAR'(9)"), T = ..., N = ... .
74 ?- T = f(_), N = 'Bad', /**/write_term(T,[quoted(true),variable_names([N=T])]).
      outputs(("f(_",...,")")), T = ..., N = ... .
28 ?- freeze(T,throw(g(T))), N = 'X', /**/write_term(T,[quoted(true),variable_names([N=T])]), false.
      outputs("X"), false.
13 ?- write_term(T,[quoted(true),variable_names(['X'=X,'Y'=Y,'Z'=Z])]).
      outputs(("_",...)).
14 ?- T=(X,Y,Z), /**/write_term(T,[quoted(true),variable_names(['X'=X,'Y'=Y,'Z'=Z])]).
      outputs("X,Y,Z"), T = ... .
15 ?- Z=Y, T=(X,Y,Z), /**/write_term(T,[quoted(true),variable_names(['X'=X,'Y'=Y,'Z'=Z])]).
      outputs("X,Y,Y"), Z = Y, T = ... .
16 ?- Z=Y, Y=X, T=(X,Y,Z), /**/write_term(T,[quoted(true),variable_names(['X'=X,'Y'=Y,'Z'=Z])]).
      outputs("X,X,X"), Z = X, Y = X, T = ... .
17 ?- T=(Y,Z), /**/write_term(T,[quoted(true),variable_names(['X'=X,'Y'=Y,'Z'=Z])]).
      outputs("Y,Z"), T = ... .
18 ?- T=(Z,Y), /**/write_term(T,[quoted(true),variable_names(['X'=X,'Y'=Y,'Z'=Z])]).
      outputs("Z,Y"), T = ... .
19 ?- write_term(T,[quoted(true),variable_names(['Z'=Z,'Y'=Y,'X'=X])]).
      outputs(("_",...)).
20 ?- T=(X,Y,Z), /**/write_term(T,[quoted(true),variable_names(['Z'=Z,'Y'=Y,'X'=X])]).
      outputs("X,Y,Z"), T = ... .
21 ?- Z=Y, T=(X,Y,Z), /**/write_term(T,[quoted(true),variable_names(['Z'=Z,'Y'=Y,'X'=X])]).
      outputs("X,Z,Z"), Z = Y, T = ... .
22 ?- Z=Y, Y=X, T=(X,Y,Z), /**/write_term(T,[quoted(true),variable_names(['Z'=Z,'Y'=Y,'X'=X])]).
      outputs("Z,Z,Z"), Z = X, Y = X, T = ... .
23 ?- T=(Y,Z), /**/write_term(T,[quoted(true),variable_names(['Z'=Z,'Y'=Y,'X'=X])]).
      outputs("Y,Z"), T = ... .
24 ?- T=(Z,Y), /**/write_term(T,[quoted(true),variable_names(['Z'=Z,'Y'=Y,'X'=X])]).
      outputs("Z,Y"), T = ... .
25 ?- write_term(T,[quoted(true),variable_names(['X'=Z,'X'=Y,'X'=X])]).
      outputs(("_",...)).
26 ?- T=(X,Y,Z), /**/write_term(T,[quoted(true),variable_names(['X'=Z,'X'=Y,'X'=X])]).
      outputs("X,X,X"), T = ... .
27 ?- T=(1,2,3), T=(X,Y,Z), /**/write_term(T,[quoted(true),variable_names(['X'=Z,'X'=Y,'X'=X])]).
      outputs("1,2,3"), T = ..., X = 1, Y = 2, Z = 3.
32 ?- read_term(T,[variable_names(VN_list)]),VN_list=[_=1,_=2,_=3],writeq(VN_list).
      waits.
29 ?- /**/read_term(T,[variable_names(VN_list)]),VN_list=[_=1,_=2,_=3],writeq(VN_list).
      inputs("B+C+A+B+C+A."), peeks("\n"),
      outputs("['B'=1,'C'=2,'A'=3]"),
      T = 1+2+3+1+2+3,
      VN_list=['B'=1,'C'=2,'A'=3].
30 ?- write_term(T,[variable_names(VN_list)]).
      instantiation_error.
31 ?- VN_list = 1, /**/write_term(T,[variable_names(VN_list)]).
      domain_error(write_option, variable_names(1)).
33 ?- VN_list = [[]], /**/write_term(T,[variable_names(VN_list)]).
      domain_error(write_option, variable_names([[]])).
34 ?- VN_list = non_list, /**/write_term(T,[variable_names(VN_list)]).
      domain_error(write_option, variable_names(non_list)).
35 ?- VN_list = [T='T'|non_list], /**/write_term(T,[variable_names(VN_list)]).
      domain_error(write_option, variable_names([_='T'|non_list]))
   |  instantiation_error.
52 ?- VN_list = ['T'=T|_], /**/write_term(T,[variable_names(VN_list)]).
      instantiation_error.
51 ?- VN_list = ['T'=T|non_list], /**/write_term(T,[variable_names(VN_list)]).
      domain_error(write_option, variable_names(...)).
36 ?- VN_list = [T-'T'], /**/write_term(T,[variable_names(VN_list)]).
      domain_error(write_option, variable_names(...)).
63 ?- VN_list = [_,a], /**/write_term(T,[variable_names(VN_list)]).
      domain_error(write_option, variable_names(...))
   |  instantiation_error.
64 ?- VN_list = [a,_], /**/write_term(T,[variable_names(VN_list)]).
      domain_error(write_option, variable_names(...))
   |  instantiation_error.
66 ?- VN_list = [a|_], /**/write_term(T,[variable_names(VN_list)]).
      domain_error(write_option, variable_names(...))
   |  instantiation_error.
67 ?- VN_list = [i=i,7=i], /**/write_term(T,[variable_names(VN_list)]).
      domain_error(write_option,variable_names([i=i,7=i])).
68 ?- VN_list = [_,_], /**/write_term(T,[variable_names(VN_list)]).
      instantiation_error.
43 ?- write_term(-X^2,[variable_names(['X'=X])]).
      outputs("- (X^2)").
44 ?- X=1, /**/write_term(-X^2,[variable_names(['X'=X])]).
      outputs("- (1^2)"), X = ... .
37 ?- open(f,write,_,[O]).
      instantiation_error.
38 ?- O = 1, /**/open(f,write,_,[O]).
      domain_error(stream_option,1).
56 ?- O = typex(_), /**/open(f,write,_,[O]).
      domain_error(stream_option,typex(_)).
57 ?- O = typex(1), /**/open(f,write,_,[O]).
      domain_error(stream_option,typex(1)).
62 ?- O = typex(s(_)), /**/open(f,write,_,[O]).
      domain_error(stream_option,typex(s(_))).
39 ?- O = type(text), /**/open(f,write,_,[O]).
      O = ... .
40 ?- O = type(1), /**/open(f,write,_,[O]).
      domain_error(stream_option,type(1)).
41 ?- O = type(_), /**/open(f,write,_,[O]).
      instantiation_error.
60 ?- O = alias(_), /**/open(f,write,_,[O]).
      instantiation_error.
42 ?- O = type(nontype), /**/open(f,write,_,[O]).
      domain_error(stream_option,type(nontype)).
61 ?- O = alias(1), /**/open(f,write,_,[O]).
      domain_error(stream_option,alias(1)).
45 ?- read_term(T,[variable_names(VN_list)]).
      waits.
46 ?- /**/read_term(T,[variable_names(VN_list)]).
      inputs("a."), peeks("\n"),
      T = a, VN_list = [].
47 ?- VN_list = 42, /**/read_term(T,[variable_names(VN_list)]).
      waits.
48 ?- VN_list = 42, /**/read_term(T,[variable_names(VN_list)]).
      inputs("a."), peeks("\n"),
      false.
49 ?- VN_list = 42, /**/read_term(T,[variable_names(VN_list)]).
      inputs("a b."), peeks("\n"),
      syntax_error(...).
53 ?- write_term(S,[quoted(true),variable_names([N=T])]).
      instantiation_error.
54 ?- S=1+T,N='/*r*/V',/**/write_term(S,[quoted(true),variable_names([N=T])]).
      outputs("1+/*r*/V"), S = ..., N = ...
   |  outputs("1+ /*r*/V"), S = ..., N = ... .
55 ?- S=1+T,N=' /*r*/V',/**/write_term(S,[quoted(true),variable_names([N=T])]).
      outputs("1+ /*r*/V"), S = ..., N = ... .
58 ?- S=1+T,N=(+),/**/write_term(S,[quoted(true),variable_names([N=T])]).
      outputs("1++"), S = ..., N = ...
   |  outputs("1+ +"), S = ..., N = ... .
59 ?- S=T+1,N=(+),/**/write_term(S,[quoted(true),variable_names([N=T])]).
      outputs("++1"), S = ..., N = ...
   |  outputs("+ +1"), S = ..., N = ... .
73 ?- S=(1 is T),N='X',/**/write_term(S,[quoted(true),variable_names([N=T])]).
      outputs("1 is X"), S = ..., N = ... .
69 ?- read_term(T,[singletons(1)]).
        waits.
70 ?- /**/read_term(T,[singletons(1)]).
      inputs("a."), peeks("\n"),
      false.
71 ?- write_term(T,[variable_names(['Bad'=T]),variable_names(['Good'=T])]).
      outputs("Good").
72 ?- read_term(T,[singletons([])]).
      waits.
