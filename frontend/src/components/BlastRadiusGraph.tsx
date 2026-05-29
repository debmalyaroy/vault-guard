import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  type Node,
  type Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useWebSocket } from '../lib/WebSocketContext';
import { AlertTriangle, ShieldAlert, Info, X } from 'lucide-react';

const API_BASE = 'http://localhost:8080';

interface PropagationPath {
  from: string;
  to: string;
  probability: number;
  vector: string;
}

interface BlastResult {
  score: number;
  severity: string;
  affected_tools: string[];
  propagation_paths: PropagationPath[];
  remediations: string[];
  data_exposure: string[];
  lateral_potential: boolean;
}

interface NodeDetail {
  id: string;
  access_level?: string;
  data_scope?: string;
  risk_score?: number;
}

const severityColor: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
  SAFE: '#22c55e',
};

const severityBg: Record<string, string> = {
  CRITICAL: 'bg-red-900/80 text-red-300 border-red-500',
  HIGH: 'bg-orange-900/80 text-orange-300 border-orange-500',
  MEDIUM: 'bg-yellow-900/80 text-yellow-300 border-yellow-500',
  LOW: 'bg-green-900/80 text-green-300 border-green-500',
  SAFE: 'bg-green-900/80 text-green-300 border-green-500',
};

function buildGraph(blast: BlastResult): { nodes: Node[]; edges: Edge[] } {
  const nodeIds = new Set<string>();
  blast.affected_tools.forEach((t) => nodeIds.add(t));
  blast.propagation_paths.forEach((p) => {
    nodeIds.add(p.from);
    nodeIds.add(p.to);
  });

  const nodeArr = Array.from(nodeIds);
  const cols = Math.ceil(Math.sqrt(nodeArr.length));

  const nodes: Node[] = nodeArr.map((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const isAffected = blast.affected_tools.includes(id);
    const color = isAffected ? severityColor[blast.severity] ?? '#22c55e' : '#22c55e';
    return {
      id,
      position: { x: col * 180 + 60, y: row * 130 + 60 },
      data: {
        label: id.replace(/_/g, ' ').toUpperCase(),
        color,
        isAffected,
        severity: isAffected ? blast.severity : 'SAFE',
      },
      style: {
        background: '#09090b',
        border: `2px solid ${color}`,
        color: color,
        fontFamily: 'monospace',
        fontSize: '11px',
        padding: '8px 12px',
        borderRadius: 0,
        minWidth: '120px',
        textAlign: 'center' as const,
      },
    };
  });

  const edges: Edge[] = blast.propagation_paths.map((p, i) => ({
    id: `e${i}`,
    source: p.from,
    target: p.to,
    animated: true,
    label: `${Math.round(p.probability * 100)}%`,
    labelStyle: { fill: '#a3e635', fontSize: 10, fontFamily: 'monospace' },
    labelBgStyle: { fill: '#09090b', fillOpacity: 0.8 },
    style: {
      stroke: severityColor[blast.severity] ?? '#22c55e',
      strokeDasharray: '5,3',
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: severityColor[blast.severity] ?? '#22c55e',
    },
  }));

  return { nodes, edges };
}

interface Props {
  sessionId?: string;
}

export default function BlastRadiusGraph({ sessionId }: Props) {
  const { lastMessage } = useWebSocket();
  const [blast, setBlast] = useState<BlastResult | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBlast = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/blast/${sessionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BlastResult = await res.json();
      setBlast(data);
      const { nodes: n, edges: e } = buildGraph(data);
      setNodes(n);
      setEdges(e);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch blast data');
    } finally {
      setLoading(false);
    }
  }, [sessionId, setNodes, setEdges]);

  useEffect(() => {
    fetchBlast();
  }, [fetchBlast]);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'blast_update') {
      const data: BlastResult = lastMessage.payload;
      setBlast(data);
      const { nodes: n, edges: e } = buildGraph(data);
      setNodes(n);
      setEdges(e);
    }
  }, [lastMessage, setNodes, setEdges]);

  const handleNodeClick = useCallback((_: any, node: Node) => {
    const isAffected = node.data?.isAffected ?? false;
    setSelectedNode({
      id: node.id,
      access_level: isAffected ? 'READ/WRITE' : 'READ',
      data_scope: isAffected ? 'SENSITIVE' : 'PUBLIC',
      risk_score: isAffected && blast ? Math.round(blast.score * (node.data?.severity === 'CRITICAL' ? 1 : 0.6)) : 5,
    });
  }, [blast]);

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center text-green-600 font-mono text-sm">
        <div className="text-center space-y-2">
          <ShieldAlert size={32} className="mx-auto text-green-700" />
          <div>NO SESSION ACTIVE</div>
          <div className="text-xs opacity-50">Start a session to view blast radius</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-green-400 font-mono text-sm animate-pulse">
        LOADING BLAST DATA...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400 font-mono text-sm">
        <div className="text-center space-y-2">
          <AlertTriangle size={32} className="mx-auto" />
          <div>ERROR: {error}</div>
          <button onClick={fetchBlast} className="border border-green-500 px-3 py-1 text-green-400 hover:bg-green-900/20 text-xs">
            RETRY
          </button>
        </div>
      </div>
    );
  }

  if (!blast) {
    return (
      <div className="h-full flex items-center justify-center text-green-600 font-mono text-sm">
        <div className="text-center space-y-2">
          <Info size={32} className="mx-auto text-green-800" />
          <div>NO BLAST DATA</div>
          <div className="text-xs opacity-50">Run an attack to generate blast radius analysis</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-xs text-green-600 uppercase tracking-widest">
          Blast Radius Graph — Session: {sessionId}
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`border px-2 py-0.5 text-xs font-bold font-mono ${severityBg[blast.severity] ?? severityBg['SAFE']}`}
          >
            {blast.severity}
          </span>
          <span className="border border-green-500 bg-black px-3 py-0.5 text-green-300 font-bold font-mono text-sm">
            SCORE: {blast.score}/100
          </span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 gap-3 min-h-0">
        {/* Graph */}
        <div className="flex-1 border border-green-900 bg-zinc-950 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            attributionPosition="bottom-right"
          >
            <Background color="#052e16" gap={20} />
            <Controls
              style={{ background: '#09090b', border: '1px solid #14532d', color: '#4ade80' }}
            />
            <MiniMap
              nodeColor={(n) => n.data?.color ?? '#22c55e'}
              maskColor="rgba(0,0,0,0.7)"
              style={{ background: '#09090b', border: '1px solid #14532d' }}
            />
          </ReactFlow>

          {/* Node detail panel */}
          {selectedNode && (
            <div className="absolute bottom-4 left-4 bg-zinc-900 border border-green-700 p-3 font-mono text-xs z-10 min-w-[200px]">
              <div className="flex justify-between items-center mb-2 border-b border-green-900 pb-1">
                <span className="text-green-400 font-bold">{selectedNode.id.toUpperCase()}</span>
                <button onClick={() => setSelectedNode(null)} className="text-green-700 hover:text-green-400">
                  <X size={12} />
                </button>
              </div>
              <div className="space-y-1 text-green-600">
                <div><span className="text-green-500">ACCESS:</span> {selectedNode.access_level}</div>
                <div><span className="text-green-500">DATA SCOPE:</span> {selectedNode.data_scope}</div>
                <div><span className="text-green-500">RISK SCORE:</span> {selectedNode.risk_score}/100</div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-64 flex flex-col space-y-3 font-mono text-xs overflow-y-auto">
          {/* Remediations */}
          <div className="border border-green-900 p-3">
            <div className="text-green-400 font-bold mb-2 border-b border-green-900 pb-1">REMEDIATIONS</div>
            {blast.remediations.length === 0 ? (
              <div className="text-green-700">No remediations available.</div>
            ) : (
              <ol className="space-y-2">
                {blast.remediations.map((r, i) => (
                  <li key={i} className="flex gap-2 text-green-600">
                    <span className="text-green-500 font-bold">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Data Exposure */}
          <div className="border border-green-900 p-3">
            <div className="text-green-400 font-bold mb-2 border-b border-green-900 pb-1">DATA EXPOSURE</div>
            {blast.data_exposure.length === 0 ? (
              <div className="text-green-700">No data exposure detected.</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {blast.data_exposure.map((d, i) => (
                  <span key={i} className="border border-red-700 bg-red-950/30 text-red-400 px-2 py-0.5 text-xs">
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Lateral Potential */}
          <div className="border border-green-900 p-3">
            <div className="text-green-400 font-bold mb-2 border-b border-green-900 pb-1">LATERAL MOVEMENT</div>
            <div className={blast.lateral_potential ? 'text-red-400' : 'text-green-400'}>
              {blast.lateral_potential ? 'RISK DETECTED' : 'NO LATERAL RISK'}
            </div>
          </div>

          {/* Affected Tools */}
          <div className="border border-green-900 p-3">
            <div className="text-green-400 font-bold mb-2 border-b border-green-900 pb-1">AFFECTED TOOLS</div>
            {blast.affected_tools.length === 0 ? (
              <div className="text-green-700">None</div>
            ) : (
              <div className="space-y-1">
                {blast.affected_tools.map((t, i) => (
                  <div key={i} className="text-orange-400 flex items-center gap-1">
                    <span className="text-orange-600">▸</span> {t}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
