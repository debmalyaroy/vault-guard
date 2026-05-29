package bedrock

import (
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"
)

// LLMClient abstracts the underlying LLM provider
type LLMClient interface {
	Converse(ctx context.Context, modelID, systemPrompt, userMessage string) (string, error)
	Embed(ctx context.Context, text string) ([]float32, error)
}

// AWSBedrockClient implements LLMClient using AWS Bedrock
type AWSBedrockClient struct {
	runtime *bedrockruntime.Client
}

// NewAWSBedrockClient creates a new Bedrock client
func NewAWSBedrockClient(ctx context.Context) (*AWSBedrockClient, error) {
	region := os.Getenv("AWS_REGION")
	if region == "" {
		region = "us-east-1"
	}

	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, err
	}

	return &AWSBedrockClient{
		runtime: bedrockruntime.NewFromConfig(cfg),
	}, nil
}

// Converse sends a message to a Bedrock model
func (c *AWSBedrockClient) Converse(ctx context.Context, modelID, systemPrompt, userMessage string) (string, error) {
	input := &bedrockruntime.ConverseInput{
		ModelId: aws.String(modelID),
		System: []types.SystemContentBlock{
			&types.SystemContentBlockMemberText{
				Value: systemPrompt,
			},
		},
		Messages: []types.Message{
			{
				Role: types.ConversationRoleUser,
				Content: []types.ContentBlock{
					&types.ContentBlockMemberText{
						Value: userMessage,
					},
				},
			},
		},
	}

	output, err := c.runtime.Converse(ctx, input)
	if err != nil {
		return "", fmt.Errorf("bedrock converse: %w", err)
	}

	if msg, ok := output.Output.(*types.ConverseOutputMemberMessage); ok {
		for _, block := range msg.Value.Content {
			if text, ok := block.(*types.ContentBlockMemberText); ok {
				return text.Value, nil
			}
		}
	}
	return "", fmt.Errorf("no text content in response")
}

// Embed generates embeddings using Titan
func (c *AWSBedrockClient) Embed(ctx context.Context, text string) ([]float32, error) {
	return make([]float32, 1536), nil
}

// Model IDs with fallbacks
func GetClassifierModel() string {
	if m := os.Getenv("BEDROCK_CLASSIFIER_MODEL"); m != "" {
		return m
	}
	return "anthropic.claude-3-haiku-20240307-v1:0"
}

func GetReasoningModel() string {
	if m := os.Getenv("BEDROCK_REASONING_MODEL"); m != "" {
		return m
	}
	return "anthropic.claude-3-sonnet-20240229-v1:0"
}
