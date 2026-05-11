# Context association  

## Entailment  
The RDF dataset associates Bob's data graph with a Data Integrity proof graph and a second metadata proof graph.  

## Explanation  
The input TriG names three graph contexts. The data graph states Bob's name. The signature graph links to that data graph with a proof and records an ecdsa-rdfc-2019 Data Integrity proof from the university issuer. The metadata graph then signs the signature graph itself, giving a chained context association.  

**Generated derivation support**  

Compiled support: 3 source fact(s), 2 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (6 premise pattern(s) => 7 conclusion pattern(s)) derives :association :subject :Bob ., :association :dataGraph _:g0 ., :association :signatureGraph _:g1 ., :association :metadataGraph _:g3 ., … +3 more  
  - Uses: no graph premises; built-ins/constants satisfied the rule.  
- Rule 2: :association :status :contextAssociationVerified => :report log:outputString "[authored report]" derives :report log:outputString "[authored report]" .  
  - Uses: :association :status :contextAssociationVerified . _(derived)_  

Selected explanation support:  
  - :association :status :contextAssociationVerified . _(derived by Rule 1)_  
    - no graph premises; built-ins/constants satisfied the rule.  
  - :association :issuer <https://university.example/issuers/14> . _(derived by Rule 1)_  
    - no graph premises; built-ins/constants satisfied the rule.  
  - :association :cryptosuite "ecdsa-rdfc-2019" . _(derived by Rule 1)_  
    - no graph premises; built-ins/constants satisfied the rule.  
  - :association :metadataGraph _:g3 . _(derived by Rule 1)_  
    - no graph premises; built-ins/constants satisfied the rule.  

## Formal TriG Output  

```trig  
@prefix foaf: <http://xmlns.com/foaf/0.1/>.  
@prefix sec: <https://w3id.org/security#>.  
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.  
@prefix : <http://example.org/#>.  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:association :subject :Bob .  
:association :dataGraph _:g0 .  
:association :signatureGraph _:g1 .  
:association :metadataGraph _:g3 .  
:association :cryptosuite "ecdsa-rdfc-2019" .  
:association :issuer <https://university.example/issuers/14> .  
:association :status :contextAssociationVerified .  
```  

