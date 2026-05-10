# Dog license example  

## Conclusion  
The derivation produced 1 new fact(s) from 7 stated fact(s).  
Main conclusion: **:alice :mustHave :dogLicense.**  

Selected conclusions:  
- :alice :mustHave :dogLicense .  

## Explanation  
Starts with 7 source fact(s), applies 1 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 1 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :alice :mustHave :dogLicense .  
  - Uses: :alice :hasDog :dog1 . _(source)_  

Selected explanation support:  
  - :alice :mustHave :dogLicense . _(derived by Rule 1)_  
    - :alice :hasDog :dog1 . _(source)_  

The selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix : <https://eyereasoner.github.io/ns#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:alice :mustHave :dogLicense .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "dog" .  
  in:run see:title "Dog license example" .  
  in:run see:sourceFile "examples/n3/dog.n3" .  
  in:run see:sourceSHA256 "3487cceaf7e09eac16d9048cca2140bd1a474a2da0bf2091ffc0e0e5f87b3167" .  
  in:run see:description "If you have more than 4 dogs you need a license." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 7 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

