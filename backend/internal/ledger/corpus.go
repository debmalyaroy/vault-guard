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

// ThreatPattern is the full in-memory representation of a corpus entry.
type ThreatPattern struct {
	ID             string    `json:"id"`
	PayloadHash    string    `json:"payload_hash"`
	AttackType     string    `json:"attack_type"`
	OWASPCategory  string    `json:"owasp_category"`
	MITREId        string    `json:"mitre_id"`
	Description    string    `json:"description"`
	Sophistication string    `json:"sophistication"`
	Confidence     float64   `json:"confidence"`
	Embedding      []float32 `json:"embedding,omitempty"`
	SessionID      string    `json:"session_id"`
	IsNovel        bool      `json:"is_novel"`
	SeenCount      int       `json:"seen_count"`
	CreatedAt      time.Time `json:"created_at"`
}

// threatMeta is persisted in BoltDB (without the embedding blob).
type threatMeta struct {
	ID             string    `json:"id"`
	PayloadHash    string    `json:"payload_hash"`
	AttackType     string    `json:"attack_type"`
	OWASPCategory  string    `json:"owasp_category"`
	MITREId        string    `json:"mitre_id"`
	Description    string    `json:"description"`
	Sophistication string    `json:"sophistication"`
	Confidence     float64   `json:"confidence"`
	SessionID      string    `json:"session_id"`
	IsNovel        bool      `json:"is_novel"`
	SeenCount      int       `json:"seen_count"`
	CreatedAt      time.Time `json:"created_at"`
}

// TimeseriesBucket holds attack counts for a time window.
type TimeseriesBucket struct {
	Hour      string         `json:"hour"`
	Total     int            `json:"total"`
	ByType    map[string]int `json:"by_type"`
	Blocked   int            `json:"blocked"`
	Allowed   int            `json:"allowed"`
	Suspicious int           `json:"suspicious"`
}

// CorpusMatch is returned when a similarity search finds a known pattern.
type CorpusMatch struct {
	ID             string  `json:"id"`
	AttackType     string  `json:"attack_type"`
	OWASPCategory  string  `json:"owasp_category"`
	Sophistication string  `json:"sophistication"`
	Confidence     float64 `json:"confidence"`
	Similarity     float64 `json:"similarity"`
}

// CorpusStats is returned by GET /api/corpus/stats.
type CorpusStats struct {
	Total      int `json:"total"`
	SessionNew int `json:"session_new"`
	HourNew    int `json:"hour_new"`
}

// Corpus manages the shared threat intelligence database.
type Corpus struct {
	meta       *store.BoltStore[threatMeta]
	embeddings *store.EmbeddingStore
	timeseries *store.BoltStore[TimeseriesBucket]
	mu         sync.RWMutex
}

// NewCorpus opens the BoltDB-backed corpus using the provided DB handle.
func NewCorpus(db *store.DB) (*Corpus, error) {
	meta, err := store.NewBoltStore[threatMeta](db, "corpus_meta")
	if err != nil {
		return nil, fmt.Errorf("corpus meta store: %w", err)
	}
	embs, err := store.NewEmbeddingStore(db, "corpus_embeddings")
	if err != nil {
		return nil, fmt.Errorf("corpus embedding store: %w", err)
	}
	ts, err := store.NewBoltStore[TimeseriesBucket](db, "corpus_timeseries")
	if err != nil {
		return nil, fmt.Errorf("corpus timeseries store: %w", err)
	}
	return &Corpus{meta: meta, embeddings: embs, timeseries: ts}, nil
}

// CosineSimilarity computes the cosine similarity between two equal-length vectors.
func CosineSimilarity(a, b []float32) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot, normA, normB float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
		normA += float64(a[i]) * float64(a[i])
		normB += float64(b[i]) * float64(b[i])
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (math.Sqrt(normA) * math.Sqrt(normB))
}

// SimilarityCheck performs an in-memory cosine scan across all corpus embeddings.
// This replaces pgvector — scales to tens of thousands of patterns on modest hardware.
func (c *Corpus) SimilarityCheck(_ context.Context, embedding []float32) ([]CorpusMatch, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	allEmbs := c.embeddings.GetAll()
	allMeta := c.meta.GetAll()

	var matches []CorpusMatch
	for id, emb := range allEmbs {
		sim := CosineSimilarity(embedding, emb)
		if sim > 0.75 {
			if m, ok := allMeta[id]; ok {
				matches = append(matches, CorpusMatch{
					ID:             id,
					AttackType:     m.AttackType,
					OWASPCategory:  m.OWASPCategory,
					Sophistication: m.Sophistication,
					Confidence:     m.Confidence,
					Similarity:     sim,
				})
			}
		}
	}

	sort.Slice(matches, func(i, j int) bool {
		return matches[i].Similarity > matches[j].Similarity
	})
	if len(matches) > 5 {
		matches = matches[:5]
	}
	return matches, nil
}

// AddPattern stores a new threat pattern (metadata + binary embedding) atomically.
func (c *Corpus) AddPattern(_ context.Context, pattern ThreatPattern) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	all := c.meta.GetAll()
	for id, p := range all {
		if p.PayloadHash == pattern.PayloadHash {
			p.SeenCount++
			return c.meta.Set(id, p)
		}
	}

	if pattern.ID == "" {
		pattern.ID = fmt.Sprintf("pat-%d", time.Now().UnixNano())
	}
	pattern.CreatedAt = time.Now()
	pattern.SeenCount = 1

	m := threatMeta{
		ID:             pattern.ID,
		PayloadHash:    pattern.PayloadHash,
		AttackType:     pattern.AttackType,
		OWASPCategory:  pattern.OWASPCategory,
		MITREId:        pattern.MITREId,
		Description:    pattern.Description,
		Sophistication: pattern.Sophistication,
		Confidence:     pattern.Confidence,
		SessionID:      pattern.SessionID,
		IsNovel:        pattern.IsNovel,
		SeenCount:      pattern.SeenCount,
		CreatedAt:      pattern.CreatedAt,
	}
	if err := c.meta.Set(pattern.ID, m); err != nil {
		return err
	}
	if len(pattern.Embedding) > 0 {
		if err := c.embeddings.Put(pattern.ID, pattern.Embedding); err != nil {
			return err
		}
	}
	return nil
}

// BulkAddPatterns inserts many patterns in two BoltDB transactions (one for meta, one for embeddings).
// This is ~100x faster than calling AddPattern in a loop due to eliminated transaction overhead.
func (c *Corpus) BulkAddPatterns(_ context.Context, patterns []ThreatPattern) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Build a set of existing payload hashes to skip duplicates
	existing := c.meta.GetAll()
	existingHashes := make(map[string]bool, len(existing))
	for _, m := range existing {
		existingHashes[m.PayloadHash] = true
	}

	metaBatch := make(map[string]threatMeta, len(patterns))
	embBatch := make(map[string][]float32, len(patterns))

	now := time.Now()
	for i, p := range patterns {
		if existingHashes[p.PayloadHash] {
			continue
		}
		if p.ID == "" {
			p.ID = fmt.Sprintf("pat-%d-%d", now.UnixNano(), i)
		}
		metaBatch[p.ID] = threatMeta{
			ID:             p.ID,
			PayloadHash:    p.PayloadHash,
			AttackType:     p.AttackType,
			OWASPCategory:  p.OWASPCategory,
			MITREId:        p.MITREId,
			Description:    p.Description,
			Sophistication: p.Sophistication,
			Confidence:     p.Confidence,
			SessionID:      p.SessionID,
			IsNovel:        p.IsNovel,
			SeenCount:      1,
			CreatedAt:      now.Add(-time.Duration(i) * time.Second),
		}
		if len(p.Embedding) > 0 {
			embBatch[p.ID] = p.Embedding
		}
		existingHashes[p.PayloadHash] = true // prevent intra-batch duplicates
	}

	if len(metaBatch) == 0 {
		return nil
	}
	if err := c.meta.BatchSet(metaBatch); err != nil {
		return fmt.Errorf("bulk meta write: %w", err)
	}
	if len(embBatch) > 0 {
		if err := c.embeddings.BatchPut(embBatch); err != nil {
			return fmt.Errorf("bulk embedding write: %w", err)
		}
	}
	return nil
}

// Count returns the total number of patterns in the corpus.
func (c *Corpus) Count() int {
	return c.meta.Count()
}

// GetAll returns all patterns with their embeddings re-attached.
func (c *Corpus) GetAll() []ThreatPattern {
	c.mu.RLock()
	defer c.mu.RUnlock()

	metas := c.meta.GetAll()
	result := make([]ThreatPattern, 0, len(metas))
	for id, m := range metas {
		p := ThreatPattern{
			ID:             m.ID,
			PayloadHash:    m.PayloadHash,
			AttackType:     m.AttackType,
			OWASPCategory:  m.OWASPCategory,
			MITREId:        m.MITREId,
			Description:    m.Description,
			Sophistication: m.Sophistication,
			Confidence:     m.Confidence,
			SessionID:      m.SessionID,
			IsNovel:        m.IsNovel,
			SeenCount:      m.SeenCount,
			CreatedAt:      m.CreatedAt,
		}
		if emb, ok := c.embeddings.Get(id); ok {
			p.Embedding = emb
		}
		result = append(result, p)
	}
	return result
}

// GetStats returns aggregate corpus statistics.
func (c *Corpus) GetStats(_ context.Context) CorpusStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	all := c.meta.GetAll()
	hourAgo := time.Now().Add(-time.Hour)
	hourNew := 0
	for _, p := range all {
		if p.CreatedAt.After(hourAgo) {
			hourNew++
		}
	}
	return CorpusStats{
		Total:   len(all),
		HourNew: hourNew,
	}
}

// GetTimeseries returns hourly bucketed attack counts for the past N hours.
func (c *Corpus) GetTimeseries(_ context.Context, hours int) []TimeseriesBucket {
	c.mu.RLock()
	defer c.mu.RUnlock()

	all := c.meta.GetAll()
	buckets := make(map[string]*TimeseriesBucket)

	for _, p := range all {
		key := p.CreatedAt.Format("2006-01-02T15")
		b, ok := buckets[key]
		if !ok {
			b = &TimeseriesBucket{
				Hour:   key,
				ByType: make(map[string]int),
			}
			buckets[key] = b
		}
		b.Total++
		b.ByType[p.AttackType]++
	}

	now := time.Now()
	result := make([]TimeseriesBucket, 0, hours)
	for i := hours - 1; i >= 0; i-- {
		key := now.Add(time.Duration(-i) * time.Hour).Format("2006-01-02T15")
		if b, ok := buckets[key]; ok {
			result = append(result, *b)
		} else {
			result = append(result, TimeseriesBucket{Hour: key, ByType: make(map[string]int)})
		}
	}
	return result
}

// RecordEvent updates the timeseries bucket for the current hour.
func (c *Corpus) RecordEvent(_ context.Context, attackType, outcome string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	key := time.Now().Format("2006-01-02T15")
	b, ok := c.timeseries.Get(key)
	if !ok {
		b = TimeseriesBucket{Hour: key, ByType: make(map[string]int)}
	}
	b.Total++
	b.ByType[attackType]++
	switch outcome {
	case "blocked":
		b.Blocked++
	case "suspicious":
		b.Suspicious++
	default:
		b.Allowed++
	}
	_ = c.timeseries.Set(key, b)
}
