# RC Discharge Envelope  

## Conclusion  
exact decay symbol : exp(-1/4)  
certified decay interval : [0.7788007830, 0.7788007831]  
first below tolerance step : 13  
first below tolerance time : 0.325 s  
upper voltage at step 13 : 0.930581 V  

## Explanation  
The physical decay factor is exp(-1/4), but the example uses a finite double interval as the certificate. Because the interval lies strictly between 0 and 1, the capacitor voltage envelope contracts each sample. The upper envelope is the safety-relevant bound: once it falls below 1.0 V, every compatible exact trajectory is below tolerance.  

**Generated derivation support**  

Compiled support: 12 source fact(s), 6 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (6 premise pattern(s) => 1 conclusion pattern(s)) derives :step12 :upperVoltage 1.19488964135521 ., :step13 :upperVoltage 0.930580988405513 .  
  - Uses: :case :initialVoltage 24 . _(source)_; :case :decayUpper 0.7788007831 . _(source)_; :case :candidateStep :step12 . _(source)_; :step12 :index 12 . _(source)_; … +2 more premise fact(s)  
- Rule 2 (3 premise pattern(s) => 1 conclusion pattern(s)) derives :step13 :belowTolerance true .  
  - Uses: :case :tolerance 1 . _(source)_; :step13 :upperVoltage 0.930580988405513 . _(derived)_  
- Rule 3 (3 premise pattern(s) => 1 conclusion pattern(s)) derives :step12 :notBelowTolerance true .  
  - Uses: :case :tolerance 1 . _(source)_; :step12 :upperVoltage 1.19488964135521 . _(derived)_  
- Rule 4 (6 premise pattern(s) => 1 conclusion pattern(s)) derives :case :firstBelowToleranceStep :step13 .  
  - Uses: :case :maxStep 18 . _(source)_; :step13 :index 13 . _(source)_; :step13 :previousStep :step12 . _(source)_; :step13 :belowTolerance true . _(derived)_; … +1 more premise fact(s)  
- Rule 5 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :step13 :timeSeconds 0.325 .  
  - Uses: :case :samplePeriod 0.025 . _(source)_; :case :firstBelowToleranceStep :step13 . _(derived)_; :step13 :index 13 . _(source)_  
- Rule 6 (8 premise pattern(s) => 1 conclusion pattern(s)) derives :report log:outputString "[authored report]" .  
  - Uses: :case :exactDecaySymbol "exp(-1/4)" . _(source)_; :case :decayLower 0.778800783 . _(source)_; :case :decayUpper 0.7788007831 . _(source)_; :case :firstBelowToleranceStep :step13 . _(derived)_; … +3 more premise fact(s)  

Selected explanation support:  
  - :report log:outputString "[authored report]" . _(authored report, Rule 6)_  
  - :step13 :timeSeconds 0.325 . _(derived by Rule 5)_  
    - :case :samplePeriod 0.025 . _(source)_  
    - :case :firstBelowToleranceStep :step13 . _(derived by Rule 4)_  
      - :case :maxStep 18 . _(source)_  
      - :step13 :index 13 . _(source)_  
      - :step13 :previousStep :step12 . _(source)_  
      - :step13 :belowTolerance true . _(derived by Rule 2)_  
        - :case :tolerance 1 . _(source)_  
        - :step13 :upperVoltage 0.930580988405513 . _(derived by Rule 1)_  
          - :case :initialVoltage 24 . _(source)_  
          - :case :decayUpper 0.7788007831 . _(source)_  
          - :case :candidateStep :step13 . _(source)_  
          - :step13 :index 13 . _(source)_  
      - ... 1 more premise fact(s)  
    - :step13 :index 13 . _(source)_  
  - :case :firstBelowToleranceStep :step13 . _(derived by Rule 4)_  
    - :case :maxStep 18 . _(source)_  
    - :step13 :index 13 . _(source)_  
    - :step13 :previousStep :step12 . _(source)_  
    - :step13 :belowTolerance true . _(derived by Rule 2)_  
      - :case :tolerance 1 . _(source)_  
      - :step13 :upperVoltage 0.930580988405513 . _(derived by Rule 1)_  
        - :case :initialVoltage 24 . _(source)_  
        - :case :decayUpper 0.7788007831 . _(source)_  
        - :case :candidateStep :step13 . _(source)_  
        - :step13 :index 13 . _(source)_  
    - ... 1 more premise fact(s)  
  - :step12 :notBelowTolerance true . _(derived by Rule 3)_  
    - :case :tolerance 1 . _(source)_  
    - :step12 :upperVoltage 1.19488964135521 . _(derived by Rule 1)_  
      - :case :initialVoltage 24 . _(source)_  
      - :case :decayUpper 0.7788007831 . _(source)_  
      - :case :candidateStep :step12 . _(source)_  
      - :step12 :index 12 . _(source)_  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/rc-discharge-envelope#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:step12 :upperVoltage 1.19488964135521 .  
:step13 :upperVoltage 0.930580988405513 .  
:step13 :belowTolerance true .  
:step12 :notBelowTolerance true .  
:case :firstBelowToleranceStep :step13 .  
:step13 :timeSeconds 0.325 .  
:report log:outputString "=== Answer ===\nexact decay symbol : exp(-1/4)\ncertified decay interval : [0.7788007830, 0.7788007831]\nfirst below tolerance step : 13\nfirst below tolerance time : 0.325 s\nupper voltage at step 13 : 0.930581 V\n\n=== Explanation ===\nThe physical decay factor is exp(-1/4), but the example uses a finite double interval as the certificate. Because the interval lies strictly between 0 and 1, the capacitor voltage envelope contracts each sample. The upper envelope is the safety-relevant bound: once it falls below 1.0 V, every compatible exact trajectory is below tolerance." .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "rc_discharge_envelope" .  
  in:run see:title "RC Discharge Envelope" .  
  in:run see:sourceFile "examples/n3/rc_discharge_envelope.n3" .  
  in:run see:sourceSHA256 "41acff69cd2994230faedf5a466b4c43d47cdff9dc6d834baecd9865979160b8" .  
  in:run see:description "Certify when a sampled RC capacitor is guaranteed below tolerance using an\nupper decay bound. The witness is derived by N3 rules and compiled to SEE." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 12 .  
  in:run see:compiledRules 6 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

