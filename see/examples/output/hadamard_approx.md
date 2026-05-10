# Hadamard gate approximation  

## Entailment  
The compiled query selected 441 fact(s) after the rule closure was computed.  
Main entailment: **:result :HMidpointEntry (20 1 1 -0.707106733683605 0).**  

Selected entailments:  
- :result :HMidpointEntry (20 1 1 -0.707106733683605 0) .  
- :result :HMidpointEntry (20 1 0 0.707106733683605 0) .  
- :result :HMidpointEntry (20 0 1 0.707106733683605 0) .  
- :result :HMidpointEntry (20 0 0 0.707106733683605 0) .  
- :result :HMidpointEntry (19 1 1 -0.707106495265375 0) .  
- :result :HMidpointEntry (19 1 0 0.707106495265375 0) .  

## Explanation  
Starts with 8 source fact(s), applies 10 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 2 (11 premise pattern(s) => 1 conclusion pattern(s)) derives :sqrt2Proc :state (1 2 3) ., :sqrt2Proc :state (4 22 23) ., :sqrt2Proc :state (6 90 91) ., :sqrt2Proc :state (8 362 363) ., … +7 more  
  - Uses: :sqrt2Proc :state (0 1 2) . _(source)_; :sqrt2Proc :maxN 20 . _(source)_; :sqrt2Proc :state (3 11 12) . _(derived)_; :sqrt2Proc :state (5 45 46) . _(derived)_; … +8 more premise fact(s)  
- Rule 3 (4 premise pattern(s) => 2 conclusion pattern(s)) derives :sqrt2Proc :dyadic (0 1 2 1) ., :sqrt2Proc :bounds (0 1 2) ., :sqrt2Proc :dyadic (1 2 3 2) ., :sqrt2Proc :bounds (1 1 1.5) ., … +38 more  
  - Uses: :sqrt2Proc :state (0 1 2) . _(source)_; :sqrt2Proc :state (1 2 3) . _(derived)_; :sqrt2Proc :state (2 5 6) . _(derived)_; :sqrt2Proc :state (3 11 12) . _(derived)_; … +17 more premise fact(s)  
- Rule 4 (3 premise pattern(s) => 1 conclusion pattern(s)) derives :invSqrt2 :bounds (0 0.5 1) ., :invSqrt2 :bounds (1 0.666666666666667 1) ., :invSqrt2 :bounds (2 0.666666666666667 0.8) ., :invSqrt2 :bounds (3 0.666666666666667 0.727272727272727) ., … +17 more  
  - Uses: :sqrt2Proc :dyadic (0 1 2 1) . _(derived)_; :sqrt2Proc :dyadic (1 2 3 2) . _(derived)_; :sqrt2Proc :dyadic (2 5 6 4) . _(derived)_; :sqrt2Proc :dyadic (3 11 12 8) . _(derived)_; … +17 more premise fact(s)  
- Rule 5 (8 premise pattern(s) => 5 conclusion pattern(s)) derives :invSqrt2 :width (0 0.5) ., :invSqrt2 :componentErrBound (0 0.25) ., :invSqrt2 :midpoint (0 0.75) ., :invSqrt2 :negBounds (0 -1 -0.5) ., … +101 more  
  - Uses: :invSqrt2 :bounds (0 0.5 1) . _(derived)_; :invSqrt2 :bounds (1 0.666666666666667 1) . _(derived)_; :invSqrt2 :bounds (2 0.666666666666667 0.8) . _(derived)_; :invSqrt2 :bounds (3 0.666666666666667 0.727272727272727) . _(derived)_; … +17 more premise fact(s)  
- Rule 6 (2 premise pattern(s) => 4 conclusion pattern(s)) derives :HGate :entry (0 0 0 0.5 1 0 0) ., :HGate :entry (0 0 1 0.5 1 0 0) ., :HGate :entry (0 1 0 0.5 1 0 0) ., :HGate :entry (0 1 1 -1 -0.5 0 0) ., … +80 more  
  - Uses: :invSqrt2 :bounds (0 0.5 1) . _(derived)_; :invSqrt2 :negBounds (0 -1 -0.5) . _(derived)_; :invSqrt2 :bounds (1 0.666666666666667 1) . _(derived)_; :invSqrt2 :negBounds (1 -1 -0.666666666666667) . _(derived)_; … +38 more premise fact(s)  
- Rule 7 (2 premise pattern(s) => 4 conclusion pattern(s)) derives :HGate :midpointEntry (0 0 0 0.75 0) ., :HGate :midpointEntry (0 0 1 0.75 0) ., :HGate :midpointEntry (0 1 0 0.75 0) ., :HGate :midpointEntry (0 1 1 -0.75 0) ., … +80 more  
  - Uses: :invSqrt2 :midpoint (0 0.75) . _(derived)_; :invSqrt2 :negMidpoint (0 -0.75) . _(derived)_; :invSqrt2 :midpoint (1 0.833333333333335) . _(derived)_; :invSqrt2 :negMidpoint (1 -0.833333333333335) . _(derived)_; … +38 more premise fact(s)  

Selected explanation support:  
  - :result :HMidpointEntry (20 1 1 -0.707106733683605 0) . _(no recorded rule support)_  
  - :result :HMidpointEntry (20 1 0 0.707106733683605 0) . _(no recorded rule support)_  
  - :result :HMidpointEntry (20 0 1 0.707106733683605 0) . _(no recorded rule support)_  
  - :result :HMidpointEntry (20 0 0 0.707106733683605 0) . _(no recorded rule support)_  
  - :result :HMidpointEntry (19 1 1 -0.707106495265375 0) . _(no recorded rule support)_  
  - :result :HMidpointEntry (19 1 0 0.707106495265375 0) . _(no recorded rule support)_  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/hadamard-approx#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:result :n 0 .  
:result :sqrt2Dyadic (0 1 2 1) .  
:result :sqrt2Bounds (0 1 2) .  
:result :invSqrt2Bounds (0 0.5 1) .  
:result :invSqrt2Width (0 0.5) .  
:result :midpointScale (0 0.75) .  
:result :midpointNegScale (0 -0.75) .  
:result :entryAbsErrBoundMidpoint (0 0.25) .  
:result :rowAbsErrBoundMidpoint (0 0.5) .  
:result :rowNormSqBounds (0 0.5 2) .  
:result :rowNormSqWidth (0 1.5) .  
:result :rowNormSqContains1 (0 true) .  
:result :midpointRowsOrthogonal (0 true) .  
:result :n 1 .  
:result :sqrt2Dyadic (1 2 3 2) .  
:result :sqrt2Bounds (1 1 1.5) .  
:result :invSqrt2Bounds (1 0.666666666666667 1) .  
:result :invSqrt2Width (1 0.333333333333333) .  
:result :midpointScale (1 0.833333333333335) .  
:result :midpointNegScale (1 -0.833333333333335) .  
:result :entryAbsErrBoundMidpoint (1 0.166666666666666) .  
:result :rowAbsErrBoundMidpoint (1 0.333333333333332) .  
:result :rowNormSqBounds (1 0.888888888888889 2) .  
:result :rowNormSqWidth (1 1.11111111111111) .  
:result :rowNormSqContains1 (1 true) .  
:result :midpointRowsOrthogonal (1 true) .  
:result :n 2 .  
:result :sqrt2Dyadic (2 5 6 4) .  
:result :sqrt2Bounds (2 1.25 1.5) .  
:result :invSqrt2Bounds (2 0.666666666666667 0.8) .  
:result :invSqrt2Width (2 0.133333333333333) .  
:result :midpointScale (2 0.733333333333335) .  
:result :midpointNegScale (2 -0.733333333333335) .  
:result :entryAbsErrBoundMidpoint (2 0.0666666666666665) .  
:result :rowAbsErrBoundMidpoint (2 0.133333333333333) .  
:result :rowNormSqBounds (2 0.888888888888889 1.28) .  
:result :rowNormSqWidth (2 0.391111111111111) .  
:result :rowNormSqContains1 (2 true) .  
:result :midpointRowsOrthogonal (2 true) .  
:result :n 3 .  
:result :sqrt2Dyadic (3 11 12 8) .  
:result :sqrt2Bounds (3 1.375 1.5) .  
:result :invSqrt2Bounds (3 0.666666666666667 0.727272727272727) .  
:result :invSqrt2Width (3 0.06060606060606) .  
:result :midpointScale (3 0.696969696969695) .  
:result :midpointNegScale (3 -0.696969696969695) .  
:result :entryAbsErrBoundMidpoint (3 0.03030303030303) .  
:result :rowAbsErrBoundMidpoint (3 0.06060606060606) .  
:result :rowNormSqBounds (3 0.888888888888889 1.05785123966942) .  
:result :rowNormSqWidth (3 0.168962350780531) .  
:result :rowNormSqContains1 (3 true) .  
:result :midpointRowsOrthogonal (3 true) .  
:result :n 4 .  
:result :sqrt2Dyadic (4 22 23 16) .  
:result :sqrt2Bounds (4 1.375 1.4375) .  
:result :invSqrt2Bounds (4 0.695652173913043 0.727272727272727) .  
:result :invSqrt2Width (4 0.0316205533596839) .  
:result :midpointScale (4 0.711462450592885) .  
:result :midpointNegScale (4 -0.711462450592885) .  
:result :entryAbsErrBoundMidpoint (4 0.015810276679842) .  
:result :rowAbsErrBoundMidpoint (4 0.031620553359684) .  
:result :rowNormSqBounds (4 0.967863894139887 1.05785123966942) .  
:result :rowNormSqWidth (4 0.0899873455295329) .  
:result :rowNormSqContains1 (4 true) .  
:result :midpointRowsOrthogonal (4 true) .  
:result :n 5 .  
:result :sqrt2Dyadic (5 45 46 32) .  
:result :sqrt2Bounds (5 1.40625 1.4375) .  
:result :invSqrt2Bounds (5 0.695652173913043 0.711111111111111) .  
:result :invSqrt2Width (5 0.015458937198068) .  
:result :midpointScale (5 0.703381642512075) .  
:result :midpointNegScale (5 -0.703381642512075) .  
:result :entryAbsErrBoundMidpoint (5 0.007729468599034) .  
:result :rowAbsErrBoundMidpoint (5 0.015458937198068) .  
:result :rowNormSqBounds (5 0.967863894139887 1.01135802469136) .  
:result :rowNormSqWidth (5 0.043494130551473) .  
:result :rowNormSqContains1 (5 true) .  
:result :midpointRowsOrthogonal (5 true) .  
:result :n 6 .  
:result :sqrt2Dyadic (6 90 91 64) .  
:result :sqrt2Bounds (6 1.40625 1.421875) .  
:result :invSqrt2Bounds (6 0.703296703296703 0.711111111111111) .  
:result :invSqrt2Width (6 0.00781440781440801) .  
:result :midpointScale (6 0.707203907203905) .  
:result :midpointNegScale (6 -0.707203907203905) .  
:result :entryAbsErrBoundMidpoint (6 0.00390720390720401) .  
:result :rowAbsErrBoundMidpoint (6 0.00781440781440802) .  
:result :rowNormSqBounds (6 0.989252505736022 1.01135802469136) .  
:result :rowNormSqWidth (6 0.0221055189553381) .  
:result :rowNormSqContains1 (6 true) .  
:result :midpointRowsOrthogonal (6 true) .  
:result :n 7 .  
:result :sqrt2Dyadic (7 181 182 128) .  
:result :sqrt2Bounds (7 1.4140625 1.421875) .  
:result :invSqrt2Bounds (7 0.703296703296703 0.707182320441989) .  
:result :invSqrt2Width (7 0.00388561714528601) .  
:result :midpointScale (7 0.705239511869345) .  
:result :midpointNegScale (7 -0.705239511869345) .  
:result :entryAbsErrBoundMidpoint (7 0.001942808572643) .  
:result :rowAbsErrBoundMidpoint (7 0.003885617145286) .  
:result :rowNormSqBounds (7 0.989252505736022 1.00021366869143) .  
:result :rowNormSqWidth (7 0.0109611629554081) .  
:result :rowNormSqContains1 (7 true) .  
:result :midpointRowsOrthogonal (7 true) .  
:result :n 8 .  
:result :sqrt2Dyadic (8 362 363 256) .  
:result :sqrt2Bounds (8 1.4140625 1.41796875) .  
:result :invSqrt2Bounds (8 0.705234159779614 0.707182320441989) .  
:result :invSqrt2Width (8 0.00194816066237502) .  
:result :midpointScale (8 0.7062082401108) .  
:result :midpointNegScale (8 -0.7062082401108) .  
:result :entryAbsErrBoundMidpoint (8 0.00097408033118751) .  
:result :rowAbsErrBoundMidpoint (8 0.00194816066237502) .  
:result :rowNormSqBounds (8 0.994710440240117 1.00021366869143) .  
:result :rowNormSqWidth (8 0.00550322845131301) .  
:result :rowNormSqContains1 (8 true) .  
:result :midpointRowsOrthogonal (8 true) .  
:result :n 9 .  
:result :sqrt2Dyadic (9 724 725 512) .  
:result :sqrt2Bounds (9 1.4140625 1.416015625) .  
:result :invSqrt2Bounds (9 0.706206896551724 0.707182320441989) .  
:result :invSqrt2Width (9 0.000975423890265059) .  
:result :midpointScale (9 0.706694608496855) .  
:result :midpointNegScale (9 -0.706694608496855) .  
:result :entryAbsErrBoundMidpoint (9 0.00048771194513253) .  
:result :rowAbsErrBoundMidpoint (9 0.00097542389026506) .  
:result :rowNormSqBounds (9 0.997456361474435 1.00021366869143) .  
:result :rowNormSqWidth (9 0.00275730721699508) .  
:result :rowNormSqContains1 (9 true) .  
:result :midpointRowsOrthogonal (9 true) .  
:result :n 10 .  
:result :sqrt2Dyadic (10 1448 1449 1024) .  
:result :sqrt2Bounds (10 1.4140625 1.4150390625) .  
:result :invSqrt2Bounds (10 0.706694271911663 0.707182320441989) .  
:result :invSqrt2Width (10 0.000488048530326024) .  
:result :midpointScale (10 0.706938296176825) .  
:result :midpointNegScale (10 -0.706938296176825) .  
:result :entryAbsErrBoundMidpoint (10 0.000244024265163012) .  
:result :rowAbsErrBoundMidpoint (10 0.000488048530326024) .  
:result :rowNormSqBounds (10 0.998833587905512 1.00021366869143) .  
:result :rowNormSqWidth (10 0.001380080785918) .  
:result :rowNormSqContains1 (10 true) .  
:result :midpointRowsOrthogonal (10 true) .  
:result :n 11 .  
:result :sqrt2Dyadic (11 2896 2897 2048) .  
:result :sqrt2Bounds (11 1.4140625 1.41455078125) .  
:result :invSqrt2Bounds (11 0.70693821194339 0.707182320441989) .  
:result :invSqrt2Width (11 0.000244108498599016) .  
:result :midpointScale (11 0.70706026619269) .  
:result :midpointNegScale (11 -0.70706026619269) .  
:result :entryAbsErrBoundMidpoint (11 0.000122054249299508) .  
:result :rowAbsErrBoundMidpoint (11 0.000244108498599016) .  
:result :rowNormSqBounds (11 0.999523271011434 1.00021366869143) .  
:result :rowNormSqWidth (11 0.000690397679996013) .  
:result :rowNormSqContains1 (11 true) .  
:result :midpointRowsOrthogonal (11 true) .  
:result :n 12 .  
:result :sqrt2Dyadic (12 5792 5793 4096) .  
:result :sqrt2Bounds (12 1.4140625 1.414306640625) .  
:result :invSqrt2Bounds (12 0.707060245123425 0.707182320441989) .  
:result :invSqrt2Width (12 0.000122075318564008) .  
:result :midpointScale (12 0.707121282782705) .  
:result :midpointNegScale (12 -0.707121282782705) .  
:result :entryAbsErrBoundMidpoint (12 0.000061037659282004) .  
:result :rowAbsErrBoundMidpoint (12 0.000122075318564008) .  
:result :rowNormSqBounds (12 0.999868380467995 1.00021366869143) .  
:result :rowNormSqWidth (12 0.000345288223435047) .  
:result :rowNormSqContains1 (12 true) .  
:result :midpointRowsOrthogonal (12 true) .  
:result :n 13 .  
:result :sqrt2Dyadic (13 11585 11586 8192) .  
:result :sqrt2Bounds (13 1.4141845703125 1.414306640625) .  
:result :invSqrt2Bounds (13 0.707060245123425 0.707121277514027) .  
:result :invSqrt2Width (13 0.0000610323906019561) .  
:result :midpointScale (13 0.707090761318725) .  
:result :midpointNegScale (13 -0.707090761318725) .  
:result :entryAbsErrBoundMidpoint (13 0.0000305161953009781) .  
:result :rowAbsErrBoundMidpoint (13 0.0000610323906019562) .  
:result :rowNormSqBounds (13 0.999868380467995 1.00004100222614) .  
:result :rowNormSqWidth (13 0.00017262175814492) .  
:result :rowNormSqContains1 (13 true) .  
:result :midpointRowsOrthogonal (13 true) .  
:result :n 14 .  
:result :sqrt2Dyadic (14 23170 23171 16384) .  
:result :sqrt2Bounds (14 1.4141845703125 1.41424560546875) .  
:result :invSqrt2Bounds (14 0.707090760001726 0.707121277514027) .  
:result :invSqrt2Width (14 0.0000305175123009871) .  
:result :midpointScale (14 0.707106018757875) .  
:result :midpointNegScale (14 -0.707106018757875) .  
:result :entryAbsErrBoundMidpoint (14 0.0000152587561504935) .  
:result :rowAbsErrBoundMidpoint (14 0.000030517512300987) .  
:result :rowNormSqBounds (14 0.999954685759638 1.00004100222614) .  
:result :rowNormSqWidth (14 0.0000863164665019234) .  
:result :rowNormSqContains1 (14 true) .  
:result :midpointRowsOrthogonal (14 true) .  
:result :n 15 .  
:result :sqrt2Dyadic (15 46340 46341 32768) .  
:result :sqrt2Bounds (15 1.4141845703125 1.41421508789063) .  
:result :invSqrt2Bounds (15 0.707106018428605 0.707121277514027) .  
:result :invSqrt2Width (15 0.0000152590854219925) .  
:result :midpointScale (15 0.707113647971315) .  
:result :midpointNegScale (15 -0.707113647971315) .  
:result :entryAbsErrBoundMidpoint (15 0.00000762954271099625) .  
:result :rowAbsErrBoundMidpoint (15 0.0000152590854219925) .  
:result :rowNormSqBounds (15 0.99999784259591 1.00004100222614) .  
:result :rowNormSqWidth (15 0.0000431596302299386) .  
:result :rowNormSqContains1 (15 true) .  
:result :midpointRowsOrthogonal (15 true) .  
:result :n 16 .  
:result :sqrt2Dyadic (16 92681 92682 65536) .  
:result :sqrt2Bounds (16 1.41419982910156 1.41421508789063) .  
:result :invSqrt2Bounds (16 0.707106018428605 0.707113647888996) .  
:result :invSqrt2Width (16 0.00000762946039101209) .  
:result :midpointScale (16 0.7071098331588) .  
:result :midpointNegScale (16 -0.7071098331588) .  
:result :entryAbsErrBoundMidpoint (16 0.00000381473019550605) .  
:result :rowAbsErrBoundMidpoint (16 0.0000076294603910121) .  
:result :rowNormSqBounds (16 0.99999784259591 1.00001942206176) .  
:result :rowNormSqWidth (16 0.000021579465850019) .  
:result :rowNormSqContains1 (16 true) .  
:result :midpointRowsOrthogonal (16 true) .  
:result :n 17 .  
:result :sqrt2Dyadic (17 185363 185364 131072) .  
:result :sqrt2Bounds (17 1.41420745849609 1.41421508789063) .  
:result :invSqrt2Bounds (17 0.707106018428605 0.707109833138221) .  
:result :invSqrt2Width (17 0.00000381470961596797) .  
:result :midpointScale (17 0.707107925783415) .  
:result :midpointNegScale (17 -0.707107925783415) .  
:result :entryAbsErrBoundMidpoint (17 0.00000190735480798398) .  
:result :rowAbsErrBoundMidpoint (17 0.00000381470961596796) .  
:result :rowNormSqBounds (17 0.99999784259591 1.00000863224152) .  
:result :rowNormSqWidth (17 0.0000107896456100764) .  
:result :rowNormSqContains1 (17 true) .  
:result :midpointRowsOrthogonal (17 true) .  
:result :n 18 .  
:result :sqrt2Dyadic (18 370727 370728 262144) .  
:result :sqrt2Bounds (18 1.41421127319336 1.41421508789063) .  
:result :invSqrt2Bounds (18 0.707106018428605 0.707107925778268) .  
:result :invSqrt2Width (18 0.00000190734966298844) .  
:result :midpointScale (18 0.707106972103435) .  
:result :midpointNegScale (18 -0.707106972103435) .  
:result :entryAbsErrBoundMidpoint (18 9.5367483149422e-7) .  
:result :rowAbsErrBoundMidpoint (18 0.00000190734966298844) .  
:result :rowNormSqBounds (18 0.99999784259591 1.00000323739689) .  
:result :rowNormSqWidth (18 0.00000539480097994094) .  
:result :rowNormSqContains1 (18 true) .  
:result :midpointRowsOrthogonal (18 true) .  
:result :n 19 .  
:result :sqrt2Dyadic (19 741455 741456 524288) .  
:result :sqrt2Bounds (19 1.41421318054199 1.41421508789063) .  
:result :invSqrt2Bounds (19 0.707106018428605 0.70710697210215) .  
:result :invSqrt2Width (19 9.53673545023292e-7) .  
:result :midpointScale (19 0.707106495265375) .  
:result :midpointNegScale (19 -0.707106495265375) .  
:result :entryAbsErrBoundMidpoint (19 4.76836772511646e-7) .  
:result :rowAbsErrBoundMidpoint (19 9.53673545023292e-7) .  
:result :rowNormSqBounds (19 0.99999784259591 1.00000053999094) .  
:result :rowNormSqWidth (19 0.00000269739503000466) .  
:result :rowNormSqContains1 (19 true) .  
:result :midpointRowsOrthogonal (19 true) .  
:result :n 20 .  
:result :sqrt2Dyadic (20 1482910 1482911 1048576) .  
:result :sqrt2Bounds (20 1.41421318054199 1.41421413421631) .  
:result :invSqrt2Bounds (20 0.707106495265056 0.70710697210215) .  
:result :invSqrt2Width (20 4.76837094032234e-7) .  
:result :midpointScale (20 0.707106733683605) .  
:result :midpointNegScale (20 -0.707106733683605) .  
:result :entryAbsErrBoundMidpoint (20 2.38418547016117e-7) .  
:result :rowAbsErrBoundMidpoint (20 4.76837094032234e-7) .  
:result :rowNormSqBounds (20 0.999999191292062 1.00000053999094) .  
:result :rowNormSqWidth (20 0.00000134869887791211) .  
:result :rowNormSqContains1 (20 true) .  
:result :midpointRowsOrthogonal (20 true) .  
:result :HEntry (0 0 0 0.5 1 0 0) .  
:result :HEntry (0 0 1 0.5 1 0 0) .  
:result :HEntry (0 1 0 0.5 1 0 0) .  
:result :HEntry (0 1 1 -1 -0.5 0 0) .  
:result :HEntry (1 0 0 0.666666666666667 1 0 0) .  
:result :HEntry (1 0 1 0.666666666666667 1 0 0) .  
:result :HEntry (1 1 0 0.666666666666667 1 0 0) .  
:result :HEntry (1 1 1 -1 -0.666666666666667 0 0) .  
:result :HEntry (2 0 0 0.666666666666667 0.8 0 0) .  
:result :HEntry (2 0 1 0.666666666666667 0.8 0 0) .  
:result :HEntry (2 1 0 0.666666666666667 0.8 0 0) .  
:result :HEntry (2 1 1 -0.8 -0.666666666666667 0 0) .  
:result :HEntry (3 0 0 0.666666666666667 0.727272727272727 0 0) .  
:result :HEntry (3 0 1 0.666666666666667 0.727272727272727 0 0) .  
:result :HEntry (3 1 0 0.666666666666667 0.727272727272727 0 0) .  
:result :HEntry (3 1 1 -0.727272727272727 -0.666666666666667 0 0) .  
:result :HEntry (4 0 0 0.695652173913043 0.727272727272727 0 0) .  
:result :HEntry (4 0 1 0.695652173913043 0.727272727272727 0 0) .  
:result :HEntry (4 1 0 0.695652173913043 0.727272727272727 0 0) .  
:result :HEntry (4 1 1 -0.727272727272727 -0.695652173913043 0 0) .  
:result :HEntry (5 0 0 0.695652173913043 0.711111111111111 0 0) .  
:result :HEntry (5 0 1 0.695652173913043 0.711111111111111 0 0) .  
:result :HEntry (5 1 0 0.695652173913043 0.711111111111111 0 0) .  
:result :HEntry (5 1 1 -0.711111111111111 -0.695652173913043 0 0) .  
:result :HEntry (6 0 0 0.703296703296703 0.711111111111111 0 0) .  
:result :HEntry (6 0 1 0.703296703296703 0.711111111111111 0 0) .  
:result :HEntry (6 1 0 0.703296703296703 0.711111111111111 0 0) .  
:result :HEntry (6 1 1 -0.711111111111111 -0.703296703296703 0 0) .  
:result :HEntry (7 0 0 0.703296703296703 0.707182320441989 0 0) .  
:result :HEntry (7 0 1 0.703296703296703 0.707182320441989 0 0) .  
:result :HEntry (7 1 0 0.703296703296703 0.707182320441989 0 0) .  
:result :HEntry (7 1 1 -0.707182320441989 -0.703296703296703 0 0) .  
:result :HEntry (8 0 0 0.705234159779614 0.707182320441989 0 0) .  
:result :HEntry (8 0 1 0.705234159779614 0.707182320441989 0 0) .  
:result :HEntry (8 1 0 0.705234159779614 0.707182320441989 0 0) .  
:result :HEntry (8 1 1 -0.707182320441989 -0.705234159779614 0 0) .  
:result :HEntry (9 0 0 0.706206896551724 0.707182320441989 0 0) .  
:result :HEntry (9 0 1 0.706206896551724 0.707182320441989 0 0) .  
:result :HEntry (9 1 0 0.706206896551724 0.707182320441989 0 0) .  
:result :HEntry (9 1 1 -0.707182320441989 -0.706206896551724 0 0) .  
:result :HEntry (10 0 0 0.706694271911663 0.707182320441989 0 0) .  
:result :HEntry (10 0 1 0.706694271911663 0.707182320441989 0 0) .  
:result :HEntry (10 1 0 0.706694271911663 0.707182320441989 0 0) .  
:result :HEntry (10 1 1 -0.707182320441989 -0.706694271911663 0 0) .  
:result :HEntry (11 0 0 0.70693821194339 0.707182320441989 0 0) .  
:result :HEntry (11 0 1 0.70693821194339 0.707182320441989 0 0) .  
:result :HEntry (11 1 0 0.70693821194339 0.707182320441989 0 0) .  
:result :HEntry (11 1 1 -0.707182320441989 -0.70693821194339 0 0) .  
:result :HEntry (12 0 0 0.707060245123425 0.707182320441989 0 0) .  
:result :HEntry (12 0 1 0.707060245123425 0.707182320441989 0 0) .  
:result :HEntry (12 1 0 0.707060245123425 0.707182320441989 0 0) .  
:result :HEntry (12 1 1 -0.707182320441989 -0.707060245123425 0 0) .  
:result :HEntry (13 0 0 0.707060245123425 0.707121277514027 0 0) .  
:result :HEntry (13 0 1 0.707060245123425 0.707121277514027 0 0) .  
:result :HEntry (13 1 0 0.707060245123425 0.707121277514027 0 0) .  
:result :HEntry (13 1 1 -0.707121277514027 -0.707060245123425 0 0) .  
:result :HEntry (14 0 0 0.707090760001726 0.707121277514027 0 0) .  
:result :HEntry (14 0 1 0.707090760001726 0.707121277514027 0 0) .  
:result :HEntry (14 1 0 0.707090760001726 0.707121277514027 0 0) .  
:result :HEntry (14 1 1 -0.707121277514027 -0.707090760001726 0 0) .  
:result :HEntry (15 0 0 0.707106018428605 0.707121277514027 0 0) .  
:result :HEntry (15 0 1 0.707106018428605 0.707121277514027 0 0) .  
:result :HEntry (15 1 0 0.707106018428605 0.707121277514027 0 0) .  
:result :HEntry (15 1 1 -0.707121277514027 -0.707106018428605 0 0) .  
:result :HEntry (16 0 0 0.707106018428605 0.707113647888996 0 0) .  
:result :HEntry (16 0 1 0.707106018428605 0.707113647888996 0 0) .  
:result :HEntry (16 1 0 0.707106018428605 0.707113647888996 0 0) .  
:result :HEntry (16 1 1 -0.707113647888996 -0.707106018428605 0 0) .  
:result :HEntry (17 0 0 0.707106018428605 0.707109833138221 0 0) .  
:result :HEntry (17 0 1 0.707106018428605 0.707109833138221 0 0) .  
:result :HEntry (17 1 0 0.707106018428605 0.707109833138221 0 0) .  
:result :HEntry (17 1 1 -0.707109833138221 -0.707106018428605 0 0) .  
:result :HEntry (18 0 0 0.707106018428605 0.707107925778268 0 0) .  
:result :HEntry (18 0 1 0.707106018428605 0.707107925778268 0 0) .  
:result :HEntry (18 1 0 0.707106018428605 0.707107925778268 0 0) .  
:result :HEntry (18 1 1 -0.707107925778268 -0.707106018428605 0 0) .  
:result :HEntry (19 0 0 0.707106018428605 0.70710697210215 0 0) .  
:result :HEntry (19 0 1 0.707106018428605 0.70710697210215 0 0) .  
:result :HEntry (19 1 0 0.707106018428605 0.70710697210215 0 0) .  
:result :HEntry (19 1 1 -0.70710697210215 -0.707106018428605 0 0) .  
:result :HEntry (20 0 0 0.707106495265056 0.70710697210215 0 0) .  
:result :HEntry (20 0 1 0.707106495265056 0.70710697210215 0 0) .  
:result :HEntry (20 1 0 0.707106495265056 0.70710697210215 0 0) .  
:result :HEntry (20 1 1 -0.70710697210215 -0.707106495265056 0 0) .  
:result :HMidpointEntry (0 0 0 0.75 0) .  
:result :HMidpointEntry (0 0 1 0.75 0) .  
:result :HMidpointEntry (0 1 0 0.75 0) .  
:result :HMidpointEntry (0 1 1 -0.75 0) .  
:result :HMidpointEntry (1 0 0 0.833333333333335 0) .  
:result :HMidpointEntry (1 0 1 0.833333333333335 0) .  
:result :HMidpointEntry (1 1 0 0.833333333333335 0) .  
:result :HMidpointEntry (1 1 1 -0.833333333333335 0) .  
:result :HMidpointEntry (2 0 0 0.733333333333335 0) .  
:result :HMidpointEntry (2 0 1 0.733333333333335 0) .  
:result :HMidpointEntry (2 1 0 0.733333333333335 0) .  
:result :HMidpointEntry (2 1 1 -0.733333333333335 0) .  
:result :HMidpointEntry (3 0 0 0.696969696969695 0) .  
:result :HMidpointEntry (3 0 1 0.696969696969695 0) .  
:result :HMidpointEntry (3 1 0 0.696969696969695 0) .  
:result :HMidpointEntry (3 1 1 -0.696969696969695 0) .  
:result :HMidpointEntry (4 0 0 0.711462450592885 0) .  
:result :HMidpointEntry (4 0 1 0.711462450592885 0) .  
:result :HMidpointEntry (4 1 0 0.711462450592885 0) .  
:result :HMidpointEntry (4 1 1 -0.711462450592885 0) .  
:result :HMidpointEntry (5 0 0 0.703381642512075 0) .  
:result :HMidpointEntry (5 0 1 0.703381642512075 0) .  
:result :HMidpointEntry (5 1 0 0.703381642512075 0) .  
:result :HMidpointEntry (5 1 1 -0.703381642512075 0) .  
:result :HMidpointEntry (6 0 0 0.707203907203905 0) .  
:result :HMidpointEntry (6 0 1 0.707203907203905 0) .  
:result :HMidpointEntry (6 1 0 0.707203907203905 0) .  
:result :HMidpointEntry (6 1 1 -0.707203907203905 0) .  
:result :HMidpointEntry (7 0 0 0.705239511869345 0) .  
:result :HMidpointEntry (7 0 1 0.705239511869345 0) .  
:result :HMidpointEntry (7 1 0 0.705239511869345 0) .  
:result :HMidpointEntry (7 1 1 -0.705239511869345 0) .  
:result :HMidpointEntry (8 0 0 0.7062082401108 0) .  
:result :HMidpointEntry (8 0 1 0.7062082401108 0) .  
:result :HMidpointEntry (8 1 0 0.7062082401108 0) .  
:result :HMidpointEntry (8 1 1 -0.7062082401108 0) .  
:result :HMidpointEntry (9 0 0 0.706694608496855 0) .  
:result :HMidpointEntry (9 0 1 0.706694608496855 0) .  
:result :HMidpointEntry (9 1 0 0.706694608496855 0) .  
:result :HMidpointEntry (9 1 1 -0.706694608496855 0) .  
:result :HMidpointEntry (10 0 0 0.706938296176825 0) .  
:result :HMidpointEntry (10 0 1 0.706938296176825 0) .  
:result :HMidpointEntry (10 1 0 0.706938296176825 0) .  
:result :HMidpointEntry (10 1 1 -0.706938296176825 0) .  
:result :HMidpointEntry (11 0 0 0.70706026619269 0) .  
:result :HMidpointEntry (11 0 1 0.70706026619269 0) .  
:result :HMidpointEntry (11 1 0 0.70706026619269 0) .  
:result :HMidpointEntry (11 1 1 -0.70706026619269 0) .  
:result :HMidpointEntry (12 0 0 0.707121282782705 0) .  
:result :HMidpointEntry (12 0 1 0.707121282782705 0) .  
:result :HMidpointEntry (12 1 0 0.707121282782705 0) .  
:result :HMidpointEntry (12 1 1 -0.707121282782705 0) .  
:result :HMidpointEntry (13 0 0 0.707090761318725 0) .  
:result :HMidpointEntry (13 0 1 0.707090761318725 0) .  
:result :HMidpointEntry (13 1 0 0.707090761318725 0) .  
:result :HMidpointEntry (13 1 1 -0.707090761318725 0) .  
:result :HMidpointEntry (14 0 0 0.707106018757875 0) .  
:result :HMidpointEntry (14 0 1 0.707106018757875 0) .  
:result :HMidpointEntry (14 1 0 0.707106018757875 0) .  
:result :HMidpointEntry (14 1 1 -0.707106018757875 0) .  
:result :HMidpointEntry (15 0 0 0.707113647971315 0) .  
:result :HMidpointEntry (15 0 1 0.707113647971315 0) .  
:result :HMidpointEntry (15 1 0 0.707113647971315 0) .  
:result :HMidpointEntry (15 1 1 -0.707113647971315 0) .  
:result :HMidpointEntry (16 0 0 0.7071098331588 0) .  
:result :HMidpointEntry (16 0 1 0.7071098331588 0) .  
:result :HMidpointEntry (16 1 0 0.7071098331588 0) .  
:result :HMidpointEntry (16 1 1 -0.7071098331588 0) .  
:result :HMidpointEntry (17 0 0 0.707107925783415 0) .  
:result :HMidpointEntry (17 0 1 0.707107925783415 0) .  
:result :HMidpointEntry (17 1 0 0.707107925783415 0) .  
:result :HMidpointEntry (17 1 1 -0.707107925783415 0) .  
:result :HMidpointEntry (18 0 0 0.707106972103435 0) .  
:result :HMidpointEntry (18 0 1 0.707106972103435 0) .  
:result :HMidpointEntry (18 1 0 0.707106972103435 0) .  
:result :HMidpointEntry (18 1 1 -0.707106972103435 0) .  
:result :HMidpointEntry (19 0 0 0.707106495265375 0) .  
:result :HMidpointEntry (19 0 1 0.707106495265375 0) .  
:result :HMidpointEntry (19 1 0 0.707106495265375 0) .  
:result :HMidpointEntry (19 1 1 -0.707106495265375 0) .  
:result :HMidpointEntry (20 0 0 0.707106733683605 0) .  
:result :HMidpointEntry (20 0 1 0.707106733683605 0) .  
:result :HMidpointEntry (20 1 0 0.707106733683605 0) .  
:result :HMidpointEntry (20 1 1 -0.707106733683605 0) .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "hadamard_approx" .  
  in:run see:title "Hadamard gate approximation" .  
  in:run see:sourceFile "examples/n3/hadamard_approx.n3" .  
  in:run see:sourceSHA256 "e8ecabf81463a98ebcb7a1970dfe31792d96011b5e060ad2ed6f5f02ee46a6d2" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 8 .  
  in:run see:compiledRules 10 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 3 .  
}  
```  

