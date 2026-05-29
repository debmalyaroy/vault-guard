package guardian

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"unicode"

	"github.com/vaultguard/backend/internal/bedrock"
	"github.com/vaultguard/backend/internal/ledger"
	"github.com/vaultguard/backend/internal/policy"
)

type AgentContext struct {
	SessionID           string
	PolicyManifest      policy.Manifest
	NextAction          policy.AgentAction
	TaskAnchorEmbedding []float32
}

type PipelineResult struct {
	Decision      string
	CleanPayload  string
	ThreatType    string
	Confidence    float64
	StageCaught   int
	CorpusStatus  string
}

type GuardianRail struct {
	corpus  *ledger.Corpus
	enforcer *policy.Enforcer
	llm     bedrock.LLMClient
}

func New(c *ledger.Corpus, llm bedrock.LLMClient) *GuardianRail {
	return &GuardianRail{
		corpus:  c,
		enforcer: policy.NewEnforcer(),
		llm:     llm,
	}
}

// Stage 1: Invisible Layer Stripping
func stripInvisible(input string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || unicode.Is(unicode.Cf, r) || r == '\u200B' {
			return -1
		}
		return r
	}, input)
}

func (g *GuardianRail) Process(ctx context.Context, payload string, agentCtx AgentContext) PipelineResult {
	// Stage 1
	stripped := stripInvisible(payload)

	// Stage 2: Corpus fast path
	emb, err := g.llm.Embed(ctx, stripped)
	if err == nil {
		matches, _ := g.corpus.SimilarityCheck(ctx, emb)
		// Trigger Stage 2 only if similarity is very high and it's explicitly identified as an existing corpus match in the mock
		if len(matches) > 0 && matches[0].Similarity > 0.92 && matches[0].AttackType != "" && matches[0].Confidence > 0 {
			return PipelineResult{
				Decision:     "REDACTED",
				CleanPayload: "[CONTENT REDACTED BY VAULTGUARD CORPUS]",
				ThreatType:   matches[0].AttackType,
				Confidence:   matches[0].Similarity,
				StageCaught:  2,
				CorpusStatus: "known",
			}
		}
	}

	// Stage 3 & 5 Concurrency
	type S3Result struct {
		IsAdversarial bool    `json:"is_adversarial"`
		AttackType    string  `json:"attack_type"`
		Sophistication string  `json:"sophistication"`
		Confidence    float64 `json:"confidence"`
	}

	type S5Result struct {
		DriftScore float64 `json:"drift_score"`
	}

	var s3 S3Result
	var s5 S5Result
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		resp, _ := g.llm.Converse(ctx, bedrock.GetClassifierModel(), "SYSTEM: YOU ARE A CLASSIFIER", stripped)
		json.Unmarshal([]byte(resp), &s3)
	}()

	go func() {
		defer wg.Done()
		resp, _ := g.llm.Converse(ctx, bedrock.GetReasoningModel(), "SYSTEM: YOU ARE A DRIFT CHECKER", stripped)
		json.Unmarshal([]byte(resp), &s5)
	}()

	wg.Wait()

	// Evaluate S3
	if s3.IsAdversarial && s3.Confidence > 0.7 {
		go g.corpus.AddPattern(context.Background(), ledger.ThreatPattern{
			PayloadHash:    "hash", // simplified
			AttackType:     s3.AttackType,
			Sophistication: s3.Sophistication,
			Confidence:     s3.Confidence,
			Embedding:      emb,
			SessionID:      agentCtx.SessionID,
			IsNovel:        true,
		})
		return PipelineResult{
			Decision:     "REDACTED",
			CleanPayload: "[CONTENT REDACTED BY VAULTGUARD LLM]",
			ThreatType:   s3.AttackType,
			Confidence:   s3.Confidence,
			StageCaught:  3,
			CorpusStatus: "new",
		}
	}

	// Stage 4: Policy Check
	if violation := g.enforcer.Check(agentCtx.PolicyManifest, agentCtx.NextAction); violation != nil {
		return PipelineResult{
			Decision:     "BLOCKED",
			CleanPayload: "",
			ThreatType:   string(violation.ActionType),
			Confidence:   1.0,
			StageCaught:  4,
			CorpusStatus: "none",
		}
	}

	// Stage 5
	if s5.DriftScore > 0.5 {
		return PipelineResult{
			Decision:     "SUSPICIOUS",
			CleanPayload: stripped,
			ThreatType:   "goal_redirect",
			Confidence:   s5.DriftScore,
			StageCaught:  5,
			CorpusStatus: "none",
		}
	}

	return PipelineResult{
		Decision:     "ALLOW",
		CleanPayload: stripped,
		ThreatType:   "none",
		Confidence:   0.0,
		StageCaught:  0,
		CorpusStatus: "none",
	}
}
