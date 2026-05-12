# school-placement-audit  

## Answer  
audit result : fail  
children affected by straight-line rule : Ada, Björn, Davi  
largest hidden detour : Ada, 3000 m  
recommended assignments : Ada -> Lindholmen; Björn -> Backa; Clara -> Haga; Davi -> Haga  
explanation requested : yes  

## Explanation  
The support-tool rule chooses the school with the smallest straight-line distance, using preference rank only as a tie-breaker. The independent audit recomputes each candidate with walking-route distance plus 600 m per preference step. Any provisional assignment that is not the audited best, or that requires more than 2500 m of walking, is flagged. Ada and Björn look close to Centrum on a map, but their walking routes cross barriers and exceed the walking limit; Davi is also better served by the first-preference Haga route. This illustrates why a decision-support label is not enough: route geometry, preferences, and audit records must be inspectable.  
