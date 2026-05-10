# In a group, the inverse of an element is unique.  

## Entailment  
The compiled query selected 2 fact(s) after the rule closure was computed.  
Main entailment: **:result :sameInverse (:x :j :i).**  

Selected entailments:  
- :result :sameInverse (:x :j :i) .  
- :result :sameInverse (:x :i :j) .  

## Explanation  
Starts with 6 source fact(s), applies 6 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 3: ?a :inG true => (:e ?a) :mul ?a derives (:e :x) :mul :x ., (:e :i) :mul :i ., (:e :j) :mul :j ., (:e :e) :mul :e .  
  - Uses: :x :inG true . _(source)_; :i :inG true . _(source)_; :j :inG true . _(source)_; :e :inG true . _(source)_  
- Rule 4: ?a :inG true => (?a :e) :mul ?a derives (:x :e) :mul :x ., (:i :e) :mul :i ., (:j :e) :mul :j .  
  - Uses: :x :inG true . _(source)_; :i :inG true . _(source)_; :j :inG true . _(source)_  
- Rule 5 (3 premise pattern(s) => 2 conclusion pattern(s)) derives (:x :i) :mul :e ., (:i :x) :mul :e ., (:x :j) :mul :e ., (:j :x) :mul :e .  
  - Uses: :x :inG true . _(source)_; :i :inG true . _(source)_; :i :inverseOf :x . _(source)_; :j :inG true . _(source)_; … +1 more premise fact(s)  
- Rule 1 (4 premise pattern(s) => 1 conclusion pattern(s)) derives (:x :x) :sameTerm true ., (:e :e) :sameTerm true ., (:i :i) :sameTerm true ., (:j :j) :sameTerm true ., … +2 more  
  - Uses: (:e :x) :mul :x . _(derived)_; (:x :e) :mul :x . _(derived)_; (:x :i) :mul :e . _(derived)_; (:e :e) :mul :e . _(derived)_; … +7 more premise fact(s)  
- Rule 6 (3 premise pattern(s) => 1 conclusion pattern(s)) derives (:x :i :i) :sameInverse true ., (:x :i :j) :sameInverse true ., (:x :j :i) :sameInverse true ., (:x :j :j) :sameInverse true .  
  - Uses: :i :inverseOf :x . _(source)_; (:i :i) :sameTerm true . _(derived)_; :j :inverseOf :x . _(source)_; (:i :j) :sameTerm true . _(derived)_; … +2 more premise fact(s)  

Selected explanation support:  
  - :result :sameInverse (:x :j :i) . _(no recorded rule support)_  
  - :result :sameInverse (:x :i :j) . _(no recorded rule support)_  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/eye/reasoning#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:result :sameInverse (:x :i :j) .  
:result :sameInverse (:x :j :i) .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "group_inverse_uniqueness" .  
  in:run see:title "In a group, the inverse of an element is unique." .  
  in:run see:sourceFile "examples/n3/group_inverse_uniqueness.n3" .  
  in:run see:sourceSHA256 "956bff60a7e087600d31b0fce180031de1e03f7a995b3f2949e531653b7b5dc3" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 6 .  
  in:run see:compiledRules 6 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

