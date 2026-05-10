# Dijkstra Risk Path  

## Entailment  
selected path : ClinicA -> DepotB -> LabD -> HubZ  
raw cost : 10.00  
risk sum : 0.55  
risk-adjusted score : 11.10  
edges in selected path : 3  

## Explanation  
Each edge contributes its delivery cost plus the configured risk penalty. The N3 source enumerates the small graph's simple route candidates and compares the selected route against each alternative score. The selected route balances cost and risk through DepotB and LabD, while the apparently cheaper DepotC path is rejected once risk is priced in.  

**Generated derivation support**  

Compiled support: 21 source fact(s), 3 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (9 premise pattern(s) => 2 conclusion pattern(s)) derives :Case :selectedPath :pathB ., :Case :trustGate :noEnumeratedPathIsLower .  
  - Uses: :pathB :score 11.1 . _(source)_; :pathC :score 11.3 . _(source)_; :pathRelay :score 11.7 . _(source)_; :pathDirectC :score 11.6 . _(source)_; … +1 more premise fact(s)  
- Rule 2 (7 premise pattern(s) => 1 conclusion pattern(s)) derives :Case :notes :riskCanOutweighRawCost .  
  - Uses: :pathViaC :rawCost 8 . _(source)_; :pathViaC :score 11.2 . _(source)_; :pathViaC :riskSum 1.6 . _(source)_; :pathB :rawCost 10 . _(source)_; … +1 more premise fact(s)  
- Rule 3 (9 premise pattern(s) => 2 conclusion pattern(s)) derives :dijkstraRiskPath log:outputString "[authored report]" ., :dijkstraRiskPath :selects :pathB .  
  - Uses: :Case :selectedPath :pathB . _(derived)_; :Case :trustGate :noEnumeratedPathIsLower . _(derived)_; :Case :notes :riskCanOutweighRawCost . _(derived)_; :pathB :routeText "ClinicA -> DepotB -> LabD -> HubZ" . _(source)_; … +4 more premise fact(s)  

Selected explanation support:  
  - :dijkstraRiskPath :selects :pathB . _(derived by Rule 3)_  
    - :Case :selectedPath :pathB . _(derived by Rule 1)_  
      - :pathB :score 11.1 . _(source)_  
      - :pathC :score 11.3 . _(source)_  
      - :pathRelay :score 11.7 . _(source)_  
      - :pathDirectC :score 11.6 . _(source)_  
      - ... 1 more premise fact(s)  
    - :Case :trustGate :noEnumeratedPathIsLower . _(derived by Rule 1)_  
      - :pathB :score 11.1 . _(source)_  
      - :pathC :score 11.3 . _(source)_  
      - :pathRelay :score 11.7 . _(source)_  
      - :pathDirectC :score 11.6 . _(source)_  
      - ... 1 more premise fact(s)  
    - :Case :notes :riskCanOutweighRawCost . _(derived by Rule 2)_  
      - :pathViaC :rawCost 8 . _(source)_  
      - :pathViaC :score 11.2 . _(source)_  
      - :pathViaC :riskSum 1.6 . _(source)_  
      - :pathB :rawCost 10 . _(source)_  
      - ... 1 more premise fact(s)  
    - :pathB :routeText "ClinicA -> DepotB -> LabD -> HubZ" . _(source)_  
    - ... 4 more premise fact(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/dijkstra-risk-path#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:dijkstraRiskPath :selects :pathB .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "dijkstra_risk_path" .  
  in:run see:title "Dijkstra Risk Path" .  
  in:run see:sourceFile "examples/n3/dijkstra_risk_path.n3" .  
  in:run see:sourceSHA256 "a11f23a58252e557817c5d26cabdfee5ce8c5c08a40a54ab680eaa8960c88937" .  
  in:run see:description "N3-compiled version of the risk-adjusted route example. The original JSON\ninput is preserved as the data-input sidecar; this source compiles the\nexecutable derivation and report." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 21 .  
  in:run see:compiledRules 3 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

