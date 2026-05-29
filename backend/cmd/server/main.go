package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"

	"github.com/vaultguard/backend/internal/agent"
	"github.com/vaultguard/backend/internal/audit"
	"github.com/vaultguard/backend/internal/bedrock"
	"github.com/vaultguard/backend/internal/guardian"
	"github.com/vaultguard/backend/internal/handlers"
	"github.com/vaultguard/backend/internal/ledger"
	"github.com/vaultguard/backend/internal/session"
	"github.com/vaultguard/backend/internal/websocket"
)

func main() {
	cwd, _ := os.Getwd()
	dataDir := filepath.Join(cwd, "data")

	// Initialize Stores
	sessMgr, _ := session.NewManager(filepath.Join(dataDir, "sessions.json"))
	corpus, _ := ledger.NewCorpus(filepath.Join(dataDir, "corpus.json"))
	auditLogger, _ := audit.NewLogger(filepath.Join(dataDir, "audit.json"))

	// Mock LLM
	llm := bedrock.NewMockClient()

	// Core Services
	guard := guardian.New(corpus, llm)
	hub := websocket.NewHub()
	agentRunner := agent.NewRunner(hub, guard)

	appCtx := &handlers.AppContext{
		Hub:          hub,
		SessionMgr:   sessMgr,
		Corpus:       corpus,
		Audit:        auditLogger,
		GuardianRail: guard,
		AgentRunner:  agentRunner,
	}

	// CORS Middleware
	router := gin.Default()
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	api := router.Group("/api")
	{
		api.POST("/session", handlers.CreateSession(appCtx))
		api.GET("/corpus/stats", handlers.GetCorpusStats(appCtx))
		api.GET("/audit/:sessionID", handlers.GetAuditLog(appCtx))
	}

	router.GET("/ws/:sessionID", handlers.WsHandler(appCtx))

	router.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })

	log.Println("VaultGuard Server starting on :8080...")
	if err := router.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
