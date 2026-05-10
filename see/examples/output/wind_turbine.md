# Wind Turbine Envelope  

## Conclusion  
operating thresholds : cut-in 3.5 m/s, rated 12.0 m/s, cut-out 25.0 m/s  
rated power : 3.2 MW  
interval classifications : t1 3.0 m/s stopped 0.000 MW; t2 6.5 m/s partial 0.440 MW; t3 11.2 m/s partial 2.586 MW; t4 15.0 m/s rated 3.200 MW; t5 24.5 m/s rated 3.200 MW; t6 27.0 m/s stopped 0.000 MW  
usable intervals : 4  
total energy : 1.571 MWh  

## Explanation  
Wind below cut-in and at or above cut-out is stopped for production and safety. Wind between cut-in and rated speed follows a cubic power curve normalized to the rated point. Wind between rated speed and cut-out is capped at rated power. Energy is accumulated by multiplying each interval power by the ten-minute interval duration.  

**Generated derivation support**  

Compiled support: 23 source fact(s), 7 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (3 premise pattern(s) => 2 conclusion pattern(s)) derives :t1 :status "stopped" ., :t1 :powerMW 0 .  
  - Uses: :case :cutInMS 3.5 . _(source)_; :t1 :speedMS 3 . _(source)_  
- Rule 2 (3 premise pattern(s) => 2 conclusion pattern(s)) derives :t6 :status "stopped" ., :t6 :powerMW 0 .  
  - Uses: :case :cutOutMS 25 . _(source)_; :t6 :speedMS 27 . _(source)_  
- Rule 3 (13 premise pattern(s) => 2 conclusion pattern(s)) derives :t2 :status "partial" ., :t2 :powerMW 0.440086047029152 ., :t3 :status "partial" ., :t3 :powerMW 2.58649631332987 .  
  - Uses: :case :cutInMS 3.5 . _(source)_; :case :ratedMS 12 . _(source)_; :case :ratedPowerMW 3.2 . _(source)_; :t2 :speedMS 6.5 . _(source)_; … +1 more premise fact(s)  
- Rule 4 (6 premise pattern(s) => 2 conclusion pattern(s)) derives :t4 :status "rated" ., :t4 :powerMW 3.2 ., :t5 :status "rated" ., :t5 :powerMW 3.2 .  
  - Uses: :case :ratedMS 12 . _(source)_; :case :cutOutMS 25 . _(source)_; :case :ratedPowerMW 3.2 . _(source)_; :t4 :speedMS 15 . _(source)_; … +1 more premise fact(s)  
- Rule 5 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :t1 :nonNegativePower true ., :t2 :nonNegativePower true ., :t3 :nonNegativePower true ., :t4 :nonNegativePower true ., … +2 more  
  - Uses: :case :sample :t1 . _(source)_; :t1 :status "stopped" . _(derived)_; :t1 :powerMW 0 . _(derived)_; :case :sample :t2 . _(source)_; … +14 more premise fact(s)  
- Rule 6 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :t1 :withinRatedPower true ., :t2 :withinRatedPower true ., :t3 :withinRatedPower true ., :t4 :withinRatedPower true ., … +2 more  
  - Uses: :case :ratedPowerMW 3.2 . _(source)_; :case :sample :t1 . _(source)_; :t1 :powerMW 0 . _(derived)_; :case :sample :t2 . _(source)_; … +9 more premise fact(s)  

Selected explanation support:  
  - :report log:outputString "[authored report]" . _(authored report, Rule 7)_  
  - :t6 :withinRatedPower true . _(derived by Rule 6)_  
    - :case :ratedPowerMW 3.2 . _(source)_  
    - :case :sample :t6 . _(source)_  
    - :t6 :powerMW 0 . _(derived by Rule 2)_  
      - :case :cutOutMS 25 . _(source)_  
      - :t6 :speedMS 27 . _(source)_  
  - :t5 :withinRatedPower true . _(derived by Rule 6)_  
    - :case :ratedPowerMW 3.2 . _(source)_  
    - :case :sample :t5 . _(source)_  
    - :t5 :powerMW 3.2 . _(derived by Rule 4)_  
      - :case :ratedMS 12 . _(source)_  
      - :case :cutOutMS 25 . _(source)_  
      - :case :ratedPowerMW 3.2 . _(source)_  
      - :t5 :speedMS 24.5 . _(source)_  
  - :t4 :withinRatedPower true . _(derived by Rule 6)_  
    - :case :ratedPowerMW 3.2 . _(source)_  
    - :case :sample :t4 . _(source)_  
    - :t4 :powerMW 3.2 . _(derived by Rule 4)_  
      - :case :ratedMS 12 . _(source)_  
      - :case :cutOutMS 25 . _(source)_  
      - :case :ratedPowerMW 3.2 . _(source)_  
      - :t4 :speedMS 15 . _(source)_  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/wind-turbine#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:t1 :status "stopped" .  
:t1 :powerMW 0 .  
:t6 :status "stopped" .  
:t6 :powerMW 0 .  
:t2 :status "partial" .  
:t2 :powerMW 0.440086047029152 .  
:t3 :status "partial" .  
:t3 :powerMW 2.58649631332987 .  
:t4 :status "rated" .  
:t4 :powerMW 3.2 .  
:t5 :status "rated" .  
:t5 :powerMW 3.2 .  
:t1 :nonNegativePower true .  
:t2 :nonNegativePower true .  
:t3 :nonNegativePower true .  
:t4 :nonNegativePower true .  
:t5 :nonNegativePower true .  
:t6 :nonNegativePower true .  
:t1 :withinRatedPower true .  
:t2 :withinRatedPower true .  
:t3 :withinRatedPower true .  
:t4 :withinRatedPower true .  
:t5 :withinRatedPower true .  
:t6 :withinRatedPower true .  
:report log:outputString "=== Answer ===\noperating thresholds : cut-in 3.5 m/s, rated 12.0 m/s, cut-out 25.0 m/s\nrated power : 3.2 MW\ninterval classifications : t1 3.0 m/s stopped 0.000 MW; t2 6.5 m/s partial 0.440 MW; t3 11.2 m/s partial 2.586 MW; t4 15.0 m/s rated 3.200 MW; t5 24.5 m/s rated 3.200 MW; t6 27.0 m/s stopped 0.000 MW\nusable intervals : 4\ntotal energy : 1.571 MWh\n\n=== Explanation ===\nWind below cut-in and at or above cut-out is stopped for production and safety. Wind between cut-in and rated speed follows a cubic power curve normalized to the rated point. Wind between rated speed and cut-out is capped at rated power. Energy is accumulated by multiplying each interval power by the ten-minute interval duration." .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "wind_turbine" .  
  in:run see:title "Wind Turbine Envelope" .  
  in:run see:sourceFile "examples/n3/wind_turbine.n3" .  
  in:run see:sourceSHA256 "cf2129430d3165b9e304a078ce1b40c0f4634b4c98a14832c096ac0c1a70a049" .  
  in:run see:description "Classify wind-speed samples against a turbine operating envelope and compute\ninterval energy. The classification and cubic power curve are expressed in N3\nrules and compiled into a standalone SEE JavaScript example." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 23 .  
  in:run see:compiledRules 7 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

