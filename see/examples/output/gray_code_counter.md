# Gray Code Counter  

## Entailment  
bits : 4  
states visited : 16  
unique states : 16  
sequence prefix : 0000, 0001, 0011, 0010, 0110, 0111, 0101, 0100  
wrap transition : 1000 -> 0000  
maximum adjacent Hamming distance : 1  

## Explanation  
The counter maps each integer n to n xor (n >> 1), which is the reflected binary Gray-code construction. For 4 bits, the first 16 integers cover the full state space without duplicates. The Hamming-distance comparison compares each state with the next state, including the final wraparound transition. A valid cyclic Gray counter therefore changes exactly one bit at every step.  

**Generated derivation support**  

Compiled support: 7 source fact(s), 3 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1: :Counter :sequence ?Sequence; ?Sequence list:length ?Visited => :Counter :statesVisited ?Visited derives :Counter :statesVisited 16 .  
  - Uses: :Counter :sequence (0 1 3 2 6 7 5 4 12 13 15 14 10 11 9 8) . _(source)_  
- Rule 2 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :Counter :validGrayCycle true .  
  - Uses: :Counter :steps 16 . _(source)_; :Counter :statesVisited 16 . _(derived)_; :Counter :uniqueStateCount 16 . _(source)_; :Counter :maxHammingDistance 1 . _(source)_  
- Rule 3 (8 premise pattern(s) => 1 conclusion pattern(s)) derives :report log:outputString "[authored report]" .  
  - Uses: :Counter :bits 4 . _(source)_; :Counter :statesVisited 16 . _(derived)_; :Counter :uniqueStateCount 16 . _(source)_; :Counter :sequencePrefix "0000, 0001, 0011, 0010, 0110, 0111, 0101, 0100" . _(source)_; … +3 more premise fact(s)  

Selected explanation support:  
  - :report log:outputString "[authored report]" . _(authored report, Rule 3)_  
  - :Counter :validGrayCycle true . _(derived by Rule 2)_  
    - :Counter :steps 16 . _(source)_  
    - :Counter :statesVisited 16 . _(derived by Rule 1)_  
      - :Counter :sequence (0 1 3 2 6 7 5 4 12 13 15 14 10 11 9 8) . _(source)_  
    - :Counter :uniqueStateCount 16 . _(source)_  
    - :Counter :maxHammingDistance 1 . _(source)_  
  - :Counter :statesVisited 16 . _(derived by Rule 1)_  
    - :Counter :sequence (0 1 3 2 6 7 5 4 12 13 15 14 10 11 9 8) . _(source)_  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/gray-code-counter#> .  
@prefix list: <http://www.w3.org/2000/10/swap/list#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:Counter :statesVisited 16 .  
:Counter :validGrayCycle true .  
:report log:outputString "=== Answer ===\nbits : 4\nstates visited : 16\nunique states : 16\nsequence prefix : 0000, 0001, 0011, 0010, 0110, 0111, 0101, 0100\nwrap transition : 1000 -> 0000\nmaximum adjacent Hamming distance : 1\n\n=== Explanation ===\nThe counter maps each integer n to n xor (n >> 1), which is the reflected binary Gray-code construction. For 4 bits, the first 16 integers cover the full state space without duplicates. The Hamming-distance comparison compares each state with the next state, including the final wraparound transition. A valid cyclic Gray counter therefore changes exactly one bit at every step." .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "gray_code_counter" .  
  in:run see:title "Gray Code Counter" .  
  in:run see:sourceFile "examples/n3/gray_code_counter.n3" .  
  in:run see:sourceSHA256 "61f77dc563c8a38d612cf4fba812e6066f00449e27b9bc620e866a52e08ea4d2" .  
  in:run see:description "N3-compiled version of the 4-bit Gray counter SEE example.  The example keeps\nthe known reflected Gray-code sequence as data, derives its visited-state count\nwith a list builtin, and derives the published invariants before rendering the\nSEE report." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 7 .  
  in:run see:compiledRules 3 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

