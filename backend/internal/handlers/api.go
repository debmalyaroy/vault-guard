package handlers

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jung-kurt/gofpdf"

	"github.com/vaultguard/backend/internal/agent"
	"github.com/vaultguard/backend/internal/attack"
	"github.com/vaultguard/backend/internal/audit"
	"github.com/vaultguard/backend/internal/bedrock"
	"github.com/vaultguard/backend/internal/blast"
	"github.com/vaultguard/backend/internal/guardian"
	"github.com/vaultguard/backend/internal/ledger"
	"github.com/vaultguard/backend/internal/policy"
	"github.com/vaultguard/backend/internal/session"
	ws "github.com/vaultguard/backend/internal/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// AppContext holds all shared services injected into handlers.
type AppContext struct {
	Hub             *ws.Hub
	SessionMgr      *session.Manager
	Corpus          *ledger.Corpus
	Audit           *audit.Logger
	GuardianRail    *guardian.GuardianRail
	AgentRunner     *agent.Runner
	BlastEngine     *blast.Engine
	CampaignRunner  *attack.Runner
	LLM             bedrock.LLMClient
}

// ── Session ─────────────────────────────────────────────────────────────────

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

// ── Corpus ───────────────────────────────────────────────────────────────────

func GetCorpusStats(app *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		stats := app.Corpus.GetStats(c.Request.Context())
		c.JSON(200, stats)
	}
}

func GetCorpusTimeseries(app *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		hours := 24
		results := app.Corpus.GetTimeseries(c.Request.Context(), hours)
		c.JSON(200, results)
	}
}

// ── Audit ────────────────────────────────────────────────────────────────────

func GetAuditLog(app *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Param("sessionID")
		entries := app.Audit.GetBySession(sessionID)
		c.JSON(200, gin.H{
			"session_id":  sessionID,
			"public_key":  app.Audit.PublicKeyHex(),
			"entry_count": len(entries),
			"entries":     entries,
		})
	}
}

func ExportAuditLog(app *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Param("sessionID")
		format := c.Query("format")
		entries := app.Audit.GetBySession(sessionID)

		switch format {
		case "csv":
			exportCSV(c, sessionID, entries)
		case "pdf":
			exportPDF(c, sessionID, app.Audit.PublicKeyHex(), entries)
		default:
			c.JSON(400, gin.H{"error": "format must be csv or pdf"})
		}
	}
}

func exportCSV(c *gin.Context, sessionID string, entries []audit.AuditEntry) {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{"seq", "id", "action", "entry_hash", "prev_hash", "signature", "created_at"})
	for _, e := range entries {
		_ = w.Write([]string{
			fmt.Sprintf("%d", e.SeqNum),
			e.ID,
			e.Action,
			e.EntryHash,
			e.PrevHash,
			e.Signature,
			e.CreatedAt.Format(time.RFC3339),
		})
	}
	w.Flush()

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=audit-%s.csv", sessionID[:8]))
	c.Data(200, "text/csv", buf.Bytes())
}

func exportPDF(c *gin.Context, sessionID, pubKey string, entries []audit.AuditEntry) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetFont("Arial", "B", 14)

	// Cover page
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 22)
	pdf.Cell(0, 12, "VaultGuard Audit Report")
	pdf.Ln(14)
	pdf.SetFont("Arial", "", 11)
	pdf.Cell(0, 8, fmt.Sprintf("Session ID: %s", sessionID))
	pdf.Ln(8)
	pdf.Cell(0, 8, fmt.Sprintf("Generated: %s", time.Now().Format("2006-01-02 15:04:05 UTC")))
	pdf.Ln(8)
	pdf.Cell(0, 8, fmt.Sprintf("Total entries: %d", len(entries)))
	pdf.Ln(14)

	pdf.SetFont("Arial", "B", 11)
	pdf.Cell(0, 8, "Ed25519 Public Key (for offline signature verification):")
	pdf.Ln(8)
	pdf.SetFont("Courier", "", 8)
	pdf.MultiCell(0, 5, pubKey, "", "", false)
	pdf.Ln(10)

	// Audit chain table
	pdf.SetFont("Arial", "B", 11)
	pdf.Cell(0, 8, "Audit Chain")
	pdf.Ln(10)

	colWidths := []float64{10, 50, 35, 40, 45}
	headers := []string{"#", "Action", "Entry Hash", "Signature", "Timestamp"}
	pdf.SetFont("Arial", "B", 8)
	for i, h := range headers {
		pdf.CellFormat(colWidths[i], 7, h, "1", 0, "C", false, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Courier", "", 7)
	for _, e := range entries {
		hashShort := e.EntryHash
		if len(hashShort) > 16 {
			hashShort = hashShort[:16] + "..."
		}
		sigShort := e.Signature
		if len(sigShort) > 20 {
			sigShort = sigShort[:20] + "..."
		}
		row := []string{
			fmt.Sprintf("%d", e.SeqNum),
			e.Action,
			hashShort,
			sigShort,
			e.CreatedAt.Format("01-02 15:04:05"),
		}
		for i, cell := range row {
			pdf.CellFormat(colWidths[i], 6, cell, "1", 0, "", false, 0, "")
		}
		pdf.Ln(-1)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		c.JSON(500, gin.H{"error": "pdf generation failed"})
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=audit-%s.pdf", sessionID[:8]))
	c.Data(200, "application/pdf", buf.Bytes())
}

// ── Blast Radius ──────────────────────────────────────────────────────────────

func GetBlastRadius(app *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Param("sessionID")
		result, ok := app.BlastEngine.GetLatest(sessionID)
		if !ok {
			c.JSON(404, gin.H{"error": "no blast radius data for this session"})
			return
		}
		c.JSON(200, result)
	}
}

func GetBlastHistory(app *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Param("sessionID")
		results := app.BlastEngine.GetHistory(sessionID)
		c.JSON(200, gin.H{"session_id": sessionID, "results": results})
	}
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

func ListCampaigns(_ *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		campaigns := attack.AllCampaigns()
		// Strip payloads from list response — only return metadata
		type campaignSummary struct {
			ID          string `json:"id"`
			OWASPCode   string `json:"owasp_code"`
			Name        string `json:"name"`
			Description string `json:"description"`
			Category    string `json:"category"`
			RiskLevel   string `json:"risk_level"`
			StepCount   int    `json:"step_count"`
		}
		summaries := make([]campaignSummary, 0, len(campaigns))
		for _, cam := range campaigns {
			summaries = append(summaries, campaignSummary{
				ID:          cam.ID,
				OWASPCode:   cam.OWASPCode,
				Name:        cam.Name,
				Description: cam.Description,
				Category:    cam.Category,
				RiskLevel:   cam.RiskLevel,
				StepCount:   len(cam.Payloads),
			})
		}
		c.JSON(200, summaries)
	}
}

func GetCampaign(_ *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		cam, ok := attack.GetCampaign(id)
		if !ok {
			c.JSON(404, gin.H{"error": "campaign not found"})
			return
		}
		c.JSON(200, cam)
	}
}

func RunCampaign(app *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		campaignID := c.Param("id")
		sessionID := c.Query("sessionID")
		if sessionID == "" {
			sessionID = uuid.New().String()
			app.SessionMgr.CreateSession(sessionID, uuid.New().String())
		}

		sess, ok := app.SessionMgr.GetSession(sessionID)
		if !ok {
			sess, _ = app.SessionMgr.CreateSession(sessionID, uuid.New().String())
		}
		pol := policy.PreloadedPolicies[sess.ActivePolicy]

		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()
			app.CampaignRunner.Run(ctx, sessionID, campaignID, pol)
		}()

		c.JSON(202, gin.H{
			"status":      "started",
			"session_id":  sessionID,
			"campaign_id": campaignID,
			"message":     "Campaign running — connect to WebSocket to stream results",
		})
	}
}

// ── Custom Threat Builder ─────────────────────────────────────────────────────

type CustomThreatRequest struct {
	Payload        string `json:"payload" binding:"required"`
	AttackType     string `json:"attack_type"`
	Sophistication string `json:"sophistication"`
	SessionID      string `json:"session_id"`
	SaveToCorpus   bool   `json:"save_to_corpus"`
}

type CustomThreatResponse struct {
	Decision      string             `json:"decision"`
	ThreatType    string             `json:"threat_type"`
	Confidence    float64            `json:"confidence"`
	StageCaught   int                `json:"stage_caught"`
	CorpusStatus  string             `json:"corpus_status"`
	BlastRadius   *blast.BlastResult `json:"blast_radius,omitempty"`
	Variants      []string           `json:"variants,omitempty"`
}

func AnalyzeCustomThreat(app *AppContext) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CustomThreatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		sessionID := req.SessionID
		if sessionID == "" {
			sessionID = uuid.New().String()
			app.SessionMgr.CreateSession(sessionID, uuid.New().String())
		}

		sess, ok := app.SessionMgr.GetSession(sessionID)
		if !ok {
			sess, _ = app.SessionMgr.CreateSession(sessionID, uuid.New().String())
		}
		pol := policy.PreloadedPolicies[sess.ActivePolicy]

		agentCtx := guardian.AgentContext{
			SessionID:      sessionID,
			PolicyManifest: pol,
			NextAction:     policy.AgentAction{URL: "https://demo.target", Method: "GET"},
		}

		result := app.GuardianRail.Process(c.Request.Context(), req.Payload, agentCtx)

		sophistication := req.Sophistication
		if sophistication == "" {
			sophistication = "medium"
		}
		attackType := result.ThreatType
		if attackType == "none" || attackType == "" {
			attackType = req.AttackType
		}

		blastResult, _ := app.BlastEngine.Calculate(c.Request.Context(), sessionID, attackType, sophistication)

		// Generate variants using LLM if the payload is adversarial
		var variants []string
		if result.Decision != "ALLOW" {
			resp, err := app.LLM.Converse(c.Request.Context(), bedrock.GetPolicyModel(),
				"SYSTEM: VARIANT GENERATOR — produce 5 attack variants",
				req.Payload)
			if err == nil {
				var v struct {
					Variants []string `json:"variants"`
				}
				if json.Unmarshal([]byte(resp), &v) == nil {
					variants = v.Variants
				}
			}
		}

		// Optionally persist to corpus
		if req.SaveToCorpus && result.ThreatType != "none" {
			emb, _ := app.LLM.Embed(c.Request.Context(), req.Payload)
			app.Corpus.AddPattern(c.Request.Context(), ledger.ThreatPattern{
				PayloadHash:    fmt.Sprintf("%x", []byte(req.Payload)[:8]),
				AttackType:     result.ThreatType,
				Sophistication: sophistication,
				Confidence:     result.Confidence,
				Embedding:      emb,
				SessionID:      sessionID,
				IsNovel:        true,
			})
		}

		app.Audit.Log(c.Request.Context(), sessionID, "custom_threat_analysis", map[string]any{
			"decision":     result.Decision,
			"threat_type":  result.ThreatType,
			"stage_caught": result.StageCaught,
		})

		c.JSON(200, CustomThreatResponse{
			Decision:     result.Decision,
			ThreatType:   result.ThreatType,
			Confidence:   result.Confidence,
			StageCaught:  result.StageCaught,
			CorpusStatus: result.CorpusStatus,
			BlastRadius:  blastResult,
			Variants:     variants,
		})
	}
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

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
		app.Hub.Register(client)
		go writePump(client, conn, app.Hub)
		go readPump(client, conn, app)
	}
}

func writePump(c *ws.Client, conn *websocket.Conn, hub *ws.Hub) {
	defer func() {
		hub.Unregister(c)
		conn.Close()
	}()
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

// Command is a WebSocket command sent from the frontend.
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
		target, _ := cmd.Payload["target"].(string)
		payloadText := "dummy payload"
		if text, ok := cmd.Payload["custom_text"].(string); ok && text != "" {
			payloadText = text
		}

		sess, ok := app.SessionMgr.GetSession(sessionID)
		if !ok {
			sess, _ = app.SessionMgr.CreateSession(sessionID, "auto-token")
		}
		pol := policy.PreloadedPolicies["research_assistant"] // safe default
		if sess != nil {
			if p, exists := policy.PreloadedPolicies[sess.ActivePolicy]; exists {
				pol = p
			}
		}

		if target == "UNPROTECTED" || target == "BOTH" {
			go app.AgentRunner.RunAgent(ctx, sessionID, "agent_a", "http://target", payloadText, false, pol)
		}
		if target == "PROTECTED" || target == "BOTH" {
			go app.AgentRunner.RunAgent(ctx, sessionID, "agent_b", "http://target", payloadText, true, pol)
		}

		// Run blast radius in background
		go func() {
			attackType, _ := cmd.Payload["attack_type"].(string)
			sophistication, _ := cmd.Payload["sophistication"].(string)
			if sophistication == "" {
				sophistication = "medium"
			}
			br, err := app.BlastEngine.Calculate(ctx, sessionID, attackType, sophistication)
			if err == nil {
				app.Hub.SendToSession(sessionID, ws.Event{
					Type:    "blast_update",
					Payload: br,
				})
			}
		}()

		atkType, _ := cmd.Payload["attack_type"].(string)
		app.Corpus.RecordEvent(ctx, atkType, "pending")
		app.Audit.Log(ctx, sessionID, "fire_attack", map[string]any{"target": target})

	case "change_policy":
		newPol, _ := cmd.Payload["policy_id"].(string)
		app.SessionMgr.UpdatePolicy(sessionID, newPol)
		app.Audit.Log(ctx, sessionID, "change_policy", map[string]any{"new_policy": newPol})
	}
}
