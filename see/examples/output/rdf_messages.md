# RDF Messages  

## Insight  
RDF Message log accepted: 3 explicit message boundaries are preserved. Message :m002 is an empty heartbeat, and the local blank-node label _:b0 is safely reused in separate messages.  

## Explanation  
The N3 source models an RDF Message Log as an ordered sequence of RDF Messages. Each non-empty message has a formula-valued payload that is inspected with log:includes, so the observation data stays inside the message boundary instead of being treated as one global graph. The two temperature results, 22 and 23, are different observations from the same stream but are contextualized by their message boundaries.  

**Generated derivation support**  

Compiled support: 25 source fact(s), 6 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (4 premise pattern(s) => 2 conclusion pattern(s)) derives :m001 msg:boundaryExplicit true ., :temperatureLog msg:replayContains :m001 ., :m002 msg:boundaryExplicit true ., :temperatureLog msg:replayContains :m002 ., … +2 more  
  - Uses: :temperatureLog rdf:type msg:MessageLog . _(source)_; :temperatureLog msg:message :m001 . _(source)_; :m001 rdf:type msg:RDFMessage . _(source)_; :m001 msg:offset 1 . _(source)_; … +6 more premise fact(s)  
- Rule 2 (4 premise pattern(s) => 1 conclusion pattern(s)) derives :m001 msg:payloadResult 22 ., :m003 msg:payloadResult 23 .  
  - Uses: :m001 rdf:type msg:RDFMessage . _(source)_; :m001 msg:expectedResult 22 . _(source)_; :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 22 } . _(source)_; :m003 rdf:type msg:RDFMessage . _(source)_; … +2 more premise fact(s)  
- Rule 3: ?Message rdf:type msg:RDFMessage; ?Message msg:payloadKind :heartbeat => ?Message msg:emptyMessageAllowed true; :HeartbeatEvidence :accepted ?Message derives :m002 msg:emptyMessageAllowed true ., :HeartbeatEvidence :accepted :m002 .  
  - Uses: :m002 rdf:type msg:RDFMessage . _(source)_; :m002 msg:payloadKind :heartbeat . _(source)_  
- Rule 4 (5 premise pattern(s) => 2 conclusion pattern(s)) derives :BlankNodeScope :reusedLabel "_:b0" ., :BlankNodeScope :isPerMessage true .  
  - Uses: :m001 rdf:type msg:RDFMessage . _(source)_; :m001 msg:localBlankLabel "_:b0" . _(source)_; :m003 rdf:type msg:RDFMessage . _(source)_; :m003 msg:localBlankLabel "_:b0" . _(source)_  
- Rule 5 (6 premise pattern(s) => 1 conclusion pattern(s)) derives :MessageContext :differentObservationsStayContextual true .  
  - Uses: :m001 rdf:type msg:RDFMessage . _(source)_; :m001 msg:payloadResult 22 . _(derived)_; :m003 rdf:type msg:RDFMessage . _(source)_; :m003 msg:payloadResult 23 . _(derived)_  
- Rule 6 (12 premise pattern(s) => 6 conclusion pattern(s)) derives :rdfMessagesExample log:outputString "[authored report]" ., :rdfMessagesExample :demonstrates :ExplicitBoundaries ., :rdfMessagesExample :demonstrates :AtomicMessageContext ., :rdfMessagesExample :demonstrates :EmptyHeartbeat ., … +2 more  
  - Uses: :temperatureLog msg:orderedMessages (:m001 :m002 :m003) . _(source)_; :m001 msg:boundaryExplicit true . _(derived)_; :m001 msg:payloadResult 22 . _(derived)_; :m002 msg:boundaryExplicit true . _(derived)_; … +6 more premise fact(s)  

Selected explanation support:  
  - :rdfMessagesExample :demonstrates :ReplayableMessageLog . _(derived by Rule 6)_  
    - :temperatureLog msg:orderedMessages (:m001 :m002 :m003) . _(source)_  
    - :m001 msg:boundaryExplicit true . _(derived by Rule 1)_  
      - :temperatureLog rdf:type msg:MessageLog . _(source)_  
      - :temperatureLog msg:message :m001 . _(source)_  
      - :m001 rdf:type msg:RDFMessage . _(source)_  
      - :m001 msg:offset 1 . _(source)_  
    - :m001 msg:payloadResult 22 . _(derived by Rule 2)_  
      - :m001 rdf:type msg:RDFMessage . _(source)_  
      - :m001 msg:expectedResult 22 . _(source)_  
      - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 22 } . _(source)_  
    - :m002 msg:boundaryExplicit true . _(derived by Rule 1)_  
      - :temperatureLog rdf:type msg:MessageLog . _(source)_  
      - :temperatureLog msg:message :m002 . _(source)_  
      - :m002 rdf:type msg:RDFMessage . _(source)_  
      - :m002 msg:offset 2 . _(source)_  
    - ... 6 more premise fact(s)  
  - :rdfMessagesExample :demonstrates :MessageScopedBlankNodes . _(derived by Rule 6)_  
    - :temperatureLog msg:orderedMessages (:m001 :m002 :m003) . _(source)_  
    - :m001 msg:boundaryExplicit true . _(derived by Rule 1)_  
      - :temperatureLog rdf:type msg:MessageLog . _(source)_  
      - :temperatureLog msg:message :m001 . _(source)_  
      - :m001 rdf:type msg:RDFMessage . _(source)_  
      - :m001 msg:offset 1 . _(source)_  
    - :m001 msg:payloadResult 22 . _(derived by Rule 2)_  
      - :m001 rdf:type msg:RDFMessage . _(source)_  
      - :m001 msg:expectedResult 22 . _(source)_  
      - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 22 } . _(source)_  
    - :m002 msg:boundaryExplicit true . _(derived by Rule 1)_  
      - :temperatureLog rdf:type msg:MessageLog . _(source)_  
      - :temperatureLog msg:message :m002 . _(source)_  
      - :m002 rdf:type msg:RDFMessage . _(source)_  
      - :m002 msg:offset 2 . _(source)_  
    - ... 6 more premise fact(s)  
  - :rdfMessagesExample :demonstrates :EmptyHeartbeat . _(derived by Rule 6)_  
    - :temperatureLog msg:orderedMessages (:m001 :m002 :m003) . _(source)_  
    - :m001 msg:boundaryExplicit true . _(derived by Rule 1)_  
      - :temperatureLog rdf:type msg:MessageLog . _(source)_  
      - :temperatureLog msg:message :m001 . _(source)_  
      - :m001 rdf:type msg:RDFMessage . _(source)_  
      - :m001 msg:offset 1 . _(source)_  
    - :m001 msg:payloadResult 22 . _(derived by Rule 2)_  
      - :m001 rdf:type msg:RDFMessage . _(source)_  
      - :m001 msg:expectedResult 22 . _(source)_  
      - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 22 } . _(source)_  
    - :m002 msg:boundaryExplicit true . _(derived by Rule 1)_  
      - :temperatureLog rdf:type msg:MessageLog . _(source)_  
      - :temperatureLog msg:message :m002 . _(source)_  
      - :m002 rdf:type msg:RDFMessage . _(source)_  
      - :m002 msg:offset 2 . _(source)_  
    - ... 6 more premise fact(s)  
  - :rdfMessagesExample :demonstrates :AtomicMessageContext . _(derived by Rule 6)_  
    - :temperatureLog msg:orderedMessages (:m001 :m002 :m003) . _(source)_  
    - :m001 msg:boundaryExplicit true . _(derived by Rule 1)_  
      - :temperatureLog rdf:type msg:MessageLog . _(source)_  
      - :temperatureLog msg:message :m001 . _(source)_  
      - :m001 rdf:type msg:RDFMessage . _(source)_  
      - :m001 msg:offset 1 . _(source)_  
    - :m001 msg:payloadResult 22 . _(derived by Rule 2)_  
      - :m001 rdf:type msg:RDFMessage . _(source)_  
      - :m001 msg:expectedResult 22 . _(source)_  
      - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 22 } . _(source)_  
    - :m002 msg:boundaryExplicit true . _(derived by Rule 1)_  
      - :temperatureLog rdf:type msg:MessageLog . _(source)_  
      - :temperatureLog msg:message :m002 . _(source)_  
      - :m002 rdf:type msg:RDFMessage . _(source)_  
      - :m002 msg:offset 2 . _(source)_  
    - ... 6 more premise fact(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/rdf-messages#> .  
@prefix msg: <https://w3c-cg.github.io/rsp/spec/messages#> .  
@prefix prov: <http://www.w3.org/ns/prov#> .  
@prefix sosa: <http://www.w3.org/ns/sosa/> .  
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix list: <http://www.w3.org/2000/10/swap/list#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:rdfMessagesExample :demonstrates :ExplicitBoundaries .  
:rdfMessagesExample :demonstrates :AtomicMessageContext .  
:rdfMessagesExample :demonstrates :EmptyHeartbeat .  
:rdfMessagesExample :demonstrates :MessageScopedBlankNodes .  
:rdfMessagesExample :demonstrates :ReplayableMessageLog .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "rdf_messages" .  
  in:run see:title "RDF Messages" .  
  in:run see:sourceFile "examples/n3/rdf_messages.n3" .  
  in:run see:sourceSHA256 "2ea8b414b92e65531cf384000955ca47811d5b7c779a8d2c9fb007515e745f32" .  
  in:run see:description "This SEE example models the main idea from\nhttps://pietercolpaert.be/papers/eswc2026-rdf-messages/:\na message stream/log is not just one freely mergeable RDF graph. It is an\nordered sequence of RDF Datasets that are interpreted atomically, one message\nat a time. The middle message is deliberately empty to model a heartbeat, and\nthe local blank-node label \"_:b0\" is deliberately reused by two messages to\nshow message-scoped blank nodes." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 25 .  
  in:run see:compiledRules 6 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

