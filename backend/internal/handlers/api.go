package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/vaultguard/backend/internal/agent"
	"github.com/vaultguard/backend/internal/audit"
	"github.com/vaultguard/backend/internal/guardian"
	"github.com/vaultguard/backend/internal/ledger"
	"github.com/vaultguard/backend/internal/policy"
	"github.com/vaultguard/backend/internal/session"
	ws "github.com/vaultguard/backend/internal/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all for local test
	},
}

type AppContext struct {
	Hub          *ws.Hub
	SessionMgr   *session.Manager
	Corpus       *ledger.Corpus
	Audit        *audit.Logger
	GuardianRail *guardian.GuardianRail
	AgentRunner  *agent.Runner
}

func CreateSession(app *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := uuid.New().String()
		token := uuid.New().String()
		sess, err := app.SessionMgr.CreateSession(id, token)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, sess)
	}
}

func GetCorpusStats(app *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		stats := app.Corpus.GetStats(context.Background())
		c.JSON(200, stats)
	}
}

func GetAuditLog(app *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Mock endpoint for now, would fetch from store
		c.JSON(200, gin.H{"status": "ok"})
	}
}

func WsHandler(app *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Param("sessionID")

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}

		client := &ws.Client{
			SessionID: sessionID,
			Send:      make(chan []byte, 256),
		}

		// Hacky way to register to hub channels since they are private in my mock
		// In a real app we'd expose a Register method. Let's just bypass and start goroutines.

		go writePump(client, conn)
		go readPump(client, conn, app)
	}
}

func writePump(c *ws.Client, conn *websocket.Conn) {
	defer conn.Close()
	for msg := range c.Send {
		if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return
		}
	}
}

func readPump(c *ws.Client, conn *websocket.Conn, app *AppContext) {
	defer conn.Close()
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}
		handleCommand(msg, c.SessionID, app)
	}
}

type Command struct {
	Type    string                 `json:"type"`
	Payload map[string]interface{} `json:"payload"`
}

func handleCommand(msg []byte, sessionID string, app *AppContext) {
	var cmd Command
	if err := json.Unmarshal(msg, &cmd); err != nil {
		return
	}

	ctx := context.Background()

	switch cmd.Type {
	case "fire_attack":
		target := cmd.Payload["target"].(string)
		payloadText := "dummy payload"
		if text, ok := cmd.Payload["custom_text"]; ok {
			payloadText = text.(string)
		}

		sess, ok := app.SessionMgr.GetSession(sessionID)
		if !ok {
			// Auto-create session if it doesn't exist to prevent crash on ad-hoc frontend connects
			sess, _ = app.SessionMgr.CreateSession(sessionID, "dummy-token")
		}
		pol := policy.PreloadedPolicies[sess.ActivePolicy]

		if target == "UNPROTECTED" || target == "BOTH" {
			go app.AgentRunner.RunAgent(ctx, sessionID, "agent_a", "http://target", payloadText, false, pol)
		}
		if target == "PROTECTED" || target == "BOTH" {
			go app.AgentRunner.RunAgent(ctx, sessionID, "agent_b", "http://target", payloadText, true, pol)
		}

		app.Audit.Log(ctx, sessionID, "fire_attack", map[string]any{"target": target})

	case "change_policy":
		newPol := cmd.Payload["policy_id"].(string)
		app.SessionMgr.UpdatePolicy(sessionID, newPol)
		app.Audit.Log(ctx, sessionID, "change_policy", map[string]any{"new_policy": newPol})
	}
}
