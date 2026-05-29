package ledger

import (
	"context"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/vaultguard/backend/internal/store"
)

type CorpusMatch struct {
	ID             string  `json:"id"`
	AttackType     string  `json:"attack_type"`
	Sophistication string  `json:"sophistication"`
	Confidence     float64 `json:"confidence"`
	Similarity     float64 `json:"similarity"`
}

type ThreatPattern struct {
	ID             string    `json:"id"`
	PayloadHash    string    `json:"payload_hash"`
	AttackType     string    `json:"attack_type"`
	Sophistication string    `json:"sophistication"`
	Confidence     float64   `json:"confidence"`
	Embedding      []float32 `json:"embedding"`
	SessionID      string    `json:"session_id"`
	IsNovel        bool      `json:"is_novel"`
	SeenCount      int       `json:"seen_count"`
	CreatedAt      time.Time `json:"created_at"`
}

type CorpusStats struct {
	Total      int `json:"total"`
	SessionNew int `json:"session_new"`
	HourNew    int `json:"hour_new"`
}

type Corpus struct {
	store *store.Store[ThreatPattern]
	mu    sync.RWMutex
}

func NewCorpus(filePath string) (*Corpus, error) {
	s, err := store.NewStore[ThreatPattern](filePath)
	if err != nil {
		return nil, err
	}
	return &Corpus{store: s}, nil
}

// CosineSimilarity calculates the similarity between two vectors
func CosineSimilarity(a, b []float32) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0.0
	}

	var dotProduct, normA, normB float64
	for i := range a {
		dotProduct += float64(a[i]) * float64(b[i])
		normA += float64(a[i]) * float64(a[i])
		normB += float64(b[i]) * float64(b[i])
	}

	if normA == 0 || normB == 0 {
		return 0.0
	}

	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

// SimilarityCheck simulates pgvector by doing in-memory cosine similarity
func (c *Corpus) SimilarityCheck(ctx context.Context, embedding []float32) ([]CorpusMatch, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var matches []CorpusMatch
	data := c.store.GetAll()

	for _, pattern := range data {
		sim := CosineSimilarity(embedding, pattern.Embedding)
		if sim > 0.85 {
			matches = append(matches, CorpusMatch{
				ID:             pattern.ID,
				AttackType:     pattern.AttackType,
				Sophistication: pattern.Sophistication,
				Confidence:     pattern.Confidence,
				Similarity:     sim,
			})
		}
	}

	// Sort descending by similarity
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].Similarity > matches[j].Similarity
	})

	if len(matches) > 5 {
		matches = matches[:5]
	}

	return matches, nil
}

func (c *Corpus) AddPattern(ctx context.Context, pattern ThreatPattern) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	data := c.store.GetAll()

	// Check if exists by hash
	for id, p := range data {
		if p.PayloadHash == pattern.PayloadHash {
			p.SeenCount++
			return c.store.Set(id, p)
		}
	}

	// Not found, add new
	pattern.ID = fmt.Sprintf("pat-%d", time.Now().UnixNano())
	pattern.CreatedAt = time.Now()
	pattern.SeenCount = 1
	return c.store.Set(pattern.ID, pattern)
}

func (c *Corpus) GetStats(ctx context.Context) CorpusStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	data := c.store.GetAll()
	total := len(data)
	hourNew := 0

	hourAgo := time.Now().Add(-1 * time.Hour)
	for _, p := range data {
		if p.CreatedAt.After(hourAgo) {
			hourNew++
		}
	}

	return CorpusStats{
		Total:      total,
		SessionNew: 0, // Managed at session level
		HourNew:    hourNew,
	}
}
