# GPS route planning  

## Entailment  
Take the direct route via Brugge.  
Recommended route: Gent -> Brugge -> Oostende  

## Explanation  
From Gent to Oostende, the planner found two routes in this small map. The direct route (Gent -> Brugge -> Oostende) takes 2400 seconds at cost 0.01, with belief 0.9408 and comfort 0.99. The alternative (Gent -> Kortrijk -> Brugge -> Oostende) takes 4100 seconds at cost 0.018, with belief 0.903168 and comfort 0.9801. So the direct route is faster, cheaper, more reliable, and slightly more comfortable.  

**Generated derivation support**  

Compiled support: 8 source fact(s), 7 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 3: :i1 :location :Gent; (:Gent :Oostende ?Acts ?Dur ?Cost ?Bel ?Comf) :path true => :i1 gps:path (?Acts ?Dur ?Cost ?Bel ?Comf) derives :i1 gps:path ((:drive_gent_brugge :drive_brugge_oostende) 2400 0.01 0.9408 0.99) ., :i1 gps:path ((:drive_gent_kortrijk :drive_kortrijk_brugge :drive_brugge_oostende) 4100 0.018 0.903168 0.9801) .  
  - Uses: :i1 :location :Gent . _(source)_  
- Rule 4 (1 premise pattern(s) => 4 conclusion pattern(s)) derives :routeDirect :duration 2400 ., :routeDirect :cost 0.01 ., :routeDirect :belief 0.9408 ., :routeDirect :comfort 0.99 .  
  - Uses: :i1 gps:path ((:drive_gent_brugge :drive_brugge_oostende) 2400 0.01 0.9408 0.99) . _(derived)_  
- Rule 5 (1 premise pattern(s) => 4 conclusion pattern(s)) derives :routeViaKortrijk :duration 4100 ., :routeViaKortrijk :cost 0.018 ., :routeViaKortrijk :belief 0.903168 ., :routeViaKortrijk :comfort 0.9801 .  
  - Uses: :i1 gps:path ((:drive_gent_kortrijk :drive_kortrijk_brugge :drive_brugge_oostende) 4100 0.018 0.903168 0.9801) . _(derived)_  
- Rule 6 (12 premise pattern(s) => 2 conclusion pattern(s)) derives :decision :recommendedRoute :routeDirect ., :decision :outcome "Take the direct route via Brugge." .  
  - Uses: :routeDirect :duration 2400 . _(derived)_; :routeDirect :cost 0.01 . _(derived)_; :routeDirect :belief 0.9408 . _(derived)_; :routeDirect :comfort 0.99 . _(derived)_; … +4 more premise fact(s)  
- Rule 7 (13 premise pattern(s) => 1 conclusion pattern(s)) derives :report log:outputString "[authored report]" .  
  - Uses: :decision :recommendedRoute :routeDirect . _(derived)_; :decision :outcome "Take the direct route via Brugge." . _(derived)_; :routeDirect :label "Gent -> Brugge -> Oostende" . _(source)_; :routeDirect :duration 2400 . _(derived)_; … +8 more premise fact(s)  

Selected explanation support:  
  - :report log:outputString "[authored report]" . _(authored report, Rule 7)_  
  - :decision :outcome "Take the direct route via Brugge." . _(derived by Rule 6)_  
    - :routeDirect :duration 2400 . _(derived by Rule 4)_  
      - :i1 gps:path ((:drive_gent_brugge :drive_brugge_oostende) 2400 0.01 0.9408 0.99) . _(derived by Rule 3)_  
        - :i1 :location :Gent . _(source)_  
    - :routeDirect :cost 0.01 . _(derived by Rule 4)_  
      - :i1 gps:path ((:drive_gent_brugge :drive_brugge_oostende) 2400 0.01 0.9408 0.99) . _(derived by Rule 3)_  
        - :i1 :location :Gent . _(source)_  
    - :routeDirect :belief 0.9408 . _(derived by Rule 4)_  
      - :i1 gps:path ((:drive_gent_brugge :drive_brugge_oostende) 2400 0.01 0.9408 0.99) . _(derived by Rule 3)_  
        - :i1 :location :Gent . _(source)_  
    - :routeDirect :comfort 0.99 . _(derived by Rule 4)_  
      - :i1 gps:path ((:drive_gent_brugge :drive_brugge_oostende) 2400 0.01 0.9408 0.99) . _(derived by Rule 3)_  
        - :i1 :location :Gent . _(source)_  
    - ... 4 more premise fact(s)  
  - :decision :recommendedRoute :routeDirect . _(derived by Rule 6)_  
    - :routeDirect :duration 2400 . _(derived by Rule 4)_  
      - :i1 gps:path ((:drive_gent_brugge :drive_brugge_oostende) 2400 0.01 0.9408 0.99) . _(derived by Rule 3)_  
        - :i1 :location :Gent . _(source)_  
    - :routeDirect :cost 0.01 . _(derived by Rule 4)_  
      - :i1 gps:path ((:drive_gent_brugge :drive_brugge_oostende) 2400 0.01 0.9408 0.99) . _(derived by Rule 3)_  
        - :i1 :location :Gent . _(source)_  
    - :routeDirect :belief 0.9408 . _(derived by Rule 4)_  
      - :i1 gps:path ((:drive_gent_brugge :drive_brugge_oostende) 2400 0.01 0.9408 0.99) . _(derived by Rule 3)_  
        - :i1 :location :Gent . _(source)_  
    - :routeDirect :comfort 0.99 . _(derived by Rule 4)_  
      - :i1 gps:path ((:drive_gent_brugge :drive_brugge_oostende) 2400 0.01 0.9408 0.99) . _(derived by Rule 3)_  
        - :i1 :location :Gent . _(source)_  
    - ... 4 more premise fact(s)  
  - :routeViaKortrijk :comfort 0.9801 . _(derived by Rule 5)_  
    - :i1 gps:path ((:drive_gent_kortrijk :drive_kortrijk_brugge :drive_brugge_oostende) 4100 0.018 0.903168 0.9801) . _(derived by Rule 3)_  
      - :i1 :location :Gent . _(source)_  

## Formal TriG Output  

```trig  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix list: <http://www.w3.org/2000/10/swap/list#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix gps: <https://eyereasoner.github.io/see/examples/gps#> .  
@prefix : <https://eyereasoner.github.io/see/examples/gps#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:i1 gps:path ((:drive_gent_brugge :drive_brugge_oostende) 2400 0.01 0.9408 0.99) .  
:i1 gps:path ((:drive_gent_kortrijk :drive_kortrijk_brugge :drive_brugge_oostende) 4100 0.018 0.903168 0.9801) .  
:routeDirect :duration 2400 .  
:routeDirect :cost 0.01 .  
:routeDirect :belief 0.9408 .  
:routeDirect :comfort 0.99 .  
:routeViaKortrijk :duration 4100 .  
:routeViaKortrijk :cost 0.018 .  
:routeViaKortrijk :belief 0.903168 .  
:routeViaKortrijk :comfort 0.9801 .  
:decision :recommendedRoute :routeDirect .  
:decision :outcome "Take the direct route via Brugge." .  
:report log:outputString "=== Answer ===\nTake the direct route via Brugge.\nRecommended route: Gent -> Brugge -> Oostende\n\n=== Explanation ===\nFrom Gent to Oostende, the planner found two routes in this small map. The direct route (Gent -> Brugge -> Oostende) takes 2400 seconds at cost 0.01, with belief 0.9408 and comfort 0.99. The alternative (Gent -> Kortrijk -> Brugge -> Oostende) takes 4100 seconds at cost 0.018, with belief 0.903168 and comfort 0.9801. So the direct route is faster, cheaper, more reliable, and slightly more comfortable." .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "gps" .  
  in:run see:title "GPS route planning" .  
  in:run see:sourceFile "examples/n3/gps.n3" .  
  in:run see:sourceSHA256 "3ca7a57d4a2d06215e852e74b51d71f6b0aa36230eb172fa3e17465052c06404" .  
  in:run see:description "Goal-driven path planning over a tiny western-Belgium map. The N3 source is\nadapted from Eyeling's GPS example and compiles to a standalone SEE example." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 8 .  
  in:run see:compiledRules 5 .  
  in:run see:compiledBackwardRules 2 .  
  in:run see:compiledFuses 4 .  
  in:run see:compiledQueries 0 .  
}  
```  

