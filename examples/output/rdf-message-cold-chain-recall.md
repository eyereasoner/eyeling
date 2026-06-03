# rdf-message-cold-chain-recall  

## Source files  

- [N3 rules](../rdf-message-cold-chain-recall.n3)  
- [Input RDF Message Log](../input/rdf-message-cold-chain-recall.trig)  
- [Story deck](../deck/rdf-message-cold-chain-recall.md)  

## Answer  
Cold-chain recall reasoning accepted: 49 RDF Message envelopes contained 48 append-only telemetry members. The consumer checkpoint was sequence 42, so 42 committed history members were skipped and only 6 newly emitted members entered the repair window. The tail window has 6 members and says batchA is both within range and over the 8.0°C limit. The repair keeps the calibrated logger evidence at sequence 47 from calibrated-cold-chain-logger with priority 5, resolves the repaired temperature to 11.8°C, and materializes the decision: quarantine batchA, notify QA, and hold shipment.  

## Explanation  
This is the streaming shape that matters operationally. A cold-chain consumer can replay a long RDF Message Log, use LDES sequence metadata to resume after its checkpoint, and inspect only the new tail. The raw tail is contradictory, so the rules do not materialize from the flattened data. They first choose the calibrated logger reading, then derive the quarantine decision from that repaired state.  