package session

import (
	"time"

	"github.com/vaultguard/backend/internal/store"
)

// Session holds the state for one playground session.
type Session struct {
	ID            string    `json:"id"`
	SessionToken  string    `json:"session_token"`
	ActivePolicy  string    `json:"active_policy"`
	TaskText      string    `json:"task_text"`
	TaskAnchorEmb []float32 `json:"task_anchor_emb"`
	CreatedAt     time.Time `json:"created_at"`
	LastActive    time.Time `json:"last_active"`
}

// Manager handles session lifecycle backed by BoltDB.
type Manager struct {
	store *store.BoltStore[Session]
}

// NewManager creates a session Manager backed by BoltDB.
func NewManager(db *store.DB) (*Manager, error) {
	s, err := store.NewBoltStore[Session](db, "sessions")
	if err != nil {
		return nil, err
	}
	return &Manager{store: s}, nil
}

// CreateSession initialises a new session with default policy and demo task.
func (m *Manager) CreateSession(id, token string) (*Session, error) {
	sess := Session{
		ID:           id,
		SessionToken: token,
		ActivePolicy: "research_assistant",
		TaskText:     "Research best laptops under ₹60,000. Return top 3 with specs.",
		CreatedAt:    time.Now(),
		LastActive:   time.Now(),
	}
	if err := m.store.Set(id, sess); err != nil {
		return nil, err
	}
	return &sess, nil
}

// GetSession retrieves a session and updates its last-active timestamp.
func (m *Manager) GetSession(id string) (*Session, bool) {
	sess, ok := m.store.Get(id)
	if !ok {
		return nil, false
	}
	sess.LastActive = time.Now()
	_ = m.store.Set(id, sess)
	return &sess, true
}

// UpdatePolicy sets the active policy for a session.
func (m *Manager) UpdatePolicy(id, policy string) error {
	sess, ok := m.store.Get(id)
	if !ok {
		return nil
	}
	sess.ActivePolicy = policy
	sess.LastActive = time.Now()
	return m.store.Set(id, sess)
}

// SetTaskAnchor stores the task embedding used for goal-drift detection.
func (m *Manager) SetTaskAnchor(id string, emb []float32) error {
	sess, ok := m.store.Get(id)
	if !ok {
		return nil
	}
	sess.TaskAnchorEmb = emb
	return m.store.Set(id, sess)
}
