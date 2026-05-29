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

type Logger struct {
	store      *store.Store[AuditEntry]
	privateKey ed25519.PrivateKey
	publicKey  ed25519.PublicKey
	mu         sync.Mutex
	sessionSeq map[string]int
	prevHash   map[string]string
}

func NewLogger(filePath string) (*Logger, error) {
	s, err := store.NewStore[AuditEntry](filePath)
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
		sessionSeq: make(map[string]int),
		prevHash:   make(map[string]string),
	}, nil
}

func sha256Hex(s string) string {
	h := sha256.New()
	h.Write([]byte(s))
	return hex.EncodeToString(h.Sum(nil))
}

func (l *Logger) Log(ctx context.Context, sessionID, action string, data map[string]any) (*AuditEntry, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.sessionSeq[sessionID]++
	seq := l.sessionSeq[sessionID]

	prev, ok := l.prevHash[sessionID]
	if !ok {
		prev = strings.Repeat("0", 64)
	}

	content := fmt.Sprintf("%s:%s:%d:%v:%s", sessionID, action, seq, data, prev)
	entryHash := sha256Hex(content + prev)

	sig := ed25519.Sign(l.privateKey, []byte(entryHash))
	signature := hex.EncodeToString(sig)

	entry := AuditEntry{
		ID:        fmt.Sprintf("audit-%d", time.Now().UnixNano()),
		SessionID: sessionID,
		SeqNum:    seq,
		Action:    action,
		Data:      data,
		EntryHash: entryHash,
		PrevHash:  prev,
		Signature: signature,
		CreatedAt: time.Now(),
	}

	if err := l.store.Set(entry.ID, entry); err != nil {
		return nil, err
	}

	l.prevHash[sessionID] = entryHash
	return &entry, nil
}
