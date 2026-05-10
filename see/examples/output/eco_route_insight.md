# Eco Route Insight  

## Entailment  
insight status : issue  
show eco banner : yes  
audience : Depot X  
allowed use : ui.eco.banner  
suggested route : alt-low-fuel  
current fuel index : 120.75  
suggested fuel index : 99.75  
estimated saving : 21.00  
expires at : 2025-01-01T11:00:00Z  
raw data exported : no  
signature algorithm : HMAC-SHA256  
payload digest : 00e19becd91e81d6881749655d23d43002d9ea714bba61e855eafbc8ef9a5135  
signature key : local-demo-key  
signature : 7fFGBN8fyI7xrmRz5VreeAUSf3LC_ywbj32NGk2ovUs  

## Explanation  
The current route uses fuel index = distanceKm × (payloadKg / 1000) × gradientFactor. For shipment-1, Current urban route gives 42.00 × 2.50 × 1.15 = 120.75. The policy threshold is 120.00, so a local eco banner is justified. The selected alternative alt-low-fuel gives 38.00 × 2.50 × 1.05 = 99.75, saving 21.00 while staying within the ETA delay limit. The signed envelope exposes audience, use, expiry, route suggestion, and compact fuel indices, but not raw payload, GPS trace, driver behavior, or raw telemetry.  

**Generated derivation support**  

Compiled support: 33 source fact(s), 2 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (11 premise pattern(s) => 4 conclusion pattern(s)) derives :Insight :status "issue" ., :Insight :showEcoBanner "yes" ., :Insight :suggestedRoute :altLowFuel ., :Insight :estimatedSaving 21 .  
  - Uses: :currentRoute :fuelIndex 120.75 . _(source)_; :currentRoute :etaMinutes 64 . _(source)_; :altLowFuel :fuelIndex 99.75 . _(source)_; :altLowFuel :etaMinutes 66 . _(source)_; … +2 more premise fact(s)  
- Rule 2 (23 premise pattern(s) => 2 conclusion pattern(s)) derives :ecoRouteInsight log:outputString "[authored report]" ., :ecoRouteInsight :issues :Insight .  
  - Uses: :Insight :status "issue" . _(derived)_; :Insight :showEcoBanner "yes" . _(derived)_; :Insight :suggestedRoute :altLowFuel . _(derived)_; :Insight :estimatedSaving 21 . _(derived)_; … +18 more premise fact(s)  

Selected explanation support:  
  - :ecoRouteInsight :issues :Insight . _(derived by Rule 2)_  
    - :Insight :status "issue" . _(derived by Rule 1)_  
      - :currentRoute :fuelIndex 120.75 . _(source)_  
      - :currentRoute :etaMinutes 64 . _(source)_  
      - :altLowFuel :fuelIndex 99.75 . _(source)_  
      - :altLowFuel :etaMinutes 66 . _(source)_  
      - ... 2 more premise fact(s)  
    - :Insight :showEcoBanner "yes" . _(derived by Rule 1)_  
      - :currentRoute :fuelIndex 120.75 . _(source)_  
      - :currentRoute :etaMinutes 64 . _(source)_  
      - :altLowFuel :fuelIndex 99.75 . _(source)_  
      - :altLowFuel :etaMinutes 66 . _(source)_  
      - ... 2 more premise fact(s)  
    - :Insight :suggestedRoute :altLowFuel . _(derived by Rule 1)_  
      - :currentRoute :fuelIndex 120.75 . _(source)_  
      - :currentRoute :etaMinutes 64 . _(source)_  
      - :altLowFuel :fuelIndex 99.75 . _(source)_  
      - :altLowFuel :etaMinutes 66 . _(source)_  
      - ... 2 more premise fact(s)  
    - :Insight :estimatedSaving 21 . _(derived by Rule 1)_  
      - :currentRoute :fuelIndex 120.75 . _(source)_  
      - :currentRoute :etaMinutes 64 . _(source)_  
      - :altLowFuel :fuelIndex 99.75 . _(source)_  
      - :altLowFuel :etaMinutes 66 . _(source)_  
      - ... 2 more premise fact(s)  
    - ... 18 more premise fact(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/eco-route-insight#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:ecoRouteInsight :issues :Insight .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "eco_route_insight" .  
  in:run see:title "Eco Route Insight" .  
  in:run see:sourceFile "examples/n3/eco_route_insight.n3" .  
  in:run see:sourceSHA256 "b5af0caa2e473b5957ba8cec647ee4e2edf4cdc2a5c28110e8536c19381b0bd3" .  
  in:run see:description "N3-compiled version of the privacy-preserving eco route insight. The JSON\ninput remains the data-input sidecar; this source compiles the local decision\nand signed-envelope explanation." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 33 .  
  in:run see:compiledRules 2 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

