% ISO/IEC TS 13211-3 terminal sequences, concatenation, parsing and generation.
sentence --> article, noun, verb.
article --> [the].
noun --> [cat].
verb --> [sleeps].

%% goal: phrase(sentence, X)
%% goal: phrase(article, [the, rest], R)
