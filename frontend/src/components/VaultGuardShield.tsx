import { useEffect, useState } from 'react';
import { useWebSocket } from '../lib/WebSocketContext';
import { Shield, FileText, AlertTriangle, Zap, CheckCircle, XCircle } from 'lucide-react';

const API_BASE = 'http://localhost:8080';

interface ProbePayload {
  text: string;
  decision: string;
  stage_caught: number;
  confidence: number;
}

interface ProbeResult {
  policy_id: string;
  payloads: ProbePayload[];
}

export default function VaultGuardShield() {
  const { send, lastMessage } = useWebSocket();
  const [activePolicy, setActivePolicy] = useState('research_assistant');
  const [threats, setThreats] = useState<any[]>([]);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  const policies = [
    { id: 'research_assistant', label: 'Research Assistant' },
    { id: 'financial_analyst', label: 'Financial Analyst' },
    { id: 'procurement_bot', label: 'Procurement Bot' },
  ];

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'threat_event') {
      setThreats(prev => [lastMessage.payload, ...prev].slice(0, 10));
    }
  }, [lastMessage]);

  const handlePolicyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setActivePolicy(val);
    setProbeResult(null);
    send('change_policy', { policy_id: val });
  };

  const handleProbe = async () => {
    setProbing(true);
    setProbeError(null);
    setProbeResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/policy/${activePolicy}/probe`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ProbeResult = await res.json();
      setProbeResult(data);
    } catch (err: any) {
      setProbeError(err.message ?? 'Probe failed');
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 font-mono text-sm overflow-y-auto">

      {/* Active Policy Box */}
      <div className="ascii-box">
        <div className="ascii-title flex items-center space-x-2">
          <Shield size={14} /> <span>ACTIVE POLICY</span>
        </div>
        <div className="mt-2 space-y-2">
          <select
            className="w-full bg-black border border-green-500 p-2 text-sm text-green-400 focus:outline-none"
            value={activePolicy}
            onChange={handlePolicyChange}
          >
            {policies.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button
            onClick={handleProbe}
            disabled={probing}
            className="w-full flex items-center justify-center gap-2 border border-green-700 py-1.5 text-xs text-green-600 hover:border-green-500 hover:text-green-400 disabled:opacity-40 transition-colors"
          >
            <Zap size={12} />
            {probing ? 'PROBING BOUNDARY…' : 'PROBE POLICY BOUNDARY'}
          </button>
        </div>
      </div>

      {/* Probe Results */}
      {probeError && (
        <div className="border border-red-800 bg-red-950/20 p-2 text-red-400 text-xs">{probeError}</div>
      )}
      {probeResult && (
        <div className="border border-green-800 bg-zinc-950">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-green-900 text-xs text-green-500 uppercase tracking-widest">
            <Zap size={11} />
            Boundary Probe: {probeResult.policy_id}
          </div>
          <div className="overflow-y-auto max-h-52">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="border-b border-green-900 text-green-700">
                  <th className="text-left px-3 py-1.5 font-bold">PAYLOAD</th>
                  <th className="text-left px-3 py-1.5 font-bold">DECISION</th>
                  <th className="text-left px-3 py-1.5 font-bold">STAGE</th>
                  <th className="text-left px-3 py-1.5 font-bold">CONF</th>
                </tr>
              </thead>
              <tbody>
                {probeResult.payloads.map((p, i) => (
                  <tr key={i} className="border-b border-green-950">
                    <td className="px-3 py-1.5 text-green-400 max-w-[180px] truncate" title={p.text}>{p.text}</td>
                    <td className="px-3 py-1.5">
                      <span className={`flex items-center gap-1 font-bold text-xs ${p.decision === 'ALLOW' ? 'text-green-400' : 'text-red-400'}`}>
                        {p.decision === 'ALLOW' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                        {p.decision}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-green-700">{p.stage_caught > 0 ? p.stage_caught : '—'}</td>
                    <td className="px-3 py-1.5 text-green-700">{p.confidence > 0 ? `${(p.confidence * 100).toFixed(0)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Threat Feed Box */}
      <div className="ascii-box flex-1 flex flex-col min-h-0">
        <div className="ascii-title flex items-center space-x-2 text-red-400">
          <AlertTriangle size={14} /> <span>LIVE THREAT FEED</span>
        </div>
        <div className="mt-2 flex-1 overflow-y-auto space-y-3 pr-2">
          {threats.length === 0 ? (
            <div className="text-sm opacity-50 text-center mt-10">No threats detected yet…</div>
          ) : (
            threats.map((t, i) => (
              <div key={i} className="border border-red-900 bg-red-950/20 p-2 text-xs">
                <div className="flex justify-between items-center mb-1 border-b border-red-900 pb-1">
                  <span className="text-red-400 font-bold">{t.action}</span>
                  <span className="opacity-50">Stage {t.stage}</span>
                </div>
                <div><span className="opacity-50">Type:</span> {t.threat_type}</div>
                <div><span className="opacity-50">Conf:</span> {(t.confidence * 100).toFixed(0)}%</div>
                {t.corpus_status === 'new' && (
                  <div className="mt-1 text-yellow-400 animate-pulse">⭐ NEW PATTERN ADDED TO CORPUS</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Audit Log Stub */}
      <div className="ascii-box">
        <div className="ascii-title flex items-center space-x-2">
          <FileText size={14} /> <span>AUDIT LOG</span>
        </div>
        <div className="mt-4 flex justify-between items-center text-sm">
          <span>Chain Integrity: <span className="text-green-400">✓ VERIFIED</span></span>
          <button className="ascii-button text-xs py-1">EXPORT PDF</button>
        </div>
      </div>
    </div>
  );
}
