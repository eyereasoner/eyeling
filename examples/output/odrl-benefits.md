# odrl-benefits  

## Source files  

- [N3 rules](../odrl-benefits.n3)  

## Why ODRL helps  

This example uses one small ODRL policy to make data-use decisions explicit, machine-checkable, and auditable.  

### Policy in plain language  

- The research lab **may use** the pseudonymised health dataset for **medical research**.  
- The research lab **must delete** the dataset by `2026-12-31`.  
- The research lab **must not use** the dataset for **marketing**.  

### Evaluated requests  

| Request | Decision | Explanation |  
| --- | --- | --- |  
| Use the dataset for medical research | `Allowed` | A matching ODRL permission grants this purpose-specific use. Duty: delete by `2026-12-31`. |  
| Use the dataset for marketing | `Blocked` | A matching ODRL prohibition blocks this purpose-specific use. |  

### Benefits illustrated  

1. **Clarity:** the policy says who may do what, to which asset, and for which purpose.  
2. **Automation:** requests can be allowed or blocked by rules instead of manual reading.  
3. **Purpose limitation:** research use and marketing use are treated differently.  
4. **Accountability:** duties such as deletion are part of the same policy and can be audited.  
