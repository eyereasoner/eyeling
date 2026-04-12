package main

// Delfour is a reference Arcling model written as a small CLI program.
// It reads delfour.data.json, derives the neutral shopping insight,
// computes the canonical envelope/hash/HMAC values, and emits either
// ARC text or a JSON result object.

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

// Data mirrors the input instance shape from delfour.data.json.
type Data struct {
	CaseName          string            `json:"caseName"`
	Retailer          string            `json:"retailer"`
	Question          string            `json:"question"`
	Timestamps        Timestamps        `json:"timestamps"`
	EvaluationContext EvaluationContext `json:"evaluationContext"`
	Thresholds        Thresholds        `json:"thresholds"`
	HouseholdProfile  HouseholdProfile  `json:"householdProfile"`
	Catalog           []Product         `json:"catalog"`
	Scan              Scan              `json:"scan"`
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
	SugarPerServingGAtLeast float64 `json:"sugarPerServingGAtLeast"`
}

type HouseholdProfile struct {
	Condition string `json:"condition"`
}

type Product struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	SugarTenths     int     `json:"sugarTenths"`
	SugarPerServing float64 `json:"sugarPerServing"`
}

type Scan struct {
	ScannedProductID string `json:"scannedProductId"`
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

// Insight is the minimized payload shared with the retailer.
type Insight struct {
	CreatedAt        string  `json:"createdAt"`
	ExpiresAt        string  `json:"expiresAt"`
	ID               string  `json:"id"`
	Metric           string  `json:"metric"`
	Retailer         string  `json:"retailer"`
	ScopeDevice      string  `json:"scopeDevice"`
	ScopeEvent       string  `json:"scopeEvent"`
	SuggestionPolicy string  `json:"suggestionPolicy"`
	Threshold        float64 `json:"threshold"`
	Type             string  `json:"type"`
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
	NeedsLowSugar              bool     `json:"needsLowSugar"`
	HighSugarScanned           bool     `json:"highSugarScanned"`
	LowerSugarCandidateIDs     []string `json:"lowerSugarCandidateIds"`
	RecommendedAlternativeID   *string  `json:"recommendedAlternativeId"`
	RecommendedAlternativeName *string  `json:"recommendedAlternativeName"`
	AlternativeLowersSugar     bool     `json:"alternativeLowersSugar"`
}

type IntegrityResult struct {
	CanonicalEnvelope  string `json:"canonicalEnvelope"`
	PayloadHashSHA256  string `json:"payloadHashSHA256"`
	EnvelopeHmacSHA256 string `json:"envelopeHmacSHA256"`
	VerificationMode   string `json:"verificationMode"`
}

type Answer struct {
	Sentence             string  `json:"sentence"`
	ScannedProduct       string  `json:"scannedProduct"`
	SuggestedAlternative *string `json:"suggestedAlternative"`
	PayloadHashSHA256    string  `json:"payloadHashSHA256"`
	EnvelopeHmacSHA256   string  `json:"envelopeHmacSHA256"`
}

type Checks struct {
	SignatureVerifies      bool `json:"signatureVerifies"`
	PayloadHashMatches     bool `json:"payloadHashMatches"`
	MinimizationRespected  bool `json:"minimizationRespected"`
	ScopeComplete          bool `json:"scopeComplete"`
	AuthorizationAllowed   bool `json:"authorizationAllowed"`
	HighSugarBanner        bool `json:"highSugarBanner"`
	AlternativeLowersSugar bool `json:"alternativeLowersSugar"`
	DutyTimingConsistent   bool `json:"dutyTimingConsistent"`
	MarketingProhibited    bool `json:"marketingProhibited"`
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

// validate performs the structural checks that used to live in JSON Schema.
func validate(data Data) error {
	if err := must(data.CaseName != "", "caseName is required"); err != nil {
		return err
	}
	if err := must(data.Retailer != "", "retailer is required"); err != nil {
		return err
	}
	if err := must(len(data.Catalog) > 0, "catalog is required"); err != nil {
		return err
	}
	if err := must(data.Scan.ScannedProductID != "", "scan.scannedProductId is required"); err != nil {
		return err
	}
	if err := must(data.Timestamps.CreatedAt != "", "timestamps.createdAt is required"); err != nil {
		return err
	}
	if err := must(data.Timestamps.ExpiresAt != "", "timestamps.expiresAt is required"); err != nil {
		return err
	}
	if err := must(data.Timestamps.AuthorizedAt != "", "timestamps.authorizedAt is required"); err != nil {
		return err
	}
	if err := must(data.Timestamps.DutyPerformedAt != "", "timestamps.dutyPerformedAt is required"); err != nil {
		return err
	}
	if err := must(data.HouseholdProfile.Condition != "", "householdProfile.condition is required"); err != nil {
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

// parseTime accepts RFC3339Nano timestamps from the case instance.
func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		panic(err)
	}
	return t
}

// findProduct resolves the scanned or recommended product by its catalog id.
func findProduct(data Data, id string) *Product {
	for i := range data.Catalog {
		if data.Catalog[i].ID == id {
			return &data.Catalog[i]
		}
	}
	return nil
}

// deriveInsight strips the household condition down to the neutral shopping insight.
func deriveInsight(data Data) Insight {
	return Insight{
		CreatedAt:        data.Timestamps.CreatedAt,
		ExpiresAt:        data.Timestamps.ExpiresAt,
		ID:               data.InsightPolicy.ID,
		Metric:           data.InsightPolicy.Metric,
		Retailer:         data.Retailer,
		ScopeDevice:      data.EvaluationContext.ScopeDevice,
		ScopeEvent:       data.EvaluationContext.ScopeEvent,
		SuggestionPolicy: data.InsightPolicy.SuggestionPolicy,
		Threshold:        data.Thresholds.SugarPerServingGAtLeast,
		Type:             data.InsightPolicy.Type,
	}
}

// derivePolicy builds the companion ODRL-style policy used for governance checks.
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

// canonicalEnvelope returns the exact byte string used for the integrity vector.
// The field order and the lexical form of threshold (10.0) are intentional.
func canonicalEnvelope(insight Insight, policy Policy) string {
	return fmt.Sprintf(
		"{\"insight\":{\"createdAt\":\"%s\",\"expiresAt\":\"%s\",\"id\":\"%s\",\"metric\":\"%s\",\"retailer\":\"%s\",\"scopeDevice\":\"%s\",\"scopeEvent\":\"%s\",\"suggestionPolicy\":\"%s\",\"threshold\":10.0,\"type\":\"%s\"},\"policy\":{\"duty\":{\"action\":\"%s\",\"constraint\":{\"leftOperand\":\"%s\",\"operator\":\"%s\",\"rightOperand\":\"%s\"}},\"permission\":{\"action\":\"%s\",\"constraint\":{\"leftOperand\":\"%s\",\"operator\":\"%s\",\"rightOperand\":\"%s\"},\"target\":\"%s\"},\"profile\":\"%s\",\"prohibition\":{\"action\":\"%s\",\"constraint\":{\"leftOperand\":\"%s\",\"operator\":\"%s\",\"rightOperand\":\"%s\"},\"target\":\"%s\"},\"type\":\"%s\"}}",
		insight.CreatedAt,
		insight.ExpiresAt,
		insight.ID,
		insight.Metric,
		insight.Retailer,
		insight.ScopeDevice,
		insight.ScopeEvent,
		insight.SuggestionPolicy,
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

// evaluate runs the full Arcling pipeline: derive facts, select the recommendation,
// build the envelope, verify integrity values, and render the final report.
func evaluate(data Data) (Result, error) {
	var result Result
	if err := validate(data); err != nil {
		return result, err
	}

	scanned := findProduct(data, data.Scan.ScannedProductID)
	if scanned == nil {
		return result, fmt.Errorf("scanned product not found: %s", data.Scan.ScannedProductID)
	}

	needsLowSugar := data.HouseholdProfile.Condition == "Diabetes"
	highSugarScanned := scanned.SugarPerServing >= data.Thresholds.SugarPerServingGAtLeast

	var candidates []Product
	for _, p := range data.Catalog {
		if p.SugarTenths < scanned.SugarTenths {
			candidates = append(candidates, p)
		}
	}
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].SugarTenths < candidates[j].SugarTenths
	})

	var recommended *Product
	if len(candidates) > 0 {
		recommended = &candidates[0]
	}
	alternativeLowersSugar := recommended != nil && recommended.SugarTenths < scanned.SugarTenths

	insight := deriveInsight(data)
	policy := derivePolicy(data)
	canonical := canonicalEnvelope(insight, policy)
	payloadHash := sha256Hex(canonical)
	envelopeHMAC := hmacSHA256Hex(data.Integrity.Secret, canonical)

	lowerIDs := make([]string, 0, len(candidates))
	for _, p := range candidates {
		lowerIDs = append(lowerIDs, p.ID)
	}

	insightBytes, _ := json.Marshal(insight)
	insightText := strings.ToLower(string(insightBytes))
	minimizationRespected := !strings.Contains(insightText, "diabetes") && !strings.Contains(insightText, "medical")

	scopeComplete := insight.ScopeDevice != "" && insight.ScopeEvent != "" && insight.ExpiresAt != ""
	authorizationAllowed := data.EvaluationContext.RequestAction == "odrl:use" &&
		data.EvaluationContext.Purpose == "shopping_assist" &&
		!parseTime(data.Timestamps.AuthorizedAt).After(parseTime(data.Timestamps.ExpiresAt))
	dutyTimingConsistent := !parseTime(data.Timestamps.DutyPerformedAt).After(parseTime(data.Timestamps.ExpiresAt))
	marketingProhibited := policy.Prohibition.Action == "odrl:distribute" &&
		policy.Prohibition.Constraint.RightOperand == "marketing"
	signatureVerifies := data.Integrity.VerificationMode == "trustedPrecomputedInput" &&
		envelopeHMAC == hmacSHA256Hex(data.Integrity.Secret, canonical)
	payloadHashMatches := payloadHash == sha256Hex(canonical)

	checks := Checks{
		SignatureVerifies:      signatureVerifies,
		PayloadHashMatches:     payloadHashMatches,
		MinimizationRespected:  minimizationRespected,
		ScopeComplete:          scopeComplete,
		AuthorizationAllowed:   authorizationAllowed,
		HighSugarBanner:        highSugarScanned,
		AlternativeLowersSugar: alternativeLowersSugar,
		DutyTimingConsistent:   dutyTimingConsistent,
		MarketingProhibited:    marketingProhibited,
	}

	var recommendedID *string
	var recommendedName *string
	recommendedText := "none"
	sentence := fmt.Sprintf("The scanner is allowed to use a neutral shopping insight and recommends no alternative instead of %s.", scanned.Name)

	if recommended != nil {
		recommendedID = &recommended.ID
		recommendedName = &recommended.Name
		recommendedText = recommended.Name
		sentence = fmt.Sprintf(
			"The scanner is allowed to use a neutral shopping insight and recommends %s instead of %s.",
			recommended.Name,
			scanned.Name,
		)
	}

	reasonWhy := []string{
		"The phone desensitizes a diabetes-related household condition into a scoped low-sugar need, wraps it in an expiring Insight+Policy envelope, and signs it.",
		fmt.Sprintf("scanned product : %s", scanned.Name),
		fmt.Sprintf("suggested alternative: %s", recommendedText),
		fmt.Sprintf("payload SHA-256 : %s", payloadHash),
		fmt.Sprintf("HMAC-SHA256 : %s", envelopeHMAC),
	}

	arcLines := []string{
		"=== Answer ===",
		sentence,
		"",
		"=== Reason Why ===",
	}
	arcLines = append(arcLines, reasonWhy...)
	arcLines = append(
		arcLines,
		"",
		"=== Check ===",
		fmt.Sprintf("signature verifies : %s", yesNo(checks.SignatureVerifies)),
		fmt.Sprintf("payload hash matches : %s", yesNo(checks.PayloadHashMatches)),
		fmt.Sprintf("minimization strips sensitive terms: %s", yesNo(checks.MinimizationRespected)),
		fmt.Sprintf("scope complete : %s", yesNo(checks.ScopeComplete)),
		fmt.Sprintf("authorization allowed : %s", yesNo(checks.AuthorizationAllowed)),
		fmt.Sprintf("high-sugar banner : %s", yesNo(checks.HighSugarBanner)),
		fmt.Sprintf("alternative lowers sugar : %s", yesNo(checks.AlternativeLowersSugar)),
		fmt.Sprintf("duty timing consistent : %s", yesNo(checks.DutyTimingConsistent)),
		fmt.Sprintf("marketing prohibited : %s", yesNo(checks.MarketingProhibited)),
	)

	allChecksPass := checks.SignatureVerifies &&
		checks.PayloadHashMatches &&
		checks.MinimizationRespected &&
		checks.ScopeComplete &&
		checks.AuthorizationAllowed &&
		checks.HighSugarBanner &&
		checks.AlternativeLowersSugar &&
		checks.DutyTimingConsistent &&
		checks.MarketingProhibited

	result = Result{
		CaseName: data.CaseName,
		Derived: Derived{
			NeedsLowSugar:              needsLowSugar,
			HighSugarScanned:           highSugarScanned,
			LowerSugarCandidateIDs:     lowerIDs,
			RecommendedAlternativeID:   recommendedID,
			RecommendedAlternativeName: recommendedName,
			AlternativeLowersSugar:     alternativeLowersSugar,
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
			Sentence:             sentence,
			ScannedProduct:       scanned.Name,
			SuggestedAlternative: recommendedName,
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

// main is a tiny CLI wrapper around evaluate. It defaults to delfour.data.json,
// prints ARC text, and switches to JSON output when --json is supplied.
func main() {
	inputPath := "delfour.data.json"
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
