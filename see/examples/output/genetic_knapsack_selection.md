# Genetic Knapsack Selection  

## Conclusion  
final genome : 101000000101  
selected items : item01, item03, item10, item12  
weight : 50 / 50  
value : 101  
fitness : 999899  
generations evaluated : 5  
exhaustive optimum value : 104 at genome 001000011111  

## Explanation  
Each genome bit says whether the corresponding item is selected for the knapsack. Feasible candidates get fitness 1000000 minus value, so higher value means lower fitness; overweight candidates are penalized above every feasible candidate. The N3 source records the deterministic local-search result and validates that the final genome respects capacity and has no strictly better one-bit neighbor. For transparency, an exhaustive enumeration also records the global best feasible value, showing this is a local mutation search rather than a global-optimality claim.  

**Generated derivation support**  

Compiled support: 14 source fact(s), 2 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (7 premise pattern(s) => 1 conclusion pattern(s)) derives :Run :localSearchStopsAt :FinalLocal .  
  - Uses: :Run :capacity 50 . _(source)_; :FinalLocal :weight 50 . _(source)_; :FinalLocal :value 101 . _(source)_; :NeighborSummary :bestNeighborValue 101 . _(source)_; … +1 more premise fact(s)  
- Rule 2 (11 premise pattern(s) => 2 conclusion pattern(s)) derives :geneticKnapsackSelection log:outputString "[authored report]" ., :geneticKnapsackSelection :selects :FinalLocal .  
  - Uses: :Run :capacity 50 . _(source)_; :Run :localSearchStopsAt :FinalLocal . _(derived)_; :FinalLocal :genome "101000000101" . _(source)_; :FinalLocal :selectedItems "item01, item03, item10, item12" . _(source)_; … +6 more premise fact(s)  

Selected explanation support:  
  - :geneticKnapsackSelection :selects :FinalLocal . _(derived by Rule 2)_  
    - :Run :capacity 50 . _(source)_  
    - :Run :localSearchStopsAt :FinalLocal . _(derived by Rule 1)_  
      - :Run :capacity 50 . _(source)_  
      - :FinalLocal :weight 50 . _(source)_  
      - :FinalLocal :value 101 . _(source)_  
      - :NeighborSummary :bestNeighborValue 101 . _(source)_  
      - ... 1 more premise fact(s)  
    - :FinalLocal :genome "101000000101" . _(source)_  
    - :FinalLocal :selectedItems "item01, item03, item10, item12" . _(source)_  
    - ... 6 more premise fact(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/genetic-knapsack-selection#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:geneticKnapsackSelection :selects :FinalLocal .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "genetic_knapsack_selection" .  
  in:run see:title "Genetic Knapsack Selection" .  
  in:run see:sourceFile "examples/n3/genetic_knapsack_selection.n3" .  
  in:run see:sourceSHA256 "c8fb351156e7656f2e3600f0d1eaf8a624742a91f688425564822cea78530855" .  
  in:run see:description "N3-compiled version of the deterministic one-bit mutation knapsack example.\nThe original item list JSON is preserved as the data-input sidecar." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 14 .  
  in:run see:compiledRules 2 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

