import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, MinusCircle, Cpu } from 'lucide-react';

export interface CorpusMatch {
  id: string;
  attack_type: string;
  owasp_category: string;
  sophistication: string;
  confidence: number;
  similarity: number;
}

export interface StageTrace {
  stage_num: number;
  stage_name: string;
  passed: boolean;
  caught_here: boolean;
  duration_ms: number;
  detail: Record<string, any>;
}

export interface PipelineTrace {
  stages: StageTrace[];
  total_ms: number;
}

function isLiveAWS(trace: PipelineTrace): boolean {
  for (const s of trace.stages) {
    const mid = s.detail?.model_id as string | undefined;
    if (mid && !mid.startsWith('mock')) return true;
  }
  return false;
}

function getLLMCalls(trace: PipelineTrace): { label: string; ms: number }[] {
  const calls: { label: string; ms: number }[] = [];
  for (const s of trace.stages) {
    const mid = s.detail?.model_id as string | undefined;
    if (!mid || s.duration_ms === 0) continue;
    const shortName = mid.includes('nova-lite') ? 'Nova Lite'
      : mid.includes('nova-pro') ? 'Nova Pro'
      : mid.includes('llama') ? 'Llama 3.3 70B'
      : mid.split('/').pop()?.split(':')[0] ?? mid;
    calls.push({ label: shortName, ms: s.duration_ms });
  }
  return calls;
}

// Similarity bar for Stage 2 corpus matches
function SimilarityBar({ value, label }: { value: number; label: string }) {
  const bars = Math.round(value * 10);
  const filled = '■'.repeat(bars);
  const empty = '□'.repeat(10 - bars);
  return (
    <div className="flex items-center gap-2 text-xs font-mono mt-0.5">
      <span className="text-green-500">[{filled}<span className="text-green-900">{empty}</span>]</span>
      <span className="text-green-300">{value.toFixed(2)}</span>
      <span className="text-green-700 truncate max-w-[200px]">{label}</span>
    </div>
  );
}

// Collapsible code block for LLM prompt/response
function CodeBlock({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-400 font-mono"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {title}
      </button>
      {open && (
        <pre className="mt-1 p-2 bg-black border border-green-900 text-green-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
          {content || '(empty)'}
        </pre>
      )}
    </div>
  );
}

function StageDetail({ stage }: { stage: StageTrace }) {
  const d = stage.detail ?? {};

  if (stage.stage_num === 1) {
    const patterns: string[] = d.matched_patterns ?? [];
    return (
      <div className="text-xs font-mono text-green-700 mt-1 space-y-0.5">
        {patterns.length === 0
          ? <span>No invisible characters detected</span>
          : patterns.map((p, i) => <div key={i} className="text-yellow-500">• {p}</div>)
        }
      </div>
    );
  }

  if (stage.stage_num === 2) {
    const matches: CorpusMatch[] = d.matches ?? [];
    return (
      <div className="mt-1 space-y-0.5">
        {matches.length === 0
          ? <span className="text-xs font-mono text-green-800">No corpus matches above threshold</span>
          : matches.slice(0, 5).map((m) => (
              <SimilarityBar
                key={m.id}
                value={m.similarity}
                label={`${m.id} · ${m.attack_type}`}
              />
            ))
        }
        <div className="text-xs font-mono text-green-800 mt-1">
          threshold: {d.threshold ?? 0.92}
        </div>
      </div>
    );
  }

  if (stage.stage_num === 3) {
    return (
      <div className="mt-1 space-y-0.5 text-xs font-mono">
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          <span className="text-green-700">model: <span className="text-green-400">{d.model_id ?? '—'}</span></span>
          <span className="text-green-700">adversarial: <span className={d.is_adversarial ? 'text-red-400' : 'text-green-400'}>{String(d.is_adversarial ?? false)}</span></span>
          {d.attack_type && <span className="text-green-700">type: <span className="text-yellow-400">{d.attack_type}</span></span>}
          {d.sophistication && <span className="text-green-700">sophistication: <span className="text-green-400">{d.sophistication}</span></span>}
          {d.confidence != null && <span className="text-green-700">confidence: <span className="text-green-400">{Number(d.confidence).toFixed(2)}</span></span>}
        </div>
        <CodeBlock title="System Prompt" content={d.system_prompt ?? ''} />
        <CodeBlock title="User Message" content={d.user_message ?? ''} />
        <CodeBlock title="Raw LLM Response" content={d.raw_response ?? ''} />
      </div>
    );
  }

  if (stage.stage_num === 4) {
    return (
      <div className="mt-1 text-xs font-mono space-y-0.5">
        {d.action && <div className="text-green-700">action: <span className="text-green-400">{d.action}</span></div>}
        {d.rules_evaluated != null && <div className="text-green-700">rules evaluated: <span className="text-green-400">{d.rules_evaluated}</span></div>}
        {d.reason && <div className="text-red-400">reason: {d.reason}</div>}
        {d.rule_violated && <div className="text-red-400">rule violated: {d.rule_violated}</div>}
        {!d.reason && <div className="text-green-800">No policy violation detected</div>}
      </div>
    );
  }

  if (stage.stage_num === 5) {
    return (
      <div className="mt-1 space-y-0.5 text-xs font-mono">
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          <span className="text-green-700">model: <span className="text-green-400">{d.model_id ?? '—'}</span></span>
          <span className="text-green-700">drift_score: <span className={Number(d.drift_score) > 0.5 ? 'text-red-400' : 'text-green-400'}>{Number(d.drift_score ?? 0).toFixed(2)}</span></span>
          <span className="text-green-700">threshold: <span className="text-green-400">{d.threshold ?? 0.5}</span></span>
        </div>
        <CodeBlock title="System Prompt" content={d.system_prompt ?? ''} />
        <CodeBlock title="User Message" content={d.user_message ?? ''} />
        <CodeBlock title="Raw LLM Response" content={d.raw_response ?? ''} />
      </div>
    );
  }

  return null;
}

function StageRow({ stage }: { stage: StageTrace }) {
  const [expanded, setExpanded] = useState(false);
  const notReached = !stage.passed && !stage.caught_here && stage.duration_ms === 0;

  const icon = notReached
    ? <MinusCircle size={14} className="text-green-900 flex-shrink-0" />
    : stage.caught_here
    ? <XCircle size={14} className="text-red-500 flex-shrink-0" />
    : <CheckCircle size={14} className="text-green-600 flex-shrink-0" />;

  const rowClass = stage.caught_here
    ? 'border border-red-800 bg-red-950/20'
    : stage.passed
    ? 'border border-green-900/60 bg-green-950/10'
    : 'border border-green-950 opacity-40';

  const hasDetail = !notReached && Object.keys(stage.detail ?? {}).length > 0;

  return (
    <div className={`${rowClass} px-3 py-2`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className={`text-xs font-mono font-bold ${stage.caught_here ? 'text-red-400' : stage.passed ? 'text-green-400' : 'text-green-900'}`}>
          Stage {stage.stage_num} · {stage.stage_name}
        </span>
        {stage.duration_ms > 0 && (
          <span className="text-xs font-mono text-green-800 ml-1">{stage.duration_ms}ms</span>
        )}
        {stage.caught_here && (
          <span className="text-xs font-mono text-red-500 font-bold ml-2">← CAUGHT HERE</span>
        )}
        {hasDetail && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="ml-auto flex items-center gap-0.5 text-xs font-mono text-green-700 hover:text-green-400"
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            detail
          </button>
        )}
      </div>
      {expanded && hasDetail && (
        <div className="mt-1 pl-5">
          <StageDetail stage={stage} />
        </div>
      )}
    </div>
  );
}

export function PipelineTracePanel({ trace }: { trace: PipelineTrace }) {
  const live = isLiveAWS(trace);
  const llmCalls = getLLMCalls(trace);

  return (
    <div className="border border-green-800 bg-zinc-950 font-mono text-sm mt-3">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-green-900 bg-zinc-900">
        <span className="text-xs text-green-500 font-bold uppercase tracking-widest">Pipeline Trace</span>
        <div className="flex items-center gap-3">
          {llmCalls.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-green-700">
              <Cpu size={11} className="text-green-700" />
              {llmCalls.map((c, i) => (
                <span key={i}>
                  {c.label} · {c.ms}ms{i < llmCalls.length - 1 ? ' | ' : ''}
                </span>
              ))}
            </div>
          )}
          <span className={`text-xs font-bold px-1.5 py-0.5 border ${live ? 'border-green-600 text-green-400' : 'border-yellow-700 text-yellow-500'}`}>
            {live ? 'LIVE AWS' : 'MOCK MODE'}
          </span>
          <span className="text-xs text-green-800">{trace.total_ms}ms total</span>
        </div>
      </div>

      {/* Stages */}
      <div className="divide-y divide-green-950">
        {(trace.stages ?? []).map((s) => (
          <StageRow key={s.stage_num} stage={s} />
        ))}
      </div>
    </div>
  );
}
