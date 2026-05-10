# Annotation  

## Conclusion  
The derivation produced 1 formula-valued conclusion(s).  
Main conclusion: **:t log:nameOf { :a :name "Alice" }.**  

Selected conclusions:  
- :t log:nameOf { :a :name "Alice" } .  

## Explanation  
Starts with 4 source fact(s), applies 0 rule(s), and reaches a fixpoint.  

Selected explanation support:  
  - :t log:nameOf { :a :name "Alice" } . _(source)_  

The formula-valued facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/annotation#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "annotation" .  
  in:run see:title "Annotation" .  
  in:run see:sourceFile "examples/n3/annotation.n3" .  
  in:run see:sourceSHA256 "fa6faef8fac2e328ccfb894c21eef260b0935a936b5e9806f8889719e7f39e4f" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 4 .  
  in:run see:compiledRules 0 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

