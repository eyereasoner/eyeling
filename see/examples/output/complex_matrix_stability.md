# Complex Matrix Stability  

## Conclusion  
A_unstable = [[(1,1),(0,0)],[(0,0),(2,0)]] has spectral radius 2 and is unstable. A_stable = [[(1,0),(0,0)],[(0,0),(-1,0)]] has spectral radius 1 and is marginally stable. A_damped = [[(0,0),(0,0)],[(0,0),(0,0)]] has spectral radius 0 and is damped.  

## Explanation  
For a discrete-time linear system x_{k+1} = A x_k, diagonal matrix eigenvalues are the diagonal entries. The largest squared complex modulus determines the spectral radius class. The N3 derivation also validates that |z*w|^2 = |z|^2*|w|^2 for a concrete complex product and that scaling A_unstable by 2 multiplies the squared spectral radius by 4.  

**Generated derivation support**  

Compiled support: 40 source fact(s), 17 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 16 (9 premise pattern(s) => 1 conclusion pattern(s)) derives :Case :scenarioOk true .  
  - Uses: :Case :unstableMatrix :A_unstable . _(source)_; :Case :stableMatrix :A_stable . _(source)_; :Case :dampedMatrix :A_damped . _(source)_  
- Rule 17 (8 premise pattern(s) => 1 conclusion pattern(s)) derives :report log:outputString "[authored report]" .  
  - Uses: :Case :scenarioOk true . _(derived)_; :A_unstable :pretty "[[(1,1),(0,0)],[(0,0),(2,0)]]" . _(source)_; :A_stable :pretty "[[(1,0),(0,0)],[(0,0),(-1,0)]]" . _(source)_; :A_damped :pretty "[[(0,0),(0,0)],[(0,0),(0,0)]]" . _(source)_  

Selected explanation support:  
  - :report log:outputString "[authored report]" . _(authored report, Rule 17)_  
  - :Case :scenarioOk true . _(derived by Rule 16)_  
    - :Case :unstableMatrix :A_unstable . _(source)_  
    - :Case :stableMatrix :A_stable . _(source)_  
    - :Case :dampedMatrix :A_damped . _(source)_  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/complex-matrix-stability#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:Case :scenarioOk true .  
:report log:outputString "=== Answer ===\nA_unstable = [[(1,1),(0,0)],[(0,0),(2,0)]] has spectral radius 2 and is unstable. A_stable = [[(1,0),(0,0)],[(0,0),(-1,0)]] has spectral radius 1 and is marginally stable. A_damped = [[(0,0),(0,0)],[(0,0),(0,0)]] has spectral radius 0 and is damped.\n\n=== Explanation ===\nFor a discrete-time linear system x_{k+1} = A x_k, diagonal matrix eigenvalues are the diagonal entries. The largest squared complex modulus determines the spectral radius class. The N3 derivation also validates that |z*w|^2 = |z|^2*|w|^2 for a concrete complex product and that scaling A_unstable by 2 multiplies the squared spectral radius by 4." .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "complex_matrix_stability" .  
  in:run see:title "Complex Matrix Stability" .  
  in:run see:sourceFile "examples/n3/complex_matrix_stability.n3" .  
  in:run see:sourceSHA256 "0ffed52d668e21ce26c5de11d2783603153ab79b6e2f92dece41e70777531297" .  
  in:run see:description "Diagonal 2x2 complex matrices are classified for discrete-time stability.\nThis adapts the Eyeling complex matrix example as a committed SEE N3\nsource that compiles to a standalone JavaScript example." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 40 .  
  in:run see:compiledRules 2 .  
  in:run see:compiledBackwardRules 15 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

