/** Scryer-compatible predicates for reasoning about files and directories.

Paths are represented as lists of characters, matching Scryer's library(files)
and EyeProlog's default double_quotes=chars profile. Runtime filesystem access
is isolated in src/files-host.js; path segmentation stays portable Prolog.
*/

:- module(files, [
    directory_files/2,
    file_size/2,
    file_exists/1,
    directory_exists/1,
    delete_file/1,
    rename_file/2,
    file_copy/2,
    delete_directory/1,
    make_directory/1,
    make_directory_path/1,
    working_directory/2,
    path_canonical/2,
    path_segments/2,
    file_modification_time/2,
    file_creation_time/2,
    file_access_time/2
]).

:- use_module(library(error), [can_be/2]).

files__chars([]).
files__chars([C|Cs]) :- atom(C), atom_length(C, 1), files__chars(Cs).

files__must_be_chars(Term) :-
    ( var(Term) -> throw(error(instantiation_error, files))
    ; files__chars(Term) -> true
    ; throw(error(type_error(list, Term), files))
    ).

files__must_exist(File, Context) :-
    ( file_exists(File) -> true
    ; throw(error(existence_error(file, File), Context))
    ).

files__directory_must_exist(Directory, Context) :-
    ( directory_exists(Directory) -> true
    ; throw(error(existence_error(directory, Directory), Context))
    ).

directory_files(Directory, Files) :-
    files__must_be_chars(Directory),
    can_be(list, Files),
    eyeprolog__directory_files(Directory, Files).

file_size(File, Size) :-
    files__must_exist(File, file_size/2),
    can_be(integer, Size),
    eyeprolog__file_size(File, Size).

file_exists(File) :-
    files__must_be_chars(File),
    eyeprolog__file_exists(File).

directory_exists(Directory) :-
    files__must_be_chars(Directory),
    eyeprolog__directory_exists(Directory).

delete_file(File) :-
    files__must_exist(File, delete_file/1),
    eyeprolog__delete_file(File).

rename_file(File, Renamed) :-
    files__must_exist(File, rename_file/2),
    files__must_be_chars(Renamed),
    eyeprolog__rename_file(File, Renamed).

file_copy(File, Copied) :-
    files__must_exist(File, file_copy/2),
    files__must_be_chars(Copied),
    eyeprolog__file_copy(File, Copied).

delete_directory(Directory) :-
    files__directory_must_exist(Directory, delete_directory/1),
    eyeprolog__delete_directory(Directory).

make_directory(Directory) :-
    files__must_be_chars(Directory),
    eyeprolog__make_directory(Directory).

make_directory_path(Directory) :-
    files__must_be_chars(Directory),
    eyeprolog__make_directory_path(Directory).

working_directory(Directory0, Directory) :-
    can_be(list, Directory0),
    can_be(list, Directory),
    eyeprolog__working_directory(Directory0, Directory).

path_canonical(Path, Canonical) :-
    files__must_be_chars(Path),
    can_be(list, Canonical),
    eyeprolog__path_canonical(Path, Canonical).

file_modification_time(File, Time) :- files__file_time(File, modification, Time).
file_access_time(File, Time) :- files__file_time(File, access, Time).
file_creation_time(File, Time) :- files__file_time(File, creation, Time).

files__file_time(File, Which, Time) :-
    files__must_exist(File, file_time_/3),
    eyeprolog__file_time(File, Which, Time).

path_segments(Path, Segments) :-
    eyeprolog__directory_separator(Separator),
    ( var(Path) ->
        files__must_be_segment_list(Segments),
        files__join_segments(Segments, Separator, Path)
    ; files__must_be_chars(Path),
      files__split_segments(Path, Separator, Segments)
    ).

files__must_be_segment_list(Segments) :-
    ( var(Segments) -> throw(error(instantiation_error, path_segments/2))
    ; files__segments(Segments) -> true
    ; throw(error(type_error(list, Segments), path_segments/2))
    ).

files__segments([]).
files__segments([S|Ss]) :- files__chars(S), files__segments(Ss).

files__join_segments([], _, []).
files__join_segments([Segment|Segments], Separator, Path) :-
    files__join_segments_(Segments, Segment, Separator, Path).

files__join_segments_([], Segment, _, Segment).
files__join_segments_([Segment|Segments], Previous, Separator, Path) :-
    files__append(Previous, [Separator|Rest], Path),
    files__join_segments_(Segments, Segment, Separator, Rest).

files__split_segments(Path, Separator, Segments) :-
    ( files__append(Front, [Separator|Rest], Path) ->
        Segments = [Front|More],
        files__split_segments(Rest, Separator, More)
    ; Segments = [Path]
    ).

files__append([], Ys, Ys).
files__append([X|Xs], Ys, [X|Zs]) :- files__append(Xs, Ys, Zs).
