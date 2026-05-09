# Existential rule  

## Insight  
The derivation produced 2 new fact(s) from 2 stated fact(s).  
Main conclusion: **:Plato is _:B.**  

Selected conclusions:  
- :Plato :is _:B .  
- :Socrates :is _:B .  

## Explanation  
Starts with 2 source fact(s), applies 1 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 1: ?S rdf:type :Human => ?S :is _:B derives :Socrates :is _:B ., :Plato :is _:B .  
  - Uses: :Socrates rdf:type :Human . _(source)_; :Plato rdf:type :Human . _(source)_  

Selected explanation support:  
  - :Plato :is _:B . _(derived by Rule 1)_  
    - :Plato rdf:type :Human . _(source)_  
  - :Socrates :is _:B . _(derived by Rule 1)_  
    - :Socrates rdf:type :Human . _(source)_  

The selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .  
@prefix : <https://eyereasoner.github.io/eye/reasoning#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:Socrates :is _:B .  
:Plato :is _:B .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "existential_rule" .  
  in:run see:title "Existential rule" .  
  in:run see:sourceFile "examples/n3/existential_rule.n3" .  
  in:run see:sourceSHA256 "f47b48d679b4bf2149782d40e01abb6f0d72cbbd0582bd7ab8a0ed2046f991f7" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 2 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

