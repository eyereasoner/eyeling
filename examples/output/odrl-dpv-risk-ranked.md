# odrl-dpv-risk-ranked  

## Source files  

- [N3 rules](../odrl-dpv-risk-ranked.n3)  

## Ranked DPV Risk Report  

**Agreement:** Example Agreement  
**Profile:** Example consumer profile  

### Clause C1 — score 100  

**Risk level:** `https://w3id.org/dpv/risk#HighRisk`  
**Severity:** `https://w3id.org/dpv/risk#HighSeverity`  

Risk: account/data removal is permitted without notice safeguards (no notice constraint and no duty to inform). Clause C1: Provider may remove the user account (and associated data) at its discretion.  

- **Mitigation for clause C1:** Add a notice constraint (minimum noticeDays) before account removal.  

- **Mitigation for clause C1:** Add a duty to inform the consumer prior to account removal.  

### Clause C3 — score 97  

**Risk level:** `https://w3id.org/dpv/risk#HighRisk`  
**Severity:** `https://w3id.org/dpv/risk#HighSeverity`  

Risk: user data sharing is permitted without an explicit consent constraint. Clause C3: Provider may share user data with partners for business purposes.  

- **Mitigation for clause C3:** Add an explicit consent constraint before data sharing.  

### Clause C2 — score 85  

**Risk level:** `https://w3id.org/dpv/risk#HighRisk`  
**Severity:** `https://w3id.org/dpv/risk#HighSeverity`  

Risk: terms may change with notice (3 days) below consumer requirement (14 days). Clause C2: Provider may change terms by informing users at least 3 days in advance.  

- **Mitigation for clause C2:** Increase minimum noticeDays in the inform duty to meet the consumer requirement.  

### Clause C4 — score 70  

**Risk level:** `https://w3id.org/dpv/risk#ModerateRisk`  
**Severity:** `https://w3id.org/dpv/risk#ModerateSeverity`  

Risk: portability is restricted because exporting user data is prohibited. Clause C4: Users are not permitted to export their data.  

- **Mitigation for clause C4:** Add a permission allowing data export (or remove the prohibition) to support portability.  

