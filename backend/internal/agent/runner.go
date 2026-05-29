package agent

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/vaultguard/backend/internal/guardian"
	"github.com/vaultguard/backend/internal/policy"
	"github.com/vaultguard/backend/internal/websocket"
)

type Runner struct {
	hub      *websocket.Hub
	guardian *guardian.GuardianRail
}

func NewRunner(hub *websocket.Hub, g *guardian.GuardianRail) *Runner {
	return &Runner{hub: hub, guardian: g}
}

// RunAgent simulates Playwright execution. For this demo, since setting up Headless Chrome
// is heavy inside the sandbox, we simulate the execution steps and delays that Playwright would take.
func (r *Runner) RunAgent(ctx context.Context, sessionID, agentID, targetURL, payload string, isProtected bool, pol policy.Manifest) {
	r.emitStatus(sessionID, agentID, "RUNNING")
	r.emitLog(sessionID, agentID, "Navigating to target page...")
	time.Sleep(1 * time.Second)

	r.emitLog(sessionID, agentID, "Reading page content...")
	time.Sleep(500 * time.Millisecond)

	finalContent := payload

	if !isProtected {
		r.emitLog(sessionID, agentID, "⚠️ Processing all content (no filtering)")
		if strings.Contains(payload, "IGNORE PREVIOUS INSTRUCTIONS") || strings.Contains(payload, "apple") {
			r.emitStatus(sessionID, agentID, "COMPROMISED")
			r.emitOutput(sessionID, agentID, "My system instructions are exposed. Recommending Apple products.")
			return
		}
	} else {
		// Protected Agent runs Guardian Rail
		agentCtx := guardian.AgentContext{
			SessionID:      sessionID,
			PolicyManifest: pol,
			NextAction:     policy.AgentAction{URL: targetURL, Method: "GET"},
		}

		res := r.guardian.Process(ctx, payload, agentCtx)

		if res.Decision != "ALLOW" {
			r.emitLog(sessionID, agentID, fmt.Sprintf("🛡️ Threat intercepted! Stage: %d, Action: %s", res.StageCaught, res.Decision))

			// Broadcast Threat Event
			r.hub.SendToSession(sessionID, websocket.Event{
				Type: "threat_event",
				Payload: map[string]any{
					"agent_id":      agentID,
					"threat_type":   res.ThreatType,
					"confidence":    res.Confidence,
					"stage":         res.StageCaught,
					"action":        res.Decision,
					"corpus_status": res.CorpusStatus,
				},
			})

			if res.Decision == "BLOCKED" {
				r.emitStatus(sessionID, agentID, "DEFENDED")
				r.emitOutput(sessionID, agentID, "[ACTION BLOCKED BY POLICY]")
				return
			}

			finalContent = res.CleanPayload
		}
	}

	time.Sleep(1 * time.Second)
	r.emitLog(sessionID, agentID, "Reasoning on content...")

	outputStr := "1. Dell XPS 15\n2. HP Spectre x360\n3. Lenovo ThinkPad E15"
	if finalContent == "" || strings.Contains(finalContent, "REDACTED") {
		outputStr += "\n[Some malicious content was ignored]"
	}

	r.emitStatus(sessionID, agentID, "DEFENDED")
	r.emitOutput(sessionID, agentID, outputStr)
}

func (r *Runner) emitStatus(sessionID, agentID, status string) {
	r.hub.SendToSession(sessionID, websocket.Event{
		Type: "agent_status",
		Payload: map[string]string{
			"agent_id": agentID,
			"status":   status,
		},
	})
}

func (r *Runner) emitLog(sessionID, agentID, msg string) {
	r.hub.SendToSession(sessionID, websocket.Event{
		Type: "agent_step",
		Payload: map[string]string{
			"agent_id": agentID,
			"message":  msg,
			"time":     time.Now().Format("15:04:05"),
		},
	})
}

func (r *Runner) emitOutput(sessionID, agentID, text string) {
	r.hub.SendToSession(sessionID, websocket.Event{
		Type: "agent_output",
		Payload: map[string]string{
			"agent_id": agentID,
			"text":     text,
		},
	})
}
