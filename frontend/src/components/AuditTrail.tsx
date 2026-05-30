import { useEffect, useState, useCallback } from 'react';
import { FileText, Download, RefreshCw, ShieldCheck, AlertCircle, Lock, Key, PlayCircle, Copy, CheckCircle } from 'lucide-react';

const API_BASE = 'http://localhost:8080';

interface AuditEntry {
  id: string;
  session_id: string;
  sequence_num: number;
  action: string;
  data?: Record<string, unknown>;
  entry_hash: string;
  prev_hash: string;
  signature: string;
  created_at: string;
}

interface AuditLog {
  session_id: string;
  public_key: string;
  entry_count: number;
  entries: AuditEntry[];
}

interface ReplayResult {
  session_id: string;
  all_match: boolean;
  count: number;
  entries: { id: string; seq_num: number; sig_valid: boolean; chain_valid: boolean }[];
}

function truncate(str: string, len = 16): string {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function verifyChain(entries: AuditEntry[]): boolean {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].prev_hash !== entries[i - 1].entry_hash) return false;
  }
  return true;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function verifySingleEntry(entry: AuditEntry, publicKeyHex: string): Promise<boolean> {
  try {
    const pubKeyBytes = hexToBytes(publicKeyHex);
    const sigBytes = hexToBytes(entry.signature);
    const msgBytes = new TextEncoder().encode(entry.entry_hash);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', pubKeyBytes.buffer as ArrayBuffer, { name: 'Ed25519' }, false, ['verify']
    );
    return await crypto.subtle.verify('Ed25519', cryptoKey, sigBytes.buffer as ArrayBuffer, msgBytes);
  } catch {
    return false;
  }
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

  // Ed25519 verify panel
  const [showVerify, setShowVerify] = useState(false);
  const [verifyEntry, setVerifyEntry] = useState('');
  const [verifyPubKey, setVerifyPubKey] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);
  const [verifyCopied, setVerifyCopied] = useState(false);

  // Replay panel
  const [showReplay, setShowReplay] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);

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
      if (data.public_key) setVerifyPubKey(data.public_key);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch audit log');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const handleCopyEntry = async (entry: AuditEntry) => {
    await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    setVerifyEntry(JSON.stringify(entry, null, 2));
    setShowVerify(true);
    setVerifyResult(null);
    setVerifyCopied(true);
    setTimeout(() => setVerifyCopied(false), 2000);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const parsed: AuditEntry = JSON.parse(verifyEntry);
      const valid = await verifySingleEntry(parsed, verifyPubKey);
      setVerifyResult(valid);
    } catch {
      setVerifyResult(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleReplay = async () => {
    if (!sessionId) return;
    setReplayLoading(true);
    setReplayResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/audit/${sessionId}/replay`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ReplayResult = await res.json();
      setReplayResult(data);
      setShowReplay(true);
    } catch (err: any) {
      setError(err.message ?? 'Replay failed');
    } finally {
      setReplayLoading(false);
    }
  };

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
    <div className="h-full flex flex-col space-y-3 font-mono text-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-green-400 font-bold tracking-widest text-xs uppercase">
          <FileText size={14} />
          <span>Audit Trail — {sessionId}</span>
        </div>
        <div className="flex items-center space-x-2">
          {chainValid !== null && (
            <div className={`flex items-center space-x-1 border px-2 py-0.5 text-xs ${chainValid ? 'border-green-700 text-green-400 bg-green-950/30' : 'border-red-700 text-red-400 bg-red-950/30'}`}>
              {chainValid ? <><ShieldCheck size={12} /><span>CHAIN VERIFIED</span></> : <><AlertCircle size={12} /><span>CHAIN BROKEN</span></>}
            </div>
          )}
          {/* Replay badge */}
          {replayResult && (
            <div className={`flex items-center space-x-1 border px-2 py-0.5 text-xs ${replayResult.all_match ? 'border-green-600 text-green-400' : 'border-red-700 text-red-400'}`}>
              {replayResult.all_match ? <><CheckCircle size={12} /><span>DETERMINISTIC</span></> : <><AlertCircle size={12} /><span>MISMATCH</span></>}
            </div>
          )}
          <button
            onClick={() => setShowVerify(v => !v)}
            className={`flex items-center space-x-1 border px-2 py-1 text-xs transition-colors ${showVerify ? 'border-green-500 text-green-300' : 'border-green-900 text-green-600 hover:border-green-600 hover:text-green-400'}`}
          >
            <Key size={11} />
            <span>VERIFY ENTRY</span>
          </button>
          <button
            onClick={handleReplay}
            disabled={replayLoading}
            className="flex items-center space-x-1 border border-green-900 px-2 py-1 text-xs text-green-600 hover:border-green-600 hover:text-green-400 disabled:opacity-40 transition-colors"
          >
            <PlayCircle size={11} className={replayLoading ? 'animate-pulse' : ''} />
            <span>{replayLoading ? 'REPLAYING…' : 'REPLAY'}</span>
          </button>
          <a href={`${API_BASE}/api/audit/${sessionId}/export?format=csv`} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 border border-green-900 px-2 py-1 text-xs text-green-600 hover:border-green-600 hover:text-green-400 transition-colors">
            <Download size={11} /><span>CSV</span>
          </a>
          <a href={`${API_BASE}/api/audit/${sessionId}/export?format=pdf`} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 border border-green-900 px-2 py-1 text-xs text-green-600 hover:border-green-600 hover:text-green-400 transition-colors">
            <Download size={11} /><span>PDF</span>
          </a>
          <button onClick={fetchAudit} disabled={loading} className="flex items-center space-x-1 border border-green-900 px-2 py-1 text-xs text-green-600 hover:border-green-600 hover:text-green-400 disabled:opacity-40 transition-colors">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /><span>REFRESH</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-700 bg-red-950/20 p-3 text-red-400 text-xs flex items-center space-x-2 shrink-0">
          <AlertCircle size={14} /><span>{error}</span>
        </div>
      )}

      {/* Ed25519 Verify Panel */}
      {showVerify && (
        <div className="border border-green-700 bg-zinc-950 p-4 space-y-3 shrink-0">
          <div className="text-xs text-green-500 uppercase tracking-widest flex items-center gap-2">
            <Key size={12} /> Ed25519 Signature Verifier (WebCrypto)
          </div>
          <p className="text-xs text-green-800">
            Click "Copy JSON" on any table row, then click Verify to check the signature using the browser's WebCrypto API.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-green-700 uppercase tracking-wider block mb-1">Entry JSON</label>
              <textarea
                value={verifyEntry}
                onChange={e => { setVerifyEntry(e.target.value); setVerifyResult(null); }}
                rows={6}
                placeholder='{"id":"...","entry_hash":"...","signature":"..."}'
                className="w-full bg-black border border-green-900 px-2 py-1 text-green-400 text-xs focus:outline-none focus:border-green-600 resize-none font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-green-700 uppercase tracking-wider block mb-1">Public Key (hex)</label>
              <textarea
                value={verifyPubKey}
                onChange={e => { setVerifyPubKey(e.target.value); setVerifyResult(null); }}
                rows={3}
                placeholder="Pre-filled from session..."
                className="w-full bg-black border border-green-900 px-2 py-1 text-green-400 text-xs focus:outline-none focus:border-green-600 resize-none font-mono"
              />
              <button
                onClick={handleVerify}
                disabled={verifying || !verifyEntry.trim() || !verifyPubKey.trim()}
                className="mt-2 w-full flex items-center justify-center gap-2 border border-green-500 py-2 text-green-400 text-xs hover:bg-green-900/30 disabled:opacity-40 transition-colors font-bold"
              >
                <Key size={12} />
                {verifying ? 'VERIFYING…' : 'VERIFY SIGNATURE'}
              </button>
              {verifyResult !== null && (
                <div className={`mt-2 flex items-center gap-2 border px-3 py-2 text-xs font-bold ${verifyResult ? 'border-green-600 text-green-400 bg-green-950/30' : 'border-red-700 text-red-400 bg-red-950/30'}`}>
                  {verifyResult ? <><ShieldCheck size={14} /> ✓ SIGNATURE VALID · CHAIN INTACT</> : <><AlertCircle size={14} /> ✗ SIGNATURE INVALID</>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Replay Panel */}
      {showReplay && replayResult && (
        <div className="border border-green-900 bg-zinc-950 p-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-green-500 uppercase tracking-widest flex items-center gap-2">
              <PlayCircle size={12} /> Audit Replay — {replayResult.count} entries
            </div>
            <button onClick={() => setShowReplay(false)} className="text-green-800 hover:text-green-600 text-xs">✕</button>
          </div>
          <div className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-bold mb-2 ${replayResult.all_match ? 'border-green-600 text-green-400' : 'border-red-700 text-red-400'}`}>
            {replayResult.all_match ? '✓ ALL SIGNATURES VALID — PIPELINE IS DETERMINISTIC' : '✗ SIGNATURE MISMATCH DETECTED'}
          </div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {replayResult.entries.map(e => (
              <span key={e.id} title={`seq ${e.seq_num}`} className={`text-xs font-mono border px-1 ${e.sig_valid && e.chain_valid ? 'border-green-900 text-green-700' : 'border-red-800 text-red-400'}`}>
                {e.seq_num}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Public key */}
      {auditLog?.public_key && !showVerify && (
        <div className="border border-green-900 bg-zinc-950 p-3 shrink-0">
          <div className="text-green-700 text-xs uppercase tracking-widest mb-1">Session Public Key</div>
          <pre className="text-green-500 text-xs whitespace-pre-wrap break-all leading-relaxed overflow-x-auto" style={{ fontSize: 9 }}>
            {auditLog.public_key}
          </pre>
        </div>
      )}

      {/* Stats row */}
      {auditLog && (
        <div className="flex items-center space-x-4 text-xs text-green-600 shrink-0">
          <span>Total: <span className="text-green-400 font-bold">{auditLog.entry_count}</span></span>
          <span>Session: <span className="text-green-400">{auditLog.session_id}</span></span>
        </div>
      )}

      {/* Table + detail panel */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
        <div className="flex-1 border border-green-900 overflow-hidden flex flex-col">
          {loading && !auditLog ? (
            <div className="flex-1 flex items-center justify-center text-green-700 text-xs animate-pulse">LOADING AUDIT LOG…</div>
          ) : !auditLog || auditLog.entries.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-green-800 text-xs">NO AUDIT ENTRIES</div>
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
                    <th className="text-left px-3 py-2 font-bold">COPY</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.entries.map((entry, i) => {
                    const chainBroken = i > 0 && entry.prev_hash !== auditLog.entries[i - 1].entry_hash;
                    return (
                      <tr
                        key={entry.id}
                        onClick={() => setSelectedEntry(entry)}
                        className={`border-b border-green-950 cursor-pointer transition-colors ${selectedEntry?.id === entry.id ? 'bg-green-900/30' : 'hover:bg-green-900/10'} ${chainBroken ? 'bg-red-950/20' : ''}`}
                      >
                        <td className="px-3 py-2 text-green-700">{entry.sequence_num}</td>
                        <td className="px-3 py-2 text-green-400 font-bold">{entry.action}</td>
                        <td className="px-3 py-2 text-green-600 font-mono" title={entry.entry_hash}>{truncate(entry.entry_hash, 20)}</td>
                        <td className="px-3 py-2 text-green-700 font-mono" title={entry.signature}>{truncate(entry.signature, 20)}</td>
                        <td className="px-3 py-2 text-green-700">{entry.created_at ? new Date(entry.created_at).toLocaleTimeString() : '—'}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={e => { e.stopPropagation(); handleCopyEntry(entry); }}
                            className="text-green-800 hover:text-green-500 transition-colors"
                            title="Copy JSON + open verifier"
                          >
                            {verifyCopied ? <CheckCircle size={11} className="text-green-400" /> : <Copy size={11} />}
                          </button>
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
              <span className="text-green-400 font-bold text-xs uppercase">Entry #{selectedEntry.sequence_num}</span>
              <button onClick={() => setSelectedEntry(null)} className="text-green-800 hover:text-green-600 text-xs">✕</button>
            </div>
            <div className="space-y-2 text-xs">
              <div><div className="text-green-700 uppercase tracking-wider mb-0.5">Action</div><div className="text-green-300 font-bold">{selectedEntry.action}</div></div>
              <div><div className="text-green-700 uppercase tracking-wider mb-0.5">Timestamp</div><div className="text-green-500">{selectedEntry.created_at ? new Date(selectedEntry.created_at).toLocaleString() : '—'}</div></div>
              <div><div className="text-green-700 uppercase tracking-wider mb-0.5">Hash</div><div className="text-green-500 break-all font-mono" style={{ fontSize: 9 }}>{selectedEntry.entry_hash || '—'}</div></div>
              <div><div className="text-green-700 uppercase tracking-wider mb-0.5">Prev Hash</div><div className="text-green-600 break-all font-mono" style={{ fontSize: 9 }}>{selectedEntry.prev_hash || '—'}</div></div>
              <div><div className="text-green-700 uppercase tracking-wider mb-0.5">Signature</div><div className="text-green-600 break-all font-mono" style={{ fontSize: 9 }}>{selectedEntry.signature || '—'}</div></div>
              {selectedEntry.data && Object.keys(selectedEntry.data).length > 0 && (
                <div>
                  <div className="text-green-700 uppercase tracking-wider mb-0.5">Data</div>
                  <pre className="text-green-600 text-xs overflow-x-auto whitespace-pre-wrap break-all" style={{ fontSize: 9 }}>{JSON.stringify(selectedEntry.data, null, 2)}</pre>
                </div>
              )}
              <button
                onClick={() => handleCopyEntry(selectedEntry)}
                className="w-full flex items-center justify-center gap-1 border border-green-900 py-1.5 text-xs text-green-700 hover:text-green-400 hover:border-green-700 transition-colors"
              >
                <Key size={11} /> Verify Signature
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
