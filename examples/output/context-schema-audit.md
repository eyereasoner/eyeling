# Context schema audit  

## Source files  

- [N3 rules](../context-schema-audit.n3)  

## Entailment  
The audit inspects quoted message contexts and finds two schema violations in `msg_bad`: `gps/2` should have arity 3, and `tampered/1` is not an allowed context member.  

## Explanation  
Each context member is encoded as a quoted triple whose predicate is the member name and whose object is the argument list. The generic audit rule uses `log:includes` to bind the member name and argument list, then `list:length` to compute the arity. Allowed shapes are declared once as `:allowedArity` facts, so the same rule can validate zero-, unary-, binary-, ternary-, and four-argument members without writing a separate rule per predicate.  
