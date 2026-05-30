import { useEffect, useState, useCallback } from 'react';
import AttackConsole from './components/AttackConsole';
import AgentArena from './components/AgentArena';
import VaultGuardShield from './components/VaultGuardShield';
import BlastRadiusGraph from './components/BlastRadiusGraph';
import CorpusAnalytics from './components/CorpusAnalytics';
import ThreatBuilder from './components/ThreatBuilder';
import CampaignMode from './components/CampaignMode';
import AuditTrail from './components/AuditTrail';
import AgentSandbox from './components/AgentSandbox';
import EventFirehose from './components/EventFirehose';
import { useWebSocket } from './lib/WebSocketContext';
import { decodeState, updateState } from './lib/urlState';
import { Shield, Sun, Moon, Share2, Check } from 'lucide-react';

const API_BASE = 'http://localhost:8080';

type TabId = 'playground' | 'threats' | 'campaigns' | 'blast' | 'analytics' | 'audit' | 'sandbox';

const TABS: { id: TabId; label: string; path: string }[] = [
  { id: 'playground', label: 'Playground', path: '/usr/bin/attacker' },
  { id: 'threats', label: 'Threat Builder', path: '/usr/bin/threat-builder' },
  { id: 'campaigns', label: 'Campaigns', path: '/var/lib/campaigns' },
  { id: 'blast', label: 'Blast Radius', path: '/var/log/blast' },
  { id: 'analytics', label: 'Analytics', path: '/var/log/corpus' },
  { id: 'audit', label: 'Audit Trail', path: '/etc/vaultguard/audit' },
  { id: 'sandbox', label: 'Agent Sandbox', path: '/opt/vaultguard/sandbox' },
];

function App() {
  const { isConnected, lastMessage } = useWebSocket();

  // Read initial state from URL hash
  const initialState = decodeState();
  const [activeTab, setActiveTab] = useState<TabId>(
    (initialState.tab as TabId) ?? 'playground'
  );
  const [sessionId, setSessionId] = useState<string | undefined>(initialState.sessionId);
  const [corpusTotal, setCorpusTotal] = useState<number>(0);
  const [isLightMode, setIsLightMode] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch session ID on mount
  useEffect(() => {
    if (sessionId) return; // already have one from URL
    const initSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/session`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          const id = data.session_id ?? data.id ?? data.sessionId;
          if (id) {
            setSessionId(id);
            updateState({ sessionId: id });
          }
        }
      } catch {
        // Backend may not have this endpoint; generate a client-side ID as fallback
        const fallback = `vg-${Date.now().toString(36)}`;
        setSessionId(fallback);
        updateState({ sessionId: fallback });
      }
    };
    initSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch corpus stats
  const fetchCorpus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/corpus/stats`);
      if (res.ok) {
        const data = await res.json();
        setCorpusTotal(data.total ?? 0);
      }
    } catch {
      // silently fail; keep whatever value we have
    }
  }, []);

  useEffect(() => {
    fetchCorpus();
  }, [fetchCorpus]);

  // Bump corpus count on new threat events
  useEffect(() => {
    if (lastMessage?.type === 'threat_event' && lastMessage.payload.corpus_status === 'new') {
      setCorpusTotal((prev) => prev + 1);
    }
  }, [lastMessage]);

  // Sync tab changes to URL
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    updateState({ tab });
  };

  const toggleTheme = () => {
    setIsLightMode((v) => !v);
    document.body.classList.toggle('light-theme');
  };

  const handleShare = async () => {
    updateState({ tab: activeTab, sessionId });
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select and copy via prompt
      window.prompt('Copy this URL:', url);
    }
  };

  const currentPath = TABS.find((t) => t.id === activeTab)?.path ?? '';

  return (
    <div className="h-screen flex flex-col overflow-hidden selection:bg-green-900 selection:text-green-100">

      {/* ── Global Header ── */}
      <header className="border-b-2 border-green-500 p-2 flex justify-between items-center bg-zinc-900 z-10 shrink-0">
        <div className="flex items-center space-x-2 font-bold tracking-widest text-lg">
          <Shield className="text-green-500" />
          <span>VAULTGUARD<span className="opacity-50 text-sm ml-2">TERMINAL</span></span>
        </div>

        <div className="flex space-x-3 items-center text-sm">
          {/* Status + corpus */}
          <div className="flex space-x-4 border border-green-900 px-3 py-1 bg-black">
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span>{isConnected ? 'SYS: ONLINE' : 'SYS: OFFLINE'}</span>
            </div>
            <div className="border-l border-green-900 pl-3 text-green-400">
              CORPUS: {corpusTotal > 0 ? corpusTotal.toLocaleString() : '—'} PATTERNS
            </div>
            {sessionId && (
              <div className="border-l border-green-900 pl-3 text-green-700 font-mono text-xs">
                SID: {sessionId.slice(0, 12)}
              </div>
            )}
          </div>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="flex items-center space-x-1 border border-green-900 px-2 py-1 text-xs text-green-600 hover:border-green-600 hover:text-green-400 transition-colors"
            title="Share Demo URL"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Share2 size={13} />}
            <span>{copied ? 'COPIED' : 'SHARE'}</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="border border-green-900 p-1.5 hover:text-green-300 hover:border-green-700 transition-colors"
          >
            {isLightMode ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>
      </header>

      {/* ── Tab Navigation ── */}
      <nav className="border-b border-green-900 bg-zinc-900 px-4 flex space-x-1 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-4 py-2.5 text-xs font-bold font-mono tracking-wider border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-green-500 text-green-300 bg-green-900/30'
                : 'border-transparent text-green-600 hover:text-green-400 hover:border-green-800'
            }`}
          >
            {tab.label.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* ── Path breadcrumb ── */}
      <div className="bg-zinc-950 border-b border-green-950 px-4 py-0.5 shrink-0">
        <span className="text-green-800 font-mono text-xs">{currentPath}</span>
      </div>

      {/* ── Tab Content ── */}
      <main className="flex-1 overflow-hidden">

        {/* ── Playground (original 3-col layout) ── */}
        {activeTab === 'playground' && (
          <div className="h-full flex overflow-hidden p-4 space-x-4">
            <section className="w-1/4 min-w-[300px] flex flex-col">
              <div className="flex-1">
                <AttackConsole />
              </div>
            </section>
            <section className="w-2/4 flex flex-col border-l border-r border-green-900/50 px-4">
              <div className="flex-1 overflow-y-auto pr-2">
                <AgentArena />
              </div>
            </section>
            <section className="w-1/4 min-w-[300px] flex flex-col">
              <div className="flex-1">
                <VaultGuardShield />
              </div>
            </section>
          </div>
        )}

        {/* ── Threat Builder ── */}
        {activeTab === 'threats' && (
          <div className="h-full overflow-y-auto p-4">
            <ThreatBuilder sessionId={sessionId} />
          </div>
        )}

        {/* ── Campaign Mode ── */}
        {activeTab === 'campaigns' && (
          <div className="h-full overflow-hidden p-4">
            <CampaignMode sessionId={sessionId} />
          </div>
        )}

        {/* ── Blast Radius Graph ── */}
        {activeTab === 'blast' && (
          <div className="h-full overflow-hidden p-4">
            <BlastRadiusGraph sessionId={sessionId} />
          </div>
        )}

        {/* ── Corpus Analytics ── */}
        {activeTab === 'analytics' && (
          <div className="h-full overflow-y-auto p-4">
            <CorpusAnalytics />
          </div>
        )}

        {/* ── Audit Trail ── */}
        {activeTab === 'audit' && (
          <div className="h-full overflow-hidden p-4">
            <AuditTrail sessionId={sessionId} />
          </div>
        )}

        {/* ── Agent Sandbox (BYOA) ── */}
        {activeTab === 'sandbox' && (
          <div className="h-full overflow-hidden">
            <AgentSandbox sessionId={sessionId} />
          </div>
        )}

      </main>

      {/* ── WS Event Firehose (pinned to page bottom) ── */}
      <EventFirehose />
    </div>
  );
}

export default App;
