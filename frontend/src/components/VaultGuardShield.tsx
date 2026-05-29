import { useEffect, useState } from 'react';
import { useWebSocket } from '../lib/WebSocketContext';
import { Shield, FileText, AlertTriangle } from 'lucide-react';

export default function VaultGuardShield() {
  const { send, lastMessage } = useWebSocket();
  const [activePolicy, setActivePolicy] = useState('research_assistant');
  const [threats, setThreats] = useState<any[]>([]);

  const policies = [
    { id: 'research_assistant', label: 'Research Assistant' },
    { id: 'financial_analyst', label: 'Financial Analyst' },
    { id: 'procurement_bot', label: 'Procurement Bot' },
  ];

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'threat_event') {
      setThreats(prev => [lastMessage.payload, ...prev].slice(0, 10)); // Keep last 10
    }
  }, [lastMessage]);

  const handlePolicyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setActivePolicy(val);
    send('change_policy', { policy_id: val });
  };

  return (
    <div className="flex flex-col h-full space-y-6">

      {/* Active Policy Box */}
      <div className="ascii-box">
        <div className="ascii-title flex items-center space-x-2">
          <Shield size={14} /> <span>ACTIVE POLICY</span>
        </div>
        <div className="mt-2">
          <select
            className="w-full bg-black border border-green-500 p-2 text-sm text-green-400 focus:outline-none"
            value={activePolicy}
            onChange={handlePolicyChange}
          >
            {policies.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Threat Feed Box */}
      <div className="ascii-box flex-1 flex flex-col min-h-0">
        <div className="ascii-title flex items-center space-x-2 text-red-400">
          <AlertTriangle size={14} /> <span>LIVE THREAT FEED</span>
        </div>
        <div className="mt-2 flex-1 overflow-y-auto space-y-3 pr-2">
          {threats.length === 0 ? (
            <div className="text-sm opacity-50 text-center mt-10">No threats detected yet...</div>
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