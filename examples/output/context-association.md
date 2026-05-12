# Context association  

## Source files  

- [N3 rules](../context-association.n3)  
- [Input TriG](../input/context-association.trig)  

## Entailment  
The RDF dataset associates Bob's data graph with a Data Integrity proof graph and a second metadata proof graph.  

## Explanation  
The input TriG names three graph contexts. The data graph states Bob's name. The signature graph links to that data graph with a proof and records an ecdsa-rdfc-2019 Data Integrity proof from the university issuer. The metadata graph then signs the signature graph itself, giving a chained context association.  
