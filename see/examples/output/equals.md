# Equals test  

## Insight  
The derivation produced 1 new fact(s) from 1 stated fact(s).  
Main conclusion: **:test is true.**  

Selected conclusions:  
- :test :is true .  

## Explanation  
Starts with 1 source fact(s), applies 1 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 1: :X owl:sameAs :Y => :test :is true derives :test :is true .  
  - Uses: :X owl:sameAs :Y . _(source)_  

Selected explanation support:  
  - :test :is true . _(derived by Rule 1)_  
    - :X owl:sameAs :Y . _(source)_  

The selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix owl: <http://www.w3.org/2002/07/owl#> .  
@prefix : <http://example.org/socrates#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:test :is true .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "equals" .  
  in:run see:title "Equals test" .  
  in:run see:sourceFile "examples/n3/equals.n3" .  
  in:run see:sourceSHA256 "29dfd303c09b0b2f05c637d6a56b6e3b198053a0732aa179ca3e75265dfb8003" .  
  in:run see:description "Example from Patrick Hochstenbach" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 1 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

