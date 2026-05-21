# odrl-risk-mitigation  

## Source files  

- [N3 rules](../odrl-risk-mitigation.n3)  

## Risk report  

**Agreement:** Example Platform Agreement (with fixes)  
**Profile:** Carol (example consumer)  

### 1. Clause D6 — Provider can delete user data  

**Score:** `100`  
**Severity:** `https://example.org/odrl-mitigation-demo#High`  

This clause is risky because it allows the provider to delete the consumer’s data. Clause D6: We may delete your data at our discretion.  

### 2. Clause D5 — No data export / portability  

**Score:** `93`  
**Severity:** `https://example.org/odrl-mitigation-demo#High`  

This clause is risky because it prohibits exporting data, undermining portability. Clause D5: You may not export or download your data from the service.  

### 3. Clause D4 — Tracking without opt-in  

**Score:** `89`  
**Severity:** `https://example.org/odrl-mitigation-demo#High`  

This clause is risky because it permits tracking without explicit opt-in consent. Clause D4: We may track your activity to improve services.  

### 4. Clause D2 — Auto-renewal without reminder  

**Score:** `85`  
**Severity:** `https://example.org/odrl-mitigation-demo#High`  

This clause is risky because it allows auto-renewal without a reminder. Consumer needs at least 7 days reminder. Clause D2: Your subscription renews automatically unless you cancel.  

### 5. Clause D1 — Notice period too short  

**Score:** `85`  
**Severity:** `https://example.org/odrl-mitigation-demo#High`  

This clause is risky because the notice period (3 days) is below the consumer requirement (14 days). Clause D1: We may change these terms with notice. Notice may be as short as 3 days.  

### 6. Clause D3 — Non-refundable fees  

**Score:** `79`  
**Severity:** `https://example.org/odrl-mitigation-demo#Medium`  

This clause is risky because it declares fees non-refundable, conflicting with a refund/cooling-off expectation (>= 14 days). Clause D3: All fees are non-refundable.  

### 7. Clause D2 — Liability cap too low  

**Score:** `73`  
**Severity:** `https://example.org/odrl-mitigation-demo#Medium`  

This clause is risky because the liability cap (20 EUR) is below the consumer minimum (200 EUR). Clause D2: Your subscription renews automatically unless you cancel.  


## Suggested mitigations (highest risk first)  

- **1. Clause D6 — Provider can delete user data** (score `100`): Suggested fix: remove provider discretion to delete data; allow deletion only on consumer request or legal obligation.  
- **2. Clause D5 — No data export / portability** (score `93`): Suggested fix: add a permission to export/download user data (data portability).  
- **3. Clause D4 — Tracking without opt-in** (score `89`): Suggested fix: require opt-in consent for tracking (optInConsent=true).  
- **4. Clause D2 — Auto-renewal without reminder** (score `85`): Suggested fix: add a reminder duty for auto-renewal with reminderDays >= 7.  
- **5. Clause D1 — Notice period too short** (score `85`): Suggested fix: ensure prior-notice duty specifies noticeDays >= 14.  
- **6. Clause D3 — Non-refundable fees** (score `79`): Suggested fix: allow refunds (e.g., refundAllowed=true) or define a cooling-off period >= 14 days.  
- **7. Clause D2 — Liability cap too low** (score `73`): Suggested fix: raise liabilityCapEuro so it is >= 200 EUR (or remove the cap where inappropriate).  
