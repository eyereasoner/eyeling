# Goldbach 1000  

## Insight  
All 499 even integers from 4 through 1000 have a Goldbach witness.  
sample witnesses : 4=2+2; 28=5+23; 100=3+97; 998=7+991; 1000=3+997  

## Explanation  
The bounded run caches primes up to the configured bound and then searches each even number E for a prime P not greater than E/2 where E-P is also prime. No counterexample is found in the bounded range, so the bounded Goldbach condition succeeds for this dataset.  

**Generated derivation support**  

Compiled support: 28 source fact(s), 3 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (6 premise pattern(s) => 1 conclusion pattern(s)) derives :w4 :verifiedGoldbachWitness true ., :w28 :verifiedGoldbachWitness true ., :w100 :verifiedGoldbachWitness true ., :w998 :verifiedGoldbachWitness true ., … +1 more  
  - Uses: :w4 :even 4 . _(source)_; :w4 :p 2 . _(source)_; :w4 :q 2 . _(source)_; 2 :prime true . _(source)_; … +19 more premise fact(s)  
- Rule 2 (6 premise pattern(s) => 1 conclusion pattern(s)) derives :BoundedRun :boundedGoldbachCondition true .  
  - Uses: :w4 :verifiedGoldbachWitness true . _(derived)_; :w28 :verifiedGoldbachWitness true . _(derived)_; :w100 :verifiedGoldbachWitness true . _(derived)_; :w998 :verifiedGoldbachWitness true . _(derived)_; … +2 more premise fact(s)  
- Rule 4 (6 premise pattern(s) => 2 conclusion pattern(s)) derives :goldbach1000 log:outputString "[authored report]" ., :goldbach1000 :demonstrates :BoundedGoldbachEvidence .  
  - Uses: :BoundedRun :minEven 4 . _(source)_; :BoundedRun :maxEven 1000 . _(source)_; :BoundedRun :evenCount 499 . _(source)_; :BoundedRun :sampleWitnesses "4=2+2; 28=5+23; 100=3+97; 998=7+991; 1000=3+997" . _(source)_; … +1 more premise fact(s)  

Selected explanation support:  
  - :goldbach1000 :demonstrates :BoundedGoldbachEvidence . _(derived by Rule 4)_  
    - :BoundedRun :minEven 4 . _(source)_  
    - :BoundedRun :maxEven 1000 . _(source)_  
    - :BoundedRun :evenCount 499 . _(source)_  
    - :BoundedRun :sampleWitnesses "4=2+2; 28=5+23; 100=3+97; 998=7+991; 1000=3+997" . _(source)_  
    - ... 1 more premise fact(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/goldbach-1000#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:goldbach1000 :demonstrates :BoundedGoldbachEvidence .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "goldbach_1000" .  
  in:run see:title "Goldbach 1000" .  
  in:run see:sourceFile "examples/n3/goldbach_1000.n3" .  
  in:run see:sourceSHA256 "f40ec2cb172140ebdb5632a0abf0f0498be1183564755aaf76748545a2b49158" .  
  in:run see:description "N3-compiled version of the bounded Goldbach SEE example. It keeps the bounded\nresult as committed data and uses rules to verify the representative witness\nequations that are shown in the report." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 28 .  
  in:run see:compiledRules 3 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 1 .  
  in:run see:compiledQueries 1 .  
}  
```  

