# Backward rule example  

## Entailment  
The derivation produced 1 new fact(s) from 0 stated fact(s).  
Main entailment: **5 :isIndeedMoreInterestingThan 3.**  

Selected entailments:  
- 5 :isIndeedMoreInterestingThan 3 .  

## Explanation  
Starts with 0 source fact(s), applies 2 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 2: 5 :moreInterestingThan 3 => 5 :isIndeedMoreInterestingThan 3 derives 5 :isIndeedMoreInterestingThan 3 .  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  

Selected explanation support:  
  - 5 :isIndeedMoreInterestingThan 3 . _(derived by Rule 2)_  
    - no graph premises; built-ins/constants satisfied the rule.  

The selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix : <http://example.org/#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

5 :isIndeedMoreInterestingThan 3 .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "backward" .  
  in:run see:title "Backward rule example" .  
  in:run see:sourceFile "examples/n3/backward.n3" .  
  in:run see:sourceSHA256 "328d66402900d98dda0c02e3c64a7f3633f01a0ba148031c17e8fbf353057d33" .  
  in:run see:description "See https://www.w3.org/2000/10/swap/doc/tutorial-1.pdf page 17" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 0 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 1 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

