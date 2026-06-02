# rdf-message-window-repair  

## Source files  

- [N3 rules](../rdf-message-window-repair.n3)  
- [Input RDF Message Log](../input/rdf-message-window-repair.trig)  
- [Story deck](../deck/rdf-message-window-repair.md)  

## Answer  
Sliding-window RDF Message repair accepted: 5 parser-replayed messages produced two overlapping 3-message ABox windows. The current window retained two envelopes from the previous window, expired one old door reading, and added one new safety-controller reading. Its raw graph-level materialization was inconsistent because doorA was both open and closed. The preferred repair kept the priority-3 assertion from safety-controller, resolved the door state to closed, and materialized the action: mark the fire compartment as sealed.  

## Explanation  
The RDF Message Log uses VERSION \"1.2-messages\" and MESSAGE delimiters. Eyeling parses those boundaries into eymsg: envelopes and payload graphs; the rules inspect each payload with log:includes rather than merging message bodies by hand. The example mirrors a sliding-window stream-reasoning pattern: when the window advances, overlapping message evidence is retained, an expired assertion leaves the window, an entering assertion can change the materialization, and a preferred repair fixes a noisy open/closed contradiction before the final action is produced.  