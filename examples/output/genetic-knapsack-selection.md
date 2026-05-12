# genetic-knapsack-selection  

## Answer  
final genome : 101000000101  
selected items : item01, item03, item10, item12  
weight : 50 / 50  
value : 101  
fitness : 999899  
generations evaluated : 5  
exhaustive optimum value : 104 at genome 001000011111  

## Explanation  
Each genome bit says whether the corresponding item is selected for the knapsack. Feasible candidates get fitness 1000000 minus value, so higher value means lower fitness; overweight candidates are penalized above every feasible candidate. The N3 source records the deterministic local-search result and validates that the final genome respects capacity and has no strictly better one-bit neighbor. For transparency, an exhaustive enumeration also records the global best feasible value, showing this is a local mutation search rather than a global-optimality claim.  
