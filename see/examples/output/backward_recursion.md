# Backward recursion coverage  

## Insight  
The compiled query selected 2 fact(s) after the rule closure was computed.  
Main conclusion: **:a :reaches :c.**  

Selected conclusions:  
- :a :reaches :c .  
- :a :reaches :b .  

## Explanation  
Starts with 2 source fact(s), applies 3 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 3: :a :ancestor ?who => :a :reaches ?who derives :a :reaches :b ., :a :reaches :c .  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  

Selected explanation support:  
  - :a :reaches :c . _(derived by Rule 3)_  
    - no graph premises; built-ins/constants satisfied the rule.  
  - :a :reaches :b . _(derived by Rule 3)_  
    - no graph premises; built-ins/constants satisfied the rule.  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <urn:example#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:a :reaches :b .  
:a :reaches :c .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "backward_recursion" .  
  in:run see:title "Backward recursion coverage" .  
  in:run see:sourceFile "examples/n3/backward_recursion.n3" .  
  in:run see:sourceSHA256 "1249b9825793b7f0174c87a4d0e44752cb63f3940cc332c0d00fc6bb15a081d1" .  
  in:run see:description "Demonstrates recursive <= rules compiled into specialized JavaScript." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 2 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 2 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

