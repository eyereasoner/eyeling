# If two equivalence classes share an element, they are the same class.  

## Conclusion  
The compiled query selected 18 fact(s) after the rule closure was computed.  
Main conclusion: **:result :sameClassBecauseOfSharedMember (:a :b :c).**  

Selected conclusions:  
- :result :sameClassBecauseOfSharedMember (:a :b :c) .  
- :result :sameClassBecauseOfSharedMember (:a :c :c) .  
- :result :sameClassBecauseOfSharedMember (:c :b :a) .  
- :result :sameClassBecauseOfSharedMember (:c :a :a) .  
- :result :sameClassBecauseOfSharedMember (:b :a :c) .  
- :result :sameClassBecauseOfSharedMember (:b :c :c) .  

## Explanation  
Starts with 5 source fact(s), applies 7 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 1: ?x :inX true => ?x :sim ?x derives :a :sim :a ., :b :sim :b ., :c :sim :c .  
  - Uses: :a :inX true . _(source)_; :b :inX true . _(source)_; :c :inX true . _(source)_  
- Rule 2: ?x :sim ?y => ?y :sim ?x derives :a :sim :b ., :c :sim :b .  
  - Uses: :b :sim :a . _(source)_; :b :sim :c . _(source)_  
- Rule 3: ?x :sim ?y; ?y :sim ?z => ?x :sim ?z derives :a :sim :c ., :c :sim :a .  
  - Uses: :a :sim :b . _(derived)_; :b :sim :c . _(source)_; :c :sim :b . _(derived)_; :b :sim :a . _(source)_  
- Rule 4: ?u :sim ?x => ?u :inClassOf ?x derives :b :inClassOf :a ., :b :inClassOf :c ., :a :inClassOf :a ., :b :inClassOf :b ., … +5 more  
  - Uses: :b :sim :a . _(source)_; :b :sim :c . _(source)_; :a :sim :a . _(derived)_; :b :sim :b . _(derived)_; … +5 more premise fact(s)  
- Rule 5: ?x :sim ?y => (?x ?y) :sameClass true derives (:b :a) :sameClass true ., (:b :c) :sameClass true ., (:a :a) :sameClass true ., (:b :b) :sameClass true ., … +5 more  
  - Uses: :b :sim :a . _(source)_; :b :sim :c . _(source)_; :a :sim :a . _(derived)_; :b :sim :b . _(derived)_; … +5 more premise fact(s)  
- Rule 7 (3 premise pattern(s) => 1 conclusion pattern(s)) derives (:a :a :b) :sharedMemberShowsSameClass true ., (:a :c :b) :sharedMemberShowsSameClass true ., (:a :b :b) :sharedMemberShowsSameClass true ., (:c :a :b) :sharedMemberShowsSameClass true ., … +23 more  
  - Uses: :b :inClassOf :a . _(derived)_; (:a :a) :sameClass true . _(derived)_; :b :inClassOf :c . _(derived)_; (:a :c) :sameClass true . _(derived)_; … +14 more premise fact(s)  

Selected explanation support:  
  - :result :sameClassBecauseOfSharedMember (:a :b :c) . _(no recorded rule support)_  
  - :result :sameClassBecauseOfSharedMember (:a :c :c) . _(no recorded rule support)_  
  - :result :sameClassBecauseOfSharedMember (:c :b :a) . _(no recorded rule support)_  
  - :result :sameClassBecauseOfSharedMember (:c :a :a) . _(no recorded rule support)_  
  - :result :sameClassBecauseOfSharedMember (:b :a :c) . _(no recorded rule support)_  
  - :result :sameClassBecauseOfSharedMember (:b :c :c) . _(no recorded rule support)_  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/eye/reasoning#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:result :sameClassBecauseOfSharedMember (:a :c :b) .  
:result :sameClassBecauseOfSharedMember (:a :b :b) .  
:result :sameClassBecauseOfSharedMember (:c :a :b) .  
:result :sameClassBecauseOfSharedMember (:c :b :b) .  
:result :sameClassBecauseOfSharedMember (:a :b :a) .  
:result :sameClassBecauseOfSharedMember (:a :c :a) .  
:result :sameClassBecauseOfSharedMember (:b :a :b) .  
:result :sameClassBecauseOfSharedMember (:b :c :b) .  
:result :sameClassBecauseOfSharedMember (:c :b :c) .  
:result :sameClassBecauseOfSharedMember (:c :a :c) .  
:result :sameClassBecauseOfSharedMember (:b :a :a) .  
:result :sameClassBecauseOfSharedMember (:b :c :a) .  
:result :sameClassBecauseOfSharedMember (:b :c :c) .  
:result :sameClassBecauseOfSharedMember (:b :a :c) .  
:result :sameClassBecauseOfSharedMember (:c :a :a) .  
:result :sameClassBecauseOfSharedMember (:c :b :a) .  
:result :sameClassBecauseOfSharedMember (:a :c :c) .  
:result :sameClassBecauseOfSharedMember (:a :b :c) .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "equivalence_classes_overlap_implies_same_class" .  
  in:run see:title "If two equivalence classes share an element, they are the same class." .  
  in:run see:sourceFile "examples/n3/equivalence_classes_overlap_implies_same_class.n3" .  
  in:run see:sourceSHA256 "b36ed917f7af601a38f6a1657ce4956a4e38484573c40d0a963e3008cbb46f5f" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 5 .  
  in:run see:compiledRules 7 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

