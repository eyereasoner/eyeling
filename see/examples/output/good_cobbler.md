# Good cobbler  

## Conclusion  
The derivation produced 1 formula-valued conclusion(s).  
Main conclusion: **:test is { :joe :is (:good :Cobbler) }.**  

Selected conclusions:  
- :test :is { :joe :is (:good :Cobbler) } .  

## Explanation  
Starts with 1 source fact(s), applies 1 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 1: ?X :is (:good ?Y) => :test :is { ?X :is (:good ?Y) } derives :test :is { :joe :is (:good :Cobbler) } .  
  - Uses: :joe :is (:good :Cobbler) . _(source)_  

Selected explanation support:  
  - :test :is { :joe :is (:good :Cobbler) } . _(derived by Rule 1)_  
    - :joe :is (:good :Cobbler) . _(source)_  

The formula-valued facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/good-cobbler#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  
@prefix out: <https://example.org/see/output#> .  

:test :is out:formula1 .  

out:formula1 {  
  :joe :is (:good :Cobbler) .  
}  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "good_cobbler" .  
  in:run see:title "Good cobbler" .  
  in:run see:sourceFile "examples/n3/good_cobbler.n3" .  
  in:run see:sourceSHA256 "7aeddb38a902b2684ba8824e3ec909e24716520433e9fbd31f6a0238cc1bd686" .  
  in:run see:description "Example from https://shs.hal.science/halshs-04148373/document\nUsing term logic http://intrologic.stanford.edu/chapters/chapter_11.html" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 1 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

