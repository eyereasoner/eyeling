# In a partial order, a greatest lower bound is unique.  

## Entailment  
The compiled query selected 2 fact(s) after the rule closure was computed.  
Main entailment: **:result :sameGreatestLowerBound (:a :b :g2 :g1).**  

Selected entailments:  
- :result :sameGreatestLowerBound (:a :b :g2 :g1) .  
- :result :sameGreatestLowerBound (:a :b :g1 :g2) .  

## Explanation  
Starts with 6 source fact(s), applies 7 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 1: ?x :inP true => ?x :leq ?x derives :a :leq :a ., :b :leq :b ., :g1 :leq :g1 ., :g2 :leq :g2 .  
  - Uses: :a :inP true . _(source)_; :b :inP true . _(source)_; :g1 :inP true . _(source)_; :g2 :inP true . _(source)_  
- Rule 3: ?x :leq ?y; ?y :leq ?x => (?x ?y) :sameTerm true derives (:a :a) :sameTerm true ., (:b :b) :sameTerm true ., (:g1 :g1) :sameTerm true ., (:g2 :g2) :sameTerm true ., … +2 more  
  - Uses: :a :leq :a . _(derived)_; :b :leq :b . _(derived)_; :g1 :leq :g1 . _(derived)_; :g2 :leq :g2 . _(derived)_; … +2 more premise fact(s)  
- Rule 5 (1 premise pattern(s) => 3 conclusion pattern(s)) derives :g1 :lowerBoundOf (:a :b) ., :g1 :leq :a ., :g1 :leq :b ., :g2 :lowerBoundOf (:a :b) ., … +2 more  
  - Uses: :g1 :glbOf (:a :b) . _(source)_; :g2 :glbOf (:a :b) . _(source)_  
- Rule 6: ?m :glbOf (?a ?b); ?l :lowerBoundOf (?a ?b) => ?l :leq ?m derives :g2 :leq :g1 ., :g1 :leq :g2 .  
  - Uses: :g1 :glbOf (:a :b) . _(source)_; :g2 :lowerBoundOf (:a :b) . _(derived)_; :g2 :glbOf (:a :b) . _(source)_; :g1 :lowerBoundOf (:a :b) . _(derived)_  
- Rule 7 (3 premise pattern(s) => 1 conclusion pattern(s)) derives (:a :b :g1 :g1) :sameGlb true ., (:a :b :g2 :g2) :sameGlb true ., (:a :b :g1 :g2) :sameGlb true ., (:a :b :g2 :g1) :sameGlb true .  
  - Uses: :g1 :glbOf (:a :b) . _(source)_; (:g1 :g1) :sameTerm true . _(derived)_; :g2 :glbOf (:a :b) . _(source)_; (:g2 :g2) :sameTerm true . _(derived)_; … +2 more premise fact(s)  

Selected explanation support:  
  - :result :sameGreatestLowerBound (:a :b :g2 :g1) . _(no recorded rule support)_  
  - :result :sameGreatestLowerBound (:a :b :g1 :g2) . _(no recorded rule support)_  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/eye/reasoning#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:result :sameGreatestLowerBound (:a :b :g1 :g2) .  
:result :sameGreatestLowerBound (:a :b :g2 :g1) .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "greatest_lower_bound_uniqueness" .  
  in:run see:title "In a partial order, a greatest lower bound is unique." .  
  in:run see:sourceFile "examples/n3/greatest_lower_bound_uniqueness.n3" .  
  in:run see:sourceSHA256 "3a199585b9906a895deba6508458c88551558aec89fdc1b490ed9493bbb63433" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 6 .  
  in:run see:compiledRules 7 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

