# Delfour  

## Entailment  
The scanner is allowed to use a neutral shopping insight and recommends Low-Sugar Tea Biscuits instead of Classic Tea Biscuits.  
case : delfour  
decision : Allowed  
scanned product : Classic Tea Biscuits  
suggested alternative: Low-Sugar Tea Biscuits  

## Explanation  
The phone desensitizes a diabetes-related household condition into a scoped low-sugar need, wraps it in an expiring Insight + Policy envelope, and the scanner consumes that envelope for shopping assistance.  
metric : sugar_g_per_serving  
threshold : 10.0  
scope : self-scanner @ pick_up_scanner  
retailer : Delfour  
signature alg : SHA-256  
banner headline : Track sugar per serving while you scan  
expires at : 2025-10-05T22:33:48Z  
audit entries : 1  
bus files written : 6  

**Generated derivation support**  

Compiled support: 61 source fact(s), 16 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1: :householdProfile :condition "Diabetes" => :case :needsLowSugar true derives :case :needsLowSugar true .  
  - Uses: :householdProfile :condition "Diabetes" . _(source)_  
- Rule 2: :case :needsLowSugar true => :insight :derivedFromNeed "low_sugar" derives :insight :derivedFromNeed "low_sugar" .  
  - Uses: :case :needsLowSugar true . _(derived)_  
- Rule 3 (3 premise pattern(s) => 1 conclusion pattern(s)) derives :assurance :payloadHashMatches true .  
  - Uses: :envelope :canonicalJson "insight=lower_sugar;policy=shopping_assist_only;expires=2025-10-05T22:33:48Z" . _(source)_; :signature :payloadHashSHA256 "9025c5ccc1cc3e97aa639e3ca2d62e65ba0abed9cf3573b487c61d8cec6b3460" . _(source)_  
- Rule 4: :insight :serializedLowercase ?s; ?s string:notMatches "diabetes|medical" => :assurance :minimizationStripsSensitiveTerms true derives :assurance :minimizationStripsSensitiveTerms true .  
  - Uses: :insight :serializedLowercase "metric=sugar_g_per_serving;retailer=delfour;threshold=10.0;scope=self-scanner" . _(source)_  
- Rule 5 (3 premise pattern(s) => 1 conclusion pattern(s)) derives :assurance :scopeComplete true .  
  - Uses: :insight :scopeDevice "self-scanner" . _(source)_; :insight :scopeEvent "pick_up_scanner" . _(source)_; :insight :expiresAt "2025-10-05T22:33:48Z" . _(source)_  
- Rule 6 (8 premise pattern(s) => 2 conclusion pattern(s)) derives :decision :outcome "Allowed" ., :assurance :authorizationAllowed true .  
  - Uses: _:blank1 odrl:action odrl:use . _(source)_; _:blank1 odrl:target :insight . _(source)_; _:blank2 odrl:rightOperand "shopping_assist" . _(source)_; _:blank1 odrl:constraint _:blank2 . _(source)_; … +3 more premise fact(s)  

Selected explanation support:  
  - :delfour :suggests :lowSugarBiscuits . _(derived by Rule 19)_  
    - :result :ready true . _(derived by Rule 15)_  
      - :assurance :payloadHashMatches true . _(derived by Rule 3)_  
        - :envelope :canonicalJson "insight=lower_sugar;policy=shopping_assist_only;expires=2025-10-05T22:33:48Z" . _(source)_  
        - :signature :payloadHashSHA256 "9025c5ccc1cc3e97aa639e3ca2d62e65ba0abed9cf3573b487c61d8cec6b3460" . _(source)_  
      - :assurance :minimizationStripsSensitiveTerms true . _(derived by Rule 4)_  
        - :insight :serializedLowercase "metric=sugar_g_per_serving;retailer=delfour;threshold=10.0;scope=self-scanner" . _(source)_  
      - :assurance :scopeComplete true . _(derived by Rule 5)_  
        - :insight :scopeDevice "self-scanner" . _(source)_  
        - :insight :scopeEvent "pick_up_scanner" . _(source)_  
        - :insight :expiresAt "2025-10-05T22:33:48Z" . _(source)_  
      - :assurance :authorizationAllowed true . _(derived by Rule 6)_  
        - _:blank1 odrl:action odrl:use . _(source)_  
        - _:blank1 odrl:target :insight . _(source)_  
        - _:blank2 odrl:rightOperand "shopping_assist" . _(source)_  
        - _:blank1 odrl:constraint _:blank2 . _(source)_  
        - ... 3 more premise fact(s)  
      - ... 5 more premise fact(s)  
    - :scan :scannedProduct :classicBiscuits . _(source)_  
    - :classicBiscuits :productName "Classic Tea Biscuits" . _(source)_  
    - :case :suggestedAlternative :lowSugarBiscuits . _(derived by Rule 8)_  
      - :scan :scannedProduct :classicBiscuits . _(source)_  
      - :classicBiscuits :sugarTenths 120 . _(source)_  
      - :lowSugarBiscuits rdf:type :Product . _(source)_  
      - :lowSugarBiscuits :sugarTenths 30 . _(source)_  
    - ... 12 more premise fact(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/delfour#> .  
@prefix ins: <https://example.org/insight#> .  
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix crypto: <http://www.w3.org/2000/10/swap/crypto#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:delfour :suggests :lowSugarBiscuits .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "delfour" .  
  in:run see:title "Delfour" .  
  in:run see:sourceFile "examples/n3/delfour.n3" .  
  in:run see:sourceSHA256 "250631cb3de8addff7037b54789b63b2ea034eb6b579c61a9feca542efd584c1" .  
  in:run see:description "N3-compiled version of the Delfour insight-economy example. A private phone\ncondition is desensitized into a scoped low-sugar insight; the scanner may use\nit for shopping assistance, but not for marketing." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 61 .  
  in:run see:compiledRules 16 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 3 .  
  in:run see:compiledQueries 1 .  
}  
```  

