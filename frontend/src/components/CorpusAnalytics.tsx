import { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import ReactFlow, { type Node, type Edge, Background, Controls, MiniMap, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { Activity, Database, Shield, RefreshCw, Search, Network } from 'lucide-react';

const API_BASE = 'http://localhost:8080';

type TabId = 'stats' | 'browser' | 'graph';

interface CorpusStats {
  total: number;
  hour_new: number;
  session_new: number;
}

interface TimeseriesEntry {
  hour: string;
  total: number;
  by_type: Record<string, number>;
  blocked: number;
  allowed: number;
  suspicious: number;
}

interface ThreatPattern {
  id: string;
  attack_type: string;
  owasp_category: string;
  mitre_id: string;
  description: string;
  sophistication: string;
  confidence: number;
  created_at: string;
}

interface GraphNode { id: string; attack_type: string; owasp_category: string; mitre_id: string; }
interface GraphEdge { from: string; to: string; similarity: number; }

const CHART_COLORS = ['#4ade80', '#f97316', '#eab308', '#60a5fa', '#c084fc', '#f43f5e', '#2dd4bf'];
const PIE_COLORS = { blocked: '#ef4444', allowed: '#22c55e', suspicious: '#eab308' };

const OWASP_COLORS: Record<string, string> = {
  'OAT-01': '#4ade80', 'OAT-02': '#f97316', 'OAT-03': '#eab308',
  'OAT-04': '#60a5fa', 'OAT-05': '#c084fc', 'OAT-06': '#f43f5e',
  'OAT-07': '#2dd4bf', 'OAT-08': '#fb923c', 'OAT-09': '#a78bfa',
  'OAT-10': '#34d399',
};

function getOwaspColor(cat: string): string {
  const prefix = cat?.slice(0, 6) ?? '';
  return OWASP_COLORS[prefix] ?? '#4ade80';
}

function StatCard({ label, value, sub, icon: Icon, accent = 'text-green-400' }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; accent?: string;
}) {
  return (
    <div className="border border-green-900 bg-zinc-950 p-4 flex items-start space-x-3">
      <Icon size={20} className={accent} />
      <div>
        <div className={`text-2xl font-bold font-mono ${accent}`}>{value}</div>
        <div className="text-xs text-green-600 uppercase tracking-widest">{label}</div>
        {sub && <div className="text-xs text-green-700 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const CustomTooltipStyle: React.CSSProperties = {
  background: '#09090b', border: '1px solid #14532d', color: '#4ade80',
  fontFamily: 'monospace', fontSize: '11px', borderRadius: 0,
};

export default function CorpusAnalytics() {
  const [activeTab, setActiveTab] = useState<TabId>('stats');
  const [stats, setStats] = useState<CorpusStats | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Corpus Browser state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ThreatPattern[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Graph state
  const [graphThreshold, setGraphThreshold] = useState(0.8);
  const [graphLoading, setGraphLoading] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const graphFetchedRef = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, tsRes] = await Promise.all([
        fetch(`${API_BASE}/api/corpus/stats`),
        fetch(`${API_BASE}/api/corpus/timeseries`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (tsRes.ok) setTimeseries(await tsRes.json());
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSearch = async () => {
    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch(`${API_BASE}/api/corpus/search?q=${encodeURIComponent(searchQuery)}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.patterns ?? []);
        setSearchTotal(data.total ?? 0);
      }
    } finally {
      setSearching(false);
    }
  };

  const fetchGraph = useCallback(async (threshold: number) => {
    setGraphLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/corpus/graph?threshold=${threshold}`);
      if (!res.ok) return;
      const data: { nodes: GraphNode[]; edges: GraphEdge[] } = await res.json();

      // Build set of nodes that appear in at least one edge
      const connectedIds = new Set<string>();
      data.edges?.forEach(e => { connectedIds.add(e.from); connectedIds.add(e.to); });
      const displayNodes = (data.nodes ?? []).filter(n => connectedIds.has(n.id)).slice(0, 200);
      const displayEdges = (data.edges ?? []).slice(0, 1000);

      setNodeCount(data.nodes?.length ?? 0);
      setEdgeCount(data.edges?.length ?? 0);

      // Circular layout grouped by owasp_category
      const categoryOrder: string[] = [];
      const categoryMap: Record<string, number> = {};
      displayNodes.forEach(n => {
        if (!categoryMap[n.owasp_category]) {
          categoryMap[n.owasp_category] = categoryOrder.length;
          categoryOrder.push(n.owasp_category);
        }
      });

      const total = displayNodes.length;
      const rfNodes: Node[] = displayNodes.map((n, i) => {
        const angle = (i / total) * 2 * Math.PI;
        const radius = 350 + (categoryMap[n.owasp_category] ?? 0) * 40;
        return {
          id: n.id,
          position: { x: Math.cos(angle) * radius + 400, y: Math.sin(angle) * radius + 400 },
          data: { label: n.attack_type?.replace(/_/g, ' ') ?? n.id.slice(0, 8) },
          style: {
            background: getOwaspColor(n.owasp_category),
            color: '#000',
            border: '1px solid #166534',
            borderRadius: '50%',
            width: 60, height: 60,
            fontSize: 8, fontFamily: 'monospace',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center' as const,
            padding: 4,
          },
        };
      });

      const rfEdges: Edge[] = displayEdges.map((e, i) => ({
        id: `e${i}`,
        source: e.from,
        target: e.to,
        style: { stroke: '#166534', strokeOpacity: Math.max(0.1, e.similarity - 0.6), strokeWidth: 1 },
        animated: e.similarity > 0.95,
      }));

      setNodes(rfNodes);
      setEdges(rfEdges);
    } finally {
      setGraphLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (activeTab === 'graph' && !graphFetchedRef.current) {
      graphFetchedRef.current = true;
      fetchGraph(graphThreshold);
    }
  }, [activeTab, fetchGraph, graphThreshold]);

  const attackTypeTotals: Record<string, number> = {};
  timeseries.forEach(entry => {
    Object.entries(entry.by_type ?? {}).forEach(([type, count]) => {
      attackTypeTotals[type] = (attackTypeTotals[type] ?? 0) + count;
    });
  });
  const attackTypeData = Object.entries(attackTypeTotals).map(([type, count]) => ({ name: type.replace(/_/g, ' '), count }));
  const lastEntry = timeseries[timeseries.length - 1];
  const pieData = lastEntry ? [
    { name: 'Blocked', value: lastEntry.blocked, color: PIE_COLORS.blocked },
    { name: 'Allowed', value: lastEntry.allowed, color: PIE_COLORS.allowed },
    { name: 'Suspicious', value: lastEntry.suspicious, color: PIE_COLORS.suspicious },
  ] : [];
  const blockRate = stats && stats.total > 0
    ? ((timeseries.reduce((s, e) => s + (e.blocked ?? 0), 0) / Math.max(1, timeseries.reduce((s, e) => s + (e.total ?? 0), 0))) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="h-full flex flex-col font-mono overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-green-900 shrink-0 px-1 pb-0">
        <div className="flex">
          {([
            { id: 'stats' as TabId, label: 'Stats' },
            { id: 'browser' as TabId, label: 'Corpus Browser' },
            { id: 'graph' as TabId, label: 'Correlation Graph' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${activeTab === tab.id ? 'border-green-500 text-green-300' : 'border-transparent text-green-700 hover:text-green-500'}`}
            >
              {tab.label.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-3 text-xs text-green-700 pr-2">
          <span>Last refresh: {lastRefresh.toLocaleTimeString()}</span>
          <button onClick={fetchData} disabled={loading} className="flex items-center space-x-1 border border-green-900 px-2 py-1 hover:bg-green-900/20 hover:text-green-400 transition-colors disabled:opacity-40">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /><span>REFRESH</span>
          </button>
        </div>
      </div>

      {/* ── Stats Tab ── */}
      {activeTab === 'stats' && (
        <div className="flex-1 overflow-y-auto space-y-4 p-1 pt-3">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total Patterns" value={stats ? stats.total.toLocaleString() : '—'} icon={Database} accent="text-green-400" />
            <StatCard label="New This Hour" value={stats ? `+${stats.hour_new}` : '—'} sub="since last hour" icon={Activity} accent="text-yellow-400" />
            <StatCard label="Block Rate" value={`${blockRate}%`} sub="attacks blocked" icon={Shield} accent="text-red-400" />
          </div>
          <div className="border border-green-900 bg-zinc-950 p-4">
            <div className="text-green-500 text-xs uppercase tracking-widest mb-3">Attack Attempts — Last 24 Hours</div>
            {timeseries.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-green-800 text-xs">NO DATA AVAILABLE</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={timeseries} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="#14532d" strokeDasharray="3 3" />
                  <XAxis dataKey="hour" stroke="#166534" tick={{ fill: '#4ade80', fontSize: 10, fontFamily: 'monospace' }} tickFormatter={v => String(v).slice(-5)} />
                  <YAxis stroke="#166534" tick={{ fill: '#4ade80', fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip contentStyle={CustomTooltipStyle} />
                  <Line type="monotone" dataKey="total" stroke="#4ade80" strokeWidth={2} dot={false} name="Total" />
                  <Line type="monotone" dataKey="blocked" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Blocked" />
                  <Line type="monotone" dataKey="suspicious" stroke="#eab308" strokeWidth={1.5} dot={false} name="Suspicious" />
                  <Legend iconType="line" wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', color: '#4ade80' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-green-900 bg-zinc-950 p-4">
              <div className="text-green-500 text-xs uppercase tracking-widest mb-3">Attack Type Distribution</div>
              {attackTypeData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-green-800 text-xs">NO DATA AVAILABLE</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={attackTypeData} margin={{ top: 4, right: 8, bottom: 30, left: 0 }}>
                    <CartesianGrid stroke="#14532d" strokeDasharray="3 3" />
                    <XAxis dataKey="name" stroke="#166534" tick={{ fill: '#4ade80', fontSize: 9, fontFamily: 'monospace' }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis stroke="#166534" tick={{ fill: '#4ade80', fontSize: 10, fontFamily: 'monospace' }} />
                    <Tooltip contentStyle={CustomTooltipStyle} />
                    <Bar dataKey="count" radius={0}>{attackTypeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="border border-green-900 bg-zinc-950 p-4">
              <div className="text-green-500 text-xs uppercase tracking-widest mb-3">Decision Breakdown (Latest Hour)</div>
              {pieData.length === 0 || pieData.every(d => d.value === 0) ? (
                <div className="h-40 flex items-center justify-center text-green-800 text-xs">NO DATA AVAILABLE</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="#09090b" strokeWidth={2} />)}
                    </Pie>
                    <Tooltip contentStyle={CustomTooltipStyle} formatter={(value, name) => [`${value}`, String(name)]} />
                    <Legend iconType="circle" wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px' }} formatter={value => <span style={{ color: '#4ade80' }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Corpus Browser Tab ── */}
      {activeTab === 'browser' && (
        <div className="flex-1 flex flex-col overflow-hidden p-1 pt-3 space-y-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex-1 flex items-center border border-green-700 bg-black">
              <Search size={13} className="ml-2 text-green-700 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search by attack_type, owasp_category, description, mitre_id…"
                className="flex-1 bg-transparent px-2 py-2 text-green-300 text-xs focus:outline-none font-mono"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="flex items-center gap-1 border border-green-500 px-4 py-2 text-green-400 text-xs hover:bg-green-900/30 disabled:opacity-40 transition-colors font-bold"
            >
              <Search size={12} />
              {searching ? 'SEARCHING…' : 'SEARCH'}
            </button>
          </div>

          {searched && (
            <div className="text-xs text-green-700 shrink-0">
              {searchTotal} pattern{searchTotal !== 1 ? 's' : ''} found
              {searchQuery ? ` for "${searchQuery}"` : ' (all patterns)'}
            </div>
          )}

          <div className="flex-1 border border-green-900 overflow-hidden flex flex-col">
            {!searched ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-green-800 text-xs space-y-1">
                  <Database size={24} className="mx-auto opacity-40" />
                  <div>Enter a query above to browse {stats?.total?.toLocaleString() ?? '—'} threat patterns</div>
                  <div className="opacity-60">Leave empty and Search to see all patterns</div>
                </div>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-green-800 text-xs">NO PATTERNS FOUND</div>
            ) : (
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-zinc-900 z-10">
                    <tr className="border-b border-green-900 text-green-600">
                      <th className="text-left px-3 py-2 font-bold">ID</th>
                      <th className="text-left px-3 py-2 font-bold">ATTACK TYPE</th>
                      <th className="text-left px-3 py-2 font-bold">OWASP</th>
                      <th className="text-left px-3 py-2 font-bold">MITRE</th>
                      <th className="text-left px-3 py-2 font-bold">SOPHISTICATION</th>
                      <th className="text-left px-3 py-2 font-bold">CONFIDENCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map(p => (
                      <tr key={p.id} className="border-b border-green-950 hover:bg-green-900/10 transition-colors">
                        <td className="px-3 py-2 text-green-800 font-mono" style={{ fontSize: 9 }}>{p.id?.slice(0, 14)}…</td>
                        <td className="px-3 py-2 text-green-400 font-bold">{p.attack_type?.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2">
                          <span className="border border-green-900 px-1 text-green-600" style={{ fontSize: 9 }}>
                            {p.owasp_category || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-green-700">{p.mitre_id || '—'}</td>
                        <td className="px-3 py-2 text-green-700 capitalize">{p.sophistication || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <div className="w-16 bg-zinc-800 h-1.5">
                              <div className="bg-green-500 h-1.5" style={{ width: `${(p.confidence ?? 0) * 100}%` }} />
                            </div>
                            <span className="text-green-600">{((p.confidence ?? 0) * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Correlation Graph Tab ── */}
      {activeTab === 'graph' && (
        <div className="flex-1 flex flex-col overflow-hidden p-1 pt-3 space-y-2">
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2 text-xs text-green-600">
              <Network size={13} />
              <span>Similarity threshold:</span>
              <input
                type="range" min="0.7" max="0.95" step="0.05"
                value={graphThreshold}
                onChange={e => setGraphThreshold(parseFloat(e.target.value))}
                onMouseUp={() => { graphFetchedRef.current = false; fetchGraph(graphThreshold); }}
                className="accent-green-500"
              />
              <span className="font-mono text-green-400">{graphThreshold.toFixed(2)}</span>
            </div>
            <span className="text-xs text-green-800 border border-green-950 px-2 py-0.5">
              {nodeCount} nodes · {edgeCount} edges
            </span>
            {graphLoading && <span className="text-xs text-green-700 animate-pulse">COMPUTING…</span>}
          </div>

          <div className="flex-1 border border-green-900 overflow-hidden" style={{ background: '#09090b' }}>
            {nodes.length === 0 && !graphLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-green-800 text-xs space-y-1">
                  <Network size={24} className="mx-auto opacity-40" />
                  <div>No connected nodes at threshold {graphThreshold.toFixed(2)}</div>
                  <div className="opacity-60">Lower the threshold to see more connections</div>
                </div>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.1 }}
                minZoom={0.1}
                maxZoom={2}
              >
                <Background color="#166534" gap={20} size={0.5} />
                <Controls style={{ background: '#09090b', border: '1px solid #14532d', color: '#4ade80' }} />
                <MiniMap
                  nodeColor={n => n.style?.background as string ?? '#4ade80'}
                  maskColor="rgba(0,0,0,0.8)"
                  style={{ background: '#09090b', border: '1px solid #14532d' }}
                />
              </ReactFlow>
            )}
          </div>

          <div className="shrink-0 flex flex-wrap gap-2 text-xs">
            {Object.entries(OWASP_COLORS).map(([cat, color]) => (
              <span key={cat} className="flex items-center gap-1 text-green-800">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
