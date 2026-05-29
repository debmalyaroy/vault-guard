package policy

import (
	"strings"
)

type ActionType string

const (
	ActionBrowse        ActionType = "browse"
	ActionFormFill      ActionType = "form_fill"
	ActionFormSubmit    ActionType = "form_submit"
	ActionPaymentAccess ActionType = "payment_access"
	ActionDataShare     ActionType = "data_share"
	ActionAPICall       ActionType = "api_call"
	ActionEmailSend     ActionType = "email_send"
)

type Manifest struct {
	Allowed []ActionType `json:"allowed"`
	Denied  []ActionType `json:"denied"`
}

type AgentAction struct {
	URL         string
	Method      string
	ElementType string
}

type Violation struct {
	ActionType   ActionType
	Reason       string
	RuleViolated string
}

type Enforcer struct{}

func NewEnforcer() *Enforcer {
	return &Enforcer{}
}

func (e *Enforcer) Check(manifest Manifest, action AgentAction) *Violation {
	actionType := e.classifyAction(action)

	for _, denied := range manifest.Denied {
		if actionType == denied {
			return &Violation{
				ActionType:   actionType,
				Reason:       "Action is denied by active policy",
				RuleViolated: string(denied),
			}
		}
	}

	for _, allowed := range manifest.Allowed {
		if actionType == allowed {
			return nil
		}
	}

	return &Violation{
		ActionType:   actionType,
		Reason:       "Action not in allowed list (default deny)",
		RuleViolated: "default_deny",
	}
}

func (e *Enforcer) classifyAction(action AgentAction) ActionType {
	url := strings.ToLower(action.URL)
	method := strings.ToUpper(action.Method)

	switch {
	case strings.Contains(url, "payment") || strings.Contains(url, "checkout") || strings.Contains(url, "stripe"):
		return ActionPaymentAccess
	case method == "POST" && strings.Contains(url, "form"):
		return ActionFormSubmit
	case method == "GET" && action.ElementType == "form":
		return ActionFormFill
	case strings.Contains(url, "mailto") || action.ElementType == "email":
		return ActionEmailSend
	case method == "GET":
		return ActionBrowse
	default:
		return ActionAPICall
	}
}

// Preloaded policies
var PreloadedPolicies = map[string]Manifest{
	"research_assistant": {
		Allowed: []ActionType{ActionBrowse},
		Denied:  []ActionType{ActionFormSubmit, ActionPaymentAccess, ActionDataShare},
	},
	"financial_analyst": {
		Allowed: []ActionType{ActionBrowse, ActionPaymentAccess}, // Allows payment access for demo
		Denied:  []ActionType{ActionFormSubmit, ActionDataShare},
	},
	"procurement_bot": {
		Allowed: []ActionType{ActionBrowse, ActionFormFill, ActionFormSubmit},
		Denied:  []ActionType{ActionPaymentAccess},
	},
}
