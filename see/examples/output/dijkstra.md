# Dijkstra's algorithm to find the shortest path  

## Insight  
The derivation produced 9 new fact(s) from 9 stated fact(s).  
Main conclusion: **(:f :e) :edge 3.**  

Selected conclusions:  
- (:f :e) :edge 3 .  
- (:f :d) :edge 6 .  
- (:e :d) :edge 2 .  
- (:e :c) :edge 10 .  
- (:d :c) :edge 8 .  
- (:d :b) :edge 5 .  

## Explanation  
Starts with 9 source fact(s), applies 5 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 1: (?A ?B) :edge ?C => (?B ?A) :edge ?C derives (:b :a) :edge 4 ., (:c :a) :edge 2 ., (:c :b) :edge 1 ., (:d :b) :edge 5 ., … +5 more  
  - Uses: (:a :b) :edge 4 . _(source)_; (:a :c) :edge 2 . _(source)_; (:b :c) :edge 1 . _(source)_; (:b :d) :edge 5 . _(source)_; … +5 more premise fact(s)  

Selected explanation support:  
  - (:f :e) :edge 3 . _(derived by Rule 1)_  
    - (:e :f) :edge 3 . _(source)_  
  - (:f :d) :edge 6 . _(derived by Rule 1)_  
    - (:d :f) :edge 6 . _(source)_  
  - (:e :d) :edge 2 . _(derived by Rule 1)_  
    - (:d :e) :edge 2 . _(source)_  
  - (:e :c) :edge 10 . _(derived by Rule 1)_  
    - (:c :e) :edge 10 . _(source)_  
  - (:d :c) :edge 8 . _(derived by Rule 1)_  
    - (:c :d) :edge 8 . _(source)_  
  - (:d :b) :edge 5 . _(derived by Rule 1)_  
    - (:b :d) :edge 5 . _(source)_  

The selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix list: <http://www.w3.org/2000/10/swap/list#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix : <https://eyereasoner.github.io/see/examples/dijkstra#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

(:b :a) :edge 4 .  
(:c :a) :edge 2 .  
(:c :b) :edge 1 .  
(:d :b) :edge 5 .  
(:d :c) :edge 8 .  
(:e :c) :edge 10 .  
(:e :d) :edge 2 .  
(:f :d) :edge 6 .  
(:f :e) :edge 3 .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "dijkstra" .  
  in:run see:title "Dijkstra's algorithm to find the shortest path" .  
  in:run see:sourceFile "examples/n3/dijkstra.n3" .  
  in:run see:sourceSHA256 "e877c1cfea99078228bd424f6e55761e56cc54bc1e64b21540231620cc3620ab" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 9 .  
  in:run see:compiledRules 2 .  
  in:run see:compiledBackwardRules 3 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

