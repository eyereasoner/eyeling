# rdf-message-flow  

## Source files  

- [N3 rules](../rdf-message-flow.n3)  
- [Input TriG](../input/rdf-message-flow.trig)  

## Answer  
Continuous RDF Message flow accepted: 5 ordered message envelopes moved through the ingest → validate → interpret → route → sink pipeline. The threshold was 26, so results 21 and 22 were archived, the heartbeat kept the stream alive, and results 28 and 29 were emitted as alerts.  

## Explanation  
The input is a single runnable example split across an N3 rule file and a TriG sidecar. The TriG file uses example-local envelope facts for stream order and processing state, while each named payload graph is treated as an atomic RDF Message dataset. Only :m001 starts at ingress; each envelope must reach :sink before the continuous-flow rule releases its flow:nextEnvelope. Observation payloads are inspected with log:includes inside their own payload formula, and the empty heartbeat advances without a payload graph. This keeps message boundaries visible to the reasoner instead of merging all payload triples into one global graph.  