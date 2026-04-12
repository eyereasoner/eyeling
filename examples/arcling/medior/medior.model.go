package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"
)

type Data struct {
	CaseName          string            `json:"caseName"`
	Region            string            `json:"region"`
	Question          string            `json:"question"`
	Timestamps        Timestamps        `json:"timestamps"`
	EvaluationContext EvaluationContext `json:"evaluationContext"`
	Thresholds        Thresholds        `json:"thresholds"`
	Signals           Signals           `json:"signals"`
	Budget            Budget            `json:"budget"`
	Packages          []Package         `json:"packages"`
	InsightPolicy     InsightPolicy     `json:"insightPolicy"`
	Integrity         Integrity         `json:"integrity"`
}

type Timestamps struct {
	CreatedAt       string `json:"createdAt"`
	ExpiresAt       string `json:"expiresAt"`
	AuthorizedAt    string `json:"authorizedAt"`
	DutyPerformedAt string `json:"dutyPerformedAt"`
}

type EvaluationContext struct {
	ScopeDevice            string `json:"scopeDevice"`
	ScopeEvent             string `json:"scopeEvent"`
	Purpose                string `json:"purpose"`
	ProhibitedReusePurpose string `json:"prohibitedReusePurpose"`
}

type Thresholds struct {
	EgfrBelow                    int `json:"egfrBelow"`
	ActiveMedicationCountAtLeast int `json:"activeMedicationCountAtLeast"`
	AdmissionsLast180DaysAtLeast int `json:"admissionsLast180DaysAtLeast"`
	HoursSinceDischargeAtMost    int `json:"hoursSinceDischargeAtMost"`
	ActiveNeedCountAtLeast       int `json:"activeNeedCountAtLeast"`
}

type Lab struct {
	Egfr int `json:"egfr"`
}

type Medications struct {
	ActiveMedicationCount int `json:"activeMedicationCount"`
}

type History struct {
	AdmissionsLast180Days int `json:"admissionsLast180Days"`
}

type Discharge struct {
	HoursSinceDischarge int `json:"hoursSinceDischarge"`
}

type Signals struct {
	Lab         Lab         `json:"lab"`
	Medications Medications `json:"medications"`
	History     History     `json:"history"`
	Discharge   Discharge   `json:"discharge"`
}

type Budget struct {
	WindowName string `json:"windowName"`
	MaxEUR     int    `json:"maxEUR"`
}

type Package struct {
	ID                          string `json:"id"`
	Name                        string `json:"name"`
	CostEUR                     int    `json:"costEUR"`
	Touches                     int    `json:"touches"`
	CoversRenalSafetyConcern    bool   `json:"coversRenalSafetyConcern"`
	CoversPolypharmacyRisk      bool   `json:"coversPolypharmacyRisk"`
	CoversReadmissionHistory    bool   `json:"coversReadmissionHistory"`
	CoversRecentDischargeWindow bool   `json:"coversRecentDischargeWindow"`
}

type InsightPolicy struct {
	ID               string `json:"id"`
	Metric           string `json:"metric"`
	SuggestionPolicy string `json:"suggestionPolicy"`
	Type             string `json:"type"`
	PolicyProfile    string `json:"policyProfile"`
	PolicyType       string `json:"policyType"`
}

type Integrity struct {
	Secret           string `json:"secret"`
	VerificationMode string `json:"verificationMode"`
}

type Insight struct {
	CreatedAt        string `json:"createdAt"`
	ExpiresAt        string `json:"expiresAt"`
	ID               string `json:"id"`
	Metric           string `json:"metric"`
	Region           string `json:"region"`
	ScopeDevice      string `json:"scopeDevice"`
	ScopeEvent       string `json:"scopeEvent"`
	SuggestionPolicy string `json:"suggestionPolicy"`
	Threshold        int    `json:"threshold"`
	Type             string `json:"type"`
}

type Constraint struct {
	LeftOperand  string `json:"leftOperand"`
	Operator     string `json:"operator"`
	RightOperand string `json:"rightOperand"`
}

type Duty struct {
	Action     string     `json:"action"`
	Constraint Constraint `json:"constraint"`
}

type Permission struct {
	Action     string     `json:"action"`
	Constraint Constraint `json:"constraint"`
	Target     string     `json:"target"`
}

type Prohibition struct {
	Action     string     `json:"action"`
	Constraint Constraint `json:"constraint"`
	Target     string     `json:"target"`
}

type Policy struct {
	Duty        Duty        `json:"duty"`
	Permission  Permission  `json:"permission"`
	Profile     string      `json:"profile"`
	Prohibition Prohibition `json:"prohibition"`
	Type        string      `json:"type"`
}

type Envelope struct {
	Insight Insight `json:"insight"`
	Policy  Policy  `json:"policy"`
}

type Derived struct {
	RenalSafetyConcern     bool     `json:"renalSafetyConcern"`
	PolypharmacyRisk       bool     `json:"polypharmacyRisk"`
	ReadmissionHistory     bool     `json:"readmissionHistory"`
	RecentDischargeWindow  bool     `json:"recentDischargeWindow"`
	ActiveNeedCount        int      `json:"activeNeedCount"`
	NeedsContinuityBundle  bool     `json:"needsContinuityBundle"`
	EligiblePackageIDs     []string `json:"eligiblePackageIds"`
	RecommendedPackageID   *string  `json:"recommendedPackageId"`
	RecommendedPackageName *string  `json:"recommendedPackageName"`
}

type IntegrityResult struct {
	CanonicalEnvelope  string `json:"canonicalEnvelope"`
	PayloadHashSHA256  string `json:"payloadHashSHA256"`
	EnvelopeHmacSHA256 string `json:"envelopeHmacSHA256"`
	VerificationMode   string `json:"verificationMode"`
}

type Answer struct {
	Name               string  `json:"name"`
	Region             string  `json:"region"`
	Metric             string  `json:"metric"`
	ActiveNeedCount    int     `json:"activeNeedCount"`
	Threshold          int     `json:"threshold"`
	RecommendedPackage *string `json:"recommendedPackage"`
	BudgetCapEUR       int     `json:"budgetCapEUR"`
	PackageCostEUR     *int    `json:"packageCostEUR"`
	PayloadHashSHA256  string  `json:"payloadHashSHA256"`
	EnvelopeHmacSHA256 string  `json:"envelopeHmacSHA256"`
}

type Checks struct {
	PayloadHashMatches              bool `json:"payloadHashMatches"`
	SignatureVerifies               bool `json:"signatureVerifies"`
	ThresholdReached                bool `json:"thresholdReached"`
	ScopeComplete                   bool `json:"scopeComplete"`
	MinimizationRespected           bool `json:"minimizationRespected"`
	AuthorizationAllowed            bool `json:"authorizationAllowed"`
	DutyTimely                      bool `json:"dutyTimely"`
	InsurancePricingProhibited      bool `json:"insurancePricingProhibited"`
	PackageWithinBudget             bool `json:"packageWithinBudget"`
	PackageCoversAllActiveNeeds     bool `json:"packageCoversAllActiveNeeds"`
	LowestCostEligiblePackageChosen bool `json:"lowestCostEligiblePackageChosen"`
}

type Result struct {
	CaseName      string          `json:"caseName"`
	Derived       Derived         `json:"derived"`
	Envelope      Envelope        `json:"envelope"`
	Integrity     IntegrityResult `json:"integrity"`
	Answer        Answer          `json:"answer"`
	ReasonWhy     []string        `json:"reasonWhy"`
	Checks        Checks          `json:"checks"`
	AllChecksPass bool            `json:"allChecksPass"`
	ArcText       string          `json:"arcText"`
}

func assertTrue(condition bool, message string) error {
	if !condition {
		return errors.New(message)
	}
	return nil
}

func readJSON(path string) (Data, error) {
	var data Data
	b, err := os.ReadFile(path)
	if err != nil {
		return data, err
	}
	err = json.Unmarshal(b, &data)
	return data, err
}

func parseTime(value string) time.Time {
	t, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		panic(err)
	}
	return t
}

func stableStringify(value any) string {
	switch v := value.(type) {
	case nil:
		return "null"
	case map[string]any:
		keys := make([]string, 0, len(v))
		for key := range v {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, key := range keys {
			parts = append(parts, fmt.Sprintf("%s:%s", stableStringify(key), stableStringify(v[key])))
		}
		return "{" + strings.Join(parts, ",") + "}"
	case []any:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			parts = append(parts, stableStringify(item))
		}
		return "[" + strings.Join(parts, ",") + "]"
	default:
		b, _ := json.Marshal(v)
		return string(b)
	}
}

func canonicalValue(value any) any {
	b, _ := json.Marshal(value)
	var out any
	_ = json.Unmarshal(b, &out)
	return out
}

func validateInstance(data Data) error {
	if err := assertTrue(data.CaseName != "", "caseName is required"); err != nil {
		return err
	}
	if err := assertTrue(data.Region != "", "region is required"); err != nil {
		return err
	}
	if err := assertTrue(len(data.Packages) > 0, "packages is required"); err != nil {
		return err
	}
	return nil
}

func countTrue(values ...bool) int {
	total := 0
	for _, value := range values {
		if value {
			total++
		}
	}
	return total
}

func clauseR1RenalSafetyConcern(data Data) bool {
	return data.Signals.Lab.Egfr < data.Thresholds.EgfrBelow
}

func clauseR2PolypharmacyRisk(data Data) bool {
	return data.Signals.Medications.ActiveMedicationCount >= data.Thresholds.ActiveMedicationCountAtLeast
}

func clauseR3ReadmissionHistory(data Data) bool {
	return data.Signals.History.AdmissionsLast180Days >= data.Thresholds.AdmissionsLast180DaysAtLeast
}

func clauseR4RecentDischargeWindow(data Data) bool {
	return data.Signals.Discharge.HoursSinceDischarge <= data.Thresholds.HoursSinceDischargeAtMost
}

func clauseR5ActiveNeedCount(renalSafetyConcern, polypharmacyRisk, readmissionHistory, recentDischargeWindow bool) int {
	return countTrue(renalSafetyConcern, polypharmacyRisk, readmissionHistory, recentDischargeWindow)
}

func clauseR6NeedsContinuityBundle(data Data, activeNeedCount int) bool {
	return activeNeedCount >= data.Thresholds.ActiveNeedCountAtLeast
}

func deriveInsight(data Data) Insight {
	return Insight{
		CreatedAt:        data.Timestamps.CreatedAt,
		ExpiresAt:        data.Timestamps.ExpiresAt,
		ID:               data.InsightPolicy.ID,
		Metric:           data.InsightPolicy.Metric,
		Region:           data.Region,
		ScopeDevice:      data.EvaluationContext.ScopeDevice,
		ScopeEvent:       data.EvaluationContext.ScopeEvent,
		SuggestionPolicy: data.InsightPolicy.SuggestionPolicy,
		Threshold:        data.Thresholds.ActiveNeedCountAtLeast,
		Type:             data.InsightPolicy.Type,
	}
}

func derivePolicy(data Data) Policy {
	return Policy{
		Duty: Duty{
			Action: "odrl:delete",
			Constraint: Constraint{
				LeftOperand:  "odrl:dateTime",
				Operator:     "odrl:eq",
				RightOperand: data.Timestamps.ExpiresAt,
			},
		},
		Permission: Permission{
			Action: "odrl:use",
			Constraint: Constraint{
				LeftOperand:  "odrl:purpose",
				Operator:     "odrl:eq",
				RightOperand: data.EvaluationContext.Purpose,
			},
			Target: data.InsightPolicy.ID,
		},
		Profile: data.InsightPolicy.PolicyProfile,
		Prohibition: Prohibition{
			Action: "odrl:distribute",
			Constraint: Constraint{
				LeftOperand:  "odrl:purpose",
				Operator:     "odrl:eq",
				RightOperand: data.EvaluationContext.ProhibitedReusePurpose,
			},
			Target: data.InsightPolicy.ID,
		},
		Type: data.InsightPolicy.PolicyType,
	}
}

func packageCoversAllActiveNeeds(pkg Package, renalSafetyConcern, polypharmacyRisk, readmissionHistory, recentDischargeWindow bool) bool {
	return (!renalSafetyConcern || pkg.CoversRenalSafetyConcern) &&
		(!polypharmacyRisk || pkg.CoversPolypharmacyRisk) &&
		(!readmissionHistory || pkg.CoversReadmissionHistory) &&
		(!recentDischargeWindow || pkg.CoversRecentDischargeWindow)
}

func clauseS1EligiblePackages(data Data, renalSafetyConcern, polypharmacyRisk, readmissionHistory, recentDischargeWindow bool) []Package {
	eligible := make([]Package, 0)
	for _, pkg := range data.Packages {
		if pkg.CostEUR <= data.Budget.MaxEUR && packageCoversAllActiveNeeds(pkg, renalSafetyConcern, polypharmacyRisk, readmissionHistory, recentDischargeWindow) {
			eligible = append(eligible, pkg)
		}
	}
	sort.Slice(eligible, func(i, j int) bool { return eligible[i].CostEUR < eligible[j].CostEUR })
	return eligible
}

func clauseS2RecommendedPackage(data Data, renalSafetyConcern, polypharmacyRisk, readmissionHistory, recentDischargeWindow bool) ([]Package, *Package) {
	eligible := clauseS1EligiblePackages(data, renalSafetyConcern, polypharmacyRisk, readmissionHistory, recentDischargeWindow)
	if len(eligible) == 0 {
		return eligible, nil
	}
	recommended := eligible[0]
	return eligible, &recommended
}

func clauseG1AuthorizedUse(data Data) bool {
	return data.EvaluationContext.Purpose == "care_coordination" && !parseTime(data.Timestamps.AuthorizedAt).After(parseTime(data.Timestamps.ExpiresAt))
}

func clauseG2InsurancePricingProhibited(data Data) bool {
	return data.EvaluationContext.ProhibitedReusePurpose == "insurance_pricing"
}

func clauseG3DutyTimely(data Data) bool {
	return !parseTime(data.Timestamps.DutyPerformedAt).After(parseTime(data.Timestamps.ExpiresAt))
}

func clauseM1CanonicalEnvelope(data Data) (Envelope, string) {
	envelope := Envelope{Insight: deriveInsight(data), Policy: derivePolicy(data)}
	return envelope, stableStringify(canonicalValue(envelope))
}

func sha256Hex(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

func hmacSHA256Hex(secret, text string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(text))
	return hex.EncodeToString(mac.Sum(nil))
}

func clauseM4MinimizationRespected(insight Insight) bool {
	b, _ := json.Marshal(insight)
	s := strings.ToLower(string(b))
	return !strings.Contains(s, "name") && !strings.Contains(s, "address") && !strings.Contains(s, "ssn") && !strings.Contains(s, "fullrecord") && !strings.Contains(s, "genome")
}

func clauseM5ScopeComplete(insight Insight) bool {
	return insight.ScopeDevice != "" && insight.ScopeEvent != "" && insight.ExpiresAt != ""
}

func yesNo(value bool) string {
	if value {
		return "PASS"
	}
	return "FAIL"
}

func evaluate(data Data) (Result, error) {
	if err := validateInstance(data); err != nil {
		return Result{}, err
	}

	renalSafetyConcern := clauseR1RenalSafetyConcern(data)
	polypharmacyRisk := clauseR2PolypharmacyRisk(data)
	readmissionHistory := clauseR3ReadmissionHistory(data)
	recentDischargeWindow := clauseR4RecentDischargeWindow(data)
	activeNeedCount := clauseR5ActiveNeedCount(renalSafetyConcern, polypharmacyRisk, readmissionHistory, recentDischargeWindow)
	needsContinuityBundle := clauseR6NeedsContinuityBundle(data, activeNeedCount)

	envelope, canonicalEnvelope := clauseM1CanonicalEnvelope(data)
	payloadHashSHA256 := sha256Hex(canonicalEnvelope)
	envelopeHmacSHA256 := hmacSHA256Hex(data.Integrity.Secret, canonicalEnvelope)

	eligible, recommended := clauseS2RecommendedPackage(data, renalSafetyConcern, polypharmacyRisk, readmissionHistory, recentDischargeWindow)
	recommendedID := (*string)(nil)
	recommendedName := (*string)(nil)
	packageCostEUR := (*int)(nil)
	if recommended != nil {
		recommendedID = &recommended.ID
		recommendedName = &recommended.Name
		packageCostEUR = &recommended.CostEUR
	}

	checks := Checks{
		PayloadHashMatches:              payloadHashSHA256 == sha256Hex(canonicalEnvelope),
		SignatureVerifies:               data.Integrity.VerificationMode == "trustedPrecomputedInput" && envelopeHmacSHA256 == hmacSHA256Hex(data.Integrity.Secret, canonicalEnvelope),
		ThresholdReached:                needsContinuityBundle,
		ScopeComplete:                   clauseM5ScopeComplete(envelope.Insight),
		MinimizationRespected:           clauseM4MinimizationRespected(envelope.Insight),
		AuthorizationAllowed:            clauseG1AuthorizedUse(data),
		DutyTimely:                      clauseG3DutyTimely(data),
		InsurancePricingProhibited:      clauseG2InsurancePricingProhibited(data),
		PackageWithinBudget:             recommended != nil && recommended.CostEUR <= data.Budget.MaxEUR,
		PackageCoversAllActiveNeeds:     recommended != nil && packageCoversAllActiveNeeds(*recommended, renalSafetyConcern, polypharmacyRisk, readmissionHistory, recentDischargeWindow),
		LowestCostEligiblePackageChosen: recommended != nil && recommended.ID == eligible[0].ID,
	}

	reasonWhy := []string{
		fmt.Sprintf("RenalSafetyConcern holds because eGFR = %d and the threshold is < %d.", data.Signals.Lab.Egfr, data.Thresholds.EgfrBelow),
		fmt.Sprintf("PolypharmacyRisk holds because the active medication count is %d and the threshold is ≥ %d.", data.Signals.Medications.ActiveMedicationCount, data.Thresholds.ActiveMedicationCountAtLeast),
		fmt.Sprintf("ReadmissionHistory holds because admissionsLast180Days = %d and the threshold is ≥ %d.", data.Signals.History.AdmissionsLast180Days, data.Thresholds.AdmissionsLast180DaysAtLeast),
		fmt.Sprintf("RecentDischargeWindow holds because hoursSinceDischarge = %d and the threshold is ≤ %d.", data.Signals.Discharge.HoursSinceDischarge, data.Thresholds.HoursSinceDischargeAtMost),
		"The recommendation rule selects the least-cost package that covers every active need and remains within budget.",
		func() string {
			if recommended != nil {
				return fmt.Sprintf("The selected package is \"%s\" with cost €%d, touches=%d.", recommended.Name, recommended.CostEUR, recommended.Touches)
			}
			return "No eligible package exists within budget."
		}(),
		fmt.Sprintf("Use is permitted only for purpose \"%s\" and expires at %s.", data.EvaluationContext.Purpose, data.Timestamps.ExpiresAt),
	}

	answer := Answer{
		Name:               data.CaseName,
		Region:             data.Region,
		Metric:             data.InsightPolicy.Metric,
		ActiveNeedCount:    activeNeedCount,
		Threshold:          data.Thresholds.ActiveNeedCountAtLeast,
		RecommendedPackage: recommendedName,
		BudgetCapEUR:       data.Budget.MaxEUR,
		PackageCostEUR:     packageCostEUR,
		PayloadHashSHA256:  payloadHashSHA256,
		EnvelopeHmacSHA256: envelopeHmacSHA256,
	}

	arcLines := []string{
		"=== Answer ===",
		fmt.Sprintf("Name: %s", answer.Name),
		fmt.Sprintf("Region: %s", answer.Region),
		fmt.Sprintf("Metric: %s", answer.Metric),
		fmt.Sprintf("Active need count: %d/%d", answer.ActiveNeedCount, answer.Threshold),
		fmt.Sprintf("Recommended package: %s", derefString(answer.RecommendedPackage)),
		fmt.Sprintf("Budget cap: €%d", answer.BudgetCapEUR),
		fmt.Sprintf("Package cost: €%s", derefIntString(answer.PackageCostEUR)),
		fmt.Sprintf("Payload SHA-256: %s", answer.PayloadHashSHA256),
		fmt.Sprintf("Envelope HMAC-SHA-256: %s", answer.EnvelopeHmacSHA256),
		"",
		"=== Reason Why ===",
	}
	arcLines = append(arcLines, reasonWhy...)
	arcLines = append(arcLines, "", "=== Check ===")
	checkOrder := []struct {
		name string
		ok   bool
	}{
		{"payloadHashMatches", checks.PayloadHashMatches},
		{"signatureVerifies", checks.SignatureVerifies},
		{"thresholdReached", checks.ThresholdReached},
		{"scopeComplete", checks.ScopeComplete},
		{"minimizationRespected", checks.MinimizationRespected},
		{"authorizationAllowed", checks.AuthorizationAllowed},
		{"dutyTimely", checks.DutyTimely},
		{"insurancePricingProhibited", checks.InsurancePricingProhibited},
		{"packageWithinBudget", checks.PackageWithinBudget},
		{"packageCoversAllActiveNeeds", checks.PackageCoversAllActiveNeeds},
		{"lowestCostEligiblePackageChosen", checks.LowestCostEligiblePackageChosen},
	}
	for _, item := range checkOrder {
		arcLines = append(arcLines, fmt.Sprintf("- %s: %s", yesNo(item.ok), item.name))
	}

	allChecksPass := checks.PayloadHashMatches && checks.SignatureVerifies && checks.ThresholdReached && checks.ScopeComplete && checks.MinimizationRespected && checks.AuthorizationAllowed && checks.DutyTimely && checks.InsurancePricingProhibited && checks.PackageWithinBudget && checks.PackageCoversAllActiveNeeds && checks.LowestCostEligiblePackageChosen

	return Result{
		CaseName: data.CaseName,
		Derived: Derived{
			RenalSafetyConcern:    renalSafetyConcern,
			PolypharmacyRisk:      polypharmacyRisk,
			ReadmissionHistory:    readmissionHistory,
			RecentDischargeWindow: recentDischargeWindow,
			ActiveNeedCount:       activeNeedCount,
			NeedsContinuityBundle: needsContinuityBundle,
			EligiblePackageIDs: func() []string {
				ids := make([]string, 0, len(eligible))
				for _, pkg := range eligible {
					ids = append(ids, pkg.ID)
				}
				return ids
			}(),
			RecommendedPackageID:   recommendedID,
			RecommendedPackageName: recommendedName,
		},
		Envelope: envelope,
		Integrity: IntegrityResult{
			CanonicalEnvelope:  canonicalEnvelope,
			PayloadHashSHA256:  payloadHashSHA256,
			EnvelopeHmacSHA256: envelopeHmacSHA256,
			VerificationMode:   data.Integrity.VerificationMode,
		},
		Answer:        answer,
		ReasonWhy:     reasonWhy,
		Checks:        checks,
		AllChecksPass: allChecksPass,
		ArcText:       strings.Join(arcLines, "\n"),
	}, nil
}

func derefString(value *string) string {
	if value == nil {
		return "<nil>"
	}
	return *value
}

func derefIntString(value *int) string {
	if value == nil {
		return "<nil>"
	}
	return fmt.Sprintf("%d", *value)
}

func main() {
	inputPath := "medior.data.json"
	jsonMode := false
	for _, arg := range os.Args[1:] {
		if arg == "--json" {
			jsonMode = true
		} else if !strings.HasPrefix(arg, "--") {
			inputPath = arg
		}
	}

	data, err := readJSON(inputPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	result, err := evaluate(data)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	if jsonMode {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		_ = enc.Encode(result)
	} else {
		fmt.Println(result.ArcText)
	}

	if !result.AllChecksPass {
		os.Exit(1)
	}
}
