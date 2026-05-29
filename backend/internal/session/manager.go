package session

import (
	"time"

	"github.com/vaultguard/backend/internal/store"
)

type Session struct {
	ID                string    `json:"id"`
	SessionToken      string    `json:"session_token"`
	ActivePolicy      string    `json:"active_policy"`
	TaskText          string    `json:"task_text"`
	TaskAnchorEmb     []float32 `json:"task_anchor_emb"`
	CreatedAt         time.Time `json:"created_at"`
	LastActive        time.Time `json:"last_active"`
}

type Manager struct {
	store *store.Store[Session]
}

func NewManager(filePath string) (*Manager, error) {
	s, err := store.NewStore[Session](filePath)
	if err != nil {
		return nil, err
	}
	return &Manager{store: s}, nil
}

func (m *Manager) CreateSession(id, token string) (*Session, error) {
	sess := Session{
		ID:           id,
		SessionToken: token,
		ActivePolicy: "research_assistant",
		TaskText:     "Research best laptops under ₹60,000. Return top 3 with specs.",
		CreatedAt:    time.Now(),
		LastActive:   time.Now(),
	}

	err := m.store.Set(id, sess)
	if err != nil {
		return nil, err
	}
	return &sess, nil
}

func (m *Manager) GetSession(id string) (*Session, bool) {
	sess, ok := m.store.Get(id)
	if ok {
		sess.LastActive = time.Now()
		_ = m.store.Set(id, sess)
		return &sess, true
	}
	return nil, false
}

func (m *Manager) UpdatePolicy(id, policy string) error {
	sess, ok := m.store.Get(id)
	if ok {
		sess.ActivePolicy = policy
		sess.LastActive = time.Now()
		return m.store.Set(id, sess)
	}
	return nil
}
