% ISO 6.5.1: ? is a graphic character and may occur in graphic atoms.
%% goal: question_mark_graphics(A, B)
question_mark_graphics(A, B) :- A = ?, B = ?? .
