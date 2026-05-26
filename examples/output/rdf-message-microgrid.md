# rdf-message-microgrid  

## Source files  

- [N3 rules](../rdf-message-microgrid.n3)  
- [Input RDF Message Log](../input/rdf-message-microgrid.trig)  

## Answer  
Storm clinic microgrid accepted: 4 parser-replayed RDF Messages were processed atomically. Critical care needs 620 W, current battery plus solar gives 800 W, and deferring the EV chargers frees 600 W, so the protected budget is 1400 W. The reasoned action is to keep the oxygen concentrator and vaccine fridge online, while deferring EV charging.  

## Why this is an RDF Message Log example  
The input now uses VERSION \"1.2-messages\" and MESSAGE delimiters. Eyeling parses those boundaries internally into an eymsg: replay view, so the rules do not need hand-written application envelopes. Each non-empty message is inspected with log:includes inside its own payload formula, and the final delimiter-only message is replayed as an empty heartbeat. The decision combines only the derived conclusions needed for load shedding while keeping the explanation tied to explicit message boundaries.  