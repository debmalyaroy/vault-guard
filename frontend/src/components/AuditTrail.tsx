import { useEffect, useState, useCallback } from 'react';
import { FileText, Download, RefreshCw, ShieldCheck, AlertCircle, Lock } from 'lucide-react';

const API_BASE = 'http://localhost:8080';

interface AuditEntry {
  seq: number;
  action: string;
  hash: string;
  prev_hash: string;
  signature: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

interface AuditLog {
  session_id: string;
  public_key: string;
  entry_count: number;
  entries: AuditEntry[];
}

function truncate(str: string, len = 16): string {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function verifyChain(entries: AuditEntry[]): boolean {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].prev_hash !== entries[i - 1].hash) return false;
  }
  return true;
}

interface Props {
  sessionId?: string;
}

export default function AuditTrail({ sessionId }: Props) {
  const [auditLog, setAuditLog] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const fetchAudit = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/audit/${sessionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AuditLog = await res.json();
      setAuditLog(data);
      setChainValid(verifyChain(data.entries ?? []));
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch audit log');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center text-green-700 font-mono text-sm">
        <div className="text-center space-y-2">
          <Lock size={32} className="mx-auto text-green-900" />
          <div>NO SESSION ACTIVE</div>
          <div className="text-xs opacity-50">Audit trail requires an active session</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4 font-mono text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-green-400 font-bold tracking-widest text-xs uppercase">
          <FileText size={14} />
          <span>Audit Trail — {sessionId}</span>
        </div>
        <div className="flex items-center space-x-2">
          {/* Chain verification */}
          {chainValid !== null && (
            <div
              className={`flex items-center space-x-1 border px-2 py-0.5 text-xs ${
                chainValid
                  ? 'border-green-700 text-green-400 bg-green-950/30'
                  : 'border-red-700 text-red-400 bg-red-950/30'
              }`}
            >
              {chainValid ? (
                <>
                  <ShieldCheck size={12} />
                  <span>CHAIN VERIFIED</span>
                </>
              ) : (
                <>
                  <AlertCircle size={12} />
                  <span>CHAIN BROKEN</span>
                </>
              )}
            </div>
          )}

          {/* Export buttons */}
          <a
            href={`${API_BASE}/api/audit/${sessionId}/export?format=csv`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 border border-green-900 px-2 py-1 text-xs text-green-600 hover:border-green-600 hover:text-green-400 transition-colors"
          >
            <Download size={11} />
            <span>CSV</span>
          </a>
          <a
            href={`${API_BASE}/api/audit/${sessionId}/export?format=pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 border border-green-900 px-2 py-1 text-xs text-green-600 hover:border-green-600 hover:text-green-400 transition-colors"
          >
            <Download size={11} />
            <span>PDF</span>
          </a>
          <button
            onClick={fetchAudit}
            disabled={loading}
            className="flex items-center space-x-1 border border-green-900 px-2 py-1 text-xs text-green-600 hover:border-green-600 hover:text-green-400 disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span>REFRESH</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-red-700 bg-red-950/20 p-3 text-red-400 text-xs flex items-center space-x-2">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Public key */}
      {auditLog?.public_key && (
        <div className="border border-green-900 bg-zinc-950 p-3">
          <div className="text-green-700 text-xs uppercase tracking-widest mb-1">
            Session Public Key
          </div>
          <pre className="text-green-500 text-xs whitespace-pre-wrap break-all leading-relaxed overflow-x-auto max-h-24">
            {auditLog.public_key}
          </pre>
        </div>
      )}

      {/* Stats row */}
      {auditLog && (
        <div className="flex items-center space-x-4 text-xs text-green-600">
          <span>
            Total entries:{' '}
            <span className="text-green-400 font-bold">{auditLog.entry_count}</span>
          </span>
          <span>
            Session:{' '}
            <span className="text-green-400">{auditLog.session_id}</span>
          </span>
        </div>
      )}

      {/* Main area: table + detail panel */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Table */}
        <div className="flex-1 border border-green-900 overflow-hidden flex flex-col">
          {loading && !auditLog ? (
            <div className="flex-1 flex items-center justify-center text-green-700 text-xs animate-pulse">
              LOADING AUDIT LOG...
            </div>
          ) : !auditLog || auditLog.entries.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-green-800 text-xs">
              NO AUDIT ENTRIES
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-zinc-900 z-10">
                  <tr className="border-b border-green-900 text-green-600">
                    <th className="text-left px-3 py-2 font-bold">SEQ</th>
                    <th className="text-left px-3 py-2 font-bold">ACTION</th>
                    <th className="text-left px-3 py-2 font-bold">ENTRY HASH</th>
                    <th className="text-left px-3 py-2 font-bold">SIGNATURE</th>
                    <th className="text-left px-3 py-2 font-bold">TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.entries.map((entry, i) => {
                    const chainBroken =
                      i > 0 &&
                      entry.prev_hash !== auditLog.entries[i - 1].hash;
                    return (
                      <tr
                        key={entry.seq}
                        onClick={() => setSelectedEntry(entry)}
                        className={`border-b border-green-950 cursor-pointer transition-colors ${
                          selectedEntry?.seq === entry.seq
                            ? 'bg-green-900/30'
                            : 'hover:bg-green-900/10'
                        } ${chainBroken ? 'bg-red-950/20' : ''}`}
                      >
                        <td className="px-3 py-2 text-green-700">{entry.seq}</td>
                        <td className="px-3 py-2 text-green-400 font-bold">{entry.action}</td>
                        <td className="px-3 py-2 text-green-600 font-mono" title={entry.hash}>
                          {truncate(entry.hash, 20)}
                        </td>
                        <td className="px-3 py-2 text-green-700 font-mono" title={entry.signature}>
                          {truncate(entry.signature, 20)}
                        </td>
                        <td className="px-3 py-2 text-green-700">
                          {entry.timestamp
                            ? new Date(entry.timestamp).toLocaleTimeString()
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Entry detail */}
        {selectedEntry && (
          <div className="w-72 border border-green-900 bg-zinc-950 p-3 flex flex-col space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-green-900 pb-2">
              <span className="text-green-400 font-bold text-xs uppercase">
                Entry #{selectedEntry.seq}
              </span>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-green-800 hover:text-green-600 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <div className="text-green-700 uppercase tracking-wider mb-0.5">Action</div>
                <div className="text-green-300 font-bold">{selectedEntry.action}</div>
              </div>
              <div>
                <div className="text-green-700 uppercase tracking-wider mb-0.5">Timestamp</div>
                <div className="text-green-500">
                  {selectedEntry.timestamp
                    ? new Date(selectedEntry.timestamp).toLocaleString()
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-green-700 uppercase tracking-wider mb-0.5">Hash</div>
                <div className="text-green-500 break-all font-mono" style={{ fontSize: 9 }}>
                  {selectedEntry.hash || '—'}
                </div>
              </div>
              <div>
                <div className="text-green-700 uppercase tracking-wider mb-0.5">Prev Hash</div>
                <div className="text-green-600 break-all font-mono" style={{ fontSize: 9 }}>
                  {selectedEntry.prev_hash || '—'}
                </div>
              </div>
              <div>
                <div className="text-green-700 uppercase tracking-wider mb-0.5">Signature</div>
                <div className="text-green-600 break-all font-mono" style={{ fontSize: 9 }}>
                  {selectedEntry.signature || '—'}
                </div>
              </div>
              {selectedEntry.data && Object.keys(selectedEntry.data).length > 0 && (
                <div>
                  <div className="text-green-700 uppercase tracking-wider mb-0.5">Data</div>
                  <pre className="text-green-600 text-xs overflow-x-auto whitespace-pre-wrap break-all" style={{ fontSize: 9 }}>
                    {JSON.stringify(selectedEntry.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
