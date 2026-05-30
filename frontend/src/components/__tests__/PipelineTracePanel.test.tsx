import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineTracePanel, type PipelineTrace } from '../PipelineTracePanel';

const mockTrace: PipelineTrace = {
  stages: [
    { stage_num: 1, stage_name: 'Pattern Match', passed: true, caught_here: false, duration_ms: 0, detail: { matched_patterns: [], pattern_count: 0 } },
    { stage_num: 2, stage_name: 'Corpus Search', passed: true, caught_here: false, duration_ms: 3, detail: { threshold: 0.92, top_similarity: 0.5, matches: [], match_count: 0 } },
    { stage_num: 3, stage_name: 'LLM Classifier', passed: false, caught_here: true, duration_ms: 8, detail: { model_id: 'mock-nova-lite', system_prompt: 'You are a classifier', user_message: 'test payload', raw_response: '{"is_adversarial":true}', is_adversarial: true, attack_type: 'prompt_injection', confidence: 0.97 } },
    { stage_num: 4, stage_name: 'Policy Enforcer', passed: true, caught_here: false, duration_ms: 0, detail: {} },
    { stage_num: 5, stage_name: 'Goal Drift Check', passed: true, caught_here: false, duration_ms: 0, detail: {} },
  ],
  total_ms: 12,
};

const mockTraceAllGreen: PipelineTrace = {
  stages: [
    { stage_num: 1, stage_name: 'Pattern Match', passed: true, caught_here: false, duration_ms: 0, detail: {} },
    { stage_num: 2, stage_name: 'Corpus Search', passed: true, caught_here: false, duration_ms: 2, detail: {} },
    { stage_num: 3, stage_name: 'LLM Classifier', passed: true, caught_here: false, duration_ms: 10, detail: { model_id: 'mock-nova-lite' } },
    { stage_num: 4, stage_name: 'Policy Enforcer', passed: true, caught_here: false, duration_ms: 0, detail: {} },
    { stage_num: 5, stage_name: 'Goal Drift Check', passed: true, caught_here: false, duration_ms: 12, detail: { model_id: 'mock-llama' } },
  ],
  total_ms: 24,
};

describe('PipelineTracePanel', () => {
  it('renders 5 stage rows', () => {
    render(<PipelineTracePanel trace={mockTrace} />);
    expect(screen.getByText(/Pattern Match/i)).toBeInTheDocument();
    expect(screen.getByText(/Corpus Search/i)).toBeInTheDocument();
    expect(screen.getByText(/LLM Classifier/i)).toBeInTheDocument();
    expect(screen.getByText(/Policy Enforcer/i)).toBeInTheDocument();
    expect(screen.getByText(/Goal Drift Check/i)).toBeInTheDocument();
  });

  it('shows total duration', () => {
    render(<PipelineTracePanel trace={mockTrace} />);
    expect(screen.getByText(/12ms/)).toBeInTheDocument();
  });

  it('shows MOCK MODE badge when model_id starts with mock-', () => {
    render(<PipelineTracePanel trace={mockTraceAllGreen} />);
    expect(screen.getByText(/MOCK MODE/i)).toBeInTheDocument();
  });

  it('shows LIVE AWS badge when model_id does not start with mock-', () => {
    const liveTrace: PipelineTrace = {
      ...mockTrace,
      stages: mockTrace.stages.map(s =>
        s.stage_num === 3 ? { ...s, detail: { ...s.detail, model_id: 'amazon.nova-lite-v1:0' } } : s
      ),
    };
    render(<PipelineTracePanel trace={liveTrace} />);
    expect(screen.getByText(/LIVE AWS/i)).toBeInTheDocument();
  });

  it('shows CAUGHT HERE on blocked stage', () => {
    render(<PipelineTracePanel trace={mockTrace} />);
    // The component renders "← CAUGHT HERE" on stage 3
    expect(screen.getByText(/← CAUGHT HERE/i)).toBeInTheDocument();
  });
});
