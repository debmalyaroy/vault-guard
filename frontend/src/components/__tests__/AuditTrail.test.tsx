import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuditTrail from '../AuditTrail';

const mockAuditLog = {
  session_id: 'test-session-123',
  public_key: 'a'.repeat(64),
  entry_count: 2,
  entries: [
    { id: 'audit-1', session_id: 'test-session-123', sequence_num: 1, action: 'fire_attack', data: {}, entry_hash: 'hash1', prev_hash: '0'.repeat(64), signature: 'sig1', created_at: new Date().toISOString() },
    { id: 'audit-2', session_id: 'test-session-123', sequence_num: 2, action: 'custom_threat_analysis', data: { decision: 'BLOCK' }, entry_hash: 'hash2', prev_hash: 'hash1', signature: 'sig2', created_at: new Date().toISOString() },
  ],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockAuditLog,
  }));
});

describe('AuditTrail', () => {
  it('shows no-session message when sessionId is absent', () => {
    render(<AuditTrail />);
    expect(screen.getByText(/NO SESSION ACTIVE/i)).toBeInTheDocument();
  });

  it('loads and renders audit entries', async () => {
    render(<AuditTrail sessionId="test-session-123" />);
    await waitFor(() => {
      expect(screen.getByText('fire_attack')).toBeInTheDocument();
      expect(screen.getByText('custom_threat_analysis')).toBeInTheDocument();
    });
  });

  it('shows CHAIN VERIFIED badge when chain is intact', async () => {
    render(<AuditTrail sessionId="test-session-123" />);
    await waitFor(() => {
      expect(screen.getByText(/CHAIN VERIFIED/i)).toBeInTheDocument();
    });
  });

  it('renders VERIFY ENTRY button', async () => {
    render(<AuditTrail sessionId="test-session-123" />);
    await waitFor(() => {
      expect(screen.getByText(/VERIFY ENTRY/i)).toBeInTheDocument();
    });
  });

  it('opens verify panel on button click', async () => {
    render(<AuditTrail sessionId="test-session-123" />);
    await waitFor(() => screen.getByText(/VERIFY ENTRY/i));
    fireEvent.click(screen.getByText(/VERIFY ENTRY/i));
    await waitFor(() => {
      expect(screen.getByText(/Ed25519 Signature Verifier/i)).toBeInTheDocument();
    });
  });

  it('renders REPLAY button', async () => {
    render(<AuditTrail sessionId="test-session-123" />);
    await waitFor(() => {
      expect(screen.getByText(/REPLAY/i)).toBeInTheDocument();
    });
  });
});
