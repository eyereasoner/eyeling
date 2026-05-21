# odrl-risk  

## Source files  

- [N3 rules](../odrl-risk.n3)  

## Risk report  

**Agreement:** Example SaaS Agreement  
**Profile:** Alice (example consumer)  

### 1. Clause C2 — Provider can delete user data  

**Score:** `100`  
**Severity:** `https://example.org/agreement#High`  

This clause is risky because it allows the provider to remove (delete) the consumer’s data. Clause C2: We may delete your data at our discretion, with or without notice.  

### 2. Clause C3 — Data sharing without consent  

**Score:** `95`  
**Severity:** `https://example.org/agreement#High`  

This clause is risky because it permits data sharing without an explicit consent requirement. Clause C3: We may share your data with partners for any purpose.  

### 3. Clause C1 — Unilateral change without notice  

**Score:** `95`  
**Severity:** `https://example.org/agreement#High`  

This clause is risky because it allows unilateral changes without any prior notice. Clause C1: We may change these terms at any time. Continued use means acceptance.  

### 4. Clause C4 — Court access waiver / mandatory arbitration  

**Score:** `60`  
**Severity:** `https://example.org/agreement#Medium`  

This clause is risky because it restricts access to court (mandatory arbitration / waiver). Clause C4: You waive your right to go to court; disputes must be arbitrated.  

