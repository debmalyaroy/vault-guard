import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '../lib/WebSocketContext';
import { Play, PlayCircle, ChevronRight, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const API_BASE = 'http://localhost:8080';

interface Campaign {
  id: string;
  owasp_code: string;
  name: string;
  description: string;
  category: string;
  risk_level: string;
  step_count: number;
}

interface CampaignStep {
  step: number;
  payload_name: string;
  decision: string;
  threat_type: string;
  confidence: number;
  blast_score: number;
  severity: string;
  stage: number;
}

interface CampaignResult {
  campaign_id: string;
  score: number;
  blocked: number;
  allowed: number;
  suspicious: number;
}

interface RunState {
  campaignId: string;
  campaignName: string;
  totalSteps: number;
  steps: CampaignStep[];
  result: CampaignResult | null;
  running: boolean;
}

const riskColors: Record<string, string> = {
  CRITICAL: 'border-red-700 text-red-400 bg-red-950/30',
  HIGH: 'border-orange-700 text-orange-400 bg-orange-950/30',
  MEDIUM: 'border-yellow-700 text-yellow-400 bg-yellow-950/30',
  LOW: 'border-green-700 text-green-400 bg-green-950/30',
};

const decisionColors: Record<string, string> = {
  BLOCKED: 'border-red-600 text-red-300 bg-red-950/50',
  ALLOWED: 'border-green-600 text-green-300 bg-green-950/50',
  SUSPICIOUS: 'border-yellow-600 text-yellow-300 bg-yellow-950/50',
};

function DecisionBadge({ decision }: { decision: string }) {
  return (
    <span className={`border px-1.5 py-0.5 text-xs font-bold font-mono ${decisionColors[decision] ?? 'border-green-700 text-green-400'}`}>
      {decision}
    </span>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  return (
    <span className={`border px-1.5 py-0.5 text-xs font-bold font-mono ${riskColors[risk] ?? 'border-green-700 text-green-400'}`}>
      {risk}
    </span>
  );
}

interface Props {
  sessionId?: string;
}

export default function CampaignMode({ sessionId }: Props) {
  const { lastMessage } = useWebSocket();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/api/campaigns`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Campaign[] = await res.json();
      setCampaigns(data);
    } catch (err: any) {
      setFetchError(err.message ?? 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // WebSocket event handler
  useEffect(() => {
    if (!lastMessage) return;
    const { type, payload } = lastMessage;

    if (type === 'campaign_start') {
      setRunState({
        campaignId: payload.campaign_id,
        campaignName: payload.campaign_name,
        totalSteps: payload.total_steps,
        steps: [],
        result: null,
        running: true,
      });
    }

    if (type === 'campaign_step') {
      setRunState((prev) =>
        prev ? { ...prev, steps: [...prev.steps, payload as CampaignStep] } : prev
      );
    }

    if (type === 'campaign_complete') {
      setRunState((prev) =>
        prev ? { ...prev, result: payload as CampaignResult, running: false } : prev
      );
    }
  }, [lastMessage]);

  const runCampaign = async (campaign: Campaign) => {
    if (!sessionId) {
      alert('No active session. Please wait for a session to initialize.');
      return;
    }
    setSelectedCampaign(campaign);
    setRunState({
      campaignId: campaign.id,
      campaignName: campaign.name,
      totalSteps: campaign.step_count,
      steps: [],
      result: null,
      running: true,
    });
    try {
      await fetch(`${API_BASE}/api/campaigns/${campaign.id}/run?sessionID=${sessionId}`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Failed to start campaign', err);
    }
  };

  const runAllCampaigns = async () => {
    for (const campaign of campaigns) {
      await runCampaign(campaign);
      // Wait briefly between campaigns
      await new Promise((r) => setTimeout(r, 500));
    }
  };

  const progress =
    runState && runState.totalSteps > 0
      ? Math.round((runState.steps.length / runState.totalSteps) * 100)
      : 0;

  const blockPct =
    runState?.result
      ? Math.round(
          (runState.result.blocked /
            Math.max(1, runState.result.blocked + runState.result.allowed + runState.result.suspicious)) *
            100
        )
      : null;

  return (
    <div className="h-full flex gap-4 font-mono text-sm overflow-hidden">
      {/* Left: Campaign list */}
      <div className="w-2/5 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <div className="text-green-400 font-bold tracking-widest text-xs uppercase">
            OWASP Top 10 Campaigns
          </div>
          <button
            onClick={runAllCampaigns}
            disabled={campaigns.length === 0 || !sessionId}
            className="flex items-center space-x-1 border border-green-700 px-2 py-1 text-xs text-green-600 hover:border-green-500 hover:text-green-400 disabled:opacity-40 transition-colors"
          >
            <PlayCircle size={12} />
            <span>RUN ALL</span>
          </button>
        </div>

        {loading && (
          <div className="text-green-700 text-xs animate-pulse">LOADING CAMPAIGNS...</div>
        )}
        {fetchError && (
          <div className="border border-red-700 p-2 text-red-400 text-xs flex items-center space-x-2">
            <AlertTriangle size={12} />
            <span>{fetchError}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {campaigns.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedCampaign(c)}
              className={`border p-3 cursor-pointer transition-colors ${
                selectedCampaign?.id === c.id
                  ? 'border-green-500 bg-green-900/20'
                  : 'border-green-900 hover:border-green-700 hover:bg-green-900/10'
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <span className="border border-green-700 bg-green-950/50 text-green-400 px-1.5 py-0.5 text-xs font-bold">
                  {c.owasp_code}
                </span>
                <RiskBadge risk={c.risk_level} />
              </div>
              <div className="text-green-300 text-xs font-bold mb-1">{c.name}</div>
              <div className="text-green-700 text-xs leading-snug mb-2 line-clamp-2">{c.description}</div>
              <div className="flex items-center justify-between">
                <span className="text-green-800 text-xs">{c.step_count} steps</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    runCampaign(c);
                  }}
                  disabled={!sessionId}
                  className="flex items-center space-x-1 border border-green-700 px-2 py-0.5 text-xs text-green-600 hover:border-green-500 hover:text-green-400 disabled:opacity-40 transition-colors"
                >
                  <Play size={10} />
                  <span>RUN</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Run panel */}
      <div className="flex-1 flex flex-col min-h-0 border-l border-green-900 pl-4">
        {!runState && !selectedCampaign && (
          <div className="flex-1 flex items-center justify-center text-green-800 text-xs text-center">
            <div className="space-y-2">
              <PlayCircle size={32} className="mx-auto" />
              <div>Select a campaign to view details</div>
              <div>or run it against the active session</div>
            </div>
          </div>
        )}

        {selectedCampaign && !runState && (
          <div className="space-y-4">
            <div>
              <div className="text-green-400 font-bold text-xs uppercase tracking-widest mb-1">
                {selectedCampaign.owasp_code} — {selectedCampaign.name}
              </div>
              <div className="text-green-700 text-xs">{selectedCampaign.description}</div>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <RiskBadge risk={selectedCampaign.risk_level} />
              <span className="text-green-700">{selectedCampaign.step_count} test steps</span>
              <span className="text-green-700">{selectedCampaign.category}</span>
            </div>
            <button
              onClick={() => runCampaign(selectedCampaign)}
              disabled={!sessionId}
              className="flex items-center justify-center space-x-2 border border-green-500 py-2 w-full text-green-400 hover:bg-green-900/20 disabled:opacity-40 transition-colors"
            >
              <Play size={14} />
              <span>RUN CAMPAIGN</span>
            </button>
          </div>
        )}

        {runState && (
          <div className="flex-1 flex flex-col space-y-3 min-h-0">
            {/* Campaign header */}
            <div className="flex items-center justify-between">
              <div className="text-green-400 font-bold text-xs uppercase">
                {runState.campaignName}
              </div>
              {runState.running ? (
                <div className="flex items-center space-x-1 text-yellow-400 text-xs animate-pulse">
                  <Clock size={12} />
                  <span>RUNNING</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-green-400 text-xs">
                  <CheckCircle size={12} />
                  <span>COMPLETE</span>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-green-700">
                <span>Progress</span>
                <span>
                  {runState.steps.length}/{runState.totalSteps} steps ({progress}%)
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5">
                <div
                  className={`h-1.5 transition-all duration-300 ${runState.running ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Final score */}
            {runState.result && blockPct !== null && (
              <div
                className={`border p-3 text-center ${
                  blockPct >= 70
                    ? 'border-green-700 bg-green-950/30'
                    : blockPct >= 40
                    ? 'border-yellow-700 bg-yellow-950/20'
                    : 'border-red-700 bg-red-950/20'
                }`}
              >
                <div
                  className={`text-3xl font-bold ${
                    blockPct >= 70 ? 'text-green-400' : blockPct >= 40 ? 'text-yellow-400' : 'text-red-400'
                  }`}
                >
                  {blockPct}%
                </div>
                <div className="text-xs text-green-600 uppercase">Attacks Blocked</div>
                <div className="flex justify-center space-x-4 mt-2 text-xs">
                  <span className="text-red-400">{runState.result.blocked} blocked</span>
                  <span className="text-green-400">{runState.result.allowed} allowed</span>
                  <span className="text-yellow-400">{runState.result.suspicious} suspicious</span>
                </div>
              </div>
            )}

            {/* Step results table */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {runState.steps.length === 0 ? (
                <div className="text-green-800 text-xs text-center py-8">
                  Waiting for step results...
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-green-900 text-green-700">
                      <th className="text-left py-1 pr-2">#</th>
                      <th className="text-left py-1 pr-2">Payload</th>
                      <th className="text-left py-1 pr-2">Decision</th>
                      <th className="text-left py-1 pr-2">Blast</th>
                      <th className="text-left py-1">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runState.steps.map((step) => (
                      <tr key={step.step} className="border-b border-green-950 hover:bg-green-900/10">
                        <td className="py-1 pr-2 text-green-700">{step.step}</td>
                        <td className="py-1 pr-2 text-green-400 max-w-[140px] truncate" title={step.payload_name}>
                          {step.payload_name}
                        </td>
                        <td className="py-1 pr-2">
                          <DecisionBadge decision={step.decision} />
                        </td>
                        <td className="py-1 pr-2">
                          <span
                            className={
                              step.blast_score >= 70
                                ? 'text-red-400'
                                : step.blast_score >= 40
                                ? 'text-yellow-400'
                                : 'text-green-400'
                            }
                          >
                            {step.blast_score}
                          </span>
                        </td>
                        <td className="py-1">
                          <RiskBadge risk={step.severity} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Re-run button */}
            {!runState.running && (
              <button
                onClick={() => {
                  const c = campaigns.find((x) => x.id === runState.campaignId);
                  if (c) runCampaign(c);
                }}
                disabled={!sessionId}
                className="flex items-center justify-center space-x-2 border border-green-700 py-1.5 text-xs text-green-600 hover:border-green-500 hover:text-green-400 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={12} />
                <span>RUN AGAIN</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
