import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EventFirehose from '../EventFirehose';

// Mock WebSocketContext — no messages by default
vi.mock('../../lib/WebSocketContext', () => ({
  useWebSocket: () => ({ send: vi.fn(), lastMessage: null, isConnected: true }),
}));

describe('EventFirehose', () => {
  it('renders firehose toggle bar', () => {
    render(<EventFirehose />);
    expect(screen.getByText(/WS Event Firehose/i)).toBeInTheDocument();
  });

  it('is collapsed by default — event list not visible', () => {
    render(<EventFirehose />);
    expect(screen.queryByText(/No events yet/i)).not.toBeInTheDocument();
  });

  it('expands and shows empty-state text when clicked', () => {
    render(<EventFirehose />);
    const allButtons = screen.getAllByRole('button');
    // First button is the toggle bar
    fireEvent.click(allButtons[0]);
    expect(screen.getByText(/No events yet/i)).toBeInTheDocument();
  });

  it('shows CLEAR button only when events exist', () => {
    render(<EventFirehose />);
    // No events → CLEAR should not appear
    expect(screen.queryByText('CLEAR')).not.toBeInTheDocument();
  });

  it('collapses when clicked a second time', () => {
    render(<EventFirehose />);
    const allButtons = screen.getAllByRole('button');
    fireEvent.click(allButtons[0]);
    expect(screen.getByText(/No events yet/i)).toBeInTheDocument();
    fireEvent.click(allButtons[0]);
    expect(screen.queryByText(/No events yet/i)).not.toBeInTheDocument();
  });
});
