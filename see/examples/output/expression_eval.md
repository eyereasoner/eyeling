# A tiny expression evaluator in N3  

## Insight  
The derivation produced 1 new fact(s) from 17 stated fact(s).  
Main conclusion: **:Root :result 12.**  

Selected conclusions:  
- :Root :result 12 .  

## Explanation  
Starts with 17 source fact(s), applies 5 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 5: :Root :expr ?E; ?E :value ?V => :Root :result ?V derives :Root :result 12 .  
  - Uses: :Root :expr :eAdd . _(source)_  

Selected explanation support:  
  - :Root :result 12 . _(derived by Rule 5)_  
    - :Root :expr :eAdd . _(source)_  

The selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix : <https://eyereasoner.github.io/eye/reasoning#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:Root :result 12 .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "expression_eval" .  
  in:run see:title "A tiny expression evaluator in N3" .  
  in:run see:sourceFile "examples/n3/expression_eval.n3" .  
  in:run see:sourceSHA256 "8b33d5122b55a40c19af6d1504d29871bcd864dce595d6824acd4515d76e360c" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 17 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 4 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

