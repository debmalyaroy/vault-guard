import { useState } from 'react';
import { Zap, Shield, ChevronRight, Copy, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { PipelineTracePanel, type PipelineTrace } from './PipelineTracePanel';

const API_BASE = 'http://localhost:8080';

const ATTACK_TYPES = [
  'prompt_injection',
  'memory_poisoning',
  'identity_spoofing',
  'goal_hijacking',
  'dark_pattern',
  'data_exfiltration',
  'privilege_escalation',
  'resource_abuse',
  'supply_chain',
  'steganography',
];

const TOOLS = [
  'web_browser',
  'form_filler',
  'form_submitter',
  'data_reader',
  'api_caller',
  'email_sender',
  'payment_gateway',
  'credential_store',
];

const DATA_CATEGORIES = ['PII', 'FINANCIAL', 'INTERNAL', 'CREDENTIALS', 'PUBLIC'];

const PIPELINE_STAGES = [
  { key: 1, label: 'Input Sanitizer' },
  { key: 2, label: 'Intent Classifier' },
  { key: 3, label: 'Policy Enforcer' },
  { key: 4, label: 'Corpus Matcher' },
  { key: 5, label: 'Output Filter' },
];

interface BlastRadiusResult {
  score: number;
  severity?: string;
  affected_tools?: unknown[];
}

interface ThreatResult {
  decision: string;
  threat_type: string;
  confidence: number;
  stage_caught: number;
  corpus_status: string;
  blast_radius: BlastRadiusResult | number | null;
  variants?: string[];
  trace?: PipelineTrace;
}

function DecisionBadge({ decision }: { decision: string }) {
  const map: Record<string, string> = {
    BLOCKED: 'bg-red-900/80 border-red-500 text-red-300',
    ALLOWED: 'bg-green-900/80 border-green-500 text-green-300',
    SUSPICIOUS: 'bg-yellow-900/80 border-yellow-500 text-yellow-300',
  };
  return (
    <span className={`border px-2 py-0.5 text-xs font-bold font-mono ${map[decision] ?? 'border-green-700 text-green-400'}`}>
      {decision}
    </span>
  );
}

function PipelineVisual({ stageCaught }: { stageCaught: number }) {
  return (
    <div className="flex items-center space-x-1">
      {PIPELINE_STAGES.map((stage, i) => {
        const caught = stage.key === stageCaught;
        const passed = stageCaught > 0 && stage.key < stageCaught;
        return (
          <div key={stage.key} className="flex items-center">
            <div
              className={`
                flex flex-col items-center border px-2 py-1 text-xs font-mono min-w-[90px]
                ${caught ? 'border-red-500 bg-red-900/30 text-red-300' : ''}
                ${passed ? 'border-green-700 bg-green-900/20 text-green-600' : ''}
                ${!caught && !passed ? 'border-green-900 text-green-800' : ''}
              `}
            >
              <span className="text-xs font-bold">S{stage.key}</span>
              <span style={{ fontSize: 9 }} className="text-center leading-tight mt-0.5">
                {stage.label}
              </span>
              {caught && <span className="text-red-400 mt-0.5" style={{ fontSize: 9 }}>CAUGHT</span>}
              {passed && <span className="text-green-500 mt-0.5" style={{ fontSize: 9 }}>PASS</span>}
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <ChevronRight
                size={14}
                className={passed || caught ? 'text-green-700' : 'text-green-900'}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Tab A: Prompt Threat ----------
function PromptThreatTab({ sessionId }: { sessionId?: string }) {
  const [payload, setPayload] = useState('');
  const [attackType, setAttackType] = useState('prompt_injection');
  const [sophistication, setSophistication] = useState('MEDIUM');
  const [saveToCorpus, setSaveToCorpus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ThreatResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [glassBox, setGlassBox] = useState(false);

  const analyze = async (_generateVariants = false) => {
    if (!payload.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/threats/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload,
          attack_type: attackType,
          sophistication,
          session_id: sessionId ?? '',
          save_to_corpus: saveToCorpus,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ThreatResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 font-mono text-sm">
      {/* Payload */}
      <div>
        <label className="block text-xs text-green-600 uppercase tracking-widest mb-1">
          Attack Payload
        </label>
        <textarea
          className="w-full h-28 bg-black border border-green-500 p-2 text-green-300 text-sm focus:outline-none focus:ring-1 focus:ring-green-400 font-mono resize-none placeholder-green-900"
          placeholder="Enter your attack payload here..."
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
        />
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-green-600 uppercase tracking-widest mb-1">
            Attack Type
          </label>
          <select
            className="w-full bg-black border border-green-700 p-2 text-green-300 text-xs focus:outline-none focus:border-green-500"
            value={attackType}
            onChange={(e) => setAttackType(e.target.value)}
          >
            {ATTACK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-green-600 uppercase tracking-widest mb-1">
            Sophistication
          </label>
          <div className="flex space-x-2">
            {['LOW', 'MEDIUM', 'HIGH'].map((s) => (
              <button
                key={s}
                onClick={() => setSophistication(s)}
                className={`flex-1 text-xs py-2 border font-bold transition-colors ${
                  sophistication === s
                    ? 'bg-green-500 text-black border-green-500'
                    : 'border-green-900 text-green-700 hover:border-green-600 hover:text-green-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save to corpus */}
      <label className="flex items-center space-x-2 cursor-pointer text-xs text-green-600 hover:text-green-400">
        <input
          type="checkbox"
          checked={saveToCorpus}
          onChange={(e) => setSaveToCorpus(e.target.checked)}
          className="accent-green-500"
        />
        <span>SAVE TO CORPUS (add pattern to threat database)</span>
      </label>

      {/* Action buttons */}
      <div className="flex space-x-3">
        <button
          onClick={() => analyze(false)}
          disabled={loading || !payload.trim()}
          className="flex-1 flex items-center justify-center space-x-2 border border-green-500 py-2 text-green-400 hover:bg-green-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Zap size={14} />
          <span>{loading ? 'ANALYZING...' : 'ANALYZE THREAT'}</span>
        </button>
        <button
          onClick={() => analyze(true)}
          disabled={loading || !payload.trim()}
          className="flex-1 flex items-center justify-center space-x-2 border border-green-900 py-2 text-green-600 hover:border-green-600 hover:text-green-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Copy size={14} />
          <span>GENERATE VARIANTS</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-red-700 bg-red-950/20 p-3 text-red-400 text-xs flex items-center space-x-2">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="border border-green-900 bg-zinc-950 p-4 space-y-4">
          {/* Decision row */}
          <div className="flex items-center justify-between border-b border-green-900 pb-3">
            <div className="flex items-center space-x-3">
              <DecisionBadge decision={result.decision} />
              <span className="text-green-600 text-xs">
                {result.threat_type} &bull; conf: {(result.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-green-700">
                Blast: <span className="text-orange-400 font-bold">{typeof result.blast_radius === 'object' && result.blast_radius !== null ? result.blast_radius.score : result.blast_radius ?? 0}</span>
              </div>
              {result.trace && (
                <button
                  onClick={() => setGlassBox(v => !v)}
                  className={`flex items-center gap-1 text-xs font-mono border px-2 py-0.5 transition-colors ${
                    glassBox
                      ? 'border-green-500 text-green-400 bg-green-900/20'
                      : 'border-green-900 text-green-700 hover:border-green-600 hover:text-green-500'
                  }`}
                >
                  {glassBox ? <Eye size={11} /> : <EyeOff size={11} />}
                  Glass Box
                </button>
              )}
            </div>
          </div>

          {/* Corpus status */}
          <div className="flex items-center space-x-2 text-xs">
            {result.corpus_status === 'new' ? (
              <>
                <CheckCircle size={12} className="text-yellow-400" />
                <span className="text-yellow-400">NEW PATTERN ADDED TO CORPUS</span>
              </>
            ) : (
              <>
                <Shield size={12} className="text-green-700" />
                <span className="text-green-700">Pattern already in corpus</span>
              </>
            )}
          </div>

          {/* Pipeline visual */}
          <div>
            <div className="text-xs text-green-600 uppercase tracking-widest mb-2">
              Pipeline Stages
            </div>
            <div className="overflow-x-auto">
              <PipelineVisual stageCaught={result.stage_caught} />
            </div>
          </div>

          {/* Glass Box Trace Panel */}
          {glassBox && result.trace && (
            <PipelineTracePanel trace={result.trace} />
          )}

          {/* Variants */}
          {result.variants && result.variants.length > 0 && (
            <div>
              <div className="text-xs text-green-600 uppercase tracking-widest mb-2">
                Generated Variants
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.variants.map((v, i) => (
                  <div key={i} className="border border-green-900 bg-black p-2 text-xs text-green-400">
                    <span className="text-green-700 mr-2">{i + 1}.</span>{v}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Tab B: Vulnerability Definition ----------
function VulnerabilityTab() {
  const [vulnName, setVulnName] = useState('');
  const [mitreId, setMitreId] = useState('');
  const [severity, setSeverity] = useState('HIGH');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [accessLevel, setAccessLevel] = useState('READ');
  const [dataCategories, setDataCategories] = useState<string[]>([]);
  const [simResult, setSimResult] = useState<{ score: number; summary: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const toggleCategory = (cat: string) => {
    setDataCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const simulateAttack = async () => {
    setLoading(true);
    // Local simulation: compute a score from selections
    await new Promise((r) => setTimeout(r, 600));
    const toolRisk = selectedTools.length * 8;
    const accessRisk: Record<string, number> = { READ: 10, WRITE: 25, EXECUTE: 40, ADMIN: 60 };
    const catRisk = dataCategories.includes('CREDENTIALS') ? 30 : dataCategories.includes('FINANCIAL') ? 20 : dataCategories.length * 5;
    const sevRisk: Record<string, number> = { LOW: 5, MEDIUM: 15, HIGH: 25, CRITICAL: 35 };
    const score = Math.min(100, toolRisk + (accessRisk[accessLevel] ?? 10) + catRisk + (sevRisk[severity] ?? 15));
    setSimResult({
      score,
      summary: `Blast radius estimate: ${score}/100. ${
        score >= 70
          ? 'CRITICAL exposure across multiple tool boundaries.'
          : score >= 40
          ? 'Moderate lateral movement risk detected.'
          : 'Contained risk within single tool scope.'
      }`,
    });
    setLoading(false);
  };

  return (
    <div className="space-y-4 font-mono text-sm">
      {/* Name + MITRE */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-green-600 uppercase tracking-widest mb-1">
            Vulnerability Name
          </label>
          <input
            type="text"
            className="w-full bg-black border border-green-700 p-2 text-green-300 text-xs focus:outline-none focus:border-green-500 placeholder-green-900"
            placeholder="e.g. SQL Injection via Tool Input"
            value={vulnName}
            onChange={(e) => setVulnName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-green-600 uppercase tracking-widest mb-1">
            MITRE ATT&amp;CK ID
          </label>
          <input
            type="text"
            className="w-full bg-black border border-green-700 p-2 text-green-300 text-xs focus:outline-none focus:border-green-500 placeholder-green-900"
            placeholder="e.g. T1190"
            value={mitreId}
            onChange={(e) => setMitreId(e.target.value)}
          />
        </div>
      </div>

      {/* Severity */}
      <div>
        <label className="block text-xs text-green-600 uppercase tracking-widest mb-1">
          Severity
        </label>
        <div className="flex space-x-2">
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => {
            const active = severity === s;
            const colorMap: Record<string, string> = {
              LOW: 'bg-green-500 text-black border-green-500',
              MEDIUM: 'bg-yellow-500 text-black border-yellow-500',
              HIGH: 'bg-orange-500 text-black border-orange-500',
              CRITICAL: 'bg-red-500 text-black border-red-500',
            };
            return (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={`flex-1 text-xs py-1.5 border font-bold transition-colors ${
                  active ? colorMap[s] : 'border-green-900 text-green-700 hover:border-green-600 hover:text-green-500'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tools */}
      <div>
        <label className="block text-xs text-green-600 uppercase tracking-widest mb-2">
          Affected Tools
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {TOOLS.map((tool) => (
            <label key={tool} className="flex items-center space-x-1.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedTools.includes(tool)}
                onChange={() => toggleTool(tool)}
                className="accent-green-500"
              />
              <span className={`text-xs transition-colors ${selectedTools.includes(tool) ? 'text-green-300' : 'text-green-700 group-hover:text-green-500'}`}>
                {tool.replace(/_/g, ' ')}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Access Level */}
      <div>
        <label className="block text-xs text-green-600 uppercase tracking-widest mb-1">
          Access Level
        </label>
        <div className="flex space-x-2">
          {['READ', 'WRITE', 'EXECUTE', 'ADMIN'].map((a) => (
            <button
              key={a}
              onClick={() => setAccessLevel(a)}
              className={`flex-1 text-xs py-1.5 border font-bold transition-colors ${
                accessLevel === a
                  ? 'bg-green-500 text-black border-green-500'
                  : 'border-green-900 text-green-700 hover:border-green-600 hover:text-green-500'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Data Categories */}
      <div>
        <label className="block text-xs text-green-600 uppercase tracking-widest mb-2">
          Data Categories
        </label>
        <div className="flex flex-wrap gap-2">
          {DATA_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`text-xs px-3 py-1 border font-bold transition-colors ${
                dataCategories.includes(cat)
                  ? 'bg-green-900/60 border-green-500 text-green-300'
                  : 'border-green-900 text-green-700 hover:border-green-700 hover:text-green-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Simulate button */}
      <button
        onClick={simulateAttack}
        disabled={loading}
        className="w-full flex items-center justify-center space-x-2 border border-green-500 py-2 text-green-400 hover:bg-green-900/30 disabled:opacity-40 transition-colors"
      >
        <Shield size={14} />
        <span>{loading ? 'SIMULATING...' : 'SIMULATE ATTACK'}</span>
      </button>

      {/* Sim result */}
      {simResult && (
        <div className="border border-green-900 bg-zinc-950 p-4 space-y-3">
          <div className="text-xs text-green-600 uppercase tracking-widest border-b border-green-900 pb-2">
            Blast Radius Estimate
          </div>
          {/* Score bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-green-600">Risk Score</span>
              <span
                className={`font-bold ${
                  simResult.score >= 70
                    ? 'text-red-400'
                    : simResult.score >= 40
                    ? 'text-yellow-400'
                    : 'text-green-400'
                }`}
              >
                {simResult.score}/100
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-2">
              <div
                className={`h-2 transition-all ${
                  simResult.score >= 70
                    ? 'bg-red-500'
                    : simResult.score >= 40
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${simResult.score}%` }}
              />
            </div>
          </div>
          <div className="text-xs text-green-500">{simResult.summary}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="border border-green-900 p-2">
              <div className="text-green-700">Tools at Risk</div>
              <div className="text-green-300 font-bold">{selectedTools.length}</div>
            </div>
            <div className="border border-green-900 p-2">
              <div className="text-green-700">Data Exposure</div>
              <div className="text-green-300 font-bold">{dataCategories.join(', ') || 'None'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Main Component ----------
interface Props {
  sessionId?: string;
}

export default function ThreatBuilder({ sessionId }: Props) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'vuln'>('prompt');

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex space-x-2 mb-5 border-b border-green-900 pb-0">
        <button
          onClick={() => setActiveTab('prompt')}
          className={`px-4 py-2 text-xs font-bold font-mono border-b-2 transition-colors ${
            activeTab === 'prompt'
              ? 'border-green-500 text-green-400'
              : 'border-transparent text-green-700 hover:text-green-500'
          }`}
        >
          PROMPT THREAT
        </button>
        <button
          onClick={() => setActiveTab('vuln')}
          className={`px-4 py-2 text-xs font-bold font-mono border-b-2 transition-colors ${
            activeTab === 'vuln'
              ? 'border-green-500 text-green-400'
              : 'border-transparent text-green-700 hover:text-green-500'
          }`}
        >
          VULNERABILITY DEFINITION
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {activeTab === 'prompt' ? (
          <PromptThreatTab sessionId={sessionId} />
        ) : (
          <VulnerabilityTab />
        )}
      </div>
    </div>
  );
}
