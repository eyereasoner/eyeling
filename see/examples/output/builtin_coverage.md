# Builtin coverage smoke  

## Entailment  
The compiled query selected 29 fact(s) after the rule closure was computed.  
Main entailment: **:assurance :member "c".**  

Selected entailments:  
- :assurance :member "c" .  
- :assurance :member "b" .  
- :assurance :formula { :x :p :y . :a :b :c } .  
- :assurance :month 1 .  
- :assurance :year 2024 .  
- :assurance :member "a" .  

## Explanation  
Starts with 0 source fact(s), applies 1 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 1 (30 premise pattern(s) => 27 conclusion pattern(s)) derives :assurance :sum 9 ., :assurance :product 24 ., :assurance :difference 5 ., :assurance :quotient 3 ., … +25 more  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  

Selected explanation support:  
  - :assurance :member "c" . _(derived by Rule 1)_  
    - no graph premises; built-ins/constants satisfied the rule.  
  - :assurance :member "b" . _(derived by Rule 1)_  
    - no graph premises; built-ins/constants satisfied the rule.  
  - :assurance :formula { :x :p :y . :a :b :c } . _(derived by Rule 1)_  
    - no graph premises; built-ins/constants satisfied the rule.  
  - :assurance :month 1 . _(derived by Rule 1)_  
    - no graph premises; built-ins/constants satisfied the rule.  
  - :assurance :year 2024 . _(derived by Rule 1)_  
    - no graph premises; built-ins/constants satisfied the rule.  
  - :assurance :member "a" . _(derived by Rule 1)_  
    - no graph premises; built-ins/constants satisfied the rule.  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <urn:example#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  
@prefix out: <https://example.org/see/output#> .  

:assurance :sum 9 .  
:assurance :product 24 .  
:assurance :difference 5 .  
:assurance :quotient 3 .  
:assurance :integerQuotient 2 .  
:assurance :remainder 1 .  
:assurance :negation -3 .  
:assurance :absoluteValue 3 .  
:assurance :degrees 180 .  
:assurance :stringLength 3 .  
:assurance :concatenation "abc" .  
:assurance :format "item x 7" .  
:assurance :scrape "ef" .  
:assurance :charAt "b" .  
:assurance :setCharAt "aZc" .  
:assurance :sha256 "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824" .  
:assurance :first "a" .  
:assurance :rest ("b" "c") .  
:assurance :last "c" .  
:assurance :listLength 3 .  
:assurance :reverse ("c" "b" "a") .  
:assurance :removed ("b") .  
:assurance :appended ("a" "b" "c") .  
:assurance :member "a" .  
:assurance :year 2024 .  
:assurance :month 1 .  
:assurance :formula out:formula1 .  

out:formula1 {  
  :x :p :y .  
  :a :b :c .  
}  
:assurance :member "b" .  
:assurance :member "c" .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "builtin_coverage" .  
  in:run see:title "Builtin coverage smoke" .  
  in:run see:sourceFile "examples/n3/builtin_coverage.n3" .  
  in:run see:sourceSHA256 "4ea25a79da436dd28fb54de1a7d0f5d49729b47f384f9bd36411c5cc1b821dbc" .  
  in:run see:description "Exercises math, string, list, crypto, time, and log builtins in compiled JavaScript." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 0 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

