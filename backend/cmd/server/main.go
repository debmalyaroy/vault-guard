package main

import (
	"context"
	"log"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"

	"github.com/vaultguard/backend/internal/agent"
	"github.com/vaultguard/backend/internal/attack"
	"github.com/vaultguard/backend/internal/audit"
	"github.com/vaultguard/backend/internal/bedrock"
	"github.com/vaultguard/backend/internal/blast"
	"github.com/vaultguard/backend/internal/guardian"
	"github.com/vaultguard/backend/internal/handlers"
	"github.com/vaultguard/backend/internal/ledger"
	"github.com/vaultguard/backend/internal/middleware"
	"github.com/vaultguard/backend/internal/session"
	"github.com/vaultguard/backend/internal/store"
	"github.com/vaultguard/backend/internal/websocket"
)

func main() {
	// Configure structured logging to stdout for Docker/CloudWatch compatibility
	log.SetFlags(log.Ldate | log.Ltime | log.Lmsgprefix)

	// Data directory: respects DATA_DIR env var for container volume mounts
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		cwd, _ := os.Getwd()
		dataDir = filepath.Join(cwd, "data")
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Fatalf("[STARTUP] Cannot create data directory %s: %v", dataDir, err)
	}
	log.Printf("[STARTUP] Data directory: %s", dataDir)

	// ── Storage ──────────────────────────────────────────────────────────────
	db, err := store.OpenDB(filepath.Join(dataDir, "vaultguard.db"))
	if err != nil {
		log.Fatalf("Failed to open BoltDB: %v", err)
	}
	defer db.Close()

	// ── Core services ────────────────────────────────────────────────────────
	sessMgr, err := session.NewManager(db)
	if err != nil {
		log.Fatalf("Session manager: %v", err)
	}

	corpus, err := ledger.NewCorpus(db)
	if err != nil {
		log.Fatalf("Corpus: %v", err)
	}

	auditLogger, err := audit.NewLogger(db)
	if err != nil {
		log.Fatalf("Audit logger: %v", err)
	}

	blastEngine, err := blast.NewEngine(db)
	if err != nil {
		log.Fatalf("Blast engine: %v", err)
	}

	// ── LLM client ───────────────────────────────────────────────────────────
	// Use AWS Bedrock when credentials are available; fall back to mock for offline demos.
	var llm bedrock.LLMClient
	useMock := os.Getenv("USE_MOCK_BEDROCK")
	if useMock == "true" || useMock == "1" {
		log.Println("Using mock Bedrock client (offline mode)")
		llm = bedrock.NewMockClient()
	} else {
		realClient, err := bedrock.NewAWSBedrockClient(context.Background())
		if err != nil {
			log.Printf("AWS Bedrock unavailable (%v) — falling back to mock client", err)
			llm = bedrock.NewMockClient()
		} else {
			log.Println("Using AWS Bedrock client")
			log.Printf("  Classifier:  %s", bedrock.GetClassifierModel())
			log.Printf("  Reasoning:   %s", bedrock.GetReasoningModel())
			log.Printf("  Policy:      %s", bedrock.GetPolicyModel())
			log.Printf("  Embeddings:  %s", bedrock.GetEmbedModel())
			llm = realClient
		}
	}

	// ── Seed corpus ──────────────────────────────────────────────────────────
	// Seeds 540+ threat patterns on first run (or when corpus drops below 100).
	if err := ledger.SeedIfNeeded(context.Background(), corpus, llm, 100); err != nil {
		log.Printf("Warning: corpus seeding failed: %v", err)
	}

	// ── Pipeline & runners ───────────────────────────────────────────────────
	guard := guardian.New(corpus, llm)
	hub := websocket.NewHub()
	go hub.Run()

	agentRunner := agent.NewRunner(hub, guard)

	campaignRunner, err := attack.NewRunner(db, guard, blastEngine, hub)
	if err != nil {
		log.Fatalf("Campaign runner: %v", err)
	}

	appCtx := &handlers.AppContext{
		Hub:            hub,
		SessionMgr:     sessMgr,
		Corpus:         corpus,
		Audit:          auditLogger,
		GuardianRail:   guard,
		AgentRunner:    agentRunner,
		BlastEngine:    blastEngine,
		CampaignRunner: campaignRunner,
		LLM:            llm,
	}

	// ── Rate limiter ─────────────────────────────────────────────────────────
	limiter := middleware.NewRateLimiter()

	// ── Router ───────────────────────────────────────────────────────────────
	router := gin.Default()

	// CORS
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
		// Sessions
		api.POST("/session", limiter.SessionLimit(), handlers.CreateSession(appCtx))

		// Corpus
		api.GET("/corpus/stats", handlers.GetCorpusStats(appCtx))
		api.GET("/corpus/timeseries", handlers.GetCorpusTimeseries(appCtx))

		// Audit
		api.GET("/audit/:sessionID", handlers.GetAuditLog(appCtx))
		api.GET("/audit/:sessionID/export", limiter.ExportLimit(), handlers.ExportAuditLog(appCtx))

		// Blast radius
		api.GET("/blast/:sessionID", handlers.GetBlastRadius(appCtx))
		api.GET("/blast/:sessionID/history", handlers.GetBlastHistory(appCtx))

		// Campaigns
		api.GET("/campaigns", handlers.ListCampaigns(appCtx))
		api.GET("/campaigns/:id", handlers.GetCampaign(appCtx))
		api.POST("/campaigns/:id/run", limiter.AttackLimit(), handlers.RunCampaign(appCtx))

		// Custom threat builder
		api.POST("/threats/custom", limiter.AttackLimit(), handlers.AnalyzeCustomThreat(appCtx))
	}

	// WebSocket
	router.GET("/ws/:sessionID", handlers.WsHandler(appCtx))

	// Health
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":        "ok",
			"corpus_size":   corpus.Count(),
			"mock_mode":     useMock == "true" || useMock == "1",
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("VaultGuard Server starting on :%s (corpus: %d patterns)", port, corpus.Count())
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
