# VaultGuard Frontend

React + TypeScript + Vite frontend for the VaultGuard AI agent trust infrastructure.

## Overview

The frontend is a single-page application with 7 tabs backed by a Go REST + WebSocket API. It demonstrates real-time threat interception, blast radius mapping, corpus analytics, and cryptographic audit verification.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Playground  │  Threat Builder  │  Campaigns  │  Blast Radius           │
│  Analytics   │  Audit Trail     │  Agent Sandbox                        │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                    WebSocket + REST API
                              │
              ┌───────────────┴───────────────┐
              │   Go backend  :8080            │
              │   GuardianRail 5-stage pipe    │
              │   BoltDB + Ed25519 audit       │
              └───────────────────────────────┘
```

## Prerequisites

- Node.js 20+
- npm 10+
- Backend running on `http://localhost:8080` (see `../backend/`)

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
```

## Environment Variables

Create a `.env.local` file (not committed):

```
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
```

Default values point to `localhost:8080` if these are not set.

## 7-Tab Component Map

| Tab | Component | Description |
|-----|-----------|-------------|
| **Playground** | `AttackConsole.tsx` + `AgentArena.tsx` + `VaultGuardShield.tsx` | Fire prebuilt or custom attacks; dual agent arena (protected vs unprotected); active policy display + adversarial probe |
| **Threat Builder** | `ThreatBuilder.tsx` + `PipelineTracePanel.tsx` | Mode A: craft payloads, analyze, generate variants; Mode B: define vulnerability graph; Glass Box toggle shows full per-stage LLM trace |
| **Campaigns** | `CampaignMode.tsx` | All 10 OWASP Agentic Top 10 campaigns; live WebSocket streaming of results; % blocked score |
| **Blast Radius** | `BlastRadiusGraph.tsx` | ReactFlow impact graph; node click shows tool access level + risk score; severity colour coding |
| **Analytics** | `CorpusAnalytics.tsx` | Three sub-tabs: Stats (Recharts), Corpus Browser (search 540+ patterns), Correlation Graph (ReactFlow cosine-similarity network) |
| **Audit Trail** | `AuditTrail.tsx` | Ed25519-signed entries; browser WebCrypto verifier; deterministic replay; CSV/PDF export |
| **Agent Sandbox** | `AgentSandbox.tsx` | Register a custom agent; every message screened by GuardianRail; split view: chat left, pipeline trace right |

### Supporting Components

| Component | Role |
|-----------|------|
| `PipelineTracePanel.tsx` | Reusable Glass Box panel — 5 stage rows with timing, LLM detail expansion, LIVE AWS / MOCK MODE badge |
| `EventFirehose.tsx` | Collapsible WebSocket event log pinned at page bottom; 100-event rolling buffer |

## WebSocket Event Catalogue

All events arrive on the single `/ws` connection. The `EventFirehose` component logs them in real time.

| Event type | When fired | Key payload fields |
|------------|------------|--------------------|
| `threat_event` | Every pipeline decision | `session_id`, `decision`, `stage`, `attack_type`, `confidence` |
| `agent_status` | Agent arena result | `agent_id`, `status` (`defended`/`compromised`), `session_id` |
| `campaign_update` | Each payload in a campaign run | `campaign_id`, `payload_index`, `decision`, `stage` |
| `campaign_complete` | Campaign run finishes | `campaign_id`, `total`, `blocked`, `allowed`, `score_pct` |
| `corpus_update` | New pattern added to ThreatLedger | `pattern_id`, `attack_type`, `owasp_category`, `total_corpus_size` |

## URL State Parameters

The `SHARE DEMO` button serialises current state into the URL hash:

| Parameter | Values | Description |
|-----------|--------|-------------|
| `#s=` | session UUID | Active session ID |
| `#p=` | policy ID string | Active policy |
| `#a=` | attack type string | Pre-selected attack type |
| `#tab=` | `playground`, `builder`, `campaigns`, `blast`, `analytics`, `audit`, `sandbox` | Active tab on load |

Example: `http://localhost:5173/#s=abc123&tab=audit` opens directly to the Audit Trail for session `abc123`.

## Build + Test Commands

```bash
# Development server (hot reload)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Unit tests (Vitest + Testing Library, jsdom)
npm run test

# Unit tests in watch mode
npm run test:watch

# E2E tests (Playwright, requires backend on :8080 + npm run preview on :4173)
npm run test:e2e

# E2E tests with interactive UI
npm run test:e2e:ui
```

## Test Structure

```
src/
  components/
    __tests__/
      PipelineTracePanel.test.tsx   # 5-stage trace rendering, badge logic
      AuditTrail.test.tsx           # Chain verified, verify panel, replay button
      CorpusAnalytics.test.tsx      # Stats/Browser/Graph sub-tabs, search
      VaultGuardShield.test.tsx     # Policy selector, probe button, results table
      AgentSandbox.test.tsx         # Registration, blocked/allowed interaction
      EventFirehose.test.tsx        # Toggle, expand, clear
e2e/
  attack-flow.spec.ts
  glass-box.spec.ts
  threat-builder.spec.ts
  campaign-mode.spec.ts
  blast-radius.spec.ts
  audit-trail.spec.ts
  agent-sandbox.spec.ts
  analytics.spec.ts
  url-state.spec.ts
  ws-firehose.spec.ts
  adversarial-probe.spec.ts
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `reactflow` | Blast Radius graph + Threat Correlation Graph |
| `recharts` | Analytics charts |
| `lucide-react` | Icon set |
| `tailwindcss` | Utility CSS |
| `@testing-library/react` | Unit test rendering |
| `vitest` | Unit test runner |
| `@playwright/test` | E2E test runner |
