# rdf-message-microgrid  

## Source files  

- [N3 rules](../rdf-message-microgrid.n3)  
- [Input TriG](../input/rdf-message-microgrid.trig)  

## Answer  
Storm clinic microgrid accepted: 4 RDF Message envelopes were replayed atomically. Critical care needs 620 W, current battery plus solar gives 800 W, and deferring the EV chargers frees 600 W, so the protected budget is 1400 W. The reasoned action is to keep the oxygen concentrator and vaccine fridge online, while deferring EV charging.  

## Why this is an RDF Messages example  
The input is a single runnable example split across an N3 rule file and a TriG sidecar. The default graph records stream order, offsets, and envelope metadata. Each non-empty named graph is treated as an atomic message payload, and the fourth message is an empty heartbeat. The rules inspect each payload with log:includes inside its own formula, then combine only the derived conclusions needed for the microgrid decision. This keeps the explanation tied to message boundaries instead of silently flattening the stream into one global graph.  

This is intentionally not a parser-level VERSION \"1.2-messages\" / MESSAGE delimiter test. It is a reasoning example over an already-materialized sidecar representation of a message log.  