% Reference 9: standard built-ins compose into a reusable data-processing workflow.
materialize(answer, 2).
row(" alice : 3,5,7 ").
row(" bob : 2,4 ").
field(Name, Scores) :- row(Raw), trim(Raw, T), split(T, ":", [NameRaw, ScoresRaw]), trim(NameRaw, NameText), atom_string(Name, NameText), trim(ScoresRaw, CleanScores), split(CleanScores, ",", ScoreTexts), scores(ScoreTexts, Scores).
scores([], []).
scores([Text | RestText], [N | Rest]) :- number_string(N, Text), scores(RestText, Rest).
answer(total(Name), Total) :- field(Name, Scores), sum_list(Scores, Total).
answer(maximum(Name), Max) :- field(Name, Scores), max_list(Scores, Max).
answer(report(Name), Text) :- field(Name, Scores), length(Scores, Count), number_string(Count, CountText), atom_string(Name, NameText), str_concat(NameText, ":", Prefix), str_concat(Prefix, CountText, Text).
