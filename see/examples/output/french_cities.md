# French cities — graph path traversal.  

## Entailment  
The compiled query selected 1 fact(s) after the rule closure was computed.  
Main entailment: **:paris :path :nantes.**  

Selected entailments:  
- :paris :path :nantes .  

## Explanation  
Starts with 12 source fact(s), applies 2 rule(s), and reaches a fixpoint.  
The log:query projection then keeps only the matching fact(s) shown above.  

Derivation steps:  
- Rule 1: ?P rdfs:subPropertyOf ?R; ?S ?P ?O => ?S ?R ?O derives :paris :path :orleans ., :paris :path :chartres ., :paris :path :amiens ., :orleans :path :blois ., … +6 more  
  - Uses: :oneway rdfs:subPropertyOf :path . _(source)_; :paris :oneway :orleans . _(source)_; :paris :oneway :chartres . _(source)_; :paris :oneway :amiens . _(source)_; … +7 more premise fact(s)  
- Rule 2 (3 premise pattern(s) => 1 conclusion pattern(s)) derives :paris :path :blois ., :paris :path :bourges ., :orleans :path :tours ., :paris :path :lemans ., … +7 more  
  - Uses: :path rdf:type owl:TransitiveProperty . _(source)_; :orleans :path :blois . _(derived)_; :paris :path :orleans . _(derived)_; :orleans :path :bourges . _(derived)_; … +10 more premise fact(s)  

Selected explanation support:  
  - :paris :path :nantes . _(derived by Rule 2)_  
    - :path rdf:type owl:TransitiveProperty . _(source)_  
    - :lemans :path :nantes . _(derived by Rule 2)_  
      - :path rdf:type owl:TransitiveProperty . _(source)_  
      - :angers :path :nantes . _(derived by Rule 1)_  
        - :oneway rdfs:subPropertyOf :path . _(source)_  
        - :angers :oneway :nantes . _(source)_  
      - :lemans :path :angers . _(derived by Rule 1)_  
        - :oneway rdfs:subPropertyOf :path . _(source)_  
        - :lemans :oneway :angers . _(source)_  
    - :paris :path :lemans . _(derived by Rule 2)_  
      - :path rdf:type owl:TransitiveProperty . _(source)_  
      - :chartres :path :lemans . _(derived by Rule 1)_  
        - :oneway rdfs:subPropertyOf :path . _(source)_  
        - :chartres :oneway :lemans . _(source)_  
      - :paris :path :chartres . _(derived by Rule 1)_  
        - :oneway rdfs:subPropertyOf :path . _(source)_  
        - :paris :oneway :chartres . _(source)_  

The query-selected facts are serialized in the Formal TriG Output section.  

## Formal TriG Output  

```trig  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .  
@prefix owl: <http://www.w3.org/2002/07/owl#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix : <https://eyereasoner.github.io/see/examples/french-cities#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  

:paris :path :nantes .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "french_cities" .  
  in:run see:title "French cities — graph path traversal." .  
  in:run see:sourceFile "examples/n3/french_cities.n3" .  
  in:run see:sourceSHA256 "7e3672e6ab314845d44cdd16e7a91484c205de77ff8c9a06971f857612692be4" .  
  in:run see:description "Based on the EYE reasoning/graph example: graph.axiom.n3 plus graph.filter.n3.\nIt asks whether Paris can reach Nantes by following one-way links, using a\nsubproperty rule and a transitive-property rule." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 12 .  
  in:run see:compiledRules 2 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

