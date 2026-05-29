import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { Activity, Database, Shield, RefreshCw } from 'lucide-react';

const API_BASE = 'http://localhost:8080';

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

const CHART_COLORS = ['#4ade80', '#f97316', '#eab308', '#60a5fa', '#c084fc', '#f43f5e', '#2dd4bf'];

const PIE_COLORS = {
  blocked: '#ef4444',
  allowed: '#22c55e',
  suspicious: '#eab308',
};

function StatCard({ label, value, sub, icon: Icon, accent = 'text-green-400' }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
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
  background: '#09090b',
  border: '1px solid #14532d',
  color: '#4ade80',
  fontFamily: 'monospace',
  fontSize: '11px',
  borderRadius: 0,
};

export default function CorpusAnalytics() {
  const [stats, setStats] = useState<CorpusStats | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, tsRes] = await Promise.all([
        fetch(`${API_BASE}/api/corpus/stats`),
        fetch(`${API_BASE}/api/corpus/timeseries`),
      ]);
      if (statsRes.ok) {
        const s: CorpusStats = await statsRes.json();
        setStats(s);
      }
      if (tsRes.ok) {
        const ts: TimeseriesEntry[] = await tsRes.json();
        setTimeseries(ts);
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch corpus analytics', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Derive attack type distribution from timeseries
  const attackTypeTotals: Record<string, number> = {};
  timeseries.forEach((entry) => {
    Object.entries(entry.by_type ?? {}).forEach(([type, count]) => {
      attackTypeTotals[type] = (attackTypeTotals[type] ?? 0) + count;
    });
  });
  const attackTypeData = Object.entries(attackTypeTotals).map(([type, count]) => ({
    name: type.replace(/_/g, ' '),
    count,
  }));

  // Pie data
  const lastEntry = timeseries[timeseries.length - 1];
  const pieData = lastEntry
    ? [
        { name: 'Blocked', value: lastEntry.blocked, color: PIE_COLORS.blocked },
        { name: 'Allowed', value: lastEntry.allowed, color: PIE_COLORS.allowed },
        { name: 'Suspicious', value: lastEntry.suspicious, color: PIE_COLORS.suspicious },
      ]
    : [];

  const blockRate =
    stats && stats.total > 0
      ? ((timeseries.reduce((s, e) => s + (e.blocked ?? 0), 0) /
          Math.max(1, timeseries.reduce((s, e) => s + (e.total ?? 0), 0))) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="h-full flex flex-col space-y-4 overflow-y-auto font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-green-400 font-bold tracking-widest text-sm uppercase">
          Corpus Analytics
        </div>
        <div className="flex items-center space-x-3 text-xs text-green-700">
          <span>Last refresh: {lastRefresh.toLocaleTimeString()}</span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center space-x-1 border border-green-900 px-2 py-1 hover:bg-green-900/20 hover:text-green-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>REFRESH</span>
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Total Patterns"
          value={stats ? stats.total.toLocaleString() : '—'}
          icon={Database}
          accent="text-green-400"
        />
        <StatCard
          label="New This Hour"
          value={stats ? `+${stats.hour_new}` : '—'}
          sub="since last hour"
          icon={Activity}
          accent="text-yellow-400"
        />
        <StatCard
          label="Block Rate"
          value={`${blockRate}%`}
          sub="attacks blocked"
          icon={Shield}
          accent="text-red-400"
        />
      </div>

      {/* Line Chart: attack attempts over 24h */}
      <div className="border border-green-900 bg-zinc-950 p-4">
        <div className="text-green-500 text-xs uppercase tracking-widest mb-3">
          Attack Attempts — Last 24 Hours
        </div>
        {timeseries.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-green-800 text-xs">
            NO DATA AVAILABLE
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={timeseries} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#14532d" strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                stroke="#166534"
                tick={{ fill: '#4ade80', fontSize: 10, fontFamily: 'monospace' }}
                tickFormatter={(v) => String(v).slice(-5)}
              />
              <YAxis
                stroke="#166534"
                tick={{ fill: '#4ade80', fontSize: 10, fontFamily: 'monospace' }}
              />
              <Tooltip contentStyle={CustomTooltipStyle} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#4ade80"
                strokeWidth={2}
                dot={false}
                name="Total"
              />
              <Line
                type="monotone"
                dataKey="blocked"
                stroke="#ef4444"
                strokeWidth={1.5}
                dot={false}
                name="Blocked"
              />
              <Line
                type="monotone"
                dataKey="suspicious"
                stroke="#eab308"
                strokeWidth={1.5}
                dot={false}
                name="Suspicious"
              />
              <Legend
                iconType="line"
                wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px', color: '#4ade80' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bar + Pie row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Bar Chart: attack type distribution */}
        <div className="border border-green-900 bg-zinc-950 p-4">
          <div className="text-green-500 text-xs uppercase tracking-widest mb-3">
            Attack Type Distribution
          </div>
          {attackTypeData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-green-800 text-xs">
              NO DATA AVAILABLE
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={attackTypeData} margin={{ top: 4, right: 8, bottom: 30, left: 0 }}>
                <CartesianGrid stroke="#14532d" strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  stroke="#166534"
                  tick={{ fill: '#4ade80', fontSize: 9, fontFamily: 'monospace' }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  stroke="#166534"
                  tick={{ fill: '#4ade80', fontSize: 10, fontFamily: 'monospace' }}
                />
                <Tooltip contentStyle={CustomTooltipStyle} />
                <Bar dataKey="count" radius={0}>
                  {attackTypeData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart: blocked/allowed/suspicious */}
        <div className="border border-green-900 bg-zinc-950 p-4">
          <div className="text-green-500 text-xs uppercase tracking-widest mb-3">
            Decision Breakdown (Latest Hour)
          </div>
          {pieData.length === 0 || pieData.every((d) => d.value === 0) ? (
            <div className="h-40 flex items-center justify-center text-green-800 text-xs">
              NO DATA AVAILABLE
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="#09090b" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CustomTooltipStyle}
                  formatter={(value, name) => [`${value}`, String(name)]}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontFamily: 'monospace', fontSize: '11px' }}
                  formatter={(value) => (
                    <span style={{ color: '#4ade80' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
