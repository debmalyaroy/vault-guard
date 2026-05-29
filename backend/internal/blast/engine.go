package blast

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/vaultguard/backend/internal/store"
)

// AccessLevel represents how much privilege a tool requires.
type AccessLevel int

const (
	AccessRead    AccessLevel = 1
	AccessWrite   AccessLevel = 2
	AccessExecute AccessLevel = 3
	AccessAdmin   AccessLevel = 4
)

func (a AccessLevel) String() string {
	switch a {
	case AccessRead:
		return "READ"
	case AccessWrite:
		return "WRITE"
	case AccessExecute:
		return "EXECUTE"
	case AccessAdmin:
		return "ADMIN"
	}
	return "UNKNOWN"
}

// ToolNode represents a resource or capability available to the agent.
type ToolNode struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	AccessLevel string   `json:"access_level"`
	DataScope   []string `json:"data_scope"`   // e.g. ["PII","FINANCIAL","INTERNAL"]
	RiskScore   int      `json:"risk_score"`   // 0-100
	Description string   `json:"description"`
}

// PropagationEdge represents a path an attack could take between tools.
type PropagationEdge struct {
	From        string  `json:"from"`
	To          string  `json:"to"`
	Vector      string  `json:"vector"`      // "tool_call", "memory_read", "api_delegation"
	Probability float32 `json:"probability"` // 0.0-1.0
	Label       string  `json:"label"`
}

// Remediation is an automatically generated fix suggestion.
type Remediation struct {
	Priority    string `json:"priority"` // CRITICAL / HIGH / MEDIUM / LOW
	Action      string `json:"action"`
	Description string `json:"description"`
}

// BlastResult is the full consequence mapping for a single attack.
type BlastResult struct {
	ID               string            `json:"id"`
	SessionID        string            `json:"session_id"`
	AttackType       string            `json:"attack_type"`
	Score            int               `json:"score"`             // 0-100
	Severity         string            `json:"severity"`          // CRITICAL/HIGH/MEDIUM/LOW
	AffectedTools    []ToolNode        `json:"affected_tools"`
	PropagationPaths []PropagationEdge `json:"propagation_paths"`
	Remediations     []Remediation     `json:"remediations"`
	DataExposure     []string          `json:"data_exposure"`
	LateralPotential float32           `json:"lateral_potential"` // 0.0-1.0
	CreatedAt        time.Time         `json:"created_at"`
}

// agentToolset defines the tools available to the demo agent, with their risk profiles.
var agentToolset = []ToolNode{
	{
		ID:          "web_browser",
		Name:        "Web Browser",
		AccessLevel: "READ",
		DataScope:   []string{"PUBLIC"},
		RiskScore:   20,
		Description: "Fetches and reads public web pages",
	},
	{
		ID:          "form_filler",
		Name:        "Form Filler",
		AccessLevel: "WRITE",
		DataScope:   []string{"USER_INPUT", "PII"},
		RiskScore:   55,
		Description: "Fills web forms with user-provided data",
	},
	{
		ID:          "form_submitter",
		Name:        "Form Submitter",
		AccessLevel: "EXECUTE",
		DataScope:   []string{"PII", "FINANCIAL"},
		RiskScore:   70,
		Description: "Submits forms — triggers server-side actions",
	},
	{
		ID:          "data_reader",
		Name:        "Data Reader",
		AccessLevel: "READ",
		DataScope:   []string{"INTERNAL", "PII"},
		RiskScore:   45,
		Description: "Reads structured data from internal sources",
	},
	{
		ID:          "api_caller",
		Name:        "API Caller",
		AccessLevel: "EXECUTE",
		DataScope:   []string{"INTERNAL", "EXTERNAL"},
		RiskScore:   65,
		Description: "Makes authenticated API calls to third-party services",
	},
	{
		ID:          "email_sender",
		Name:        "Email Sender",
		AccessLevel: "EXECUTE",
		DataScope:   []string{"INTERNAL", "PII"},
		RiskScore:   60,
		Description: "Sends emails on behalf of the user",
	},
	{
		ID:          "payment_gateway",
		Name:        "Payment Gateway",
		AccessLevel: "ADMIN",
		DataScope:   []string{"FINANCIAL", "PII"},
		RiskScore:   95,
		Description: "Initiates financial transactions",
	},
	{
		ID:          "credential_store",
		Name:        "Credential Store",
		AccessLevel: "ADMIN",
		DataScope:   []string{"CREDENTIALS", "PII"},
		RiskScore:   100,
		Description: "Accesses stored credentials and API keys",
	},
}

// attackPropagationMap defines which tool pairs are connected and how for each attack type.
var attackPropagationMap = map[string][]PropagationEdge{
	"prompt_injection": {
		{From: "web_browser", To: "form_filler", Vector: "memory_read", Probability: 0.85, Label: "Injected instruction persists to fill"},
		{From: "form_filler", To: "form_submitter", Vector: "tool_call", Probability: 0.75, Label: "Malicious data submitted"},
		{From: "form_submitter", To: "api_caller", Vector: "api_delegation", Probability: 0.60, Label: "Delegates to external API"},
	},
	"memory_poisoning": {
		{From: "data_reader", To: "form_filler", Vector: "memory_read", Probability: 0.90, Label: "Poisoned memory drives form fill"},
		{From: "form_filler", To: "email_sender", Vector: "tool_call", Probability: 0.65, Label: "Exfiltration via email"},
		{From: "data_reader", To: "api_caller", Vector: "api_delegation", Probability: 0.70, Label: "Poisoned context calls external API"},
	},
	"identity_spoofing": {
		{From: "credential_store", To: "api_caller", Vector: "tool_call", Probability: 0.92, Label: "Stolen credentials used for API calls"},
		{From: "api_caller", To: "payment_gateway", Vector: "api_delegation", Probability: 0.55, Label: "Spoofed identity initiates payment"},
	},
	"goal_hijacking": {
		{From: "web_browser", To: "api_caller", Vector: "memory_read", Probability: 0.80, Label: "Hijacked goal redirects API target"},
		{From: "api_caller", To: "data_reader", Vector: "tool_call", Probability: 0.70, Label: "Reads data not in original scope"},
		{From: "data_reader", To: "email_sender", Vector: "tool_call", Probability: 0.65, Label: "Exfiltrates out-of-scope data"},
	},
	"dark_pattern": {
		{From: "web_browser", To: "form_submitter", Vector: "tool_call", Probability: 0.75, Label: "Deceptive UX triggers submission"},
		{From: "form_submitter", To: "payment_gateway", Vector: "api_delegation", Probability: 0.50, Label: "Hidden subscription activated"},
	},
	"data_exfiltration": {
		{From: "data_reader", To: "email_sender", Vector: "tool_call", Probability: 0.95, Label: "Direct exfil via email"},
		{From: "data_reader", To: "api_caller", Vector: "api_delegation", Probability: 0.88, Label: "Exfil via external API"},
	},
	"privilege_escalation": {
		{From: "api_caller", To: "credential_store", Vector: "tool_call", Probability: 0.70, Label: "API call leaks credential access"},
		{From: "credential_store", To: "payment_gateway", Vector: "tool_call", Probability: 0.85, Label: "Escalated access reaches payments"},
		{From: "credential_store", To: "api_caller", Vector: "tool_call", Probability: 0.90, Label: "Elevated privilege for all APIs"},
	},
	"steganography": {
		{From: "web_browser", To: "form_filler", Vector: "memory_read", Probability: 0.88, Label: "Hidden instruction decoded and acted on"},
		{From: "form_filler", To: "form_submitter", Vector: "tool_call", Probability: 0.75, Label: "Hidden payload submitted"},
	},
	"resource_abuse": {
		{From: "api_caller", To: "api_caller", Vector: "tool_call", Probability: 0.95, Label: "Recursive API call loop"},
	},
	"supply_chain": {
		{From: "api_caller", To: "credential_store", Vector: "api_delegation", Probability: 0.60, Label: "Compromised dependency accesses credentials"},
		{From: "api_caller", To: "data_reader", Vector: "tool_call", Probability: 0.80, Label: "Malicious plugin reads internal data"},
	},
	"none": {},
}

// accessLevelScore returns the weighted risk contribution of an access level.
func accessLevelScore(level string) int {
	switch level {
	case "READ":
		return 15
	case "WRITE":
		return 30
	case "EXECUTE":
		return 45
	case "ADMIN":
		return 60
	}
	return 10
}

// dataScopeScore returns the weighted risk of exposed data categories.
func dataScopeScore(scope []string) int {
	score := 0
	for _, s := range scope {
		switch s {
		case "FINANCIAL", "CREDENTIALS":
			score += 25
		case "PII":
			score += 20
		case "INTERNAL":
			score += 10
		case "USER_INPUT", "EXTERNAL":
			score += 5
		}
	}
	if score > 40 {
		return 40
	}
	return score
}

// sophisticationBonus adds to the score based on attack sophistication.
func sophisticationBonus(sophistication string) int {
	switch sophistication {
	case "high":
		return 25
	case "medium":
		return 15
	case "low":
		return 5
	}
	return 10
}

// severity classifies a numerical score.
func severity(score int) string {
	switch {
	case score >= 80:
		return "CRITICAL"
	case score >= 60:
		return "HIGH"
	case score >= 40:
		return "MEDIUM"
	default:
		return "LOW"
	}
}

// remediationsFor generates context-aware remediation suggestions.
func remediationsFor(attackType string, affectedTools []ToolNode) []Remediation {
	base := []Remediation{
		{Priority: "HIGH", Action: "Enable Guardian Rail", Description: "Activate all 5 pipeline stages including LLM classification and goal-drift detection."},
		{Priority: "HIGH", Action: "Apply least-privilege policy", Description: "Restrict agent tool access to only what the current task requires."},
	}
	for _, t := range affectedTools {
		if t.ID == "payment_gateway" {
			base = append(base, Remediation{
				Priority:    "CRITICAL",
				Action:      "Block payment_gateway access",
				Description: "Remove payment_gateway from agent tool manifest for this task type.",
			})
		}
		if t.ID == "credential_store" {
			base = append(base, Remediation{
				Priority:    "CRITICAL",
				Action:      "Revoke credential_store access",
				Description: "Agent should never have direct credential access — use scoped tokens instead.",
			})
		}
	}
	switch attackType {
	case "prompt_injection":
		base = append(base, Remediation{Priority: "HIGH", Action: "Sanitise all web content before processing", Description: "Strip HTML, control characters, and suspicious instruction patterns from fetched content."})
	case "memory_poisoning":
		base = append(base, Remediation{Priority: "HIGH", Action: "Isolate session memory", Description: "Use per-task memory scopes to prevent cross-session contamination."})
	case "data_exfiltration":
		base = append(base, Remediation{Priority: "CRITICAL", Action: "Block outbound email/API for data tasks", Description: "Data retrieval tasks should not have access to email_sender or external api_caller."})
	}
	return base
}

// Engine computes Blast Radius scores for attacks.
type Engine struct {
	store *store.NestedStore[BlastResult]
	mu    sync.RWMutex
}

// NewEngine creates a Blast Radius Engine backed by BoltDB.
func NewEngine(db *store.DB) (*Engine, error) {
	s, err := store.NewNestedStore[BlastResult](db, "blast_results")
	if err != nil {
		return nil, fmt.Errorf("blast engine store: %w", err)
	}
	return &Engine{store: s}, nil
}

// Calculate computes the blast radius for an attack and persists it.
func (e *Engine) Calculate(_ context.Context, sessionID, attackType, sophistication string) (*BlastResult, error) {
	edges, ok := attackPropagationMap[attackType]
	if !ok {
		edges = attackPropagationMap["none"]
	}

	// Identify affected tool IDs from edges
	affectedIDs := map[string]bool{}
	for _, edge := range edges {
		affectedIDs[edge.From] = true
		affectedIDs[edge.To] = true
	}

	affectedTools := make([]ToolNode, 0)
	maxAccessScore := 0
	maxDataScore := 0
	var dataExposure []string
	seen := map[string]bool{}

	for _, tool := range agentToolset {
		if affectedIDs[tool.ID] {
			affectedTools = append(affectedTools, tool)
			as := accessLevelScore(tool.AccessLevel)
			if as > maxAccessScore {
				maxAccessScore = as
			}
			ds := dataScopeScore(tool.DataScope)
			if ds > maxDataScore {
				maxDataScore = ds
			}
			for _, s := range tool.DataScope {
				if !seen[s] {
					seen[s] = true
					dataExposure = append(dataExposure, s)
				}
			}
		}
	}

	// Compute lateral potential: average of propagation edge probabilities
	var lateralPotential float32
	if len(edges) > 0 {
		sum := float32(0)
		for _, edge := range edges {
			sum += edge.Probability
		}
		lateralPotential = sum / float32(len(edges))
	}

	lateralScore := int(lateralPotential * 30)
	sophBonus := sophisticationBonus(sophistication)
	rawScore := maxAccessScore + maxDataScore + lateralScore + sophBonus
	if rawScore > 100 {
		rawScore = 100
	}

	result := BlastResult{
		ID:               fmt.Sprintf("blast-%d", time.Now().UnixNano()),
		SessionID:        sessionID,
		AttackType:       attackType,
		Score:            rawScore,
		Severity:         severity(rawScore),
		AffectedTools:    affectedTools,
		PropagationPaths: edges,
		Remediations:     remediationsFor(attackType, affectedTools),
		DataExposure:     dataExposure,
		LateralPotential: lateralPotential,
		CreatedAt:        time.Now(),
	}

	e.mu.Lock()
	defer e.mu.Unlock()
	if err := e.store.Set(sessionID, result.ID, result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetLatest returns the most recent BlastResult for a session.
func (e *Engine) GetLatest(sessionID string) (*BlastResult, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	all := e.store.GetAll(sessionID)
	if len(all) == 0 {
		return nil, false
	}
	var latest *BlastResult
	for _, r := range all {
		r := r
		if latest == nil || r.CreatedAt.After(latest.CreatedAt) {
			latest = &r
		}
	}
	return latest, true
}

// GetHistory returns all BlastResults for a session, newest first.
func (e *Engine) GetHistory(sessionID string) []BlastResult {
	e.mu.RLock()
	defer e.mu.RUnlock()

	all := e.store.GetAll(sessionID)
	results := make([]BlastResult, 0, len(all))
	for _, r := range all {
		results = append(results, r)
	}
	// Sort newest first
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].CreatedAt.After(results[i].CreatedAt) {
				results[i], results[j] = results[j], results[i]
			}
		}
	}
	return results
}
