# School Placement Route Audit  

## Conclusion  
audit result : fail  
children affected by straight-line rule : Ada, Björn, Davi  
largest hidden detour : Ada, 3000 m  
recommended assignments : Ada -> Lindholmen; Björn -> Backa; Clara -> Haga; Davi -> Haga  
explanation requested : yes  

## Explanation  
The support-tool rule chooses the school with the smallest straight-line distance, using preference rank only as a tie-breaker. The independent audit recomputes each candidate with walking-route distance plus 600 m per preference step. Any provisional assignment that is not the audited best, or that requires more than 2500 m of walking, is flagged. Ada and Björn look close to Centrum on a map, but their walking routes cross barriers and exceed the walking limit; Davi is also better served by the first-preference Haga route. This illustrates why a decision-support label is not enough: route geometry, preferences, and audit records must be inspectable.  

**Generated derivation support**  

Compiled support: 26 source fact(s), 4 rule(s), fixpoint reached before rendering.  

Derivation steps:  
- Rule 1 (5 premise pattern(s) => 1 conclusion pattern(s)) derives :Ada :auditFlag :walkingLimitExceeded ., :Bjorn :auditFlag :walkingLimitExceeded ., :Davi :auditFlag :walkingLimitExceeded .  
  - Uses: :Ada :provisional :Centrum . _(source)_; :Ada :auditedBest :Lindholmen . _(source)_; :Ada :walkingMeters 3600 . _(source)_; :Policy :maxWalkingMeters 2500 . _(source)_; … +6 more premise fact(s)  
- Rule 2 (3 premise pattern(s) => 1 conclusion pattern(s)) derives :Ada :auditFlag :assignmentDiffersFromAuditedBest ., :Bjorn :auditFlag :assignmentDiffersFromAuditedBest ., :Davi :auditFlag :assignmentDiffersFromAuditedBest .  
  - Uses: :Ada :provisional :Centrum . _(source)_; :Ada :auditedBest :Lindholmen . _(source)_; :Bjorn :provisional :Centrum . _(source)_; :Bjorn :auditedBest :Backa . _(source)_; … +2 more premise fact(s)  
- Rule 3 (8 premise pattern(s) => 4 conclusion pattern(s)) derives :Audit :result "fail" ., :Audit :affectedChildren "Ada, Björn, Davi" ., :Audit :largestHiddenDetour "Ada, 3000 m" ., :Audit :recommendedAssignments "Ada -> Lindholmen; Björn -> Backa; Clara -> Haga; Davi -> Haga" .  
  - Uses: :Ada :auditFlag :walkingLimitExceeded . _(derived)_; :Bjorn :auditFlag :walkingLimitExceeded . _(derived)_; :Davi :auditFlag :walkingLimitExceeded . _(derived)_; :Ada :hiddenDetour 3000 . _(source)_; … +2 more premise fact(s)  
- Rule 4 (5 premise pattern(s) => 2 conclusion pattern(s)) derives :schoolPlacementAudit log:outputString "[authored report]" ., :schoolPlacementAudit :reports :Audit .  
  - Uses: :Audit :result "fail" . _(derived)_; :Audit :affectedChildren "Ada, Björn, Davi" . _(derived)_; :Audit :largestHiddenDetour "Ada, 3000 m" . _(derived)_; :Audit :recommendedAssignments "Ada -> Lindholmen; Björn -> Backa; Clara -> Haga; Davi -> Haga" . _(derived)_  

Selected explanation support:  
  - :schoolPlacementAudit :reports :Audit . _(derived by Rule 4)_  
    - :Audit :result "fail" . _(derived by Rule 3)_  
      - :Ada :auditFlag :walkingLimitExceeded . _(derived by Rule 1)_  
        - :Ada :provisional :Centrum . _(source)_  
        - :Ada :auditedBest :Lindholmen . _(source)_  
        - :Ada :walkingMeters 3600 . _(source)_  
        - :Policy :maxWalkingMeters 2500 . _(source)_  
      - :Bjorn :auditFlag :walkingLimitExceeded . _(derived by Rule 1)_  
        - :Bjorn :provisional :Centrum . _(source)_  
        - :Bjorn :auditedBest :Backa . _(source)_  
        - :Bjorn :walkingMeters 3100 . _(source)_  
        - :Policy :maxWalkingMeters 2500 . _(source)_  
      - :Davi :auditFlag :walkingLimitExceeded . _(derived by Rule 1)_  
        - :Davi :provisional :Centrum . _(source)_  
        - :Davi :auditedBest :Haga . _(source)_  
        - :Davi :walkingMeters 2800 . _(source)_  
        - :Policy :maxWalkingMeters 2500 . _(source)_  
      - :Ada :hiddenDetour 3000 . _(source)_  
      - ... 2 more premise fact(s)  
    - :Audit :affectedChildren "Ada, Björn, Davi" . _(derived by Rule 3)_  
      - :Ada :auditFlag :walkingLimitExceeded . _(derived by Rule 1)_  
        - :Ada :provisional :Centrum . _(source)_  
        - :Ada :auditedBest :Lindholmen . _(source)_  
        - :Ada :walkingMeters 3600 . _(source)_  
        - :Policy :maxWalkingMeters 2500 . _(source)_  
      - :Bjorn :auditFlag :walkingLimitExceeded . _(derived by Rule 1)_  
        - :Bjorn :provisional :Centrum . _(source)_  
        - :Bjorn :auditedBest :Backa . _(source)_  
        - :Bjorn :walkingMeters 3100 . _(source)_  
        - :Policy :maxWalkingMeters 2500 . _(source)_  
      - :Davi :auditFlag :walkingLimitExceeded . _(derived by Rule 1)_  
        - :Davi :provisional :Centrum . _(source)_  
        - :Davi :auditedBest :Haga . _(source)_  
        - :Davi :walkingMeters 2800 . _(source)_  
        - :Policy :maxWalkingMeters 2500 . _(source)_  
      - :Ada :hiddenDetour 3000 . _(source)_  
      - ... 2 more premise fact(s)  
    - :Audit :largestHiddenDetour "Ada, 3000 m" . _(derived by Rule 3)_  
      - :Ada :auditFlag :walkingLimitExceeded . _(derived by Rule 1)_  
        - :Ada :provisional :Centrum . _(source)_  
      - ... 2 more premise fact(s)  
  - … support tree truncated after 40 line(s)  

## Formal TriG Output  

```trig  
@prefix : <https://eyereasoner.github.io/see/examples/school-placement-audit#> .  
@prefix math: <http://www.w3.org/2000/10/swap/math#> .  
@prefix log: <http://www.w3.org/2000/10/swap/log#> .  
@prefix string: <http://www.w3.org/2000/10/swap/string#> .  
@prefix see: <https://example.org/see#> .  
@prefix in: <https://example.org/see/input#> .  
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .  

:schoolPlacementAudit :reports :Audit .  

in:metadata {  
  in:run a see:InputDataset .  
  in:run see:name "school_placement_audit" .  
  in:run see:title "School Placement Route Audit" .  
  in:run see:sourceFile "examples/n3/school_placement_audit.n3" .  
  in:run see:sourceSHA256 "8bea39b2ea4c3045fed64b6e7adef0ca8cdf8d14c3735e28e831a759dae600fd" .  
  in:run see:description "N3-compiled version of the school placement audit. The original student,\nschool, distance, and policy JSON is preserved as the data-input sidecar." .  
  in:run see:compiler "see.js N3-to-JS compiler" .  
  in:run see:inputFacts 26 .  
  in:run see:compiledRules 4 .  
  in:run see:compiledBackwardRules 0 .  
  in:run see:compiledFuses 0 .  
  in:run see:compiledQueries 1 .  
}  
```  

