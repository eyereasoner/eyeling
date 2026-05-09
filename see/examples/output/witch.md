# Burn the witch  

## Insight  
The derivation produced 6 new fact(s) from 3 stated fact(s).  
Main conclusion: **:GIRL is a :WITCH.**  

Selected conclusions:  
- :GIRL rdf:type :WITCH .  
- :GIRL rdf:type :BURNS .  
- :GIRL rdf:type :ISMADEOFWOOD .  
- :DUCK rdf:type :BURNS .  
- :GIRL rdf:type :FLOATS .  
- :DUCK rdf:type :ISMADEOFWOOD .  

## Explanation  
Starts with 3 source fact(s), applies 4 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 3: ?x rdf:type :FLOATS => ?x rdf:type :ISMADEOFWOOD derives :DUCK rdf:type :ISMADEOFWOOD ., :GIRL rdf:type :ISMADEOFWOOD .  
  - Uses: :DUCK rdf:type :FLOATS . _(source)_; :GIRL rdf:type :FLOATS . _(derived)_  
- Rule 4: ?x rdf:type :FLOATS; ?x :SAMEWEIGHT ?y => ?y rdf:type :FLOATS derives :GIRL rdf:type :FLOATS .  
  - Uses: :DUCK rdf:type :FLOATS . _(source)_; :DUCK :SAMEWEIGHT :GIRL . _(source)_  
- Rule 2: ?x rdf:type :ISMADEOFWOOD => ?x rdf:type :BURNS derives :DUCK rdf:type :BURNS ., :GIRL rdf:type :BURNS .  
  - Uses: :DUCK rdf:type :ISMADEOFWOOD . _(derived)_; :GIRL rdf:type :ISMADEOFWOOD . _(derived)_  
- Rule 1: ?x rdf:type :BURNS; ?x rdf:type :WOMAN => ?x rdf:type :WITCH derives :GIRL rdf:type :WITCH .  
  - Uses: :GIRL rdf:type :BURNS . _(derived)_; :GIRL rdf:type :WOMAN . _(source)_  

Selected explanation support:  
  - :GIRL rdf:type :WITCH . _(derived by Rule 1)_  
    - :GIRL rdf:type :BURNS . _(derived by Rule 2)_  
      - :GIRL rdf:type :ISMADEOFWOOD . _(derived by Rule 3)_  
        - :GIRL rdf:type :FLOATS . _(derived by Rule 4)_  
          - :DUCK rdf:type :FLOATS . _(source)_  
          - :DUCK :SAMEWEIGHT :GIRL . _(source)_  
    - :GIRL rdf:type :WOMAN . _(source)_  
  - :GIRL rdf:type :BURNS . _(derived by Rule 2)_  
    - :GIRL rdf:type :ISMADEOFWOOD . _(derived by Rule 3)_  
      - :GIRL rdf:type :FLOATS . _(derived by Rule 4)_  
        - :DUCK rdf:type :FLOATS . _(source)_  
        - :DUCK :SAMEWEIGHT :GIRL . _(source)_  
  - :GIRL rdf:type :ISMADEOFWOOD . _(derived by Rule 3)_  
    - :GIRL rdf:type :FLOATS . _(derived by Rule 4)_  
      - :DUCK rdf:type :FLOATS . _(source)_  
      - :DUCK :SAMEWEIGHT :GIRL . _(source)_  
  - :DUCK rdf:type :BURNS . _(derived by Rule 2)_  
    - :DUCK rdf:type :ISMADEOFWOOD . _(derived by Rule 3)_  
      - :DUCK rdf:type :FLOATS . _(source)_  
  - :GIRL rdf:type :FLOATS . _(derived by Rule 4)_  
    - :DUCK rdf:type :FLOATS . _(source)_  
    - :DUCK :SAMEWEIGHT :GIRL . _(source)_  
  - :DUCK rdf:type :ISMADEOFWOOD . _(derived by Rule 3)_  
    - :DUCK rdf:type :FLOATS . _(source)_  

The selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix : <http://example.org/witch#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:DUCK rdf:type :ISMADEOFWOOD .  
:GIRL rdf:type :FLOATS .  
:DUCK rdf:type :BURNS .  
:GIRL rdf:type :ISMADEOFWOOD .  
:GIRL rdf:type :BURNS .  
:GIRL rdf:type :WITCH .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "witch" .  
  in:run see:title "Burn the witch" .  
  in:run see:sourceFile "examples/n3/witch.n3" .  
  in:run see:sourceSHA256 "bc0a493c490136926a3e3086f6b8bc63a8ae97334d723c7737eeaea837428045" .  
  in:run see:description "http://clarkparsia.com/weblog/2007/01/02/burn-the-witch/\nhttp://www.netfunny.com/rhf/jokes/90q4/burnher.html\noriginal http://www.w3.org/2000/10/swap/test/reason/witch.n3" .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 3 .  
  in:run see:compiledRules 4 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

