# Socrates inference  

## Conclusion  
The compiled query selected 2 fact(s) after the rule closure was computed.  
Main conclusion: **:Socrates is a :Mortal.**  

Selected conclusions:  
- :Socrates rdf:type :Mortal .  
- :Socrates rdf:type :Human .  

## Explanation  
Starts with 2 source fact(s), applies 1 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 1: ?S rdf:type ?A; ?A rdfs:subClassOf ?B => ?S rdf:type ?B derives :Socrates rdf:type :Mortal .  
  - Uses: :Socrates rdf:type :Human . _(source)_; :Human rdfs:subClassOf :Mortal . _(source)_  

Selected explanation support:  
  - :Socrates rdf:type :Mortal . _(derived by Rule 1)_  
    - :Socrates rdf:type :Human . _(source)_  
    - :Human rdfs:subClassOf :Mortal . _(source)_  
  - :Socrates rdf:type :Human . _(source)_  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix : <http://example.org/socrates#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:Socrates rdf:type :Human .  
:Socrates rdf:type :Mortal .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "socrates" .  
  in:run see:title "Socrates inference" .  
  in:run see:sourceFile "examples/n3/socrates.n3" .  
  in:run see:sourceSHA256 "a0c8a488401f3247c2371978378e7f4c532c8b6c22d5f5642665e93fd8c576a4" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 2 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

