# Complex numbers  

## Entailment  
The derivation produced 1 formula-valued entailment(s).  
Main entailment: **:test is { ((-1 0) (0.5 0)) complex:exponentiation (-3.49148133884313e-15 1) . ((2.71828182845905 0) (0 3.14159265358979)) complex:exponentiation (-1 3.23108914886517e-15) . ((0 1) (0 1)) complex:exponentiation (0.207879576350761 0) . ((2.71828182845905 0) (-1.57079632679 0)) complex:exponentiation (0.207879576351779 0) . (2 0) complex:asin (1.5707963267949 1.31695789692482) . (2 0) complex:acos (0 -1.31695789692482) }.**  

Selected entailments:  
- :test :is { ((-1 0) (0.5 0)) complex:exponentiation (-3.49148133884313e-15 1) . ((2.71828182845905 0) (0 3.14159265358979)) complex:exponentiation (-1 3.23108914886517e-15) . ((0 1) (0 1)) complex:exponentiation (0.207879576350761 0) . ((2.71828182845905 0) (-1.57079632679 0)) complex:exponentiation (0.207879576351779 0) . (2 0) complex:asin (1.5707963267949 1.31695789692482) . (2 0) complex:acos (0 -1.31695789692482) } .  

## Explanation  
Starts with 0 source fact(s), applies 9 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 9 (6 premise pattern(s) => 1 conclusion pattern(s)) derives :test :is { ((-1 0) (0.5 0)) complex:exponentiation (-3.49148133884313e-15 1) . ((2.71828182845905 0) (0 3.14159265358979)) complex:exponentiation (-1 3.23108914886517e-15) . ((0 1) (0 1)) complex:exponentiation (0.207879576350761 0) . ((2.71828182845905 0) (-1.57079632679 0)) complex:exponentiation (0.207879576351779 0) . (2 0) complex:asin (1.5707963267949 1.31695789692482) . (2 0) complex:acos (0 -1.31695789692482) } .  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  

Selected explanation support:  
  - :test :is { ((-1 0) (0.5 0)) complex:exponentiation (-3.49148133884313e-15 1) . ((2.71828182845905 0) (0 3.14159265358979)) complex:exponentiation (-1 3.23108914886517e-15) . ((0 1) (0 1)) complex:exponentiation (0.207879576350761 0) . ((2.71828182845905 0) (-1.57079632679 0)) complex:exponentiation (0.207879576351779 0) . (2 0) complex:asin (1.5707963267949 1.31695789692482) . (2 0) complex:acos (0 -1.31695789692482) } . _(derived by Rule 9)_  
    - no graph premises; built-ins/constants satisfied the rule.  

The formula-valued facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix complex: <https://eyereasoner.github.io/eye/complex#> .  
@prefix : <http://example.org/#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  
@prefix out: <https://example.org/see/output#> .  

:test :is out:formula1 .  

out:formula1 {  
  ((-1 0) (0.5 0)) complex:exponentiation (-3.49148133884313e-15 1) .  
  ((2.71828182845905 0) (0 3.14159265358979)) complex:exponentiation (-1 3.23108914886517e-15) .  
  ((0 1) (0 1)) complex:exponentiation (0.207879576350761 0) .  
  ((2.71828182845905 0) (-1.57079632679 0)) complex:exponentiation (0.207879576351779 0) .  
  (2 0) complex:asin (1.5707963267949 1.31695789692482) .  
  (2 0) complex:acos (0 -1.31695789692482) .  
}  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "complex" .  
  in:run see:title "Complex numbers" .  
  in:run see:sourceFile "examples/n3/complex.n3" .  
  in:run see:sourceSHA256 "f06171b97fcf380a64522165c21d4544ef88af39e5f8a679aad2e51bcc63c2b6" .  
  in:run see:description "See https://en.wikipedia.org/wiki/Complex_number" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 0 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 8 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

