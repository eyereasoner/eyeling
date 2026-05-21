# odrl-dpv-ehds-risk-ranked  

## Source files  

- [N3 rules](../odrl-dpv-ehds-risk-ranked.n3)  

## Ranked DPV Risk Report (EHDS-aligned)  

**Agreement:** EHDS Secondary Use Agreement (example)  
**Profile:** Example patient profile (EHDS rights expectations)  

### Clause H1 — score 100  

**Risk level:** `https://w3id.org/dpv/risk#HighRisk`  
**Severity:** `https://w3id.org/dpv/risk#HighSeverity`  

Risk: secondary use is permitted without an EHDS Data Permit safeguard. Clause H1: Hospital may provide electronic health data for secondary use based on a bilateral data use agreement with the applicant.  

- **Mitigation for clause H1:** Require an EHDS Data Permit (eu-ehds:DataPermit) issued by a Health Data Access Body prior to secondary use.  

### Clause H2 — score 100  

**Risk level:** `https://w3id.org/dpv/risk#HighRisk`  
**Severity:** `https://w3id.org/dpv/risk#HighSeverity`  

Risk: secondary use may include patients who opted out (EHDS A71). Clause H2: Secondary use may include all patient records for training and evaluating health-related algorithms.  

- **Mitigation for clause H2:** Add an explicit safeguard to exclude records of persons who exercised the EHDS opt-out from secondary use (A71).  

### Clause H3 — score 88  

**Risk level:** `https://w3id.org/dpv/risk#HighRisk`  
**Severity:** `https://w3id.org/dpv/risk#HighSeverity`  

Risk: the agreement permits local downloads rather than processing within a secure processing environment. Clause H3: The applicant may download a complete local copy of the dataset to its own infrastructure for analysis.  

- **Mitigation for clause H3:** Require processing only within a secure processing environment (e.g., eu-dga:SecureProcessingEnvironment), and prohibit local downloads of raw datasets.  

### Clause H4 — score 80  

**Risk level:** `https://w3id.org/dpv/risk#HighRisk`  
**Severity:** `https://w3id.org/dpv/risk#HighSeverity`  

Risk: secondary-use dataset is only described as pseudonymised, without a safeguard requiring statistically anonymised data for secondary use. Clause H4: The dataset will be provided in pseudonymised form by removing direct identifiers.  

- **Mitigation for clause H4:** Require an EHDS Health Data Request for statistically anonymised data (eu-ehds:HealthDataRequest), and add a constraint that secondary-use data must be statistically anonymised.  

