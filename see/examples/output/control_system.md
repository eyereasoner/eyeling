# Control System  

## Insight  
The compiled query selected 2 fact(s) after the rule closure was computed.  
Main conclusion: **:actuator2 :control1 26.08.**  

Selected conclusions:  
- :actuator2 :control1 26.08 .  
- :actuator1 :control1 39.2734619867828 .  

## Explanation  
Starts with 7 source fact(s), applies 4 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 1 (6 premise pattern(s) => 1 conclusion pattern(s)) derives :actuator1 :control1 39.2734619867828 .  
  - Uses: :input2 :measurement2 true . _(source)_; :disturbance1 :measurement3 35766 . _(source)_  
- Rule 2 (10 premise pattern(s) => 1 conclusion pattern(s)) derives :actuator2 :control1 26.08 .  
  - Uses: :input3 :measurement3 56967 . _(source)_; :state3 :observation3 22 . _(source)_; :output2 :measurement4 24 . _(source)_; :output2 :target2 29 . _(source)_  

Selected explanation support:  
  - :actuator2 :control1 26.08 . _(derived by Rule 2)_  
    - :input3 :measurement3 56967 . _(source)_  
    - :state3 :observation3 22 . _(source)_  
    - :output2 :measurement4 24 . _(source)_  
    - :output2 :target2 29 . _(source)_  
  - :actuator1 :control1 39.2734619867828 . _(derived by Rule 1)_  
    - :input2 :measurement2 true . _(source)_  
    - :disturbance1 :measurement3 35766 . _(source)_  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix : <https://eyereasoner.github.io/see/examples/control-system#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:actuator1 :control1 39.2734619867828 .  
:actuator2 :control1 26.08 .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "control_system" .  
  in:run see:title "Control System" .  
  in:run see:sourceFile "examples/n3/control_system.n3" .  
  in:run see:sourceSHA256 "0950a7098972ffc4883c2cc7410f7d54f5699111ecfc026bc88dba74ef0ffc40" .  
  in:run see:description "Compact SEE version of the EYE reasoning/control-system example." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 7 .  
  in:run see:compiledRules 2 .  
  in:run see:compiledBackwardRules 2 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

