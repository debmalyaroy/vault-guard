import { useState, useRef, useEffect } from 'react';
import { Shield, ShieldAlert, Send, Trash2, AlertCircle, CheckCircle, Bot } from 'lucide-react';
import { PipelineTracePanel, type PipelineTrace } from './PipelineTracePanel';

const API_BASE = 'http://localhost:8080';

const AVAILABLE_TOOLS = [
  { id: 'file_system',    label: 'File System' },
  { id: 'database',       label: 'Database' },
  { id: 'external_api',   label: 'External API' },
  { id: 'shell',          label: 'Shell' },
  { id: 'email',          label: 'Email' },
  { id: 'payment',        label: 'Payment Gateway' },
  { id: 'credentials',    label: 'Credential Store' },
  { id: 'web_browser',    label: 'Web Browser' },
];

interface CustomAgent {
  id: string;
  session_id: string;
  name: string;
  system_prompt: string;
  tools: string[];
  created_at: string;
}

interface CustomInteraction {
  id: string;
  agent_id: string;
  message: string;
  blocked: boolean;
  screened_input: string;
  agent_response?: string;
  trace?: PipelineTrace;
  blast_result?: any;
  audit_id: string;
  created_at: string;
}

function BlastBadge({ score }: { score?: number }) {
  if (score == null) return null;
  const color = score >= 70 ? 'text-red-400 border-red-800'
    : score >= 40 ? 'text-yellow-400 border-yellow-800'
    : 'text-green-500 border-green-800';
  return (
    <span className={`text-xs font-mono border px-1 ${color}`}>
      BLAST {score}
    </span>
  );
}

export default function AgentSandbox({ sessionId }: { sessionId?: string }) {
  // Registration state
  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Interaction state
  const [agent, setAgent] = useState<CustomAgent | null>(null);
  const [interactions, setInteractions] = useState<CustomInteraction[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTrace, setActiveTrace] = useState<PipelineTrace | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [interactions]);

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev =>
      prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]
    );
  };

  const register = async () => {
    if (!name.trim() || !systemPrompt.trim()) return;
    setRegistering(true);
    setRegError(null);
    try {
      const res = await fetch(`${API_BASE}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId ?? '',
          name: name.trim(),
          system_prompt: systemPrompt.trim(),
          tools: selectedTools,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CustomAgent = await res.json();
      setAgent(data);
    } catch (err: any) {
      setRegError(err.message ?? 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const sendMessage = async () => {
    if (!agent || !message.trim() || sending) return;
    const msg = message.trim();
    setMessage('');
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/agents/${agent.id}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CustomInteraction = await res.json();
      setInteractions(prev => [...prev, data]);
      if (data.trace) setActiveTrace(data.trace);
    } catch (err: any) {
      // Show inline error as a pseudo-interaction
      setInteractions(prev => [...prev, {
        id: Date.now().toString(),
        agent_id: agent.id,
        message: msg,
        blocked: true,
        screened_input: '',
        audit_id: '',
        created_at: new Date().toISOString(),
        agent_response: `[Error: ${err.message}]`,
      }]);
    } finally {
      setSending(false);
    }
  };

  const resetAgent = () => {
    setAgent(null);
    setInteractions([]);
    setActiveTrace(null);
    setName('');
    setSystemPrompt('');
    setSelectedTools([]);
  };

  // ── Registration Panel ────────────────────────────────────────────────────
  if (!agent) {
    return (
      <div className="h-full flex items-start justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-2xl space-y-5 font-mono">
          <div className="border border-green-700 p-4 bg-zinc-950">
            <div className="text-xs text-green-600 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Bot size={14} />
              Register Your Agent
            </div>
            <p className="text-xs text-green-800 mb-4">
              Describe your agent with a system prompt. VaultGuard will wrap it — every input
              is screened through GuardianRail before reaching your agent.
            </p>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs text-green-600 uppercase tracking-widest mb-1">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Research Assistant"
                  className="w-full bg-black border border-green-700 px-3 py-2 text-green-300 text-sm focus:outline-none focus:border-green-500 font-mono"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-xs text-green-600 uppercase tracking-widest mb-1">
                  System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  rows={5}
                  placeholder="You are a helpful research assistant with access to financial data. Answer questions about market trends..."
                  className="w-full bg-black border border-green-700 px-3 py-2 text-green-300 text-sm focus:outline-none focus:border-green-500 font-mono resize-none"
                />
              </div>

              {/* Tool Access */}
              <div>
                <label className="block text-xs text-green-600 uppercase tracking-widest mb-2">
                  Declare Tool Access <span className="text-green-900 normal-case">(used for blast radius calculation)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_TOOLS.map(tool => (
                    <label
                      key={tool.id}
                      className={`flex items-center gap-2 border px-3 py-2 cursor-pointer text-xs transition-colors ${
                        selectedTools.includes(tool.id)
                          ? 'border-green-600 bg-green-900/20 text-green-400'
                          : 'border-green-900 text-green-700 hover:border-green-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTools.includes(tool.id)}
                        onChange={() => toggleTool(tool.id)}
                        className="accent-green-500"
                      />
                      {tool.label}
                    </label>
                  ))}
                </div>
              </div>

              {regError && (
                <div className="flex items-center gap-2 text-red-400 text-xs border border-red-800 px-3 py-2">
                  <AlertCircle size={12} />
                  {regError}
                </div>
              )}

              <button
                onClick={register}
                disabled={registering || !name.trim() || !systemPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 border border-green-500 py-2.5 text-green-400 hover:bg-green-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-bold"
              >
                <Shield size={14} />
                {registering ? 'REGISTERING...' : 'REGISTER AGENT'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Interaction Panel ─────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden font-mono">
      {/* Agent header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-green-900 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-3">
          <Shield size={14} className="text-green-500" />
          <span className="text-sm text-green-400 font-bold">{agent.name}</span>
          <span className="text-xs text-green-800 border border-green-900 px-1.5 py-0.5">
            Protected by VaultGuard
          </span>
        </div>
        <button
          onClick={resetAgent}
          className="flex items-center gap-1 text-xs text-green-800 hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} />
          Reset
        </button>
      </div>

      {/* Split view */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Chat */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-green-900">
          <div className="px-3 py-1.5 border-b border-green-950 shrink-0">
            <span className="text-xs text-green-800 uppercase tracking-widest">Conversation</span>
          </div>

          {/* Message list */}
          <div ref={chatRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {interactions.length === 0 && (
              <div className="text-xs text-green-900 italic">
                Send a message to your agent. Malicious inputs will be blocked before reaching it.
              </div>
            )}
            {interactions.map(ix => (
              <div key={ix.id} className="space-y-1.5">
                {/* User message */}
                <div className="flex items-start gap-2">
                  <span className="text-green-700 text-xs shrink-0">YOU</span>
                  <span className="text-green-300 text-xs border border-green-900 bg-zinc-950 px-2 py-1 flex-1">
                    {ix.message}
                  </span>
                </div>

                {/* VaultGuard response */}
                {ix.blocked ? (
                  <div className="flex items-start gap-2 ml-4">
                    <ShieldAlert size={12} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="text-red-400 font-bold">VaultGuard: Input blocked</span>
                      {ix.trace && (
                        <span className="text-red-800 ml-2">
                          at Stage {ix.trace.stages.find(s => s.caught_here)?.stage_num ?? '?'}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 ml-4">
                    <CheckCircle size={12} className="text-green-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-xs text-green-400 font-bold mb-0.5">{agent.name}</div>
                      <div className="text-xs text-green-300 border border-green-900 bg-zinc-950 px-2 py-1 whitespace-pre-wrap">
                        {ix.agent_response ?? '...'}
                      </div>
                      {ix.blast_result && (
                        <div className="mt-1">
                          <BlastBadge score={ix.blast_result.score} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Click to view trace button */}
                {ix.trace && (
                  <button
                    onClick={() => setActiveTrace(ix.trace ?? null)}
                    className="ml-4 text-xs text-green-800 hover:text-green-600 transition-colors"
                  >
                    {activeTrace === ix.trace ? '▾ trace shown' : '▸ view trace'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-green-900 p-3 flex gap-2">
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Message your agent..."
              className="flex-1 bg-black border border-green-700 px-3 py-2 text-green-300 text-xs focus:outline-none focus:border-green-500 font-mono"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !message.trim()}
              className="flex items-center gap-1 border border-green-500 px-3 py-2 text-green-400 text-xs hover:bg-green-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={12} />
              {sending ? '...' : 'SEND'}
            </button>
          </div>
        </div>

        {/* Right: Pipeline Trace */}
        <div className="w-[45%] flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 border-b border-green-950 shrink-0">
            <span className="text-xs text-green-800 uppercase tracking-widest">VaultGuard Trace</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {activeTrace ? (
              <PipelineTracePanel trace={activeTrace} />
            ) : (
              <div className="text-xs text-green-900 italic mt-4">
                Send a message to see the pipeline trace here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
