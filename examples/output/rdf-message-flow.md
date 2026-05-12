# rdf-message-flow  

## Answer  
Continuous RDF Message flow accepted: 5 ordered messages moved through the ingest → validate → interpret → route → sink pipeline. The threshold was 26, so results 21 and 22 were archived, the heartbeat kept the stream alive, and results 28 and 29 were emitted as alerts.  

## Explanation  
The N3 source starts only :m001 at ingress. Each message must reach :sink before the continuous-flow rule releases its msg:nextMessage. Observation payloads are inspected with log:includes inside each message formula, while the empty heartbeat uses the same envelope and routing stages without a payload. This models messages flowing through a live stream while preserving message boundaries.  
