# Smoke Arithmetic  

## Conclusion  
product = 42  

## Explanation  
The compiled rule multiplies :x and :y using math:product.  

**Generated derivation support**  

Compiled support: 2 source fact(s), 2 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :Case :product 42 .  
  - Uses: :Input :x 6 . _(source)_; :Input :y 7 . _(source)_  
- Rule 2: :Case :product ?Product; ("=== Answer ===\nproduct = %s\n\n=== Explanation ===\nThe compiled rule multiplies :x and :y using math:product." ?Product) string:format ?Block => :out01 log:outputString "[authored report]" derives :out01 log:outputString "[authored report]" .  
  - Uses: :Case :product 42 . _(derived)_  

Selected explanation support:  
  - :out01 log:outputString "[authored report]" . _(authored report, Rule 2)_  
  - :Case :product 42 . _(derived by Rule 1)_  
    - :Input :x 6 . _(source)_  
    - :Input :y 7 . _(source)_  

## Formal TriG Output  

```trig  
@prefix : <https://example.org/see/smoke#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:Case :product 42 .  
:out01 log:outputString "=== Answer ===\nproduct = 42\n\n=== Explanation ===\nThe compiled rule multiplies :x and :y using math:product." .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "smoke_arithmetic" .  
  in:run see:title "Smoke Arithmetic" .  
  in:run see:sourceFile "examples/n3/smoke_arithmetic.n3" .  
  in:run see:sourceSHA256 "e254b8b9be8207c07f29cf30426466e2d916286b5f93ea4385786a5d80303499" .  
  in:run see:description "Small Notation3 source used to prove that see.js generates a specialized JS\nexample which derives its answer from facts, math built-ins, fuses, and string\nformatting instead of reading a prewritten conclusion." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 2 .  
  in:run see:compiledRules 2 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

