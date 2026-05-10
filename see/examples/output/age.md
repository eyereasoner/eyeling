# Age checker  

## Conclusion  
The compiled query selected 1 fact(s) after the rule closure was computed.  
Main conclusion: **:test is true.**  

Selected conclusions:  
- :test :is true .  

## Explanation  
Starts with 1 source fact(s), applies 1 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Selected explanation support:  
  - :test :is true . _(no recorded rule support)_  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .  
@prefix time: <http://www.w3.org/2000/10/swap/time#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix : <https://example.org/#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:test :is true .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "age" .  
  in:run see:title "Age checker" .  
  in:run see:sourceFile "examples/n3/age.n3" .  
  in:run see:sourceSHA256 "bf52bb918b595bb68a0a6304729e8129f3a851dc16cd3980ec5932115f2e7aea" .  
  in:run see:description "Is the age of a person above some duration?" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 1 .  
  in:run see:compiledRules 0 .  
  in:run see:compiledBackwardRules 1 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

