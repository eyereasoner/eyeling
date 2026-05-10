# Collection  

## Entailment  
The derivation produced 0 new fact(s) from 2 stated fact(s).  
Main entailment: **_:b2 :p :q.**  

Selected entailments:  
- _:b2 :p :q .  
- (1 _:b2 (2)) :p2 :q2 .  

## Explanation  
Starts with 2 source fact(s), applies 0 rule(s), and reaches a fixpoint.  

Selected explanation support:  
  - _:b2 :p :q . _(source)_  
  - (1 _:b2 (2)) :p2 :q2 . _(source)_  

The selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/collection#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "collection" .  
  in:run see:title "Collection" .  
  in:run see:sourceFile "examples/n3/collection.n3" .  
  in:run see:sourceSHA256 "ebce812d5e37729432cb77a638cde078af333450cc12ebd66b06083867cee7fa" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 2 .  
  in:run see:compiledRules 0 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

