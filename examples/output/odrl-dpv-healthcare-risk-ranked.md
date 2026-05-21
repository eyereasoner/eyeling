# odrl-dpv-healthcare-risk-ranked  

## Source files  

- [N3 rules](../odrl-dpv-healthcare-risk-ranked.n3)  

## Ranked DPV Risk Report (Healthcare & Life Sciences)  

**Agreement:** Example Healthcare & Life-Sciences Data Use Agreement  
**Profile:** Example patient profile  

### Clause H1 — score 100  

**Risk level:** `https://w3id.org/dpv/risk#HighRisk`  
**Severity:** `https://w3id.org/dpv/risk#HighSeverity`  

Risk: health/genomic data may be used for research without explicit opt-in consent. Clause H1: Hospital may use EHR and genomic data for internal clinical research and publication.  

- **Mitigation for clause H1:** Add an explicit consent constraint for secondary research use.  

### Clause H2 — score 100  

**Risk level:** `https://w3id.org/dpv/risk#HighRisk`  
**Severity:** `https://w3id.org/dpv/risk#HighSeverity`  

Risk: genomic data may be shared with external pharma partners without a de-identification/pseudonymisation requirement. Clause H2: Hospital may share genomic data with pharmaceutical partners for drug discovery and R&D.  

- **Mitigation for clause H2:** Require de-identification/pseudonymisation before external sharing of genomic data.  

### Clause H4 — score 70  

**Risk level:** `https://w3id.org/dpv/risk#ModerateRisk`  
**Severity:** `https://w3id.org/dpv/risk#ModerateSeverity`  

Risk: retention (3650 days) exceeds patient preference (1095 days). Clause H4: Hospital retains patient health records for 10 years.  

- **Mitigation for clause H4:** Limit retention to 3 years (or document the legal obligation requiring longer retention).  

