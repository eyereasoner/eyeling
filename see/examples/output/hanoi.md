# Towers of Hanoi  

## Entailment  
The derivation produced 1 new fact(s) from 0 stated fact(s).  
Main entailment: **3 :answer ((:left :right) (:left :center) (:right :center) (:left :right) (:center :left) (:center :right) (:left :right)).**  

Selected entailments:  
- 3 :answer ((:left :right) (:left :center) (:right :center) (:left :right) (:center :left) (:center :right) (:left :right)) .  

## Explanation  
Starts with 0 source fact(s), applies 3 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 3: (3 :left :right :center) :moves ?M => 3 :answer ?M derives 3 :answer ((:left :right) (:left :center) (:right :center) (:left :right) (:center :left) (:center :right) (:left :right)) .  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  

Selected explanation support:  
  - 3 :answer ((:left :right) (:left :center) (:right :center) (:left :right) (:center :left) (:center :right) (:left :right)) . _(derived by Rule 3)_  
    - no graph premises; built-ins/constants satisfied the rule.  

The selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix list: <http://www.w3.org/2000/10/swap/list#> .  
@prefix : <https://eyereasoner.github.io/eye/reasoning#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

3 :answer ((:left :right) (:left :center) (:right :center) (:left :right) (:center :left) (:center :right) (:left :right)) .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "hanoi" .  
  in:run see:title "Towers of Hanoi" .  
  in:run see:sourceFile "examples/n3/hanoi.n3" .  
  in:run see:sourceSHA256 "f2ef15363d9c2430bd3b68d500d3d256d241b8fcf4fd368b287a91e15289df1d" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 0 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 2 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

