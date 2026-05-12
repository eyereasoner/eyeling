# annotation  

## Source files  

- [N3 rules](../annotation.n3)  
- [Input TriG](../input/annotation.trig)  

RDF 1.2 annotation evidence is loaded from the TriG sidecar and represented as ordinary facts.  

## Answer  
YES — the annotated statement says `:a :name "Alice"` and gives that statement the identifier `:t`.  

## Reason Why  
The input evidence contains the statement that Alice has the name "Alice" and records metadata for the named statement `:t`. In RDF compatibility mode, the named graph form is represented with `log:nameOf`, so `:t` names the statement while `:statedBy` and `:recorded` keep its provenance metadata.  

## Check  
C1 OK - the statement `:a :name "Alice"` is present  
C2 OK - `:t` names the annotated statement  
C3 OK - the statement is attributed to `:bob`  
C4 OK - the statement is recorded as `2021-07-07`  
C5 OK - the RDF/TriG input sidecar is linked as source evidence  
