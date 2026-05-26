# rdf-message-flow  

## Source files  

- [N3 rules](../rdf-message-flow.n3)  
- [Input RDF Message Log](../input/rdf-message-flow.trig)  

## Answer  
Continuous RDF Message flow accepted: 5 ordered parser-replayed message envelopes moved through the ingest → validate → interpret → route → sink pipeline. The threshold was 26, so results 21 and 22 were archived, the empty heartbeat kept the stream alive, and results 28 and 29 were emitted as alerts.  

## Explanation  
The input sidecar is now a true RDF Message Log using VERSION \"1.2-messages\" and MESSAGE delimiters. Eyeling parses the log internally into an eymsg: replay view with ordered envelopes, offsets, next-envelope links, and one payload graph per non-empty message. Only the first replayed envelope starts at ingress; each envelope must reach :sink before the continuous-flow rule releases its eymsg:nextEnvelope. Observation payloads are inspected with log:includes inside their own message formula, and the delimiter-only third message is replayed as an empty heartbeat. This keeps message boundaries in the parser/runtime instead of modeling them by hand in the TriG sidecar.  