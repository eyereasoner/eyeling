# RDF dataset compatibility  

## Entailment  
The compiled query selected 1 fact(s) after the rule closure was computed.  
Main entailment: **:workOrder :entails <<( :sensor :needs :inspection )>>.**  

Selected entailments:  
- :workOrder :entails <<( :sensor :needs :inspection )>> .  

## Explanation  
Starts with 4 source fact(s), applies 1 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 1 (3 premise pattern(s) => 2 conclusion pattern(s)) derives :workOrder :entails <<( :sensor :needs :inspection )>> ., :audit log:nameOf { :workOrder :basedOn :factoryDataset . :workOrder :checkedBy :maintenanceSystem } .  
  - Uses: :sensor :reports :overheating . _(source)_; :overheating :requires :inspection . _(source)_; :maintenanceSystem :trusted true . _(source)_  

Selected explanation support:  
  - :workOrder :entails <<( :sensor :needs :inspection )>> . _(derived by Rule 1)_  
    - :sensor :reports :overheating . _(source)_  
    - :overheating :requires :inspection . _(source)_  
    - :maintenanceSystem :trusted true . _(source)_  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
VERSION "1.2"  

@prefix : <https://eyereasoner.github.io/see/examples/rdf-dataset#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  

:workOrder :entails <<( :sensor :needs :inspection )>> .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "rdf_dataset" .  
  in:run see:title "RDF dataset compatibility" .  
  in:run see:sourceFile "examples/n3/rdf_dataset.n3" .  
  in:run see:sourceSHA256 "76035a24eb72fc1d28a5e1f3021baefee0dde667aa8fc9f2b0a111f9c773b744" .  
  in:run see:description "RDF 1.1 named graph data and RDF 1.2 triple terms are normalized to ordinary N3 graph terms before SEE compiles the derivation." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 4 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

