# EV Roadtrip Planner  

## Entailment  
Select plan : drive_bru_liege -> drive_liege_aachen -> shuttle_aachen_cologne.  
route result : Cologne battery=low pass=none  
duration : 210.0 minutes  
cost : 0.054  
belief : 0.974175  
comfort : 0.898320  
acceptable plans : 8  
fuel remaining : 5 of 8  

## Explanation  
The planner starts with car1 at Brussels, battery=high, pass=none, then composes action descriptions until the goal city Cologne is reached. Duration and cost are summed across each candidate; belief and comfort are multiplied, matching the N3 planner pattern. The selected plan is the fastest acceptable candidate under belief > 0.93, cost < 0.090, and duration < 260.0. It uses the shuttle from Aachen to Cologne, avoiding an extra charge stop while keeping belief at 0.974175.  

Top acceptable plans:  
1. drive_bru_liege -> drive_liege_aachen -> shuttle_aachen_cologne | duration=210.0 cost=0.054 belief=0.974175 comfort=0.898320 final=Cologne/low/none  
2. buy_pass_brussels -> drive_bru_liege -> drive_liege_aachen -> shuttle_aachen_cologne | duration=220.0 cost=0.058 belief=0.973201 comfort=0.889337 final=Cologne/low/yes  
3. buy_pass_brussels -> drive_bru_liege -> drive_liege_aachen -> fast_charge_aachen_pass -> premium_corridor_aachen_cologne | duration=220.0 cost=0.063 belief=0.953737 comfort=0.880398 final=Cologne/low/yes  
4. drive_bru_liege -> buy_pass_liege -> drive_liege_aachen -> shuttle_aachen_cologne | duration=225.0 cost=0.057 belief=0.969304 comfort=0.880354 final=Cologne/low/yes  
5. drive_bru_liege -> buy_pass_liege -> drive_liege_aachen -> fast_charge_aachen_pass -> premium_corridor_aachen_cologne | duration=225.0 cost=0.062 belief=0.949918 comfort=0.871505 final=Cologne/low/yes  

**Generated derivation support**  

Compiled support: 64 source fact(s), 3 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (10 premise pattern(s) => 1 conclusion pattern(s)) derives :plan1 gps:acceptable true ., :plan2 gps:acceptable true ., :plan3 gps:acceptable true ., :plan4 gps:acceptable true ., … +1 more  
  - Uses: :plan1 rdf:type gps:Plan . _(source)_; :plan1 gps:duration 210 . _(source)_; :plan1 gps:cost 0.054 . _(source)_; :plan1 gps:belief 0.974175 . _(source)_; … +19 more premise fact(s)  
- Rule 2: :plan1 gps:acceptable true; :plan1 gps:rank 1 => :PlanSet :selected :plan1 derives :PlanSet :selected :plan1 .  
  - Uses: :plan1 gps:acceptable true . _(derived)_; :plan1 gps:rank 1 . _(source)_  
- Rule 4 (45 premise pattern(s) => 2 conclusion pattern(s)) derives :evRoadtripPlanner log:outputString "[authored report]" ., :evRoadtripPlanner :selects :plan1 .  
  - Uses: :PlanSet :selected :plan1 . _(derived)_; :PlanSet :acceptableCount 8 . _(source)_; :PlanSet :fuelBudget 8 . _(source)_; :plan1 gps:actions "drive_bru_liege -> drive_liege_aachen -> shuttle_aachen_cologne" . _(source)_; … +40 more premise fact(s)  

Selected explanation support:  
  - :evRoadtripPlanner :selects :plan1 . _(derived by Rule 4)_  
    - :PlanSet :selected :plan1 . _(derived by Rule 2)_  
      - :plan1 gps:acceptable true . _(derived by Rule 1)_  
        - :plan1 rdf:type gps:Plan . _(source)_  
        - :plan1 gps:duration 210 . _(source)_  
        - :plan1 gps:cost 0.054 . _(source)_  
        - :plan1 gps:belief 0.974175 . _(source)_  
        - ... 3 more premise fact(s)  
      - :plan1 gps:rank 1 . _(source)_  
    - :PlanSet :acceptableCount 8 . _(source)_  
    - :PlanSet :fuelBudget 8 . _(source)_  
    - :plan1 gps:actions "drive_bru_liege -> drive_liege_aachen -> shuttle_aachen_cologne" . _(source)_  
    - ... 40 more premise fact(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/ev-roundtrip-planner#> .  
@prefix gps: <https://eyereasoner.github.io/see/examples/gps#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:evRoadtripPlanner :selects :plan1 .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "ev_roundtrip_planner" .  
  in:run see:title "EV Roadtrip Planner" .  
  in:run see:sourceFile "examples/n3/ev_roundtrip_planner.n3" .  
  in:run see:sourceSHA256 "0adbefa76f008fdb320ee926631bf5e997a8c3b8b7159ec8c3c9111db3437c65" .  
  in:run see:description "N3-compiled version of the hand-written EV roadtrip planner. Candidate plans\nare represented as data; rules apply the same acceptance thresholds and select\nthe fastest acceptable route." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 64 .  
  in:run see:compiledRules 3 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 1 .  
  in:run see:compiledQueries 1 .  
}  
```  

