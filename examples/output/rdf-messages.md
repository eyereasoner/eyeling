# rdf-messages  

## Source files  

- [N3 rules](../rdf-messages.n3)  
- [Input RDF Message Log](../input/rdf-messages.trig)  

## Answer  
RDF Message Log accepted: 3 parser-replayed message boundaries are preserved. The middle message is an empty heartbeat, and the same source-local blank-node label is safely reused because Eyeling scopes blank nodes per message.  

## Explanation  
The input now uses VERSION \"1.2-messages\" and MESSAGE delimiters instead of hand-written application envelope facts. Eyeling parses the log internally into an eymsg: replay view with ordered envelopes and one payload graph per non-empty message. The rules inspect each payload with log:includes inside its own message formula, so the observation data stays inside the message boundary instead of being treated as one global graph. The two temperature results, 22 and 23, are different observations from the same stream and remain contextualized by their message boundaries.  