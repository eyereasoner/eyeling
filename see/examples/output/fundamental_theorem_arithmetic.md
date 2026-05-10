# Fundamental Theorem Arithmetic  

## Entailment  
Primary N3 case: n = 202692987 has prime factors 3 * 3 * 7 * 829 * 3881.  
primary prime-power form : 3^2 * 7 * 829 * 3881  
sample count : 6  
largest sample : 600851475143  
total prime factors counted with multiplicity : 31  
distinct primes seen across samples : 17  

Sample factorizations:  
  360360 = 2^3 * 3^2 * 5 * 7 * 11 * 13  
  202692987 = 3^2 * 7 * 829 * 3881  
  4294967295 = 3 * 5 * 17 * 257 * 65537  
  600851475143 = 71 * 839 * 1471 * 6857  
  9876543210 = 2 * 3^2 * 5 * 17^2 * 379721  
  9999999967 = 9999999967  

## Explanation  
Existence comes from repeated smallest-divisor decomposition. At each step, the first divisor found is prime because no smaller positive divisor can divide the current number.  

Smallest-divisor trace for the N3 source number:  
  202692987 = 3 * 67564329  
  67564329 = 3 * 22521443  
  22521443 = 7 * 3217349  
  3217349 = 829 * 3881  
  3881 is prime  

Uniqueness up to order is validated by reversing each traversal and sorting both factor lists. Matching sorted lists describe the same multiset of prime factors, even when the factors were discovered in the opposite order.  
  source smallest-first factors : 3 * 3 * 7 * 829 * 3881  
  source largest-first factors : 3881 * 829 * 7 * 3 * 3  
  source sorted comparison : 3 * 3 * 7 * 829 * 3881  

The additional samples cover repeated small factors, special products, large composites, and a larger prime that has no smaller divisor.  

**Generated derivation support**  

Compiled support: 16 source fact(s), 4 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :Case :reconstructsProduct true .  
  - Uses: :Case :n 202692987 . _(source)_; :Case :factors (3 3 7 829 3881) . _(source)_  
- Rule 2 (5 premise pattern(s) => 1 conclusion pattern(s)) derives :Case :uniqueUpToOrder true .  
  - Uses: :Case :factors (3 3 7 829 3881) . _(source)_  
- Rule 3 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :Case :allDistinctFactorsPrime true .  
  - Uses: 3 :primeWitness true . _(source)_; 7 :primeWitness true . _(source)_; 829 :primeWitness true . _(source)_; 3881 :primeWitness true . _(source)_  
- Rule 7 (15 premise pattern(s) => 4 conclusion pattern(s)) derives :fundamentalTheoremArithmetic log:outputString "[authored report]" ., :fundamentalTheoremArithmetic :demonstrates :Existence ., :fundamentalTheoremArithmetic :demonstrates :UniquenessUpToOrder ., :fundamentalTheoremArithmetic :demonstrates :PrimeWitnesses .  
  - Uses: :Case :n 202692987 . _(source)_; :Case :flatFactorString "3 * 3 * 7 * 829 * 3881" . _(source)_; :Case :primePowerString "3^2 * 7 * 829 * 3881" . _(source)_; :Case :largestFlatFactorString "3881 * 829 * 7 * 3 * 3" . _(source)_; … +10 more premise fact(s)  

Selected explanation support:  
  - :fundamentalTheoremArithmetic :demonstrates :PrimeWitnesses . _(derived by Rule 7)_  
    - :Case :n 202692987 . _(source)_  
    - :Case :flatFactorString "3 * 3 * 7 * 829 * 3881" . _(source)_  
    - :Case :primePowerString "3^2 * 7 * 829 * 3881" . _(source)_  
    - :Case :largestFlatFactorString "3881 * 829 * 7 * 3 * 3" . _(source)_  
    - ... 10 more premise fact(s)  
  - :fundamentalTheoremArithmetic :demonstrates :UniquenessUpToOrder . _(derived by Rule 7)_  
    - :Case :n 202692987 . _(source)_  
    - :Case :flatFactorString "3 * 3 * 7 * 829 * 3881" . _(source)_  
    - :Case :primePowerString "3^2 * 7 * 829 * 3881" . _(source)_  
    - :Case :largestFlatFactorString "3881 * 829 * 7 * 3 * 3" . _(source)_  
    - ... 10 more premise fact(s)  
  - :fundamentalTheoremArithmetic :demonstrates :Existence . _(derived by Rule 7)_  
    - :Case :n 202692987 . _(source)_  
    - :Case :flatFactorString "3 * 3 * 7 * 829 * 3881" . _(source)_  
    - :Case :primePowerString "3^2 * 7 * 829 * 3881" . _(source)_  
    - :Case :largestFlatFactorString "3881 * 829 * 7 * 3 * 3" . _(source)_  
    - ... 10 more premise fact(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/fundamental-theorem-arithmetic#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix list: <http://www.w3.org/2000/10/swap/list#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:fundamentalTheoremArithmetic :demonstrates :Existence .  
:fundamentalTheoremArithmetic :demonstrates :UniquenessUpToOrder .  
:fundamentalTheoremArithmetic :demonstrates :PrimeWitnesses .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "fundamental_theorem_arithmetic" .  
  in:run see:title "Fundamental Theorem Arithmetic" .  
  in:run see:sourceFile "examples/n3/fundamental_theorem_arithmetic.n3" .  
  in:run see:sourceSHA256 "d88eca366c590d49544e49453cbe69ba38938f8bc23919278bfaadd0bed0cd2d" .  
  in:run see:description "N3-compiled version of the hand-written SEE example. The primary case mirrors\nEyeling's fundamental-theorem-arithmetic.n3: n = 202692987 is validated against\nthe factorization 3^2 * 7 * 829 * 3881. Extra sample summaries are kept as\ndata so the SEE report still documents the larger regression set." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 16 .  
  in:run see:compiledRules 4 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 3 .  
  in:run see:compiledQueries 1 .  
}  
```  

