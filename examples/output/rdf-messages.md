# rdf-messages  

## Source files  

- [N3 rules](../rdf-messages.n3)  
- [Input TriG](../input/rdf-messages.trig)  

## Answer  
RDF Message replay archive accepted: 3 explicit message boundaries are preserved. Message :m002 is an empty heartbeat, and the local blank-node label _:b0 is safely reused in separate message envelopes.  

## Explanation  
The input is a single runnable example split across an N3 rule file and a TriG sidecar. The TriG file uses application-local envelope facts for stream order and replay metadata, while each non-empty named payload graph is treated as an atomic RDF Message dataset. Payloads are inspected with log:includes inside their own formulas, so the observation data stays inside the message boundary instead of being treated as one global graph. The two temperature results, 22 and 23, are different observations from the same stream but are contextualized by their message boundaries.  

This is intentionally not a parser-level VERSION \"1.2-messages\" / MESSAGE delimiter test. It is a reasoning example over an already-materialized sidecar representation of a message log.  