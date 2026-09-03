% From The Art of EyeProlog, Chapter 37.
write_event(Path, Event) :-
  setup_call_cleanup(
    open(Path, write, Stream, [type(text)]),
    ( write_canonical(Stream, Event),
      put_char(Stream, '.'),
      nl(Stream)
    ),
    close(Stream)
  ).
