import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../lib/WebSocketContext';
import { Activity, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface FirehoseEvent {
  id: number;
  type: string;
  timestamp: string;
  payload: unknown;
}

const MAX_EVENTS = 100;

const EVENT_COLORS: Record<string, string> = {
  threat_event: 'text-red-400 border-red-900',
  agent_status: 'text-green-400 border-green-900',
  blast_update: 'text-orange-400 border-orange-900',
  campaign_progress: 'text-blue-400 border-blue-900',
  campaign_complete: 'text-purple-400 border-purple-900',
};

function eventColor(type: string): string {
  return EVENT_COLORS[type] ?? 'text-green-700 border-green-950';
}

export default function EventFirehose() {
  const { lastMessage } = useWebSocket();
  const [events, setEvents] = useState<FirehoseEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const counterRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lastMessage) return;
    const ev: FirehoseEvent = {
      id: ++counterRef.current,
      type: lastMessage.type,
      timestamp: new Date().toISOString(),
      payload: lastMessage.payload,
    };
    setEvents(prev => [ev, ...prev].slice(0, MAX_EVENTS));
  }, [lastMessage]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events, open]);

  return (
    <div className="border-t border-green-900 bg-zinc-950 font-mono shrink-0">
      {/* Toggle bar */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-green-700 hover:text-green-400 hover:bg-green-900/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity size={12} className={events.length > 0 ? 'text-green-500 animate-pulse' : ''} />
          <span className="uppercase tracking-widest">WS Event Firehose</span>
          {events.length > 0 && (
            <span className="border border-green-900 px-1.5 py-0.5 text-green-600" style={{ fontSize: 9 }}>
              {events.length}/{MAX_EVENTS}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {events.length > 0 && open && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); setEvents([]); setExpanded(null); }}
              onKeyDown={e => e.key === 'Enter' && setEvents([])}
              className="flex items-center gap-1 border border-green-900 px-2 py-0.5 text-green-800 hover:text-red-400 hover:border-red-800 transition-colors cursor-pointer"
            >
              <Trash2 size={10} />
              <span>CLEAR</span>
            </span>
          )}
          {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </div>
      </button>

      {/* Event list */}
      {open && (
        <div ref={listRef} className="max-h-48 overflow-y-auto border-t border-green-950">
          {events.length === 0 ? (
            <div className="text-xs text-green-900 text-center py-4">No events yet — fire an attack to see live events</div>
          ) : (
            events.map(ev => (
              <div key={ev.id} className={`border-b border-green-950 ${eventColor(ev.type).split(' ')[1]}`}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-1 text-left hover:bg-green-900/10 transition-colors"
                  onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}
                >
                  <span className={`text-xs font-bold font-mono w-32 shrink-0 ${eventColor(ev.type).split(' ')[0]}`}>
                    {ev.type}
                  </span>
                  <span className="text-xs text-green-800 shrink-0">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-xs text-green-900 truncate flex-1">
                    {JSON.stringify(ev.payload).slice(0, 80)}…
                  </span>
                  <span className="text-green-900 text-xs">{expanded === ev.id ? '▴' : '▾'}</span>
                </button>
                {expanded === ev.id && (
                  <div className="px-4 pb-2">
                    <pre className="text-green-600 text-xs overflow-x-auto whitespace-pre-wrap break-all bg-black p-2 border border-green-950" style={{ fontSize: 9 }}>
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
