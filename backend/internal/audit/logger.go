package audit

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/vaultguard/backend/internal/store"
)

// AuditEntry is a single tamper-evident log record.
type AuditEntry struct {
	ID        string         `json:"id"`
	SessionID string         `json:"session_id"`
	SeqNum    int            `json:"sequence_num"`
	Action    string         `json:"action"`
	Data      map[string]any `json:"data"`
	EntryHash string         `json:"entry_hash"`
	PrevHash  string         `json:"prev_hash"`
	Signature string         `json:"signature"`
	CreatedAt time.Time      `json:"created_at"`
}

// Logger writes Ed25519-signed, SHA-256 hash-chained audit entries.
type Logger struct {
	store      *store.NestedStore[AuditEntry]
	privateKey ed25519.PrivateKey
	publicKey  ed25519.PublicKey
	mu         sync.Mutex
	sessionSeq  map[string]int
	prevHash   map[string]string
}

// NewLogger creates an audit Logger backed by BoltDB.
func NewLogger(db *store.DB) (*Logger, error) {
	s, err := store.NewNestedStore[AuditEntry](db, "audit")
	if err != nil {
		return nil, err
	}
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		return nil, err
	}
	return &Logger{
		store:      s,
		privateKey: priv,
		publicKey:  pub,
		sessionSeq:  make(map[string]int),
		prevHash:   make(map[string]string),
	}, nil
}

// PublicKeyHex returns the hex-encoded Ed25519 public key for offline signature verification.
func (l *Logger) PublicKeyHex() string {
	return hex.EncodeToString(l.publicKey)
}

// Log appends a new signed entry to the session's audit chain.
func (l *Logger) Log(_ context.Context, sessionID, action string, data map[string]any) (*AuditEntry, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.sessionSeq[sessionID]++
	seq := l.sessionSeq[sessionID]

	prev, ok := l.prevHash[sessionID]
	if !ok {
		prev = strings.Repeat("0", 64)
	}

	content := fmt.Sprintf("%s:%s:%d:%v:%s", sessionID, action, seq, data, prev)
	h := sha256.New()
	h.Write([]byte(content))
	entryHash := hex.EncodeToString(h.Sum(nil))

	sig := ed25519.Sign(l.privateKey, []byte(entryHash))
	entry := AuditEntry{
		ID:        fmt.Sprintf("audit-%d", time.Now().UnixNano()),
		SessionID: sessionID,
		SeqNum:    seq,
		Action:    action,
		Data:      data,
		EntryHash: entryHash,
		PrevHash:  prev,
		Signature: hex.EncodeToString(sig),
		CreatedAt: time.Now(),
	}

	if err := l.store.Set(sessionID, entry.ID, entry); err != nil {
		return nil, err
	}
	l.prevHash[sessionID] = entryHash
	return &entry, nil
}

// GetBySession returns all audit entries for a session, ordered by sequence number.
func (l *Logger) GetBySession(sessionID string) []AuditEntry {
	l.mu.Lock()
	defer l.mu.Unlock()

	all := l.store.GetAll(sessionID)
	entries := make([]AuditEntry, 0, len(all))
	for _, e := range all {
		entries = append(entries, e)
	}
	// Sort by sequence number
	for i := 0; i < len(entries); i++ {
		for j := i + 1; j < len(entries); j++ {
			if entries[j].SeqNum < entries[i].SeqNum {
				entries[i], entries[j] = entries[j], entries[i]
			}
		}
	}
	return entries
}
