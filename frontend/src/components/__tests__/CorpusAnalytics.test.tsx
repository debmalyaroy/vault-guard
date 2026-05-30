import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CorpusAnalytics from '../CorpusAnalytics';

const mockStats = { total: 512, hour_new: 5, session_new: 2 };
const mockTimeseries = [
  { hour: '2024-01-01T10', total: 12, by_type: { prompt_injection: 8 }, blocked: 10, allowed: 2, suspicious: 0 },
];
const mockPatterns = {
  total: 2,
  query: 'injection',
  patterns: [
    { id: 'pat-1', attack_type: 'prompt_injection', owasp_category: 'OAT-01', mitre_id: 'T1190', description: 'Test pattern', sophistication: 'high', confidence: 0.95, created_at: new Date().toISOString() },
  ],
};
const mockGraph = { nodes: [], edges: [] };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.includes('/corpus/stats')) return Promise.resolve({ ok: true, json: async () => mockStats });
    if (url.includes('/corpus/timeseries')) return Promise.resolve({ ok: true, json: async () => mockTimeseries });
    if (url.includes('/corpus/search')) return Promise.resolve({ ok: true, json: async () => mockPatterns });
    if (url.includes('/corpus/graph')) return Promise.resolve({ ok: true, json: async () => mockGraph });
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }));
});

describe('CorpusAnalytics', () => {
  it('renders stats tab by default', async () => {
    render(<CorpusAnalytics />);
    await waitFor(() => {
      expect(screen.getByText('512')).toBeInTheDocument();
    });
  });

  it('shows Corpus Browser sub-tab button', () => {
    render(<CorpusAnalytics />);
    expect(screen.getByText(/CORPUS BROWSER/i)).toBeInTheDocument();
  });

  it('shows Correlation Graph sub-tab button', () => {
    render(<CorpusAnalytics />);
    expect(screen.getByText(/CORRELATION GRAPH/i)).toBeInTheDocument();
  });

  it('renders search input in Corpus Browser tab', async () => {
    render(<CorpusAnalytics />);
    fireEvent.click(screen.getByText(/CORPUS BROWSER/i));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search by/i)).toBeInTheDocument();
    });
  });

  it('shows search results after searching', async () => {
    render(<CorpusAnalytics />);
    fireEvent.click(screen.getByText(/CORPUS BROWSER/i));
    await waitFor(() => screen.getByPlaceholderText(/Search by/i));
    fireEvent.change(screen.getByPlaceholderText(/Search by/i), { target: { value: 'injection' } });
    fireEvent.click(screen.getByText(/^SEARCH$/i));
    await waitFor(() => {
      expect(screen.getByText(/prompt injection/i)).toBeInTheDocument();
    });
  });

  it('renders threshold slider in Correlation Graph tab', async () => {
    render(<CorpusAnalytics />);
    fireEvent.click(screen.getByText(/CORRELATION GRAPH/i));
    await waitFor(() => {
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });
  });
});
