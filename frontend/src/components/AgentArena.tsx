import { useState, useEffect } from 'react';
import { useWebSocket } from '../lib/WebSocketContext';
import { Shield, ShieldAlert, Activity, CheckSquare, Eye, EyeOff } from 'lucide-react';
import { PipelineTracePanel, type PipelineTrace } from './PipelineTracePanel';

interface AgentState {
  status: string;
  logs: any[];
  output: string;
  lastTrace: PipelineTrace | null;
}

const initAgent = (): AgentState => ({ status: 'IDLE', logs: [], output: '', lastTrace: null });

export default function AgentArena() {
  const { lastMessage } = useWebSocket();
  const [agentA, setAgentA] = useState<AgentState>(initAgent());
  const [agentB, setAgentB] = useState<AgentState>(initAgent());
  const [glassBoxB, setGlassBoxB] = useState(false);

  useEffect(() => {
    if (!lastMessage) return;
    const { type, payload } = lastMessage;

    if (type === 'agent_status') {
      if (payload.agent_id === 'agent_a') setAgentA(s => ({ ...s, status: payload.status }));
      if (payload.agent_id === 'agent_b') setAgentB(s => ({ ...s, status: payload.status }));
    }
    if (type === 'agent_step') {
      if (payload.agent_id === 'agent_a') setAgentA(s => ({ ...s, logs: [...s.logs, payload] }));
      if (payload.agent_id === 'agent_b') setAgentB(s => ({ ...s, logs: [...s.logs, payload] }));
    }
    if (type === 'agent_output') {
      if (payload.agent_id === 'agent_a') setAgentA(s => ({ ...s, output: payload.text }));
      if (payload.agent_id === 'agent_b') setAgentB(s => ({ ...s, output: payload.text }));
    }
    if (type === 'threat_event' && payload.trace) {
      if (payload.agent_id === 'agent_b') setAgentB(s => ({ ...s, lastTrace: payload.trace }));
    }
  }, [lastMessage]);

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'RUNNING': return <Activity className="inline animate-pulse text-yellow-500" size={16} />;
      case 'COMPROMISED': return <ShieldAlert className="inline text-red-500" size={16} />;
      case 'DEFENDED': return <Shield className="inline text-green-500" size={16} />;
      case 'COMPLETED': return <CheckSquare className="inline text-green-500" size={16} />;
      default: return <span>-</span>;
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'COMPROMISED') return 'text-red-500 border-red-500';
    if (status === 'DEFENDED' || status === 'COMPLETED') return 'text-green-500 border-green-500';
    if (status === 'RUNNING') return 'text-yellow-500 border-yellow-500';
    return 'text-zinc-500 border-zinc-500';
  };

  const renderAgentCard = (name: string, agent: AgentState, isProtected: boolean) => (
    <div className={`ascii-box ascii-box-bottom mb-6 ${getStatusColor(agent.status)} border-opacity-50`}>
      <div className="flex items-center justify-between">
        <div className="ascii-title">{name} {isProtected ? '[PROTECTED]' : '[UNPROTECTED]'}</div>
        {isProtected && agent.lastTrace && (
          <button
            onClick={() => setGlassBoxB(v => !v)}
            className={`flex items-center gap-1 text-xs font-mono border px-2 py-0.5 transition-colors ${
              glassBoxB
                ? 'border-green-500 text-green-400 bg-green-900/20'
                : 'border-green-900 text-green-700 hover:border-green-600 hover:text-green-500'
            }`}
          >
            {glassBoxB ? <Eye size={11} /> : <EyeOff size={11} />}
            Glass Box
          </button>
        )}
      </div>

      <div className="flex justify-between items-center mb-4 mt-2 border-b border-green-900 pb-2">
        <div className="text-sm">STATUS: <StatusIcon status={agent.status} /> {agent.status}</div>
      </div>

      <div className="bg-black/50 p-2 h-40 overflow-y-auto mb-4 border border-green-900 font-mono text-xs">
        {agent.logs.map((log: any, i: number) => (
          <div key={i} className="mb-1">
            <span className="opacity-50">[{log.time}]</span> {log.message}
          </div>
        ))}
      </div>

      <div className="text-sm border-t border-green-900 pt-2">
        <div className="opacity-50 mb-1">OUTPUT:</div>
        <pre className="whitespace-pre-wrap text-xs">{agent.output || 'Waiting for output...'}</pre>
      </div>

      {isProtected && glassBoxB && agent.lastTrace && (
        <PipelineTracePanel trace={agent.lastTrace} />
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      {renderAgentCard('AGENT A', agentA, false)}
      {renderAgentCard('AGENT B', agentB, true)}
    </div>
  );
}
