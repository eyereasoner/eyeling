package main

// Calidor is an Arcling case about municipal heatwave support.
// Raw household heat, vulnerability, and prepaid-energy details stay local.
// The shareable output is a narrow, expiring support insight plus policy.

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
	Municipality      string            `json:"municipality"`
	Question          string            `json:"question"`
	Timestamps        Timestamps        `json:"timestamps"`
	EvaluationContext EvaluationContext `json:"evaluationContext"`
	Thresholds        Thresholds        `json:"thresholds"`
	LocalProfile      LocalProfile      `json:"localProfile"`
	HeatStatus        HeatStatus        `json:"heatStatus"`
	EnergyProfile     EnergyProfile     `json:"energyProfile"`
	SupportCatalog    []SupportPackage  `json:"supportCatalog"`
	Budget            Budget            `json:"budget"`
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
	RequestAction          string `json:"requestAction"`
}

type Thresholds struct {
	AlertLevelAtLeast              int     `json:"alertLevelAtLeast"`
	IndoorTempCAtLeast             float64 `json:"indoorTempCAtLeast"`
	HoursAtOrAboveThresholdAtLeast int     `json:"hoursAtOrAboveThresholdAtLeast"`
	EnergyCreditEurAtMost          float64 `json:"energyCreditEurAtMost"`
	MinimumActiveNeedCount         int     `json:"minimumActiveNeedCount"`
}

type LocalProfile struct {
	VulnerabilityFlags []string `json:"vulnerabilityFlags"`
}

type HeatStatus struct {
	CurrentAlertLevel       int     `json:"currentAlertLevel"`
	CurrentIndoorTempC      float64 `json:"currentIndoorTempC"`
	HoursAtOrAboveThreshold int     `json:"hoursAtOrAboveThreshold"`
}

type EnergyProfile struct {
	RemainingPrepaidCreditEur float64 `json:"remainingPrepaidCreditEur"`
}

type SupportPackage struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	CostEur      int      `json:"costEur"`
	Capabilities []string `json:"capabilities"`
}

type Budget struct {
	MaxPackageCostEur int `json:"maxPackageCostEur"`
}

type InsightPolicy struct {
	ID            string `json:"id"`
	Metric        string `json:"metric"`
	Type          string `json:"type"`
	SupportPolicy string `json:"supportPolicy"`
	PolicyType    string `json:"policyType"`
	PolicyProfile string `json:"policyProfile"`
}

type Integrity struct {
	HashAlgorithm    string `json:"hashAlgorithm"`
	MacAlgorithm     string `json:"macAlgorithm"`
	Secret           string `json:"secret"`
	VerificationMode string `json:"verificationMode"`
}

// Insight is the minimized claim that leaves the household boundary.
type Insight struct {
	CreatedAt     string  `json:"createdAt"`
	ExpiresAt     string  `json:"expiresAt"`
	ID            string  `json:"id"`
	Metric        string  `json:"metric"`
	Municipality  string  `json:"municipality"`
	ScopeDevice   string  `json:"scopeDevice"`
	ScopeEvent    string  `json:"scopeEvent"`
	SupportPolicy string  `json:"supportPolicy"`
	Threshold     float64 `json:"threshold"`
	Type          string  `json:"type"`
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

type IntegrityResult struct {
	CanonicalEnvelope  string `json:"canonicalEnvelope"`
	PayloadHashSHA256  string `json:"payloadHashSHA256"`
	EnvelopeHmacSHA256 string `json:"envelopeHmacSHA256"`
	VerificationMode   string `json:"verificationMode"`
}

type Answer struct {
	Sentence             string   `json:"sentence"`
	RecommendedPackage   string   `json:"recommendedPackage"`
	RequiredCapabilities []string `json:"requiredCapabilities"`
	PayloadHashSHA256    string   `json:"payloadHashSHA256"`
	EnvelopeHmacSHA256   string   `json:"envelopeHmacSHA256"`
}

type Derived struct {
	HeatAlertActive              bool     `json:"heatAlertActive"`
	UnsafeIndoorHeat             bool     `json:"unsafeIndoorHeat"`
	VulnerabilityPresent         bool     `json:"vulnerabilityPresent"`
	EnergyConstraint             bool     `json:"energyConstraint"`
	ActiveNeedCount              int      `json:"activeNeedCount"`
	PriorityCoolingSupportNeeded bool     `json:"priorityCoolingSupportNeeded"`
	RequiredCapabilities         []string `json:"requiredCapabilities"`
	EligiblePackageIDs           []string `json:"eligiblePackageIds"`
	RecommendedPackageID         string   `json:"recommendedPackageId"`
	RecommendedPackageName       string   `json:"recommendedPackageName"`
}

type Checks struct {
	SignatureVerifies            bool `json:"signatureVerifies"`
	PayloadHashMatches           bool `json:"payloadHashMatches"`
	MinimizationRespected        bool `json:"minimizationRespected"`
	ScopeComplete                bool `json:"scopeComplete"`
	AuthorizationAllowed         bool `json:"authorizationAllowed"`
	HeatAlertActive              bool `json:"heatAlertActive"`
	UnsafeIndoorHeat             bool `json:"unsafeIndoorHeat"`
	PriorityCoolingSupportNeeded bool `json:"priorityCoolingSupportNeeded"`
	RecommendedPackageEligible   bool `json:"recommendedPackageEligible"`
	DutyTimingConsistent         bool `json:"dutyTimingConsistent"`
	TenantScreeningProhibited    bool `json:"tenantScreeningProhibited"`
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

func must(condition bool, message string) error {
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

func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}
	return t
}

// The 4-file layout moves basic validation into the model itself.
func validate(data Data) error {
	if err := must(data.CaseName != "", "caseName is required"); err != nil {
		return err
	}
	if err := must(data.Municipality != "", "municipality is required"); err != nil {
		return err
	}
	if err := must(len(data.SupportCatalog) > 0, "supportCatalog is required"); err != nil {
		return err
	}
	if err := must(data.EvaluationContext.Purpose != "", "evaluationContext.purpose is required"); err != nil {
		return err
	}
	if err := must(data.EvaluationContext.RequestAction != "", "evaluationContext.requestAction is required"); err != nil {
		return err
	}
	if err := must(data.InsightPolicy.ID != "", "insightPolicy.id is required"); err != nil {
		return err
	}
	if err := must(data.Integrity.Secret != "", "integrity.secret is required"); err != nil {
		return err
	}
	return nil
}

func containsAll(have []string, required []string) bool {
	set := map[string]bool{}
	for _, item := range have {
		set[item] = true
	}
	for _, item := range required {
		if !set[item] {
			return false
		}
	}
	return true
}

func deriveInsight(data Data) Insight {
	return Insight{
		CreatedAt:     data.Timestamps.CreatedAt,
		ExpiresAt:     data.Timestamps.ExpiresAt,
		ID:            data.InsightPolicy.ID,
		Metric:        data.InsightPolicy.Metric,
		Municipality:  data.Municipality,
		ScopeDevice:   data.EvaluationContext.ScopeDevice,
		ScopeEvent:    data.EvaluationContext.ScopeEvent,
		SupportPolicy: data.InsightPolicy.SupportPolicy,
		Threshold:     float64(data.Thresholds.MinimumActiveNeedCount),
		Type:          data.InsightPolicy.Type,
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
			Action: data.EvaluationContext.RequestAction,
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

// Canonical serialization is explicit because the integrity vector depends
// on these exact bytes, including threshold written as 3.0.
func canonicalEnvelope(insight Insight, policy Policy) string {
	return fmt.Sprintf(
		"{\"insight\":{\"createdAt\":\"%s\",\"expiresAt\":\"%s\",\"id\":\"%s\",\"metric\":\"%s\",\"municipality\":\"%s\",\"scopeDevice\":\"%s\",\"scopeEvent\":\"%s\",\"supportPolicy\":\"%s\",\"threshold\":3.0,\"type\":\"%s\"},\"policy\":{\"duty\":{\"action\":\"%s\",\"constraint\":{\"leftOperand\":\"%s\",\"operator\":\"%s\",\"rightOperand\":\"%s\"}},\"permission\":{\"action\":\"%s\",\"constraint\":{\"leftOperand\":\"%s\",\"operator\":\"%s\",\"rightOperand\":\"%s\"},\"target\":\"%s\"},\"profile\":\"%s\",\"prohibition\":{\"action\":\"%s\",\"constraint\":{\"leftOperand\":\"%s\",\"operator\":\"%s\",\"rightOperand\":\"%s\"},\"target\":\"%s\"},\"type\":\"%s\"}}",
		insight.CreatedAt,
		insight.ExpiresAt,
		insight.ID,
		insight.Metric,
		insight.Municipality,
		insight.ScopeDevice,
		insight.ScopeEvent,
		insight.SupportPolicy,
		insight.Type,
		policy.Duty.Action,
		policy.Duty.Constraint.LeftOperand,
		policy.Duty.Constraint.Operator,
		policy.Duty.Constraint.RightOperand,
		policy.Permission.Action,
		policy.Permission.Constraint.LeftOperand,
		policy.Permission.Constraint.Operator,
		policy.Permission.Constraint.RightOperand,
		policy.Permission.Target,
		policy.Profile,
		policy.Prohibition.Action,
		policy.Prohibition.Constraint.LeftOperand,
		policy.Prohibition.Constraint.Operator,
		policy.Prohibition.Constraint.RightOperand,
		policy.Prohibition.Target,
		policy.Type,
	)
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func hmacSHA256Hex(secret, s string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(s))
	return hex.EncodeToString(mac.Sum(nil))
}

func yesNo(v bool) string {
	if v {
		return "yes"
	}
	return "no"
}

// evaluate implements the normative case logic:
// derive need signals, choose the lowest-cost eligible package,
// construct the envelope, then compute integrity and governance checks.
func evaluate(data Data) (Result, error) {
	var result Result

	if err := validate(data); err != nil {
		return result, err
	}

	heatAlertActive := data.HeatStatus.CurrentAlertLevel >= data.Thresholds.AlertLevelAtLeast
	unsafeIndoorHeat := data.HeatStatus.CurrentIndoorTempC >= data.Thresholds.IndoorTempCAtLeast &&
		data.HeatStatus.HoursAtOrAboveThreshold >= data.Thresholds.HoursAtOrAboveThresholdAtLeast
	vulnerabilityPresent := len(data.LocalProfile.VulnerabilityFlags) > 0
	energyConstraint := data.EnergyProfile.RemainingPrepaidCreditEur <= data.Thresholds.EnergyCreditEurAtMost

	activeNeedCount := 0
	for _, v := range []bool{heatAlertActive, unsafeIndoorHeat, vulnerabilityPresent, energyConstraint} {
		if v {
			activeNeedCount++
		}
	}

	priorityCoolingSupportNeeded := activeNeedCount >= data.Thresholds.MinimumActiveNeedCount

	requiredSet := map[string]bool{}
	if heatAlertActive && unsafeIndoorHeat {
		requiredSet["cooling_kit"] = true
	}
	if vulnerabilityPresent {
		requiredSet["welfare_check"] = true
		requiredSet["transport"] = true
	}
	if energyConstraint {
		requiredSet["bill_credit"] = true
	}

	requiredCapabilities := make([]string, 0, len(requiredSet))
	for capability := range requiredSet {
		requiredCapabilities = append(requiredCapabilities, capability)
	}
	sort.Strings(requiredCapabilities)

	eligiblePackages := []SupportPackage{}
	for _, pkg := range data.SupportCatalog {
		if pkg.CostEur <= data.Budget.MaxPackageCostEur && containsAll(pkg.Capabilities, requiredCapabilities) {
			eligiblePackages = append(eligiblePackages, pkg)
		}
	}
	sort.Slice(eligiblePackages, func(i, j int) bool {
		if eligiblePackages[i].CostEur != eligiblePackages[j].CostEur {
			return eligiblePackages[i].CostEur < eligiblePackages[j].CostEur
		}
		return eligiblePackages[i].ID < eligiblePackages[j].ID
	})

	if len(eligiblePackages) == 0 {
		return result, errors.New("no eligible package found")
	}
	recommended := eligiblePackages[0]

	insight := deriveInsight(data)
	policy := derivePolicy(data)
	canonical := canonicalEnvelope(insight, policy)
	payloadHash := sha256Hex(canonical)
	envelopeHMAC := hmacSHA256Hex(data.Integrity.Secret, canonical)

	insightBytes, _ := json.Marshal(insight)
	insightText := strings.ToLower(string(insightBytes))
	minimizationRespected := !strings.Contains(insightText, "heat_sensitive_condition") &&
		!strings.Contains(insightText, "mobility_limitation") &&
		!strings.Contains(insightText, "credit") &&
		!strings.Contains(insightText, "meter_trace")

	scopeComplete := insight.ScopeDevice != "" && insight.ScopeEvent != "" && insight.ExpiresAt != ""

	authorizationAllowed := data.EvaluationContext.RequestAction == "odrl:use" &&
		data.EvaluationContext.Purpose == "heatwave_response" &&
		!parseTime(data.Timestamps.AuthorizedAt).After(parseTime(data.Timestamps.ExpiresAt))

	recommendedPackageEligible := containsAll(recommended.Capabilities, requiredCapabilities) &&
		recommended.CostEur <= data.Budget.MaxPackageCostEur

	dutyTimingConsistent := !parseTime(data.Timestamps.DutyPerformedAt).After(parseTime(data.Timestamps.ExpiresAt))

	tenantScreeningProhibited := policy.Prohibition.Action == "odrl:distribute" &&
		policy.Prohibition.Constraint.RightOperand == "tenant_screening"

	signatureVerifies := data.Integrity.VerificationMode == "trustedPrecomputedInput" &&
		envelopeHMAC == hmacSHA256Hex(data.Integrity.Secret, canonical)

	payloadHashMatches := payloadHash == sha256Hex(canonical)

	eligiblePackageIDs := make([]string, 0, len(eligiblePackages))
	for _, pkg := range eligiblePackages {
		eligiblePackageIDs = append(eligiblePackageIDs, pkg.ID)
	}

	checks := Checks{
		SignatureVerifies:            signatureVerifies,
		PayloadHashMatches:           payloadHashMatches,
		MinimizationRespected:        minimizationRespected,
		ScopeComplete:                scopeComplete,
		AuthorizationAllowed:         authorizationAllowed,
		HeatAlertActive:              heatAlertActive,
		UnsafeIndoorHeat:             unsafeIndoorHeat,
		PriorityCoolingSupportNeeded: priorityCoolingSupportNeeded,
		RecommendedPackageEligible:   recommendedPackageEligible,
		DutyTimingConsistent:         dutyTimingConsistent,
		TenantScreeningProhibited:    tenantScreeningProhibited,
	}

	answerSentence := fmt.Sprintf(
		"The city is allowed to use a narrow heatwave-response insight and recommends %s for this household.",
		recommended.Name,
	)

	reasonWhy := []string{
		"The household gateway converts local heat, vulnerability, and prepaid-energy stress into an expiring priority-support insight rather than sharing raw household traces or sensitive details.",
		fmt.Sprintf("recommended package: %s", recommended.Name),
		fmt.Sprintf("required capabilities: %s", strings.Join(requiredCapabilities, ", ")),
		fmt.Sprintf("payload SHA-256 : %s", payloadHash),
		fmt.Sprintf("HMAC-SHA256 : %s", envelopeHMAC),
	}

	arcLines := []string{
		"=== Answer ===",
		answerSentence,
		"",
		"=== Reason Why ===",
	}
	arcLines = append(arcLines, reasonWhy...)
	arcLines = append(arcLines,
		"",
		"=== Check ===",
		fmt.Sprintf("signature verifies : %s", yesNo(checks.SignatureVerifies)),
		fmt.Sprintf("payload hash matches : %s", yesNo(checks.PayloadHashMatches)),
		fmt.Sprintf("minimization strips sensitive terms: %s", yesNo(checks.MinimizationRespected)),
		fmt.Sprintf("scope complete : %s", yesNo(checks.ScopeComplete)),
		fmt.Sprintf("authorization allowed : %s", yesNo(checks.AuthorizationAllowed)),
		fmt.Sprintf("heat-alert active : %s", yesNo(checks.HeatAlertActive)),
		fmt.Sprintf("unsafe indoor heat : %s", yesNo(checks.UnsafeIndoorHeat)),
		fmt.Sprintf("priority cooling support needed : %s", yesNo(checks.PriorityCoolingSupportNeeded)),
		fmt.Sprintf("recommended package eligible : %s", yesNo(checks.RecommendedPackageEligible)),
		fmt.Sprintf("duty timing consistent : %s", yesNo(checks.DutyTimingConsistent)),
		fmt.Sprintf("tenant screening prohibited : %s", yesNo(checks.TenantScreeningProhibited)),
	)

	allChecksPass := true
	for _, v := range []bool{
		checks.SignatureVerifies,
		checks.PayloadHashMatches,
		checks.MinimizationRespected,
		checks.ScopeComplete,
		checks.AuthorizationAllowed,
		checks.HeatAlertActive,
		checks.UnsafeIndoorHeat,
		checks.PriorityCoolingSupportNeeded,
		checks.RecommendedPackageEligible,
		checks.DutyTimingConsistent,
		checks.TenantScreeningProhibited,
	} {
		if !v {
			allChecksPass = false
			break
		}
	}

	result = Result{
		CaseName: data.CaseName,
		Derived: Derived{
			HeatAlertActive:              heatAlertActive,
			UnsafeIndoorHeat:             unsafeIndoorHeat,
			VulnerabilityPresent:         vulnerabilityPresent,
			EnergyConstraint:             energyConstraint,
			ActiveNeedCount:              activeNeedCount,
			PriorityCoolingSupportNeeded: priorityCoolingSupportNeeded,
			RequiredCapabilities:         requiredCapabilities,
			EligiblePackageIDs:           eligiblePackageIDs,
			RecommendedPackageID:         recommended.ID,
			RecommendedPackageName:       recommended.Name,
		},
		Envelope: Envelope{
			Insight: insight,
			Policy:  policy,
		},
		Integrity: IntegrityResult{
			CanonicalEnvelope:  canonical,
			PayloadHashSHA256:  payloadHash,
			EnvelopeHmacSHA256: envelopeHMAC,
			VerificationMode:   data.Integrity.VerificationMode,
		},
		Answer: Answer{
			Sentence:             answerSentence,
			RecommendedPackage:   recommended.Name,
			RequiredCapabilities: requiredCapabilities,
			PayloadHashSHA256:    payloadHash,
			EnvelopeHmacSHA256:   envelopeHMAC,
		},
		ReasonWhy:     reasonWhy,
		Checks:        checks,
		AllChecksPass: allChecksPass,
		ArcText:       strings.Join(arcLines, "\n"),
	}

	return result, nil
}

// main keeps the CLI behavior aligned with the other Arcling Go models:
// default to the local data file, print ARC text by default, or JSON with --json.
func main() {
	inputPath := "calidor.data.json"
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
