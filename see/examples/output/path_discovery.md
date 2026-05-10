# Path Discovery  

## Entailment  
The derivation produced 3 new fact(s) from 96420 stated fact(s).  
Main entailment: **:discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Palma De Mallorca Airport" "Václav Havel Airport Prague").**  

Selected entailments:  
- :discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Palma De Mallorca Airport" "Václav Havel Airport Prague") .  
- :discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Diagoras Airport" "Václav Havel Airport Prague") .  
- :discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Heraklion International Nikos Kazantzakis Airport" "Václav Havel Airport Prague") .  

## Explanation  
Starts with 96420 source fact(s), applies 3 rule(s), and reaches a fixpoint.  

Derivation steps:  
- Rule 3 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Heraklion International Nikos Kazantzakis Airport" "Václav Havel Airport Prague") ., :discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Diagoras Airport" "Václav Havel Airport Prague") ., :discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Palma De Mallorca Airport" "Václav Havel Airport Prague") .  
  - Uses: res:AIRPORT_310 rdfs:label "Ostend-Bruges International Airport" . _(source)_; res:AIRPORT_1587 rdfs:label "Václav Havel Airport Prague" . _(source)_  

Selected explanation support:  
  - :discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Palma De Mallorca Airport" "Václav Havel Airport Prague") . _(derived by Rule 3)_  
    - res:AIRPORT_310 rdfs:label "Ostend-Bruges International Airport" . _(source)_  
    - res:AIRPORT_1587 rdfs:label "Václav Havel Airport Prague" . _(source)_  
  - :discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Diagoras Airport" "Václav Havel Airport Prague") . _(derived by Rule 3)_  
    - res:AIRPORT_310 rdfs:label "Ostend-Bruges International Airport" . _(source)_  
    - res:AIRPORT_1587 rdfs:label "Václav Havel Airport Prague" . _(source)_  
  - :discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Heraklion International Nikos Kazantzakis Airport" "Václav Havel Airport Prague") . _(derived by Rule 3)_  
    - res:AIRPORT_310 rdfs:label "Ostend-Bruges International Airport" . _(source)_  
    - res:AIRPORT_1587 rdfs:label "Václav Havel Airport Prague" . _(source)_  

The selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .  
@prefix nepo: <http://neptune.aws.com/ontology/airroutes/> .  
@prefix res: <http://neptune.aws.com/ontology/airroutes/resource#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix list: <http://www.w3.org/2000/10/swap/list#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix : <http://example.org/#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Heraklion International Nikos Kazantzakis Airport" "Václav Havel Airport Prague") .  
:discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Diagoras Airport" "Václav Havel Airport Prague") .  
:discovered :airroute ("Ostend-Bruges International Airport" "Liège Airport" "Palma De Mallorca Airport" "Václav Havel Airport Prague") .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "path_discovery" .  
  in:run see:title "Path Discovery" .  
  in:run see:sourceFile "examples/n3/path_discovery.n3" .  
  in:run see:sourceSHA256 "9481a2b27a6cae4d73f312c7d8403d1abd7beab573f627f591ea8301073fe4db" .  
  in:run see:description "Full upstream Eyeling path-discovery airroutes evidence converted to TriG; rules and query are kept in examples/n3/path_discovery.n3." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 96420 .  
  in:run see:compiledRules 1 .  
  in:run see:compiledBackwardRules 2 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 0 .  
}  
```  

