package bedrock

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"
)

// LLMClient abstracts the underlying LLM provider.
type LLMClient interface {
	Converse(ctx context.Context, modelID, systemPrompt, userMessage string) (string, error)
	Embed(ctx context.Context, text string) ([]float32, error)
}

// AWSBedrockClient implements LLMClient using AWS Bedrock.
type AWSBedrockClient struct {
	runtime *bedrockruntime.Client
}

// NewAWSBedrockClient creates a new Bedrock client using the default credential chain.
func NewAWSBedrockClient(ctx context.Context) (*AWSBedrockClient, error) {
	region := os.Getenv("AWS_REGION")
	if region == "" {
		region = "us-east-1"
	}
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, err
	}
	return &AWSBedrockClient{runtime: bedrockruntime.NewFromConfig(cfg)}, nil
}

// Converse sends a conversational request to any Bedrock Converse-compatible model.
func (c *AWSBedrockClient) Converse(ctx context.Context, modelID, systemPrompt, userMessage string) (string, error) {
	input := &bedrockruntime.ConverseInput{
		ModelId: aws.String(modelID),
		System: []types.SystemContentBlock{
			&types.SystemContentBlockMemberText{Value: systemPrompt},
		},
		Messages: []types.Message{
			{
				Role: types.ConversationRoleUser,
				Content: []types.ContentBlock{
					&types.ContentBlockMemberText{Value: userMessage},
				},
			},
		},
	}
	output, err := c.runtime.Converse(ctx, input)
	if err != nil {
		return "", fmt.Errorf("bedrock converse (%s): %w", modelID, err)
	}
	if msg, ok := output.Output.(*types.ConverseOutputMemberMessage); ok {
		for _, block := range msg.Value.Content {
			if text, ok := block.(*types.ContentBlockMemberText); ok {
				return text.Value, nil
			}
		}
	}
	return "", fmt.Errorf("no text content in response from %s", modelID)
}

// titanEmbedRequest is the request body for Amazon Titan Embed Text v2.
type titanEmbedRequest struct {
	InputText  string `json:"inputText"`
	Dimensions int    `json:"dimensions"`
	Normalize  bool   `json:"normalize"`
}

type titanEmbedResponse struct {
	Embedding           []float32 `json:"embedding"`
	InputTextTokenCount int       `json:"inputTextTokenCount"`
}

// Embed generates a 1024-dimension embedding via Amazon Titan Embed Text v2.
func (c *AWSBedrockClient) Embed(ctx context.Context, text string) ([]float32, error) {
	body, err := json.Marshal(titanEmbedRequest{
		InputText:  text,
		Dimensions: 1024,
		Normalize:  true,
	})
	if err != nil {
		return nil, err
	}
	resp, err := c.runtime.InvokeModel(ctx, &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(GetEmbedModel()),
		Body:        body,
		ContentType: aws.String("application/json"),
		Accept:      aws.String("application/json"),
	})
	if err != nil {
		return nil, fmt.Errorf("titan embed: %w", err)
	}
	var result titanEmbedResponse
	if err := json.NewDecoder(bytes.NewReader(resp.Body)).Decode(&result); err != nil {
		return nil, fmt.Errorf("titan embed decode: %w", err)
	}
	return result.Embedding, nil
}

// Model ID accessors — all default to non-Anthropic models.

// GetClassifierModel returns the model for high-volume Stage 3 injection classification.
// Default: Amazon Nova Lite — fast and cost-effective ($0.06/$0.24 per 1M tokens).
func GetClassifierModel() string {
	if m := os.Getenv("BEDROCK_CLASSIFIER_MODEL"); m != "" {
		return m
	}
	return "amazon.nova-lite-v1:0"
}

// GetReasoningModel returns the model for Stage 5 goal-drift detection.
// Default: Meta Llama 3.3 70B — strong reasoning, open-weight.
func GetReasoningModel() string {
	if m := os.Getenv("BEDROCK_REASONING_MODEL"); m != "" {
		return m
	}
	return "meta.llama3-3-70b-instruct-v1:0"
}

// GetPolicyModel returns the model for policy compilation and attack payload generation.
// Default: Amazon Nova Pro — capable model for low-volume complex tasks.
func GetPolicyModel() string {
	if m := os.Getenv("BEDROCK_POLICY_MODEL"); m != "" {
		return m
	}
	return "amazon.nova-pro-v1:0"
}

// GetEmbedModel returns the embedding model used for corpus vector similarity.
// Default: Amazon Titan Embed Text v2 — 1024 dimensions, normalized.
func GetEmbedModel() string {
	if m := os.Getenv("BEDROCK_EMBED_MODEL"); m != "" {
		return m
	}
	return "amazon.titan-embed-text-v2:0"
}
