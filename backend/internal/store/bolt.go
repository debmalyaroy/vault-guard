package store

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"

	bbolt "go.etcd.io/bbolt"
)

// DB wraps a BoltDB instance shared across all stores.
type DB struct {
	bolt *bbolt.DB
}

// OpenDB opens (or creates) the BoltDB file at the given path.
func OpenDB(path string) (*DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return nil, err
	}
	db, err := bbolt.Open(path, 0600, nil)
	if err != nil {
		return nil, fmt.Errorf("open bolt db: %w", err)
	}
	return &DB{bolt: db}, nil
}

// Close closes the underlying BoltDB.
func (d *DB) Close() error {
	return d.bolt.Close()
}

// BoltStore is a generic BoltDB-backed key-value store using JSON encoding.
type BoltStore[T any] struct {
	db     *bbolt.DB
	bucket []byte
}

// NewBoltStore creates a BoltStore backed by the named top-level bucket.
func NewBoltStore[T any](db *DB, bucket string) (*BoltStore[T], error) {
	err := db.bolt.Update(func(tx *bbolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists([]byte(bucket))
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("create bucket %q: %w", bucket, err)
	}
	return &BoltStore[T]{db: db.bolt, bucket: []byte(bucket)}, nil
}

func (s *BoltStore[T]) Get(id string) (T, bool) {
	var result T
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(s.bucket)
		if b == nil {
			return fmt.Errorf("bucket missing")
		}
		v := b.Get([]byte(id))
		if v == nil {
			return fmt.Errorf("not found")
		}
		return json.Unmarshal(v, &result)
	})
	return result, err == nil
}

func (s *BoltStore[T]) GetAll() map[string]T {
	result := make(map[string]T)
	_ = s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(s.bucket)
		if b == nil {
			return nil
		}
		return b.ForEach(func(k, v []byte) error {
			var item T
			if json.Unmarshal(v, &item) == nil {
				result[string(k)] = item
			}
			return nil
		})
	})
	return result
}

func (s *BoltStore[T]) Set(id string, item T) error {
	data, err := json.Marshal(item)
	if err != nil {
		return err
	}
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(s.bucket)
		if b == nil {
			return fmt.Errorf("bucket missing")
		}
		return b.Put([]byte(id), data)
	})
}

// BatchSet writes all items in a single BoltDB transaction. Much faster than
// calling Set() in a loop when inserting many items (e.g., corpus seeding).
func (s *BoltStore[T]) BatchSet(items map[string]T) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(s.bucket)
		if b == nil {
			return fmt.Errorf("bucket missing")
		}
		for id, item := range items {
			data, err := json.Marshal(item)
			if err != nil {
				return err
			}
			if err := b.Put([]byte(id), data); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *BoltStore[T]) Delete(id string) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(s.bucket)
		if b == nil {
			return fmt.Errorf("bucket missing")
		}
		return b.Delete([]byte(id))
	})
}

func (s *BoltStore[T]) Count() int {
	var n int
	_ = s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(s.bucket)
		if b != nil {
			n = b.Stats().KeyN
		}
		return nil
	})
	return n
}

// EmbeddingStore stores float32 vectors as raw little-endian binary blobs.
// This is far more compact than JSON: 1536 floats = 6144 bytes vs ~15KB as JSON text.
type EmbeddingStore struct {
	db     *bbolt.DB
	bucket []byte
}

// NewEmbeddingStore creates an EmbeddingStore backed by the named top-level bucket.
func NewEmbeddingStore(db *DB, bucket string) (*EmbeddingStore, error) {
	err := db.bolt.Update(func(tx *bbolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists([]byte(bucket))
		return err
	})
	if err != nil {
		return nil, fmt.Errorf("create embedding bucket %q: %w", bucket, err)
	}
	return &EmbeddingStore{db: db.bolt, bucket: []byte(bucket)}, nil
}

func (e *EmbeddingStore) Put(id string, emb []float32) error {
	data := float32sToBytes(emb)
	return e.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(e.bucket)
		if b == nil {
			return fmt.Errorf("embedding bucket missing")
		}
		return b.Put([]byte(id), data)
	})
}

func (e *EmbeddingStore) Get(id string) ([]float32, bool) {
	var data []byte
	err := e.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(e.bucket)
		if b == nil {
			return fmt.Errorf("bucket missing")
		}
		v := b.Get([]byte(id))
		if v == nil {
			return fmt.Errorf("not found")
		}
		data = make([]byte, len(v))
		copy(data, v)
		return nil
	})
	if err != nil || len(data)%4 != 0 {
		return nil, false
	}
	return bytesToFloat32s(data), true
}

// GetAll loads all embeddings into memory — used for in-process cosine similarity search.
func (e *EmbeddingStore) GetAll() map[string][]float32 {
	result := make(map[string][]float32)
	_ = e.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(e.bucket)
		if b == nil {
			return nil
		}
		return b.ForEach(func(k, v []byte) error {
			if len(v)%4 == 0 {
				emb := bytesToFloat32s(v)
				result[string(k)] = emb
			}
			return nil
		})
	})
	return result
}

// BatchPut writes all embeddings in a single BoltDB transaction.
func (e *EmbeddingStore) BatchPut(items map[string][]float32) error {
	return e.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(e.bucket)
		if b == nil {
			return fmt.Errorf("embedding bucket missing")
		}
		for id, emb := range items {
			if err := b.Put([]byte(id), float32sToBytes(emb)); err != nil {
				return err
			}
		}
		return nil
	})
}

func (e *EmbeddingStore) Delete(id string) error {
	return e.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(e.bucket)
		if b == nil {
			return nil
		}
		return b.Delete([]byte(id))
	})
}

// NestedStore stores JSON values under a two-level bucket hierarchy: bucket/parentID/childID.
// Used for blast radius graphs, audit entries per session, campaign runs, etc.
type NestedStore[T any] struct {
	db     *bbolt.DB
	bucket []byte
}

// NewNestedStore creates the top-level bucket.
func NewNestedStore[T any](db *DB, bucket string) (*NestedStore[T], error) {
	err := db.bolt.Update(func(tx *bbolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists([]byte(bucket))
		return err
	})
	if err != nil {
		return nil, err
	}
	return &NestedStore[T]{db: db.bolt, bucket: []byte(bucket)}, nil
}

func (n *NestedStore[T]) Set(parentID, childID string, item T) error {
	data, err := json.Marshal(item)
	if err != nil {
		return err
	}
	return n.db.Update(func(tx *bbolt.Tx) error {
		parent, err := tx.Bucket(n.bucket).CreateBucketIfNotExists([]byte(parentID))
		if err != nil {
			return err
		}
		return parent.Put([]byte(childID), data)
	})
}

func (n *NestedStore[T]) Get(parentID, childID string) (T, bool) {
	var result T
	err := n.db.View(func(tx *bbolt.Tx) error {
		top := tx.Bucket(n.bucket)
		if top == nil {
			return fmt.Errorf("missing")
		}
		parent := top.Bucket([]byte(parentID))
		if parent == nil {
			return fmt.Errorf("missing")
		}
		v := parent.Get([]byte(childID))
		if v == nil {
			return fmt.Errorf("missing")
		}
		return json.Unmarshal(v, &result)
	})
	return result, err == nil
}

func (n *NestedStore[T]) GetAll(parentID string) map[string]T {
	result := make(map[string]T)
	_ = n.db.View(func(tx *bbolt.Tx) error {
		top := tx.Bucket(n.bucket)
		if top == nil {
			return nil
		}
		parent := top.Bucket([]byte(parentID))
		if parent == nil {
			return nil
		}
		return parent.ForEach(func(k, v []byte) error {
			var item T
			if json.Unmarshal(v, &item) == nil {
				result[string(k)] = item
			}
			return nil
		})
	})
	return result
}

func (n *NestedStore[T]) GetAllParents() map[string]map[string]T {
	result := make(map[string]map[string]T)
	_ = n.db.View(func(tx *bbolt.Tx) error {
		top := tx.Bucket(n.bucket)
		if top == nil {
			return nil
		}
		return top.ForEach(func(pk, _ []byte) error {
			parent := top.Bucket(pk)
			if parent == nil {
				return nil
			}
			children := make(map[string]T)
			_ = parent.ForEach(func(ck, cv []byte) error {
				var item T
				if json.Unmarshal(cv, &item) == nil {
					children[string(ck)] = item
				}
				return nil
			})
			result[string(pk)] = children
			return nil
		})
	})
	return result
}

// helpers

func float32sToBytes(fs []float32) []byte {
	b := make([]byte, len(fs)*4)
	for i, f := range fs {
		binary.LittleEndian.PutUint32(b[i*4:], math.Float32bits(f))
	}
	return b
}

func bytesToFloat32s(b []byte) []float32 {
	fs := make([]float32, len(b)/4)
	for i := range fs {
		bits := binary.LittleEndian.Uint32(b[i*4:])
		fs[i] = math.Float32frombits(bits)
	}
	return fs
}
