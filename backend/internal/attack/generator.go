package attack

import (
	"context"

	"github.com/vaultguard/backend/internal/bedrock"
)

type Generator struct {
	llm bedrock.LLMClient
}

func NewGenerator(llm bedrock.LLMClient) *Generator {
	return &Generator{llm: llm}
}

func (g *Generator) GeneratePayload(ctx context.Context, intent string) (string, error) {
	prompt := "SYSTEM: YOU ARE A SECURITY PAYLOAD GENERATOR. Output HTML injection based on user intent."
	return g.llm.Converse(ctx, bedrock.GetReasoningModel(), prompt, intent)
}
