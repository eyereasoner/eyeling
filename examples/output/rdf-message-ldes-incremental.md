# rdf-message-ldes-incremental  

## Source files  

- [N3 rules](../rdf-message-ldes-incremental.n3)  
- [Input RDF Message Log](../input/rdf-message-ldes-incremental.trig)  
- [Story deck](../deck/rdf-message-ldes-incremental.md)  

## Answer  
Incremental LDES reasoning accepted: 41 RDF Message envelopes contained 40 append-only LDES members. The consumer checkpoint was sequence 34, so 34 committed history members were skipped and only 6 newly emitted members entered the repair window. The tail window has 6 members, contains a raw open/closed inconsistency for doorA, repairs it by keeping the priority-5 member at sequence 40 from safety-controller, resolves the door state to closed, and materializes the action: keep the compartment sealed and continue monitoring.  

## Explanation  
The input is deliberately larger than the reasoning task: it serializes many LDES members as RDF Messages, but the LDES sequence bookmark tells the consumer which prefix was already materialized. Eyeling's -r mode replays the RDF Message Log into ordered eymsg: envelopes; the rules inspect each payload with log:includes, classify old versus new members from the LDES sequence path, and run the inconsistency repair only over the new tail. This mirrors an incremental streaming pipeline: append-only publication, resumable synchronization, small repair window, and monotonic output after the noisy tail is fixed.  