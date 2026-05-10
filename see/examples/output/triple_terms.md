# Triple terms  

## Entailment  
The compiled query selected 1 fact(s) after the rule closure was computed.  
Main entailment: **:observation :entails <<( :sensor :needs :inspection )>>.**  

Selected entailments:  
- :observation :entails <<( :sensor :needs :inspection )>> .  

## Explanation  
Starts with 2 source fact(s), applies 1 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 1: ?observation rdf:reifies <<( ?device :reports ?condition )>>; ?condition :requires ?action => ?observation :entails <<( ?device :needs ?action )>> derives :observation :entails <<( :sensor :needs :inspection )>> .  
  - Uses: :observation rdf:reifies <<( :sensor :reports :overheating )>> . _(source)_; :overheating :requires :inspection . _(source)_  

Selected explanation support:  
  - :observation :entails <<( :sensor :needs :inspection )>> . _(derived by Rule 1)_  
    - :observation rdf:reifies <<( :sensor :reports :overheating )>> . _(source)_  
    - :overheating :requires :inspection . _(source)_  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
VERSION "1.2"  

@prefix : <https://eyereasoner.github.io/eyeling/see/examples/triple_terms#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  

:observation :entails <<( :sensor :needs :inspection )>> .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "triple_terms" .  
  in:run see:title "Triple terms" .  
  in:run see:sourceFile "examples/n3/triple_terms.n3" .  
  in:run see:sourceSHA256 "f94fae1b4087f790c085c4dd1570875694238a882213951b457480ee26c06944" .  
  in:run see:description "Demonstrates RDF 1.2 TriG triple terms as input evidence and as a derived entailment." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 2 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

