# dijkstra-risk-path  

## Source files  

- [N3 rules](../dijkstra-risk-path.n3)  
- [Input TriG](../input/dijkstra-risk-path.trig)  

## Answer  
selected path : ClinicA -> DepotB -> LabD -> HubZ  
raw cost : 10.00  
risk sum : 0.55  
risk-adjusted score : 11.10  
edges in selected path : 3  

## Explanation  
Each edge contributes its delivery cost plus the configured risk penalty. The N3 source enumerates the small graph's simple route candidates and compares the selected route against each alternative score. The selected route balances cost and risk through DepotB and LabD, while the apparently cheaper DepotC path is rejected once risk is priced in.  
