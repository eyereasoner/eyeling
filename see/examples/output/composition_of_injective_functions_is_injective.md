# Composition of injective functions is injective.  

## Conclusion  
The compiled query selected 2 fact(s) after the rule closure was computed.  
Main conclusion: **:result :sameInputByCompositeInjectivity (:h :b :a).**  

Selected conclusions:  
- :result :sameInputByCompositeInjectivity (:h :b :a) .  
- :result :sameInputByCompositeInjectivity (:h :a :b) .  

## Explanation  
Starts with 12 source fact(s), applies 8 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 1: ?x :inX true => (?x ?x) :sameTerm true derives (:a :a) :sameTerm true ., (:b :b) :sameTerm true .  
  - Uses: :a :inX true . _(source)_; :b :inX true . _(source)_  
- Rule 2: ?y :inY true => (?y ?y) :sameTerm true derives (:p :p) :sameTerm true ., (:q :q) :sameTerm true .  
  - Uses: :p :inY true . _(source)_; :q :inY true . _(source)_  
- Rule 3: ?z :inZ true => (?z ?z) :sameTerm true derives (:r :r) :sameTerm true .  
  - Uses: :r :inZ true . _(source)_  
- Rule 6 (4 premise pattern(s) => 1 conclusion pattern(s)) derives (:p :q) :sameTerm true ., (:q :p) :sameTerm true ., (:a :b) :sameTerm true ., (:b :a) :sameTerm true .  
  - Uses: :g :injective true . _(source)_; (:g :p) :app :r . _(source)_; (:g :q) :app :r . _(source)_; (:r :r) :sameTerm true . _(derived)_; … +5 more premise fact(s)  
- Rule 7 (3 premise pattern(s) => 1 conclusion pattern(s)) derives (:h :a) :app :r ., (:h :b) :app :r .  
  - Uses: :h :compositeOf (:g :f) . _(source)_; (:f :a) :app :p . _(source)_; (:g :p) :app :r . _(source)_; (:f :b) :app :q . _(source)_; … +1 more premise fact(s)  
- Rule 8 (9 premise pattern(s) => 1 conclusion pattern(s)) derives (:h :a :a) :sameInputUnderEqualCompositeOutput true ., (:h :b :b) :sameInputUnderEqualCompositeOutput true ., (:h :a :b) :sameInputUnderEqualCompositeOutput true ., (:h :b :a) :sameInputUnderEqualCompositeOutput true .  
  - Uses: :h :compositeOf (:g :f) . _(source)_; :f :injective true . _(source)_; :g :injective true . _(source)_; (:f :a) :app :p . _(source)_; … +8 more premise fact(s)  

Selected explanation support:  
  - :result :sameInputByCompositeInjectivity (:h :b :a) . _(no recorded rule support)_  
  - :result :sameInputByCompositeInjectivity (:h :a :b) . _(no recorded rule support)_  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/eye/reasoning#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:result :sameInputByCompositeInjectivity (:h :a :b) .  
:result :sameInputByCompositeInjectivity (:h :b :a) .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "composition_of_injective_functions_is_injective" .  
  in:run see:title "Composition of injective functions is injective." .  
  in:run see:sourceFile "examples/n3/composition_of_injective_functions_is_injective.n3" .  
  in:run see:sourceSHA256 "59429a6490d6587b42c78b3206d390c6a9c1570a2fcdfa09407be0261c99b88f" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 12 .  
  in:run see:compiledRules 8 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

