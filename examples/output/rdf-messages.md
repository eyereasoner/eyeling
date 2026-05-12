# rdf-messages  

## Answer  
RDF Message log accepted: 3 explicit message boundaries are preserved. Message :m002 is an empty heartbeat, and the local blank-node label _:b0 is safely reused in separate messages.  

## Explanation  
The N3 source models an RDF Message Log as an ordered sequence of RDF Messages. Each non-empty message has a formula-valued payload that is inspected with log:includes, so the observation data stays inside the message boundary instead of being treated as one global graph. The two temperature results, 22 and 23, are different observations from the same stream but are contextualized by their message boundaries.  
