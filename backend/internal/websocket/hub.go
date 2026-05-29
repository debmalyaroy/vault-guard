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
			h.mu.RLock()
			for _, client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client.SessionID)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) SendToSession(sessionID string, event Event) {
	h.mu.RLock()
	client, ok := h.clients[sessionID]
	h.mu.RUnlock()

	if ok {
		data, _ := json.Marshal(event)
		client.Send <- data
	}
}

func (h *Hub) Broadcast(event Event) {
	data, _ := json.Marshal(event)
	h.broadcast <- data
}
