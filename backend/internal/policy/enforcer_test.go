package policy

import (
	"testing"
	"github.com/stretchr/testify/assert"
)

func TestEnforcer_Check(t *testing.T) {
	enforcer := NewEnforcer()
	manifest := PreloadedPolicies["research_assistant"]

	t.Run("Allowed Action", func(t *testing.T) {
		action := AgentAction{URL: "http://example.com/research", Method: "GET"}
		violation := enforcer.Check(manifest, action)
		assert.Nil(t, violation, "Expected allowed action to return nil violation")
	})

	t.Run("Denied Action - Explicit", func(t *testing.T) {
		action := AgentAction{URL: "http://example.com/checkout", Method: "POST"}
		violation := enforcer.Check(manifest, action)
		assert.NotNil(t, violation, "Expected denied action to return violation")
		assert.Equal(t, ActionPaymentAccess, violation.ActionType)
		assert.Equal(t, string(ActionPaymentAccess), violation.RuleViolated)
	})

	t.Run("Denied Action - Default Deny", func(t *testing.T) {
		action := AgentAction{URL: "http://example.com/api/data", Method: "PUT"} // Not in allowed list
		violation := enforcer.Check(manifest, action)
		assert.NotNil(t, violation, "Expected default deny to return violation")
		assert.Equal(t, "default_deny", violation.RuleViolated)
	})
}
