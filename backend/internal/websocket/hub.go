package websocket

import (
	"sync"
	"encoding/json"
)

type Event struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

type Client struct {
	SessionID string
	Send      chan []byte
}

type Hub struct {
	clients    map[string]*Client
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.SessionID] = client
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.SessionID]; ok {
				delete(h.clients, client.SessionID)
				close(client.Send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			// Collect stale clients under read lock, clean up under write lock
			h.mu.RLock()
			snapshot := make([]*Client, 0, len(h.clients))
			for _, c := range h.clients {
				snapshot = append(snapshot, c)
			}
			h.mu.RUnlock()

			var stale []*Client
			for _, client := range snapshot {
				select {
				case client.Send <- message:
				default:
					stale = append(stale, client)
				}
			}
			if len(stale) > 0 {
				h.mu.Lock()
				for _, client := range stale {
					if _, ok := h.clients[client.SessionID]; ok {
						delete(h.clients, client.SessionID)
						close(client.Send)
					}
				}
				h.mu.Unlock()
			}
		}
	}
}

func (h *Hub) SendToSession(sessionID string, event Event) {
	h.mu.RLock()
	client, ok := h.clients[sessionID]
	h.mu.RUnlock()

	if !ok {
		return
	}
	data, _ := json.Marshal(event)
	// Recover from panic if channel was closed between lookup and send
	defer func() { recover() }() //nolint:errcheck
	select {
	case client.Send <- data:
	default:
	}
}

func (h *Hub) Register(c *Client) {
	h.register <- c
}

func (h *Hub) Unregister(c *Client) {
	h.unregister <- c
}

func (h *Hub) Broadcast(event Event) {
	data, _ := json.Marshal(event)
	h.broadcast <- data
}
