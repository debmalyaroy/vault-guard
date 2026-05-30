package agent

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/vaultguard/backend/internal/blast"
	"github.com/vaultguard/backend/internal/guardian"
	"github.com/vaultguard/backend/internal/store"
)

// CustomAgent is a judge-registered agent that VaultGuard wraps with GuardianRail.
type CustomAgent struct {
	ID           string    `json:"id"`
	SessionID    string    `json:"session_id"`
	Name         string    `json:"name"`
	SystemPrompt string    `json:"system_prompt"`
	Tools        []string  `json:"tools"`
	CreatedAt    time.Time `json:"created_at"`
}

// CustomInteraction records a single message exchange with a wrapped custom agent.
type CustomInteraction struct {
	ID            string                  `json:"id"`
	AgentID       string                  `json:"agent_id"`
	Message       string                  `json:"message"`
	Blocked       bool                    `json:"blocked"`
	ScreenedInput string                  `json:"screened_input"`
	AgentResponse string                  `json:"agent_response,omitempty"`
	Trace         *guardian.PipelineTrace `json:"trace"`
	BlastResult   *blast.BlastResult      `json:"blast_result,omitempty"`
	AuditID       string                  `json:"audit_id"`
	CreatedAt     time.Time               `json:"created_at"`
}

// CustomAgentManager handles CRUD for custom agents and their interaction history.
type CustomAgentManager struct {
	agents       *store.BoltStore[CustomAgent]
	interactions *store.BoltStore[CustomInteraction]
}

// NewCustomAgentManager initialises both BoltDB buckets.
func NewCustomAgentManager(db *store.DB) (*CustomAgentManager, error) {
	agents, err := store.NewBoltStore[CustomAgent](db, "custom_agents")
	if err != nil {
		return nil, fmt.Errorf("custom_agents bucket: %w", err)
	}
	interactions, err := store.NewBoltStore[CustomInteraction](db, "custom_interactions")
	if err != nil {
		return nil, fmt.Errorf("custom_interactions bucket: %w", err)
	}
	return &CustomAgentManager{agents: agents, interactions: interactions}, nil
}

// Register stores a new custom agent and returns its assigned ID.
func (m *CustomAgentManager) Register(agent CustomAgent) error {
	return m.agents.Set(agent.ID, agent)
}

// Get retrieves a custom agent by ID.
func (m *CustomAgentManager) Get(agentID string) (CustomAgent, bool) {
	return m.agents.Get(agentID)
}

// ListBySession returns all agents registered for a given session.
func (m *CustomAgentManager) ListBySession(sessionID string) []CustomAgent {
	all := m.agents.GetAll()
	var result []CustomAgent
	for _, a := range all {
		if a.SessionID == sessionID {
			result = append(result, a)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.Before(result[j].CreatedAt)
	})
	return result
}

// Delete removes an agent and all its interaction history.
func (m *CustomAgentManager) Delete(agentID string) error {
	// Remove interactions for this agent
	all := m.interactions.GetAll()
	for key := range all {
		if strings.HasPrefix(key, agentID+":") {
			_ = m.interactions.Delete(key)
		}
	}
	return m.agents.Delete(agentID)
}

// SaveInteraction persists a single interaction record.
func (m *CustomAgentManager) SaveInteraction(interaction CustomInteraction) error {
	key := fmt.Sprintf("%s:%d", interaction.AgentID, interaction.CreatedAt.UnixNano())
	return m.interactions.Set(key, interaction)
}

// GetHistory returns the last N interactions for an agent, newest first.
func (m *CustomAgentManager) GetHistory(agentID string, limit int) []CustomInteraction {
	all := m.interactions.GetAll()
	var result []CustomInteraction
	for key, v := range all {
		if strings.HasPrefix(key, agentID+":") {
			result = append(result, v)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})
	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	return result
}
