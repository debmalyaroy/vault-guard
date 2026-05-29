package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// Store provides thread-safe access to a generic disk-backed JSON file
type Store[T any] struct {
	mu       sync.RWMutex
	filePath string
	Data     map[string]T
}

// NewStore initializes a new Store and loads existing data from disk
func NewStore[T any](filePath string) (*Store[T], error) {
	// Ensure directory exists
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory: %w", err)
	}

	s := &Store[T]{
		filePath: filePath,
		Data:     make(map[string]T),
	}

	if err := s.load(); err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("failed to load initial data: %w", err)
	}

	return s, nil
}

// load reads data from disk into memory
func (s *Store[T]) load() error {
	file, err := os.Open(s.filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	return json.NewDecoder(file).Decode(&s.Data)
}

// save writes memory data to disk
func (s *Store[T]) save() error {
	file, err := os.Create(s.filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(s.Data)
}

// Get returns an item by ID
func (s *Store[T]) Get(id string) (T, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	val, ok := s.Data[id]
	return val, ok
}

// GetAll returns all items
func (s *Store[T]) GetAll() map[string]T {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Return a copy to avoid external modification
	copy := make(map[string]T, len(s.Data))
	for k, v := range s.Data {
		copy[k] = v
	}
	return copy
}

// Set adds or updates an item and persists to disk
func (s *Store[T]) Set(id string, item T) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Data[id] = item
	return s.save()
}

// Delete removes an item and persists to disk
func (s *Store[T]) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.Data, id)
	return s.save()
}
