# Euler identity (exact, certificate-friendly):  

## Conclusion  
The compiled query selected 6 fact(s) after the rule closure was computed.  
Main conclusion: **:result :identityHolds true.**  

Selected conclusions:  
- :result :identityHolds true .  
- :result :phaseModSqIsOne true .  
- :result :phaseModSq 1 .  
- :result :rhsZero (0 0) .  
- :result :lhsPlusOne (0 0) .  
- :result :phasePi (-1 0) .  

## Explanation  
Starts with 10 source fact(s), applies 5 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 1: (0 1) math:difference ?minusOne => :phasePi :exact (?minusOne 0) derives :phasePi :exact (-1 0) .  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  
- Rule 2 (4 premise pattern(s) => 2 conclusion pattern(s)) derives :EulerIdentity :lhsExact (0 0) ., :EulerIdentity :rhsExact (0 0) .  
  - Uses: :phasePi :exact (-1 0) . _(derived)_; :one :exact (1 0) . _(source)_  
- Rule 3: :EulerIdentity :lhsExact (?sumRe ?sumIm); :zero :exact (?sumRe ?sumIm) => :EulerIdentity :holds true derives :EulerIdentity :holds true .  
  - Uses: :EulerIdentity :lhsExact (0 0) . _(derived)_; :zero :exact (0 0) . _(source)_  
- Rule 4 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :phasePi :modSq 1 .  
  - Uses: :phasePi :exact (-1 0) . _(derived)_  
- Rule 5: :phasePi :modSq ?modSq; ?modSq math:equalTo 1 => :phasePi :modSqIsOne true derives :phasePi :modSqIsOne true .  
  - Uses: :phasePi :modSq 1 . _(derived)_  

Selected explanation support:  
  - :result :identityHolds true . _(no recorded rule support)_  
  - :result :phaseModSqIsOne true . _(no recorded rule support)_  
  - :result :phaseModSq 1 . _(no recorded rule support)_  
  - :result :rhsZero (0 0) . _(no recorded rule support)_  
  - :result :lhsPlusOne (0 0) . _(no recorded rule support)_  
  - :result :phasePi (-1 0) . _(no recorded rule support)_  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/euler-identity#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:result :phasePi (-1 0) .  
:result :lhsPlusOne (0 0) .  
:result :rhsZero (0 0) .  
:result :phaseModSq 1 .  
:result :phaseModSqIsOne true .  
:result :identityHolds true .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "euler_identity" .  
  in:run see:title "Euler identity (exact, certificate-friendly):" .  
  in:run see:sourceFile "examples/n3/euler_identity.n3" .  
  in:run see:sourceSHA256 "8a0467bd923b3774627c99aa4cc9fe34baaa0bbaff1847399cd025d24b39c17a" .  
  in:run see:description "exp(i*pi) + 1 = 0\nPhilosophy:\nUnlike the T-gate example, this phase needs no approximation. exp(i*pi) lands exactly at\n(-1,0) = cos(pi) + i sin(pi), so the identity can be certified using integer arithmetic\nalone.\nMethod:\n1) Construct -1 as 0 - 1.\n2) Represent exp(i*pi) exactly as (-1, 0).\n3) Add 1 componentwise to obtain (0, 0).\n4) Sanity validation the phase modulus: |-1 + 0i|^2 = 1.\n5) Project only the intended certificates via log:query." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 10 .  
  in:run see:compiledRules 5 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

