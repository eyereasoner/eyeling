% Reusable builtin tour: normalize text, summarize lists, and compute numeric values.
materialize(report, 2).

name_raw("  Ada Lovelace  ").
tag_csv("logic,math,logic,programming").
scores([8, 13, 21]).

report(normalized_name, Name) :-
  name_raw(Raw),
  trim(Raw, Trimmed),
  lowercase(Trimmed, Name).

report(unique_tags, Tags) :-
  tag_csv(Csv),
  split(Csv, ",", Parts),
  list_to_set(Parts, Tags).

report(tag_label, Label) :-
  tag_csv(Csv),
  split(Csv, ",", Parts),
  list_to_set(Parts, Tags),
  join(Tags, " / ", Label).

report(score_summary, summary(Total, Peak, RootTotal)) :-
  scores(Scores),
  sum_list(Scores, Total),
  max_list(Scores, Peak),
  sqrt(Total, RootTotal).

report(window, Slice) :-
  scores(Scores),
  slice(1, 2, Scores, Slice).
