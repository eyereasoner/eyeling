# Family cousins  

## Conclusion  
The derivation produced 25 new fact(s) from 15 stated fact(s).  
Main conclusion: **:Judy :cousin :Ivan.**  

Selected conclusions:  
- :Judy :cousin :Ivan .  
- :Judy :cousin :Heidi .  
- :Ivan :cousin :Judy .  
- :Heidi :cousin :Judy .  
- :Judy :generation 3 .  
- :Ivan :generation 3 .  

## Explanation  
Starts with 15 source fact(s), applies 4 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 1: true => :Adam :generation 0 derives :Adam :generation 0 .  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  
- Rule 2 (3 premise pattern(s) => 1 conclusion pattern(s)) derives :Bob :generation 1 ., :Carol :generation 1 ., :Dave :generation 2 ., :Eve :generation 2 ., … +5 more  
  - Uses: :Adam :parentOf :Bob . _(source)_; :Adam :generation 0 . _(derived)_; :Adam :parentOf :Carol . _(source)_; :Bob :parentOf :Dave . _(source)_; … +11 more premise fact(s)  
- Rule 3: ?P :parentOf ?C; ?P :branch ?B => ?C :branch ?B derives :Heidi :branch :b ., :Ivan :branch :b ., :Judy :branch :c .  
  - Uses: :Dave :parentOf :Heidi . _(source)_; :Dave :branch :b . _(source)_; :Eve :parentOf :Ivan . _(source)_; :Eve :branch :b . _(source)_; … +2 more premise fact(s)  
- Rule 4 (5 premise pattern(s) => 1 conclusion pattern(s)) derives :Dave :cousin :Frank ., :Dave :cousin :Grace ., :Eve :cousin :Frank ., :Eve :cousin :Grace ., … +8 more  
  - Uses: :Dave :generation 2 . _(derived)_; :Frank :generation 2 . _(derived)_; :Dave :branch :b . _(source)_; :Frank :branch :c . _(source)_; … +12 more premise fact(s)  

Selected explanation support:  
  - :Judy :cousin :Ivan . _(derived by Rule 4)_  
    - :Judy :generation 3 . _(derived by Rule 2)_  
      - :Frank :parentOf :Judy . _(source)_  
      - :Frank :generation 2 . _(derived by Rule 2)_  
        - :Carol :parentOf :Frank . _(source)_  
        - :Carol :generation 1 . _(derived by Rule 2)_  
          - :Adam :parentOf :Carol . _(source)_  
          - :Adam :generation 0 . _(derived by Rule 1)_  
    - :Ivan :generation 3 . _(derived by Rule 2)_  
      - :Eve :parentOf :Ivan . _(source)_  
      - :Eve :generation 2 . _(derived by Rule 2)_  
        - :Bob :parentOf :Eve . _(source)_  
        - :Bob :generation 1 . _(derived by Rule 2)_  
          - :Adam :parentOf :Bob . _(source)_  
          - :Adam :generation 0 . _(derived by Rule 1)_  
    - :Judy :branch :c . _(derived by Rule 3)_  
      - :Frank :parentOf :Judy . _(source)_  
      - :Frank :branch :c . _(source)_  
    - :Ivan :branch :b . _(derived by Rule 3)_  
      - :Eve :parentOf :Ivan . _(source)_  
      - :Eve :branch :b . _(source)_  
    - ... 1 more premise fact(s)  
  - :Judy :cousin :Heidi . _(derived by Rule 4)_  
    - :Judy :generation 3 . _(derived by Rule 2)_  
      - :Frank :parentOf :Judy . _(source)_  
      - :Frank :generation 2 . _(derived by Rule 2)_  
        - :Carol :parentOf :Frank . _(source)_  
        - :Carol :generation 1 . _(derived by Rule 2)_  
          - :Adam :parentOf :Carol . _(source)_  
          - :Adam :generation 0 . _(derived by Rule 1)_  
    - :Heidi :generation 3 . _(derived by Rule 2)_  
      - :Dave :parentOf :Heidi . _(source)_  
      - :Dave :generation 2 . _(derived by Rule 2)_  
        - :Bob :parentOf :Dave . _(source)_  
        - :Bob :generation 1 . _(derived by Rule 2)_  
          - :Adam :parentOf :Bob . _(source)_  
          - :Adam :generation 0 . _(derived by Rule 1)_  
    - :Judy :branch :c . _(derived by Rule 3)_  
      - :Frank :parentOf :Judy . _(source)_  
      - :Frank :branch :c . _(source)_  
    - :Heidi :branch :b . _(derived by Rule 3)_  
      - :Dave :parentOf :Heidi . _(source)_  
      - :Dave :branch :b . _(source)_  
    - ... 1 more premise fact(s)  
  - :Ivan :cousin :Judy . _(derived by Rule 4)_  
    - :Ivan :generation 3 . _(derived by Rule 2)_  
      - :Eve :parentOf :Ivan . _(source)_  
      - :Eve :generation 2 . _(derived by Rule 2)_  
        - :Bob :parentOf :Eve . _(source)_  
        - :Bob :generation 1 . _(derived by Rule 2)_  
          - :Adam :parentOf :Bob . _(source)_  
          - :Adam :generation 0 . _(derived by Rule 1)_  
    - :Judy :generation 3 . _(derived by Rule 2)_  
      - :Frank :parentOf :Judy . _(source)_  
      - :Frank :generation 2 . _(derived by Rule 2)_  
        - :Carol :parentOf :Frank . _(source)_  
        - :Carol :generation 1 . _(derived by Rule 2)_  
          - :Adam :parentOf :Carol . _(source)_  
          - :Adam :generation 0 . _(derived by Rule 1)_  
    - :Ivan :branch :b . _(derived by Rule 3)_  
      - :Eve :parentOf :Ivan . _(source)_  
      - :Eve :branch :b . _(source)_  
    - :Judy :branch :c . _(derived by Rule 3)_  
      - :Frank :parentOf :Judy . _(source)_  
      - :Frank :branch :c . _(source)_  
    - ... 1 more premise fact(s)  
  - :Heidi :cousin :Judy . _(derived by Rule 4)_  
    - :Heidi :generation 3 . _(derived by Rule 2)_  
      - :Dave :parentOf :Heidi . _(source)_  
      - :Dave :generation 2 . _(derived by Rule 2)_  
        - :Bob :parentOf :Dave . _(source)_  
        - :Bob :generation 1 . _(derived by Rule 2)_  
          - :Adam :parentOf :Bob . _(source)_  
          - :Adam :generation 0 . _(derived by Rule 1)_  
    - :Judy :generation 3 . _(derived by Rule 2)_  
      - :Frank :parentOf :Judy . _(source)_  
      - :Frank :generation 2 . _(derived by Rule 2)_  
        - :Carol :parentOf :Frank . _(source)_  
        - :Carol :generation 1 . _(derived by Rule 2)_  
          - :Adam :parentOf :Carol . _(source)_  
          - :Adam :generation 0 . _(derived by Rule 1)_  
    - :Heidi :branch :b . _(derived by Rule 3)_  
      - :Dave :parentOf :Heidi . _(source)_  
      - :Dave :branch :b . _(source)_  
    - :Judy :branch :c . _(derived by Rule 3)_  
      - :Frank :parentOf :Judy . _(source)_  
      - :Frank :branch :c . _(source)_  
    - ... 1 more premise fact(s)  
  - :Judy :generation 3 . _(derived by Rule 2)_  
    - :Frank :parentOf :Judy . _(source)_  
    - :Frank :generation 2 . _(derived by Rule 2)_  
      - :Carol :parentOf :Frank . _(source)_  
      - :Carol :generation 1 . _(derived by Rule 2)_  
        - :Adam :parentOf :Carol . _(source)_  
        - :Adam :generation 0 . _(derived by Rule 1)_  
          - no graph premises; built-ins/constants satisfied the rule.  
  - :Ivan :generation 3 . _(derived by Rule 2)_  
    - :Eve :parentOf :Ivan . _(source)_  
    - :Eve :generation 2 . _(derived by Rule 2)_  
      - :Bob :parentOf :Eve . _(source)_  
      - :Bob :generation 1 . _(derived by Rule 2)_  
        - :Adam :parentOf :Bob . _(source)_  
        - :Adam :generation 0 . _(derived by Rule 1)_  
          - no graph premises; built-ins/constants satisfied the rule.  

The selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <http://example.org/family#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:Adam :generation 0 .  
:Bob :generation 1 .  
:Carol :generation 1 .  
:Heidi :branch :b .  
:Ivan :branch :b .  
:Judy :branch :c .  
:Dave :generation 2 .  
:Eve :generation 2 .  
:Frank :generation 2 .  
:Grace :generation 2 .  
:Dave :cousin :Frank .  
:Dave :cousin :Grace .  
:Eve :cousin :Frank .  
:Eve :cousin :Grace .  
:Frank :cousin :Dave .  
:Frank :cousin :Eve .  
:Grace :cousin :Dave .  
:Grace :cousin :Eve .  
:Heidi :generation 3 .  
:Ivan :generation 3 .  
:Judy :generation 3 .  
:Heidi :cousin :Judy .  
:Ivan :cousin :Judy .  
:Judy :cousin :Heidi .  
:Judy :cousin :Ivan .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "family_cousins" .  
  in:run see:title "Family cousins" .  
  in:run see:sourceFile "examples/n3/family_cousins.n3" .  
  in:run see:sourceSHA256 "5254e987fd72e71aafad53c8e3e9eb91d034cfd06878fcd02f611539200ab3e4" .  
  in:run see:description "" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 15 .  
  in:run see:compiledRules 4 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

