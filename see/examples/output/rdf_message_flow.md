# RDF Message Flow  

## Entailment  
Continuous RDF Message flow accepted: 5 ordered messages moved through the ingest → validate → interpret → route → sink pipeline. The threshold was 26, so results 21 and 22 were archived, the heartbeat kept the stream alive, and results 28 and 29 were emitted as alerts.  

## Explanation  
The N3 source starts only :m001 at ingress. Each message must reach :sink before the continuous-flow rule releases its msg:nextMessage. Observation payloads are inspected with log:includes inside each message formula, while the empty heartbeat uses the same envelope and routing stages without a payload. This models messages flowing through a live stream while preserving message boundaries.  

**Generated derivation support**  

Compiled support: 42 source fact(s), 9 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1: ?Message :atStage :ingest => ?Message :atStage :validate derives :m001 :atStage :validate ., :m002 :atStage :validate ., :m003 :atStage :validate ., :m004 :atStage :validate ., … +1 more  
  - Uses: :m001 :atStage :ingest . _(source)_; :m002 :atStage :ingest . _(derived)_; :m003 :atStage :ingest . _(derived)_; :m004 :atStage :ingest . _(derived)_; … +1 more premise fact(s)  
- Rule 2 (3 premise pattern(s) => 2 conclusion pattern(s)) derives :m001 msg:boundaryExplicit true ., :m001 :atStage :interpret ., :m002 msg:boundaryExplicit true ., :m002 :atStage :interpret ., … +6 more  
  - Uses: :m001 :atStage :validate . _(derived)_; :m001 rdf:type msg:RDFMessage . _(source)_; :m001 msg:offset 1 . _(source)_; :m002 :atStage :validate . _(derived)_; … +11 more premise fact(s)  
- Rule 3 (5 premise pattern(s) => 2 conclusion pattern(s)) derives :m001 msg:payloadResult 21 ., :m001 :atStage :route ., :m002 msg:payloadResult 22 ., :m002 :atStage :route ., … +4 more  
  - Uses: :m001 :atStage :interpret . _(derived)_; :m001 msg:payloadKind :observation . _(source)_; :m001 msg:expectedResult 21 . _(source)_; :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_; … +12 more premise fact(s)  
- Rule 6 (4 premise pattern(s) => 3 conclusion pattern(s)) derives :m001 :route :archiveSink ., :m001 :atStage :sink ., :archiveSink :received :m001 ., :m002 :route :archiveSink ., … +2 more  
  - Uses: :m001 :atStage :route . _(derived)_; :m001 msg:payloadResult 21 . _(derived)_; :temperatureFlow :highThreshold 26 . _(source)_; :m002 :atStage :route . _(derived)_; … +1 more premise fact(s)  
- Rule 8 (3 premise pattern(s) => 2 conclusion pattern(s)) derives :m001 :releases :m002 ., :m002 :atStage :ingest ., :m002 :releases :m003 ., :m003 :atStage :ingest ., … +4 more  
  - Uses: :m001 :atStage :sink . _(derived)_; :m001 msg:nextMessage :m002 . _(source)_; :m002 rdf:type msg:RDFMessage . _(source)_; :m002 :atStage :sink . _(derived)_; … +8 more premise fact(s)  
- Rule 4: ?Message :atStage :interpret; ?Message msg:payloadKind :heartbeat => ?Message msg:emptyMessageAllowed true; ?Message :atStage :route derives :m003 msg:emptyMessageAllowed true ., :m003 :atStage :route .  
  - Uses: :m003 :atStage :interpret . _(derived)_; :m003 msg:payloadKind :heartbeat . _(source)_  

Selected explanation support:  
  - :rdfMessageFlowExample :demonstrates :ThresholdRouting . _(derived by Rule 9)_  
    - :temperatureFlow msg:orderedMessages (:m001 :m002 :m003 :m004 :m005) . _(source)_  
    - :temperatureFlow :highThreshold 26 . _(source)_  
    - :m001 :atStage :sink . _(derived by Rule 6)_  
      - :m001 :atStage :route . _(derived by Rule 3)_  
        - :m001 :atStage :interpret . _(derived by Rule 2)_  
          - :m001 :atStage :validate . _(derived by Rule 1)_  
            - support omitted beyond depth 4  
          - :m001 rdf:type msg:RDFMessage . _(source)_  
          - :m001 msg:offset 1 . _(source)_  
        - :m001 msg:payloadKind :observation . _(source)_  
        - :m001 msg:expectedResult 21 . _(source)_  
        - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_  
      - :m001 msg:payloadResult 21 . _(derived by Rule 3)_  
        - :m001 :atStage :interpret . _(derived by Rule 2)_  
          - :m001 :atStage :validate . _(derived by Rule 1)_  
            - support omitted beyond depth 4  
          - :m001 rdf:type msg:RDFMessage . _(source)_  
          - :m001 msg:offset 1 . _(source)_  
        - :m001 msg:payloadKind :observation . _(source)_  
        - :m001 msg:expectedResult 21 . _(source)_  
        - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_  
      - :temperatureFlow :highThreshold 26 . _(source)_  
    - :m001 msg:payloadResult 21 . _(derived by Rule 3)_  
      - :m001 :atStage :interpret . _(derived by Rule 2)_  
        - :m001 :atStage :validate . _(derived by Rule 1)_  
          - :m001 :atStage :ingest . _(source)_  
        - :m001 rdf:type msg:RDFMessage . _(source)_  
        - :m001 msg:offset 1 . _(source)_  
      - :m001 msg:payloadKind :observation . _(source)_  
      - :m001 msg:expectedResult 21 . _(source)_  
      - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_  
    - ... 17 more premise fact(s)  
  - :rdfMessageFlowExample :demonstrates :HeartbeatInFlow . _(derived by Rule 9)_  
    - :temperatureFlow msg:orderedMessages (:m001 :m002 :m003 :m004 :m005) . _(source)_  
    - :temperatureFlow :highThreshold 26 . _(source)_  
    - :m001 :atStage :sink . _(derived by Rule 6)_  
      - :m001 :atStage :route . _(derived by Rule 3)_  
        - :m001 :atStage :interpret . _(derived by Rule 2)_  
          - :m001 :atStage :validate . _(derived by Rule 1)_  
            - support omitted beyond depth 4  
          - :m001 rdf:type msg:RDFMessage . _(source)_  
          - :m001 msg:offset 1 . _(source)_  
        - :m001 msg:payloadKind :observation . _(source)_  
        - :m001 msg:expectedResult 21 . _(source)_  
        - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_  
      - :m001 msg:payloadResult 21 . _(derived by Rule 3)_  
        - :m001 :atStage :interpret . _(derived by Rule 2)_  
          - :m001 :atStage :validate . _(derived by Rule 1)_  
            - support omitted beyond depth 4  
          - :m001 rdf:type msg:RDFMessage . _(source)_  
          - :m001 msg:offset 1 . _(source)_  
        - :m001 msg:payloadKind :observation . _(source)_  
        - :m001 msg:expectedResult 21 . _(source)_  
        - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_  
      - :temperatureFlow :highThreshold 26 . _(source)_  
    - :m001 msg:payloadResult 21 . _(derived by Rule 3)_  
      - :m001 :atStage :interpret . _(derived by Rule 2)_  
        - :m001 :atStage :validate . _(derived by Rule 1)_  
          - :m001 :atStage :ingest . _(source)_  
        - :m001 rdf:type msg:RDFMessage . _(source)_  
        - :m001 msg:offset 1 . _(source)_  
      - :m001 msg:payloadKind :observation . _(source)_  
      - :m001 msg:expectedResult 21 . _(source)_  
      - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_  
    - ... 17 more premise fact(s)  
  - :rdfMessageFlowExample :demonstrates :AtomicMessageContext . _(derived by Rule 9)_  
    - :temperatureFlow msg:orderedMessages (:m001 :m002 :m003 :m004 :m005) . _(source)_  
    - :temperatureFlow :highThreshold 26 . _(source)_  
    - :m001 :atStage :sink . _(derived by Rule 6)_  
      - :m001 :atStage :route . _(derived by Rule 3)_  
        - :m001 :atStage :interpret . _(derived by Rule 2)_  
          - :m001 :atStage :validate . _(derived by Rule 1)_  
            - support omitted beyond depth 4  
          - :m001 rdf:type msg:RDFMessage . _(source)_  
          - :m001 msg:offset 1 . _(source)_  
        - :m001 msg:payloadKind :observation . _(source)_  
        - :m001 msg:expectedResult 21 . _(source)_  
        - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_  
      - :m001 msg:payloadResult 21 . _(derived by Rule 3)_  
        - :m001 :atStage :interpret . _(derived by Rule 2)_  
          - :m001 :atStage :validate . _(derived by Rule 1)_  
            - support omitted beyond depth 4  
          - :m001 rdf:type msg:RDFMessage . _(source)_  
          - :m001 msg:offset 1 . _(source)_  
        - :m001 msg:payloadKind :observation . _(source)_  
        - :m001 msg:expectedResult 21 . _(source)_  
        - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_  
      - :temperatureFlow :highThreshold 26 . _(source)_  
    - :m001 msg:payloadResult 21 . _(derived by Rule 3)_  
      - :m001 :atStage :interpret . _(derived by Rule 2)_  
        - :m001 :atStage :validate . _(derived by Rule 1)_  
          - :m001 :atStage :ingest . _(source)_  
        - :m001 rdf:type msg:RDFMessage . _(source)_  
        - :m001 msg:offset 1 . _(source)_  
      - :m001 msg:payloadKind :observation . _(source)_  
      - :m001 msg:expectedResult 21 . _(source)_  
      - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_  
    - ... 17 more premise fact(s)  
  - :rdfMessageFlowExample :demonstrates :BackPressureRelease . _(derived by Rule 9)_  
    - :temperatureFlow msg:orderedMessages (:m001 :m002 :m003 :m004 :m005) . _(source)_  
    - :temperatureFlow :highThreshold 26 . _(source)_  
    - :m001 :atStage :sink . _(derived by Rule 6)_  
      - :m001 :atStage :route . _(derived by Rule 3)_  
        - :m001 :atStage :interpret . _(derived by Rule 2)_  
          - :m001 :atStage :validate . _(derived by Rule 1)_  
            - support omitted beyond depth 4  
          - :m001 rdf:type msg:RDFMessage . _(source)_  
          - :m001 msg:offset 1 . _(source)_  
        - :m001 msg:payloadKind :observation . _(source)_  
        - :m001 msg:expectedResult 21 . _(source)_  
        - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_  
      - :m001 msg:payloadResult 21 . _(derived by Rule 3)_  
        - :m001 :atStage :interpret . _(derived by Rule 2)_  
          - :m001 :atStage :validate . _(derived by Rule 1)_  
            - support omitted beyond depth 4  
          - :m001 rdf:type msg:RDFMessage . _(source)_  
          - :m001 msg:offset 1 . _(source)_  
        - :m001 msg:payloadKind :observation . _(source)_  
        - :m001 msg:expectedResult 21 . _(source)_  
        - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_  
      - :temperatureFlow :highThreshold 26 . _(source)_  
    - :m001 msg:payloadResult 21 . _(derived by Rule 3)_  
      - :m001 :atStage :interpret . _(derived by Rule 2)_  
        - :m001 :atStage :validate . _(derived by Rule 1)_  
          - :m001 :atStage :ingest . _(source)_  
        - :m001 rdf:type msg:RDFMessage . _(source)_  
        - :m001 msg:offset 1 . _(source)_  
      - :m001 msg:payloadKind :observation . _(source)_  
      - :m001 msg:expectedResult 21 . _(source)_  
      - :m001 msg:payload { _:m001b0 rdf:type sosa:Observation . _:m001b0 sosa:madeBySensor :thermometerA . _:m001b0 sosa:resultTime "2026-05-12T18:20:00Z" . _:m001b0 sosa:hasSimpleResult 21 } . _(source)_  
    - ... 17 more premise fact(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/rdf-message-flow#> .  
@prefix msg: <https://example.org/msg#> .  
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

:rdfMessageFlowExample :demonstrates :ContinuousFlow .  
:rdfMessageFlowExample :demonstrates :BackPressureRelease .  
:rdfMessageFlowExample :demonstrates :AtomicMessageContext .  
:rdfMessageFlowExample :demonstrates :HeartbeatInFlow .  
:rdfMessageFlowExample :demonstrates :ThresholdRouting .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "rdf_message_flow" .  
  in:run see:title "RDF Message Flow" .  
  in:run see:sourceFile "examples/n3/rdf_message_flow.n3" .  
  in:run see:sourceSHA256 "e4e534c8ac3c2aa276e7158cca8d3146531879033f73685c302b486be2ab0099" .  
  in:run see:description "A companion to rdf_messages.n3. This example focuses on a live stream where\nRDF Messages continuously flow through a small processing pipeline. The next\nmessage is released only after the current message reaches the sink, so the\nstream behaves as an ordered, replayable flow rather than a single merged RDF\ngraph." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 42 .  
  in:run see:compiledRules 9 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

