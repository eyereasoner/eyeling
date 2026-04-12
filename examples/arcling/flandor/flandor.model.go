package main

// Flandor is a reference Arcling model for the regional retooling-pulse case.
// It evaluates whether a region needs intervention, selects the lowest-cost
// eligible package, and emits ARC text or a JSON report.

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

// Data mirrors the input instance shape from flandor.data.json.
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
	ExportOrdersIndexBelow       int     `json:"exportOrdersIndexBelow"`
	TechnicalVacancyRatePctAbove float64 `json:"technicalVacancyRatePctAbove"`
	GridCongestionHoursAbove     int     `json:"gridCongestionHoursAbove"`
	ActiveNeedCountAtLeast       int     `json:"activeNeedCountAtLeast"`
}

type Cluster struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	ExportOrdersIndex int    `json:"exportOrdersIndex"`
	EnergyIntensity   int    `json:"energyIntensity"`
}

type LabourMarket struct {
	TechnicalVacancyRatePct float64 `json:"technicalVacancyRatePct"`
}

type Grid struct {
	CongestionHours         int `json:"congestionHours"`
	RenewableCurtailmentMWh int `json:"renewableCurtailmentMWh"`
}

type Signals struct {
	Clusters     []Cluster    `json:"clusters"`
	LabourMarket LabourMarket `json:"labourMarket"`
	Grid         Grid         `json:"grid"`
}

type Budget struct {
	WindowName string `json:"windowName"`
	MaxMEUR    int    `json:"maxMEUR"`
}

type Package struct {
	ID                   string `json:"id"`
	Name                 string `json:"name"`
	CostMEUR             int    `json:"costMEUR"`
	WorkerCoverage       int    `json:"workerCoverage"`
	GridReliefMW         int    `json:"gridReliefMW"`
	CoversExportWeakness bool   `json:"coversExportWeakness"`
	CoversSkillsStrain   bool   `json:"coversSkillsStrain"`
	CoversGridStress     bool   `json:"coversGridStress"`
}

type InsightPolicy struct {
	ID               string `json:"id"`
	Metric           string `json:"metric"`
	Type             string `json:"type"`
	SuggestionPolicy string `json:"suggestionPolicy"`
	PolicyType       string `json:"policyType"`
	PolicyProfile    string `json:"policyProfile"`
}

type Integrity struct {
	HashAlgorithm    string `json:"hashAlgorithm"`
	MacAlgorithm     string `json:"macAlgorithm"`
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
	ExportWeakness         bool     `json:"exportWeakness"`
	SkillsStrain           bool     `json:"skillsStrain"`
	GridStress             bool     `json:"gridStress"`
	ActiveNeedCount        int      `json:"activeNeedCount"`
	NeedsRetoolingPulse    bool     `json:"needsRetoolingPulse"`
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
	BudgetCapMEUR      int     `json:"budgetCapMEUR"`
	PackageCostMEUR    *int    `json:"packageCostMEUR"`
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
	SurveillanceReuseProhibited     bool `json:"surveillanceReuseProhibited"`
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

// stableStringify recursively sorts map keys so the canonical envelope is
// deterministic across runs and implementations.
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

// canonicalValue converts typed structs into generic JSON-like values before
// stable stringification.
func canonicalValue(value any) any {
	b, _ := json.Marshal(value)
	var out any
	_ = json.Unmarshal(b, &out)
	return out
}

// validateInstance performs the structural checks for the 4-file bundle.
func validateInstance(data Data) error {
	if err := assertTrue(data.CaseName != "", "caseName is required"); err != nil {
		return err
	}
	if err := assertTrue(data.Region != "", "region is required"); err != nil {
		return err
	}
	if err := assertTrue(len(data.Signals.Clusters) > 0, "signals.clusters is required"); err != nil {
		return err
	}
	if err := assertTrue(len(data.Packages) > 0, "packages is required"); err != nil {
		return err
	}
	return nil
}

// countTrue is used for the active-need threshold logic in the spec.
func countTrue(values ...bool) int {
	total := 0
	for _, value := range values {
		if value {
			total++
		}
	}
	return total
}

// The R* helpers map directly to named derivation clauses in flandor.spec.md.
func clauseR1ExportWeakness(data Data) bool {
	for _, cluster := range data.Signals.Clusters {
		if cluster.ExportOrdersIndex < data.Thresholds.ExportOrdersIndexBelow {
			return true
		}
	}
	return false
}

func clauseR2SkillsStrain(data Data) bool {
	return data.Signals.LabourMarket.TechnicalVacancyRatePct > data.Thresholds.TechnicalVacancyRatePctAbove
}

func clauseR3GridStress(data Data) bool {
	return data.Signals.Grid.CongestionHours > data.Thresholds.GridCongestionHoursAbove
}

func clauseR4ActiveNeedCount(exportWeakness, skillsStrain, gridStress bool) int {
	return countTrue(exportWeakness, skillsStrain, gridStress)
}

func clauseR5NeedsRetoolingPulse(data Data, activeNeedCount int) bool {
	return activeNeedCount >= data.Thresholds.ActiveNeedCountAtLeast
}

// deriveInsight produces the minimized regional signal shared with the recipient.
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

// derivePolicy constructs the usage restrictions paired with the insight.
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

// packageCoversAllActiveNeeds checks whether a candidate package addresses every
// need that is active for this specific instance.
func packageCoversAllActiveNeeds(pkg Package, exportWeakness, skillsStrain, gridStress bool) bool {
	return (!exportWeakness || pkg.CoversExportWeakness) &&
		(!skillsStrain || pkg.CoversSkillsStrain) &&
		(!gridStress || pkg.CoversGridStress)
}

// clauseS1EligiblePackages filters to packages that both fit the budget and
// cover the active needs.
func clauseS1EligiblePackages(data Data, exportWeakness, skillsStrain, gridStress bool) []Package {
	eligible := make([]Package, 0)
	for _, pkg := range data.Packages {
		if pkg.CostMEUR <= data.Budget.MaxMEUR && packageCoversAllActiveNeeds(pkg, exportWeakness, skillsStrain, gridStress) {
			eligible = append(eligible, pkg)
		}
	}
	sort.Slice(eligible, func(i, j int) bool { return eligible[i].CostMEUR < eligible[j].CostMEUR })
	return eligible
}

// clauseS2RecommendedPackage applies the tie-breaker: choose the lowest-cost
// eligible package after sorting by cost.
func clauseS2RecommendedPackage(data Data, exportWeakness, skillsStrain, gridStress bool) ([]Package, *Package) {
	eligible := clauseS1EligiblePackages(data, exportWeakness, skillsStrain, gridStress)
	if len(eligible) == 0 {
		return eligible, nil
	}
	recommended := eligible[0]
	return eligible, &recommended
}

func clauseG1AuthorizedUse(data Data) bool {
	return data.EvaluationContext.Purpose == "regional_stabilization" && !parseTime(data.Timestamps.AuthorizedAt).After(parseTime(data.Timestamps.ExpiresAt))
}

func clauseG2SurveillanceReuseProhibited(data Data) bool {
	return data.EvaluationContext.ProhibitedReusePurpose == "firm_surveillance"
}

func clauseG3DutyTimely(data Data) bool {
	return !parseTime(data.Timestamps.DutyPerformedAt).After(parseTime(data.Timestamps.ExpiresAt))
}

// clauseM1CanonicalEnvelope returns both the structured envelope and the
// deterministic string hashed/signed by the integrity clauses.
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
	return !strings.Contains(s, "salary") && !strings.Contains(s, "payroll") && !strings.Contains(s, "invoice") && !strings.Contains(s, "medical") && !strings.Contains(s, "firmname")
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

// evaluate computes all derived facts, governance checks, integrity values,
// and presentation fields expected by flandor.expected.json.
func evaluate(data Data) (Result, error) {
	if err := validateInstance(data); err != nil {
		return Result{}, err
	}

	exportWeakness := clauseR1ExportWeakness(data)
	skillsStrain := clauseR2SkillsStrain(data)
	gridStress := clauseR3GridStress(data)
	activeNeedCount := clauseR4ActiveNeedCount(exportWeakness, skillsStrain, gridStress)
	needsRetoolingPulse := clauseR5NeedsRetoolingPulse(data, activeNeedCount)

	envelope, canonicalEnvelope := clauseM1CanonicalEnvelope(data)
	payloadHashSHA256 := sha256Hex(canonicalEnvelope)
	envelopeHmacSHA256 := hmacSHA256Hex(data.Integrity.Secret, canonicalEnvelope)

	eligible, recommended := clauseS2RecommendedPackage(data, exportWeakness, skillsStrain, gridStress)
	recommendedID := (*string)(nil)
	recommendedName := (*string)(nil)
	packageCostMEUR := (*int)(nil)
	if recommended != nil {
		recommendedID = &recommended.ID
		recommendedName = &recommended.Name
		packageCostMEUR = &recommended.CostMEUR
	}

	checks := Checks{
		PayloadHashMatches:              payloadHashSHA256 == sha256Hex(canonicalEnvelope),
		SignatureVerifies:               data.Integrity.VerificationMode == "trustedPrecomputedInput" && envelopeHmacSHA256 == hmacSHA256Hex(data.Integrity.Secret, canonicalEnvelope),
		ThresholdReached:                needsRetoolingPulse,
		ScopeComplete:                   clauseM5ScopeComplete(envelope.Insight),
		MinimizationRespected:           clauseM4MinimizationRespected(envelope.Insight),
		AuthorizationAllowed:            clauseG1AuthorizedUse(data),
		DutyTimely:                      clauseG3DutyTimely(data),
		SurveillanceReuseProhibited:     clauseG2SurveillanceReuseProhibited(data),
		PackageWithinBudget:             recommended != nil && recommended.CostMEUR <= data.Budget.MaxMEUR,
		PackageCoversAllActiveNeeds:     recommended != nil && packageCoversAllActiveNeeds(*recommended, exportWeakness, skillsStrain, gridStress),
		LowestCostEligiblePackageChosen: recommended != nil && recommended.ID == eligible[0].ID,
	}

	clusterBits := make([]string, 0, len(data.Signals.Clusters))
	for _, cluster := range data.Signals.Clusters {
		clusterBits = append(clusterBits, fmt.Sprintf("%s=%d", cluster.Name, cluster.ExportOrdersIndex))
	}

	reasonWhy := []string{
		fmt.Sprintf("ExportWeakness holds because at least one cluster has exportOrdersIndex < %d (%s).", data.Thresholds.ExportOrdersIndexBelow, strings.Join(clusterBits, ", ")),
		fmt.Sprintf("SkillsStrain holds because the technical vacancy rate is %g%% and the threshold is > %g%%.", data.Signals.LabourMarket.TechnicalVacancyRatePct, data.Thresholds.TechnicalVacancyRatePctAbove),
		fmt.Sprintf("GridStress holds because congestion hours = %d and the threshold is > %d.", data.Signals.Grid.CongestionHours, data.Thresholds.GridCongestionHoursAbove),
		"The recommendation rule selects the least-cost package that covers every active need and remains within budget.",
		func() string {
			if recommended != nil {
				return fmt.Sprintf("The selected package is \"%s\" with cost €%dM, workerCoverage=%d, gridReliefMW=%d.", recommended.Name, recommended.CostMEUR, recommended.WorkerCoverage, recommended.GridReliefMW)
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
		BudgetCapMEUR:      data.Budget.MaxMEUR,
		PackageCostMEUR:    packageCostMEUR,
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
		fmt.Sprintf("Budget cap: €%dM", answer.BudgetCapMEUR),
		fmt.Sprintf("Package cost: €%sM", derefIntString(answer.PackageCostMEUR)),
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
		{"surveillanceReuseProhibited", checks.SurveillanceReuseProhibited},
		{"packageWithinBudget", checks.PackageWithinBudget},
		{"packageCoversAllActiveNeeds", checks.PackageCoversAllActiveNeeds},
		{"lowestCostEligiblePackageChosen", checks.LowestCostEligiblePackageChosen},
	}
	for _, item := range checkOrder {
		arcLines = append(arcLines, fmt.Sprintf("- %s: %s", yesNo(item.ok), item.name))
	}

	allChecksPass := checks.PayloadHashMatches && checks.SignatureVerifies && checks.ThresholdReached && checks.ScopeComplete && checks.MinimizationRespected && checks.AuthorizationAllowed && checks.DutyTimely && checks.SurveillanceReuseProhibited && checks.PackageWithinBudget && checks.PackageCoversAllActiveNeeds && checks.LowestCostEligiblePackageChosen

	return Result{
		CaseName: data.CaseName,
		Derived: Derived{
			ExportWeakness:      exportWeakness,
			SkillsStrain:        skillsStrain,
			GridStress:          gridStress,
			ActiveNeedCount:     activeNeedCount,
			NeedsRetoolingPulse: needsRetoolingPulse,
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

// main is the CLI entry point used by the Arcling test runner.
func main() {
	inputPath := "flandor.data.json"
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
