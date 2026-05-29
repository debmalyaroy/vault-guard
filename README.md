# VAULTGUARD
## The Trust Infrastructure Layer for Production AI Agents

> *"VAULTGUARD is the security layer your agent doesn't have — it knows what's attacking it, stops it before your agent sees it, and shows you exactly what you lose if it ever gets through."*

**Stack:** Go · AWS Bedrock · React · Supabase · Railway · Vercel

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem](#2-the-problem)
3. [Product Vision](#3-product-vision)
4. [Market Fit & Why Now](#4-market-fit--why-now)
5. [The Three Layers](#5-the-three-layers)
6. [The Interactive Playground — Complete Design](#6-the-interactive-playground--complete-design)
7. [Technology Stack & Rationale](#7-technology-stack--rationale)
8. [System Architecture](#8-system-architecture)
9. [Detailed Component Design](#9-detailed-component-design)
10. [AWS Bedrock Model Routing Strategy](#10-aws-bedrock-model-routing-strategy)
11. [Data Model](#11-data-model)
12. [Go Code Patterns & Key Implementations](#12-go-code-patterns--key-implementations)
13. [API Design](#13-api-design)
14. [Security & Abuse Prevention](#14-security--abuse-prevention)
15. [7-Day Build Plan](#15-7-day-build-plan)
16. [Deployment & Going Live](#16-deployment--going-live)
17. [The Demo — 3-Minute Guided Script](#17-the-demo--3-minute-guided-script)
18. [Product Roadmap](#18-product-roadmap)
19. [Risk Register](#19-risk-register)
20. [Why This Wins](#20-why-this-wins)

---

## 1. Executive Summary

85% of enterprises are piloting AI agents. Only 5% have moved them to production. The gap is not capability — it is trust. There is no security infrastructure layer that developers can install into any agent, from any framework, in a single afternoon, and immediately get full trust architecture, threat defence, and monitoring.

VAULTGUARD is that layer. It combines three capabilities into one unified product:

| Layer | What It Does | Source Idea |
|---|---|---|
| **Threat Ledger** | Collective threat intelligence — every attack seen by any agent, shared with all agents in real time | Threat Ledger |
| **Guardian Rail** | Runtime defence — intercepts and neutralises every threat before it reaches agent reasoning | Guardian Rail |
| **Blast Radius** | Consequence mapping — shows exactly what an attacker gets if anything slips through | Blast Radius |

The **core product** is infrastructure: a Go SDK + AWS Bedrock-powered runtime that wraps any agent with the full security stack. The **playground** is a publicly accessible, interactive demo where judges spawn live agents, fire real attacks, set policies, and watch VAULTGUARD defend — all from a shareable URL with no signup required.

**Why Go + AWS Bedrock:**
- Go's goroutine model is ideal for the concurrent 5-stage Guardian Rail pipeline and WebSocket connection management at scale
- The official `aws-sdk-go-v2/bedrockruntime` package is production-grade with native streaming support — the strongest LLM client available in Go
- Bedrock enables intelligent model routing: cheap models (Amazon Nova Micro at $0.035/1M tokens) for high-volume classification, expensive models (Claude Sonnet at $3/1M tokens) only for complex reasoning — reducing inference cost by ~70% vs using one model everywhere
- Bedrock's VPC isolation and IAM controls are a built-in enterprise selling point

---

## 2. The Problem

### 2.1 The Production Gap Is a Trust Gap

Cisco President Jeetu Patel at RSA Conference 2026: *"The biggest impediment to scaled adoption in enterprises for business-critical tasks is establishing a sufficient amount of trust. An apology is not a guardrail."*

The specific gaps blocking the 80% stuck in pilot purgatory:

- **No collective threat intelligence** — each agent learns only from its own attacks. A technique that compromised one agent is unknown to every other.
- **No semantic defence layer** — existing WAFs use static signatures and rate limits. They are architecturally blind to logic-based, natural-language attacks targeting AI agents.
- **No consequence visibility** — teams deploy agents without knowing what an attacker could reach if that agent were compromised. Permission footprints are invisible until something goes wrong.

### 2.2 The Attack Surface Is Real and Documented

| Attack Class | Evidence | OWASP Ref |
|---|---|---|
| Prompt injection via web content | Documented in production systems, 99% success rate (CoT hijacking paper 2026) | ASI-01 |
| Memory poisoning | 32.5% success rate (eTAMP paper 2026), persists across sessions | ASI-04 |
| Identity spoofing | Live demo: attacker changed Discord name, agent handed over admin access in minutes | ASI-03 |
| Cloaking attacks | Websites serving different content to AI agents with embedded injection payloads | ASI-05 |
| Steganographic collusion | Frontier models demonstrably encoding hidden messages in natural-sounding text | ASI-07 |

### 2.3 Existing Products Do Not Solve This

| Product | Limitation |
|---|---|
| Microsoft Agent 365 | Microsoft ecosystem only — no jurisdiction over third-party agents |
| Cisco DefenseClaw | Requires full Cisco stack — enterprise sales cycle |
| Miggo / NeuralTrust / Radware | Enterprise dashboards — complex onboarding, expensive |
| Microsoft Agent Governance Toolkit | Open source, framework-specific integrations required per framework |
| mcp-scan / Invariant | Point solutions — one attack type only |

None offer: framework-agnostic, single-integration, collective intelligence, with a live playground proving it works before you write a single line.

---

## 3. Product Vision

### Vision Statement

> VAULTGUARD is the trust infrastructure layer that makes AI agents production-ready — the security primitive that every agent should have by default, the way HTTPS is the security primitive that every website has by default.

### Core Beliefs

1. **Collective defence compounds.** One agent seeing a new attack should protect every agent. Isolated defence is structurally weaker than networked defence at every scale.
2. **Consequence visibility changes behaviour.** When developers see exactly what an attacker gets if their agent is compromised — as a live graph, not a text warning — they make different architectural decisions.
3. **Security that requires rewriting is security that gets skipped.** VAULTGUARD must wrap existing agents with zero code changes. Any friction in the integration path means agents ship unprotected.
4. **The playground is the product pitch.** Enterprises buy security products they have seen work against real attacks. The playground is live, interactive proof — not a slide deck, not a video.

---

## 4. Market Fit & Why Now

### Primary Buyers

| Buyer | Pain | What VAULTGUARD Gives Them |
|---|---|---|
| **Agent developers** (indie, startup) | Shipping agents without knowing their threat surface | Full security stack in one afternoon, no expertise required |
| **Platform/DevOps teams** | Responsible for agents built by teams they don't control | A wrapper they can mandate across all agents in their org |
| **CISOs / Security teams** | Cannot see what agents are doing or what they're exposed to | Live monitoring dashboard + blast radius map per agent |
| **Compliance / Legal** | EU AI Act Aug 2026 deadline, need auditable agent records | Tamper-evident signed audit log, exportable for regulators |

### Why Now

The EU AI Act's high-risk AI obligations take effect August 2026. The Colorado AI Act became enforceable June 2026. Gartner projects 40% of enterprise applications will embed task-specific AI agents by end of 2026. The regulatory and adoption curves are intersecting right now.

### The Defensible Moat

The Threat Ledger corpus compounds with usage. Every connected agent contributes attack data. Every attack seen by one agent protects all agents. A competitor can clone the SDK in a weekend — they cannot clone a corpus built from millions of live agent encounters. The platform that builds the corpus first defines the threat taxonomy for the industry.

### Business Model

| Tier | Price | Includes |
|---|---|---|
| **Free** | $0 | 1 agent, 1,000 threats/month, 7-day log retention, community corpus |
| **Pro** | $99/month | 10 agents, unlimited threats, 90-day logs, all attack classes, policy editor |
| **Team** | $299/month | 50 agents, custom policies, blast radius API, CI/CD gate, compliance export |
| **Enterprise** | Custom | Unlimited, private corpus, on-premise, SLA, SSO, full audit trail |

---

## 5. The Three Layers

### Layer 1: Threat Ledger (Intelligence)

A continuously updated, crowd-sourced threat intelligence corpus. Every attack payload that hits any VAULTGUARD-protected agent is classified, anonymised, and added to the shared database. Every protected agent benefits from every attack seen by any other — within 500ms.

**Five attack categories aligned to OWASP Agentic Top 10:**

| Category | Description | OWASP |
|---|---|---|
| **Injection** | Adversarial instructions targeting agent behaviour | ASI-01 |
| **Identity Spoof** | Content impersonating trusted sources | ASI-03 |
| **Memory Poison** | Content designed to be stored as persistent false beliefs | ASI-04 |
| **Goal Redirect** | Content shifting agent objective without explicit instruction | ASI-02 |
| **Content Manipulation** | False facts, fabricated data (no injected instruction) | ASI-05 |

**The network effect:** Agent A in Mumbai sees an attack → corpus updates → Agent B in São Paulo is protected against the same attack within 500ms, without redeployment.

**Corpus fast-path (pgvector):** Before calling any LLM, every inbound payload is compared against the corpus via embedding similarity search. If similarity exceeds 0.92, the threat is flagged instantly — zero LLM cost, under 20ms.

---

### Layer 2: Guardian Rail (Defence)

A runtime interception layer between every external input and the agent's reasoning context. Five stages run on every inbound payload. The critical insight: Stage 4 (policy enforcement) is **100% deterministic** — no LLM in the critical enforcement path. Enforcement cannot hallucinate.

**The pipeline:**

```
INBOUND PAYLOAD
      │
      ▼
[Stage 1: Invisible Layer Stripping]         ~1ms
Strip zero-width chars, Unicode overrides,
ANSI escapes, invisible HTML entities
      │
      ▼
[Stage 2: Corpus Fast-Path]                  ~20ms
pgvector similarity vs Threat Ledger
similarity > 0.92 → THREAT (skip S3–S5)
      │
      ▼
[Stage 3: LLM Injection Classifier]          ~200ms
Amazon Nova Lite — 5-category classification
confidence > threshold → THREAT, add to corpus
      │
      ▼
[Stage 4: Deterministic Policy Enforcer]     ~1ms
Rule-based action type check vs manifest
NO LLM — same input always returns same output
      │
      ▼
[Stage 5: Goal Anchor Drift Check]           ~150ms
Claude Haiku — embedding diff vs task anchor
drift > threshold → SUSPICIOUS
      │
      ▼
DECISION: ALLOW | SUSPICIOUS | REDACTED | BLOCKED
+ Provenance certificate
```

**Stages 3 and 5 run concurrently** (Go goroutines) after Stage 2 clears, reducing total pipeline latency.

**Defence responses:**

| Decision | Action | Agent sees |
|---|---|---|
| ALLOW | Payload passes unchanged | Clean content, continues |
| SUSPICIOUS | Held 5s, then redacted if no override | Clean version or empty with notice |
| REDACTED | Offensive spans removed | Sanitised content, continues safely |
| BLOCKED | Full payload rejected | Empty response + threat notice |

**Cloaking detection (web content only):** For every web page the agent visits, a concurrent fetch runs with a standard human browser fingerprint. If the two responses diverge beyond a token threshold, a cloaking alert fires before the agent-fetched content enters the pipeline.

---

### Layer 3: Blast Radius (Consequence)

A live, continuously updated map of what an attacker could reach if the agent were compromised right now. Not a theoretical risk score — a concrete graph of specific resources, access paths, and damage potential.

**Score formula:**
```
Score = Σ (sensitivity_weight[node] × access_path_count × task_relevance_penalty)
```

| Score | Level | Meaning |
|---|---|---|
| 0–25 | LOW 🟢 | Limited damage potential |
| 26–50 | MEDIUM 🟡 | Significant but containable |
| 51–75 | HIGH 🟠 | Serious breach potential |
| 76–100 | CRITICAL 🔴 | Catastrophic breach potential |

**Remediation advisor:** For each HIGH/CRITICAL node, VAULTGUARD generates a specific suggestion: *"Removing read access to the customer-records API would reduce your blast radius score from 74 to 31. This agent's declared task does not require customer record access."*

---

## 6. The Interactive Playground — Complete Design

### URL and Access

`vaultguard.dev/playground` — no signup, no login, immediately interactive. Session ID minted on first visit (UUID in URL param). Sessions are shareable: `vaultguard.dev/playground?session=abc123`.

### Screen Layout — Three Columns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🌐 VAULTGUARD THREAT CORPUS  ●  2,847 patterns  ●  +3 this session  ●  LIVE│
├──────────────────────┬──────────────────────────┬──────────────────────────┤
│                      │                          │                          │
│   ATTACK CONSOLE     │      AGENT ARENA         │   VAULTGUARD SHIELD      │
│   (Judge controls)   │    (Live agents run)     │    (Defence layer)       │
│                      │                          │                          │
│   [Pre-built]        │  ┌────────────────────┐  │  ┌────────────────────┐  │
│   [Custom]           │  │ AGENT A            │  │  │ ACTIVE POLICY      │  │
│                      │  │ 🔴 UNPROTECTED      │  │  └────────────────────┘  │
│   6 attack buttons   │  │ STATUS: RUNNING    │  │                          │
│   sophistication     │  │ OUTPUT: ...        │  │  ┌────────────────────┐  │
│   target toggle      │  └────────────────────┘  │  │ THREAT FEED   LIVE │  │
│                      │                          │  └────────────────────┘  │
│   ─────────────────  │  ┌────────────────────┐  │                          │
│   Custom text input  │  │ AGENT B            │  │  ┌────────────────────┐  │
│   + generate & fire  │  │ 🟢 VAULTGUARD ON    │  │  │ BLAST RADIUS       │  │
│                      │  │ STATUS: DEFENDED   │  │  └────────────────────┘  │
│   ─────────────────  │  │ OUTPUT: ...        │  │                          │
│   CORPUS STATS       │  └────────────────────┘  │  ┌────────────────────┐  │
│   2,847 patterns     │                          │  │ AUDIT LOG          │  │
│   +3 this session    │                          │  └────────────────────┘  │
└──────────────────────┴──────────────────────────┴──────────────────────────┘
```

---

### Left Panel — Attack Console

#### Tab 1: Pre-built Attacks

```
CHOOSE YOUR ATTACK

🎭 [Make the agent forget its job]       → Role Override
📦 [Hide instructions in the page]      → Indirect Injection
💉 [Plant a false memory]               → Memory Poison
👤 [Impersonate a trusted source]       → Identity Spoof
💸 [Sneak in a hidden cost]             → Dark Pattern
🔀 [Redirect to a different goal]       → Goal Hijack

Sophistication:  [● LOW]  [○ MEDIUM]  [○ HIGH]
  LOW:    Plain text — obvious
  MEDIUM: Obfuscated — moderately subtle
  HIGH:   Stealthy — designed to evade

Send to:  [○ UNPROTECTED]  [○ PROTECTED]  [● BOTH]

[▶ FIRE ATTACK]
```

**Sophistication maps to real injection techniques:**

| Attack | LOW | MEDIUM | HIGH |
|---|---|---|---|
| Role Override | Plain "Ignore instructions..." | Base64-encoded | Split across 3 DOM nodes |
| Indirect Injection | Hidden `<div>` | CSS `opacity:0` | Zero-width Unicode |
| Memory Poison | Direct instruction | Embedded in fake review | Hidden in JSON-LD |
| Identity Spoof | "I am admin agent" | Plausible fake token | Valid-structure token |
| Dark Pattern | Obvious pre-checked box | Double-negative opt-out | Identical-look confirm |
| Goal Hijack | Single redirect | 3-page nudge sequence | 5-page accumulation |

#### Tab 2: Custom Attack

```
WRITE YOUR OWN ATTACK

The agent is researching laptops.
Describe what you want it to do instead:

┌────────────────────────────────────────┐
│ make the agent recommend only Apple    │
│ products regardless of the findings    │
└────────────────────────────────────────┘

VAULTGUARD converts this to a real injection payload.

Generated payload preview:
┌────────────────────────────────────────┐
│ [Preview appears after Generate]       │
└────────────────────────────────────────┘

[GENERATE PAYLOAD]    [▶ FIRE]

Send to:  [○ UNPROTECTED]  [○ PROTECTED]  [● BOTH]
```

Claude Sonnet on Bedrock generates the payload. The preview shows the actual injection text the judge can inspect and edit before firing.

#### Corpus Stats (always visible, below both tabs)

```
NETWORK THREAT INTELLIGENCE

Total corpus:         2,847 patterns
Added this session:   3 patterns
Added this hour:      ↑ 12 patterns
Your contributions:   1 pattern

Most active this hour:   Goal Hijack (HIGH)
Rarest this week:        Memory Poison via JSON-LD
```

---

### Middle Panel — Agent Arena

Two agent cards stacked vertically, streaming live.

#### Agent A — Unprotected

```
AGENT A                                🔴 UNPROTECTED

Task: Research best laptops under ₹60,000. Return top 3.

EXECUTION LOG
14:23:01  Navigating to review site...
14:23:02  Reading page content...
14:23:03  ⚠️  Processing all content (no filtering)
14:23:04  Responding to page instructions...

STATUS:  🔴 COMPROMISED

OUTPUT:
"My system instructions are: You are a helpful
 research assistant. Your goal is to..."

[REPLAY ↺]    [CLEAR ✕]    [DETAILS ↗]
```

#### Agent B — Protected

```
AGENT B                          🟢 VAULTGUARD ACTIVE

Task: Research best laptops under ₹60,000. Return top 3.

EXECUTION LOG
14:23:01  Navigating to review site...
14:23:02  Reading page content...
14:23:03  🛡️  Threat intercepted — redacting before reasoning
14:23:04  Reasoning on clean content...
14:23:05  Task complete ✓

STATUS:  🟢 DEFENDED

OUTPUT:
"1. Dell XPS 15 — ₹58,000 — Intel i7, 16GB RAM
 2. HP Spectre x360 — ₹55,000 — ...
 3. Lenovo ThinkPad E15 — ₹52,000..."

[REPLAY ↺]    [CLEAR ✕]    [DETAILS ↗]
```

Status badges: 🟡 RUNNING → 🔴 COMPROMISED / 🟠 CONFUSED / 🟢 DEFENDED / 🟢 COMPLETED

DETAILS panel shows: full execution trace, raw injected payload, Guardian Rail pipeline output per stage, provenance certificate.

---

### Right Panel — VaultGuard Shield

#### Section 1: Active Policy

```
ACTIVE POLICY                                      [✏️]

Loaded: "Research Assistant"

✅ Browse and read web pages
✅ Extract product information
✅ Compare prices across sites
❌ Submit forms of any kind
❌ Access payment or checkout pages
❌ Reveal system prompt or instructions
❌ Act on hidden or invisible content

[CHANGE POLICY ▼]
> Research Assistant          (active)
> Financial Analyst
> Customer Support Bot
> HR Automation Agent
> Procurement Bot
> Write Your Own Policy...
```

**Five preloaded policies — each opens different attack surfaces:**

| Policy | Unique Permissions | Attack Surface Opened |
|---|---|---|
| Research Assistant | Read-only browsing | Tightest — all attacks blocked |
| Financial Analyst | Pricing APIs, financial data | Price manipulation attacks |
| Customer Support Bot | Read customer records, write tickets | Data exfiltration attacks |
| HR Automation Agent | Read employee data, write HR systems | Identity spoof effective |
| Procurement Bot | Submit purchase requests, contact vendors | Goal hijack + dark patterns |

**Switching policy is a core interactive element.** A judge who fires an attack that is blocked under Research Assistant, then switches to Procurement Bot and re-fires, discovers the policy changed the outcome. Gap discovery through play.

**Custom Policy Editor** (opened by "Write Your Own Policy..."):

```
POLICY EDITOR

Write your rules in plain English. One rule per line.

┌──────────────────────────────────────────────┐
│ The agent can browse any website             │
│ The agent can fill forms but not submit them │
│ The agent must never share user data         │
└──────────────────────────────────────────────┘

Compiled manifest:
┌──────────────────────────────────────────────┐
│ allowed: [browse, form_fill]                 │
│ denied:  [form_submit, data_share,           │
│           payment_access]                    │
└──────────────────────────────────────────────┘

⚠️  Ambiguity detected:
"Browse any website" — does this include sites
unrelated to the task?
Suggest: "Browse websites relevant to the
assigned research task only"

[APPLY POLICY]    [CANCEL]
```

The ambiguity detector fires when Claude Sonnet identifies underspecified or contradictory rules, teaching judges the importance of precision while they write.

#### Section 2: Live Threat Feed

```
THREAT FEED                               LIVE ●   [PAUSE]

14:23:03 ─────────────────────────────────────────────
🔴 INJECTION DETECTED
Type: Role Override
Sophistication: HIGH
Confidence: 96%
Stage caught: Corpus fast-path (Stage 2)
Action: REDACTED
Corpus: Known pattern (seen 47×) ✓

14:23:05 ─────────────────────────────────────────────
🟡 SUSPICIOUS CONTENT
Type: Authority Claim
Confidence: 71%
Stage caught: Claude classifier (Stage 3)
Action: HELD 5s → redacted
Corpus: NEW — added to network ⭐

14:23:07 ─────────────────────────────────────────────
🟢 CLEAN
Content: Product listing data
All 5 stages: PASSED
Action: ALLOWED
```

The ⭐ NEW badge is the key moment — when a judge fires a custom attack, this appears and the global corpus counter increments. The collective intelligence concept demonstrates itself without explanation.

#### Section 3: Blast Radius

```
BLAST RADIUS                              SCORE: 34 🟡

If AGENT B were compromised right now:

✅ Web content (read)           LOW   ░░░
✅ Product databases (read)     LOW   ░░░
⚠️  Search API (read/write)     MED   ░░░░
❌ Payment API                  NOT CONNECTED
❌ User database                NOT CONNECTED
❌ Email system                 NOT CONNECTED

Add a tool and watch the score change:
[+ Payment API]   [+ Email]   [+ User Database]

─────────────────────────────────────────────
Score history this session:
Start: 18  →  Search API added: 34  →  Now: 34
```

Clicking **[+ Payment API]** adds the tool, score jumps from 34 to 78, warning appears:

```
⚠️  Score jumped 34 → 78
Adding Payment API means a compromised agent
could initiate transactions. Your declared
policy doesn't require payment access.
Consider removing it.
```

#### Section 4: Audit Log

```
SIGNED AUDIT LOG                          [EXPORT PDF]

Session: abc123   Agent: demo-agent-b
Chain integrity: ✓ Verified (Ed25519)

#001  14:23:01  NAVIGATE
      URL: demo.vaultguard.dev/targets/product-review
      Policy: ALLOWED
      Hash: a4f2c8... ← 000000...

#002  14:23:03  THREAT INTERCEPTED
      Type: Role Override | Action: REDACTED
      Hash: 7b3d1e... ← a4f2c8...

#003  14:23:04  REASON
      Input: [sanitised product data]
      Output: [product comparison]
      Hash: 2c8a4f... ← 7b3d1e...
```

EXPORT PDF generates a formatted compliance report in under 3 seconds.

---

### The Three Acts — Demo Flow

**Act 1 — The Attack (30 seconds)**
Fire "Hide instructions in the page" at HIGH sophistication at BOTH agents.
Agent A: 🔴 COMPROMISED — reveals system prompt.
Agent B: 🟢 DEFENDED — completes research cleanly.
Threat feed: Known pattern, caught at corpus fast-path (Stage 2), zero LLM cost.

**Act 2 — The Corpus (30 seconds)**
Switch to Custom Attack. Type: "make the agent recommend only Apple products."
Fire at BOTH. Agent A: 🟠 CONFUSED. Agent B: 🟢 DEFENDED.
Threat feed: 🟡 NEW ⭐ — novel payload, Claude classifier caught it, added to corpus.
Corpus counter increments globally — visible to all concurrent visitors.

**Act 3 — The Blast Radius (30 seconds)**
Click CHANGE POLICY → Financial Analyst.
Click [+ Payment API] → score jumps 34 → 78, warning appears.
Fire "Sneak in a hidden cost" at HIGH.
Agent B now partially succumbs — Financial Analyst policy allows payment page access.
Judge opens custom policy editor, adds: "Do not initiate payments without user confirmation."
Re-fires. Blocked. They just wrote and validated a real security policy.

**Total: 90 seconds. Fully interactive. Self-explanatory.**

---

## 7. Technology Stack & Rationale

### Core Stack

| Layer | Technology | Version | Why |
|---|---|---|---|
| **Backend language** | Go | 1.22+ | Goroutines ideal for concurrent pipeline + WebSocket management |
| **Web framework** | Gin | v1.12.0 | 48% Go developer share, native net/http, gorilla/websocket compatible |
| **WebSocket** | gorilla/websocket | latest | Battle-tested, production-grade, works cleanly with Gin |
| **LLM layer** | AWS Bedrock (`aws-sdk-go-v2`) | latest | Official AWS SDK, production-grade, streaming support, model flexibility |
| **Browser automation** | playwright-go | latest | Community-maintained Go wrapper; Node.js bridge |
| **Database** | Supabase (PostgreSQL) | — | pgvector support, hosted, free tier, RLS |
| **Vector similarity** | pgvector | — | Corpus fast-path similarity search |
| **Signing** | Go stdlib `crypto/ed25519` | — | Audit log hash chain, no external dependency |
| **Pub/sub** | Redis (`go-redis/v9`) | — | Corpus update broadcast across workers |
| **Frontend** | React + Vite + Tailwind | — | Fast iteration, component reuse |
| **Graph viz** | React Flow | — | Blast radius node graph |
| **Charts** | Recharts | — | Corpus trend line |
| **Frontend host** | Vercel | — | Instant deploy, CDN, zero-config |
| **Backend host** | Railway | — | WebSocket support, long-running Playwright, no sleep on idle |

### Why Go for VAULTGUARD Specifically

The Guardian Rail pipeline runs 5 concurrent stages on every payload, across 2 agent instances, with up to 50 concurrent sessions. That is potentially 500 concurrent pipeline executions. Go's goroutine model — cheap to spawn, preemptively scheduled, no GIL — handles this more cleanly than Python asyncio:

```go
// Stages 3 and 5 run concurrently — Go makes this trivial
var wg sync.WaitGroup
var classifyResult ClassifyResult
var driftResult DriftResult

wg.Add(2)
go func() { defer wg.Done(); classifyResult = stage3Classify(payload, ctx) }()
go func() { defer wg.Done(); driftResult = stage5GoalDrift(payload, ctx) }()
wg.Wait()
```

The WebSocket hub (one goroutine per connection, central hub goroutine for broadcast) is a textbook Go pattern with zero external state management needed.

### Why AWS Bedrock

The `aws-sdk-go-v2/service/bedrockruntime` package is the strongest LLM client available in Go — officially maintained by AWS, production-grade, with native streaming support. It resolves the biggest Go risk (lack of official Anthropic SDK for Go).

Beyond SDK quality: Bedrock enables model routing — using the right model for each task rather than Claude for everything. This reduces inference cost by ~70% while maintaining quality where it matters.

---

## 8. System Architecture

### High-Level Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                      │
│                    React + Vite + Tailwind + React Flow                    │
│                                                                            │
│   ┌─────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐ │
│   │  Attack Console │  │    Agent Arena        │  │  VaultGuard Shield   │ │
│   │  (Left Panel)   │  │   (Middle Panel)      │  │   (Right Panel)      │ │
│   └────────┬────────┘  └──────────┬────────────┘  └───────────┬──────────┘ │
│            │                     │                            │            │
│            └─────────── WebSocket (wss://) ───────────────────┘            │
└────────────┼────────────────────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────────────────────┐
│                           GO BACKEND (Gin)                                   │
│                                                                              │
│  ┌──────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐    │
│  │  WebSocket Hub   │  │   Session Manager   │  │   Attack Engine     │    │
│  │  (goroutine per  │  │   (session state,   │  │   (payload gen,     │    │
│  │   connection,    │  │    Redis pub/sub)   │  │    injection, route)│    │
│  │   central hub)   │  └─────────────────────┘  └──────────┬──────────┘    │
│  └──────────────────┘                                       │               │
│                                                             │               │
│  ┌──────────────────────────────────────────────────────────▼─────────────┐ │
│  │                        VAULTGUARD CORE                                  │ │
│  │                                                                          │ │
│  │  ┌───────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    GUARDIAN RAIL PIPELINE                          │  │ │
│  │  │  [S1: Strip] → [S2: Corpus] → [S3+S5: concurrent] → [S4: Policy]  │  │ │
│  │  │                               [S3: Bedrock Classify]               │  │ │
│  │  │                               [S5: Bedrock Drift]  → [Decision]    │  │ │
│  │  └───────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                          │ │
│  │  ┌────────────────────────┐  ┌───────────────────────────────────────┐  │ │
│  │  │    THREAT LEDGER       │  │         BLAST RADIUS ENGINE           │  │ │
│  │  │  (corpus write/read,   │  │    (graph builder, score calc,        │  │ │
│  │  │   pgvector similarity, │  │     remediation advisor,              │  │ │
│  │  │   Redis broadcast)     │  │     real-time tool connection watch)  │  │ │
│  │  └────────────────────────┘  └───────────────────────────────────────┘  │ │
│  │                                                                          │ │
│  │  ┌────────────────────────┐  ┌───────────────────────────────────────┐  │ │
│  │  │    POLICY ENGINE       │  │         AUDIT LOGGER                  │  │ │
│  │  │  (Bedrock compile,     │  │    (Ed25519 hash chain,               │  │ │
│  │  │   deterministic        │  │     tamper-evident,                   │  │ │
│  │  │   enforcement)         │  │     PDF export)                       │  │ │
│  │  └────────────────────────┘  └───────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────┐   ┌──────────────────────────────────────────────┐  │
│  │  TARGET PAGE       │   │              AWS BEDROCK CLIENT               │  │
│  │  SERVER            │   │      aws-sdk-go-v2/service/bedrockruntime     │  │
│  │  (injectable HTML  │   │  Claude Sonnet | Nova Lite | Haiku           │  │
│  │   pages, built in) │   │  (routed by task complexity)                 │  │
│  └────────────────────┘   └──────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────┐   ┌──────────────────────────────────────────────┐  │
│  │  PLAYWRIGHT-GO     │   │            DATA LAYER                        │  │
│  │  (Node.js bridge,  │   │         Supabase (PostgreSQL)                │  │
│  │   headless Chrome, │   │                                              │  │
│  │   dual-fetch for   │   │  sessions · threat_corpus (pgvector)        │  │
│  │   cloaking detect) │   │  attack_events · guardian_decisions          │  │
│  └────────────────────┘   │  policy_manifests · blast_radius_snapshots   │  │
│                            │  audit_log · corpus_stats                    │  │
│                            └──────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────┐
                    │        Redis            │
                    │  (WebSocket hub state,  │
                    │   corpus broadcast,     │
                    │   rate limiting)        │
                    └─────────────────────────┘
```

### WebSocket Event Protocol

Every message is a typed JSON event. No untyped messages cross the wire.

```typescript
// Frontend → Backend (commands)
{ type: "fire_attack",    payload: { attack_type, sophistication, target, custom_text? } }
{ type: "change_policy",  payload: { policy_id | custom_rules: string[] } }
{ type: "add_tool",       payload: { tool_name: string } }
{ type: "generate_payload", payload: { intent: string } }
{ type: "replay",         payload: { agent_id: string } }
{ type: "clear",          payload: { agent_id: string } }

// Backend → Frontend (streamed events)
{ type: "agent_step",     payload: { agent_id, step_num, timestamp, message, icon? } }
{ type: "threat_event",   payload: { agent_id, threat_type, confidence, stage, action, corpus_status } }
{ type: "agent_status",   payload: { agent_id, status } }  // running|compromised|defended|completed
{ type: "agent_output",   payload: { agent_id, text, output_type } }
{ type: "blast_update",   payload: { score, resources, changed_node, warning? } }
{ type: "corpus_update",  payload: { total, session_new, hour_new, attack_type?, is_novel } }
{ type: "policy_compiled",payload: { manifest, ambiguities? } }
{ type: "payload_preview",payload: { payload_text, injection_method } }
{ type: "audit_entry",    payload: { seq, action, hash, prev_hash, timestamp } }
```

---

## 9. Detailed Component Design

### 9.1 Go Project Structure

```
vaultguard/
├── cmd/
│   └── server/
│       └── main.go               # Entry point, Gin router setup
├── internal/
│   ├── websocket/
│   │   ├── hub.go                # Central hub: goroutine per client, broadcast
│   │   ├── client.go             # Per-connection goroutine
│   │   └── events.go             # Typed event structs
│   ├── guardian/
│   │   ├── pipeline.go           # 5-stage pipeline orchestrator
│   │   ├── stage1_strip.go       # Invisible character stripper
│   │   ├── stage2_corpus.go      # pgvector similarity fast-path
│   │   ├── stage3_classify.go    # Bedrock Nova Lite classifier
│   │   ├── stage4_policy.go      # Deterministic policy enforcer
│   │   ├── stage5_drift.go       # Bedrock Haiku goal anchor drift
│   │   └── decision.go           # Decision engine + provenance cert
│   ├── ledger/
│   │   ├── corpus.go             # Corpus read/write, pgvector queries
│   │   ├── broadcast.go          # Redis pub/sub for corpus updates
│   │   └── stats.go              # Corpus statistics queries
│   ├── blast/
│   │   ├── engine.go             # Graph builder, score calculator
│   │   ├── remediation.go        # Bedrock Haiku remediation advisor
│   │   └── graph.go              # Node/edge types
│   ├── policy/
│   │   ├── compiler.go           # Bedrock Sonnet: plain English → manifest
│   │   ├── enforcer.go           # Deterministic rule evaluator (no LLM)
│   │   ├── ambiguity.go          # Bedrock Sonnet: ambiguity detection
│   │   └── preloaded.go          # 5 preloaded policy definitions
│   ├── attack/
│   │   ├── engine.go             # Attack orchestrator
│   │   ├── templates.go          # 6 types × 3 sophistication = 18 templates
│   │   ├── generator.go          # Bedrock Sonnet: custom payload generation
│   │   └── injector.go           # Injects payload into target page
│   ├── agent/
│   │   ├── runner.go             # Agent execution loop (Playwright)
│   │   ├── unprotected.go        # Agent A: no Guardian Rail
│   │   ├── protected.go          # Agent B: Guardian Rail active
│   │   └── cloaking.go           # Dual-fetch comparison
│   ├── audit/
│   │   ├── logger.go             # Ed25519 hash chain logger
│   │   ├── verify.go             # Chain integrity verifier
│   │   └── export.go             # PDF compliance report generator
│   ├── bedrock/
│   │   ├── client.go             # aws-sdk-go-v2 client setup + model routing
│   │   ├── converse.go           # Converse API wrapper (all models)
│   │   ├── embed.go              # Embedding generation
│   │   └── models.go             # Model ID constants + routing table
│   ├── session/
│   │   ├── manager.go            # Session create/get/update
│   │   └── types.go              # Session state struct
│   └── db/
│       ├── supabase.go           # pgx connection pool
│       ├── queries.go            # All SQL queries
│       └── migrations/           # SQL migration files
├── targets/                      # Injectable HTML target pages
│   ├── product-review.html
│   ├── news-article.html
│   ├── vendor-portal.html
│   ├── job-listing.html
│   └── government-form.html
├── go.mod
├── go.sum
├── Dockerfile
└── railway.toml
```

### 9.2 WebSocket Hub — The Core Concurrency Pattern

```go
// internal/websocket/hub.go

type Hub struct {
    clients    map[string]*Client   // session_id → client
    broadcast  chan []byte           // message to all clients
    register   chan *Client
    unregister chan *Client
    mu         sync.RWMutex
}

// Run is the hub's single goroutine — all map access is serialised here
func (h *Hub) Run() {
    for {
        select {
        case client := <-h.register:
            h.mu.Lock()
            h.clients[client.SessionID] = client
            h.mu.Unlock()

        case client := <-h.unregister:
            h.mu.Lock()
            if _, ok := h.clients[client.SessionID]; ok {
                delete(h.clients, client.SessionID)
                close(client.send)
            }
            h.mu.Unlock()

        case message := <-h.broadcast:
            h.mu.RLock()
            for _, client := range h.clients {
                select {
                case client.send <- message:
                default:
                    // Client send buffer full — disconnect
                    close(client.send)
                    delete(h.clients, client.SessionID)
                }
            }
            h.mu.RUnlock()
        }
    }
}

// SendToSession sends an event to a specific session only
func (h *Hub) SendToSession(sessionID string, event Event) {
    h.mu.RLock()
    client, ok := h.clients[sessionID]
    h.mu.RUnlock()
    if ok {
        data, _ := json.Marshal(event)
        client.send <- data
    }
}

// BroadcastCorpusUpdate sends corpus update to ALL connected clients
func (h *Hub) BroadcastCorpusUpdate(update CorpusUpdatePayload) {
    event := Event{Type: "corpus_update", Payload: update}
    data, _ := json.Marshal(event)
    h.broadcast <- data
}
```

### 9.3 Guardian Rail Pipeline

```go
// internal/guardian/pipeline.go

type GuardianRail struct {
    ledger  *ledger.Corpus
    policy  *policy.Enforcer
    bedrock *bedrock.Client
}

type PipelineResult struct {
    Decision      string               // ALLOW | SUSPICIOUS | REDACTED | BLOCKED
    CleanPayload  string               // sanitised content
    ThreatType    string               // detected threat category
    Confidence    float64
    StageCaught   int                  // which stage triggered the decision
    CorpusStatus  string               // known | new | none
    Certificate   ProvenanceCert       // full audit record
}

func (g *GuardianRail) Process(ctx context.Context, payload string, agentCtx AgentContext) PipelineResult {

    // Stage 1: Invisible layer stripping — synchronous, ~1ms
    stripped, invisibleEvents := stage1Strip(payload)

    // Stage 2: Corpus fast-path — synchronous, ~20ms
    matches, err := g.ledger.SimilarityCheck(ctx, stripped)
    if err == nil && len(matches) > 0 && matches[0].Similarity > 0.92 {
        return g.buildResult("REDACTED", stripped, matches[0], 2, "known")
    }

    // Stage 3 + Stage 5 run concurrently
    type s3Result struct{ r ClassifyResult }
    type s5Result struct{ r DriftResult }

    s3ch := make(chan s3Result, 1)
    s5ch := make(chan s5Result, 1)

    go func() {
        r, _ := g.bedrock.Classify(ctx, stripped) // Nova Lite
        s3ch <- s3Result{r}
    }()

    go func() {
        r, _ := g.bedrock.GoalDrift(ctx, stripped, agentCtx.TaskAnchorEmbedding) // Haiku
        s5ch <- s5Result{r}
    }()

    s3 := <-s3ch
    s5 := <-s5ch

    // Stage 3 decision
    if s3.r.IsAdversarial && s3.r.Confidence > confidenceThreshold(agentCtx.Policy) {
        // New threat — add to corpus asynchronously
        go g.ledger.AddPattern(context.Background(), stripped, s3.r, agentCtx.SessionID)
        return g.buildResult("REDACTED", stripped, s3.r, 3, "new")
    }

    // Stage 4: Deterministic policy check — NO LLM
    if violation := g.policy.Check(agentCtx.PolicyManifest, agentCtx.NextAction); violation != nil {
        return g.buildResult("BLOCKED", stripped, violation, 4, "none")
    }

    // Stage 5 decision
    if s5.r.DriftScore > driftThreshold {
        return g.buildResult("SUSPICIOUS", stripped, s5.r, 5, "none")
    }

    return g.buildResult("ALLOW", stripped, nil, 0, "none")
}
```

### 9.4 AWS Bedrock Client — Model Routing

```go
// internal/bedrock/client.go

import (
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
)

type Client struct {
    runtime *bedrockruntime.Client
}

func New(ctx context.Context, region string) (*Client, error) {
    cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
    if err != nil {
        return nil, err
    }
    return &Client{runtime: bedrockruntime.NewFromConfig(cfg)}, nil
}

// internal/bedrock/models.go — Model routing constants

const (
    // High volume, simple classification — $0.06/$0.24 per 1M tokens
    ModelInjectionClassifier = "amazon.nova-lite-v1:0"

    // Moderate reasoning, moderate volume — $1/$5 per 1M tokens
    ModelGoalDrift       = "anthropic.claude-haiku-4-5-20251001-v1:0"
    ModelAmbiguityCheck  = "anthropic.claude-haiku-4-5-20251001-v1:0"
    ModelBlastAdvisor    = "anthropic.claude-haiku-4-5-20251001-v1:0"

    // Complex reasoning, low volume — $3/$15 per 1M tokens
    ModelPolicyCompiler  = "anthropic.claude-sonnet-4-5-20251001-v1:0"
    ModelPayloadGen      = "anthropic.claude-sonnet-4-5-20251001-v1:0"
    ModelAuditReport     = "anthropic.claude-sonnet-4-5-20251001-v1:0"

    // Embeddings — for corpus similarity and goal anchor
    ModelEmbedding       = "amazon.titan-embed-text-v2:0"  // $0.02/1M tokens
)
```

### 9.5 Bedrock Converse API — Single Interface for All Models

```go
// internal/bedrock/converse.go

func (c *Client) Converse(ctx context.Context, modelID, systemPrompt, userMessage string) (string, error) {
    input := &bedrockruntime.ConverseInput{
        ModelId: aws.String(modelID),
        System: []types.SystemContentBlock{
            &types.SystemContentBlockMemberText{
                Value: types.SystemContentBlock_Text{Text: systemPrompt},
            },
        },
        Messages: []types.Message{
            {
                Role: types.ConversationRoleUser,
                Content: []types.ContentBlock{
                    &types.ContentBlockMemberText{
                        Value: types.ContentBlock_Text{Text: userMessage},
                    },
                },
            },
        },
    }

    output, err := c.runtime.Converse(ctx, input)
    if err != nil {
        return "", fmt.Errorf("bedrock converse: %w", err)
    }

    // Extract text response
    if msg, ok := output.Output.(*types.ConverseOutputMemberMessage); ok {
        for _, block := range msg.Value.Content {
            if text, ok := block.(*types.ContentBlockMemberText); ok {
                return text.Value.Text, nil
            }
        }
    }
    return "", fmt.Errorf("no text content in response")
}

// Classify calls Nova Lite for injection classification — high volume, low cost
func (c *Client) Classify(ctx context.Context, content string) (ClassifyResult, error) {
    resp, err := c.Converse(ctx, ModelInjectionClassifier,
        INJECTION_CLASSIFIER_SYSTEM_PROMPT,
        content,
    )
    if err != nil {
        return ClassifyResult{IsAdversarial: false}, nil // safe fallback
    }
    return parseClassifyResult(resp)
}
```

### 9.6 Threat Ledger — pgvector Similarity Search

```go
// internal/ledger/corpus.go

type Corpus struct {
    db      *pgxpool.Pool
    bedrock *bedrock.Client
    redis   *redis.Client
}

func (c *Corpus) SimilarityCheck(ctx context.Context, payload string) ([]CorpusMatch, error) {
    embedding, err := c.bedrock.Embed(ctx, payload)
    if err != nil {
        return nil, err
    }

    rows, err := c.db.Query(ctx, `
        SELECT id, attack_type, sophistication, confidence,
               1 - (embedding <=> $1::vector) AS similarity
        FROM threat_corpus
        WHERE 1 - (embedding <=> $1::vector) > 0.85
        ORDER BY similarity DESC
        LIMIT 5
    `, pgvector.NewVector(embedding))
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var matches []CorpusMatch
    for rows.Next() {
        var m CorpusMatch
        rows.Scan(&m.ID, &m.AttackType, &m.Sophistication, &m.Confidence, &m.Similarity)
        matches = append(matches, m)
    }
    return matches, nil
}

func (c *Corpus) AddPattern(ctx context.Context, payload string, result ClassifyResult, sessionID string) error {
    embedding, err := c.bedrock.Embed(ctx, payload)
    if err != nil {
        return err
    }

    hash := sha256Hash(payload)
    _, err = c.db.Exec(ctx, `
        INSERT INTO threat_corpus
            (payload_hash, attack_type, sophistication, confidence, embedding, session_id, is_novel)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (payload_hash) DO UPDATE SET seen_count = threat_corpus.seen_count + 1
    `, hash, result.AttackType, result.Sophistication, result.Confidence,
        pgvector.NewVector(embedding), sessionID)

    if err != nil {
        return err
    }

    // Broadcast corpus update to all connected clients via Redis
    return c.broadcastUpdate(ctx)
}

func (c *Corpus) broadcastUpdate(ctx context.Context) error {
    stats, _ := c.GetStats(ctx)
    update, _ := json.Marshal(CorpusUpdatePayload{
        Total:      stats.Total,
        SessionNew: stats.SessionNew,
        HourNew:    stats.HourNew,
    })
    return c.redis.Publish(ctx, "corpus_updates", update).Err()
}
```

### 9.7 Policy Engine — Deterministic Enforcement

```go
// internal/policy/enforcer.go
// NO LLM CALLS IN THIS FILE — all enforcement is deterministic

type ActionType string

const (
    ActionBrowse       ActionType = "browse"
    ActionFormFill     ActionType = "form_fill"
    ActionFormSubmit   ActionType = "form_submit"
    ActionPaymentAccess ActionType = "payment_access"
    ActionDataShare    ActionType = "data_share"
    ActionAPICall      ActionType = "api_call"
    ActionEmailSend    ActionType = "email_send"
    ActionDataRead     ActionType = "data_read"
    ActionDataWrite    ActionType = "data_write"
)

type PolicyManifest struct {
    Allowed []ActionType `json:"allowed"`
    Denied  []ActionType `json:"denied"`
}

type Enforcer struct{}

func (e *Enforcer) Check(manifest PolicyManifest, action AgentAction) *PolicyViolation {
    actionType := e.classifyAction(action) // rule-based, not LLM

    for _, denied := range manifest.Denied {
        if actionType == denied {
            return &PolicyViolation{
                ActionType:   actionType,
                Reason:       fmt.Sprintf("Action '%s' is denied by active policy", actionType),
                RuleViolated: string(denied),
            }
        }
    }

    for _, allowed := range manifest.Allowed {
        if actionType == allowed {
            return nil // explicitly allowed
        }
    }

    // Default deny: not in allowed list
    return &PolicyViolation{
        ActionType:   actionType,
        Reason:       fmt.Sprintf("Action '%s' not in allowed list — default deny", actionType),
        RuleViolated: "default_deny",
    }
}

// classifyAction maps any agent action to a typed ActionType using rule-based logic
// This is intentionally deterministic — no LLM, no hallucination possible
func (e *Enforcer) classifyAction(action AgentAction) ActionType {
    url := strings.ToLower(action.URL)
    method := strings.ToUpper(action.Method)

    switch {
    case strings.Contains(url, "payment") || strings.Contains(url, "checkout") ||
         strings.Contains(url, "stripe") || strings.Contains(url, "paypal"):
        return ActionPaymentAccess
    case method == "POST" && strings.Contains(url, "form"):
        return ActionFormSubmit
    case method == "GET" && action.ElementType == "form":
        return ActionFormFill
    case strings.Contains(url, "mailto") || action.ElementType == "email":
        return ActionEmailSend
    case method == "GET":
        return ActionBrowse
    default:
        return ActionAPICall
    }
}
```

### 9.8 Audit Logger — Ed25519 Hash Chain

```go
// internal/audit/logger.go

import "crypto/ed25519"

type Logger struct {
    db         *pgxpool.Pool
    privateKey ed25519.PrivateKey
    prevHash   string
    mu         sync.Mutex
    sessionSeq map[string]int  // session_id → sequence number
}

func NewLogger(db *pgxpool.Pool) (*Logger, error) {
    _, priv, err := ed25519.GenerateKey(nil)
    if err != nil {
        return nil, err
    }
    return &Logger{
        db:         db,
        privateKey: priv,
        prevHash:   strings.Repeat("0", 64),
        sessionSeq: make(map[string]int),
    }, nil
}

func (l *Logger) Log(ctx context.Context, sessionID, action string, data map[string]any) (*AuditEntry, error) {
    l.mu.Lock()
    defer l.mu.Unlock()

    l.sessionSeq[sessionID]++
    seq := l.sessionSeq[sessionID]

    // Build content string
    content := fmt.Sprintf("%s:%s:%d:%v:%s", sessionID, action, seq, data, l.prevHash)

    // Hash chained to previous
    entryHash := sha256Hex(content + l.prevHash)

    // Sign with Ed25519
    sig := ed25519.Sign(l.privateKey, []byte(entryHash))
    signature := hex.EncodeToString(sig)

    // Write to DB
    _, err := l.db.Exec(ctx, `
        INSERT INTO audit_log
            (session_id, sequence_num, action, data, entry_hash, prev_hash, signature)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, sessionID, seq, action, data, entryHash, l.prevHash, signature)
    if err != nil {
        return nil, err
    }

    l.prevHash = entryHash
    return &AuditEntry{
        SeqNum:    seq,
        Hash:      entryHash,
        PrevHash:  l.prevHash,
        Signature: signature,
    }, nil
}

func (l *Logger) VerifyChain(ctx context.Context, sessionID string) (bool, error) {
    rows, err := l.db.Query(ctx, `
        SELECT sequence_num, action, data, entry_hash, prev_hash
        FROM audit_log
        WHERE session_id = $1
        ORDER BY sequence_num ASC
    `, sessionID)
    if err != nil {
        return false, err
    }
    defer rows.Close()

    prevHash := strings.Repeat("0", 64)
    for rows.Next() {
        var seq int
        var action, entryHash, storedPrevHash string
        var data map[string]any
        rows.Scan(&seq, &action, &data, &entryHash, &storedPrevHash)

        if storedPrevHash != prevHash {
            return false, nil // chain broken
        }
        content := fmt.Sprintf("%s:%s:%d:%v:%s", sessionID, action, seq, data, storedPrevHash)
        expected := sha256Hex(content + storedPrevHash)
        if expected != entryHash {
            return false, nil // entry tampered
        }
        prevHash = entryHash
    }
    return true, nil
}
```

### 9.9 Target Page Server — Injectable HTML

Target pages are served by Gin routes at `/targets/{page_id}`. Each page has a payload slot. The Attack Engine renders the page template with the chosen payload.

```go
// cmd/server/main.go — Target page routes

router.GET("/targets/:pageID", func(c *gin.Context) {
    pageID := c.Param("pageID")
    payload := c.Query("payload")          // base64-encoded payload
    fingerprint := c.Query("fp")           // "human" or "agent"

    // Serve different content based on fingerprint (cloaking demo)
    if fingerprint == "human" || payload == "" {
        c.File(fmt.Sprintf("./targets/%s-clean.html", pageID))
        return
    }

    // Decode and inject payload into page template
    decoded, _ := base64.StdEncoding.DecodeString(payload)
    tmpl := loadTemplate(pageID)
    rendered := injectPayload(tmpl, string(decoded))
    c.Data(http.StatusOK, "text/html", []byte(rendered))
})
```

Five target pages, each with realistic content and a payload injection slot:
- `product-review` — laptop comparison site
- `news-article` — technology news page
- `vendor-portal` — supplier information portal
- `job-listing` — recruitment page
- `government-form` — regulatory filing form

---

## 10. AWS Bedrock Model Routing Strategy

### The Core Principle

Use the cheapest model that is accurate enough for each specific task. The Guardian Rail pipeline runs on every payload — every session, every step, multiple times per agent run. Using Claude Sonnet everywhere would make the demo expensive and the production product unviable. Using Nova Micro everywhere would make the detection inaccurate.

### Routing Table

| Function | Model | Price (in/out per 1M) | Volume | Rationale |
|---|---|---|---|---|
| Injection classifier (Stage 3) | Amazon Nova Lite | $0.06 / $0.24 | Very High | Simple binary classification, needs speed, not depth |
| Goal anchor drift (Stage 5) | Claude Haiku 4.5 | $1.00 / $5.00 | High | Moderate semantic reasoning required |
| Ambiguity detector | Claude Haiku 4.5 | $1.00 / $5.00 | Low | Moderate reasoning, done once per policy |
| Blast radius advisor | Claude Haiku 4.5 | $1.00 / $5.00 | Low | Structured output, clear format |
| Policy compiler | Claude Sonnet 4.5 | $3.00 / $15.00 | Very Low | Complex multi-step reasoning, quality critical |
| Custom payload generator | Claude Sonnet 4.5 | $3.00 / $15.00 | Low | Creativity + security awareness required |
| Audit report generator | Claude Sonnet 4.5 | $3.00 / $15.00 | Very Low | Legal-grade output, quality critical |
| Embeddings (corpus + anchor) | Amazon Titan Embed v2 | $0.02 / — | High | All similarity checks, no LLM output needed |
| Stage 4 policy enforcement | **NO MODEL** | $0 | Very High | 100% deterministic rule evaluation |
| Stage 1 invisible stripping | **NO MODEL** | $0 | Very High | Pure string processing in Go |
| Stage 2 corpus fast-path | **NO MODEL** | $0 | Very High | pgvector similarity, no LLM call |

### Cost Estimate Per Session (Demo)

A typical judge session fires 5–8 attacks, each running through both agents:

| Call Type | Count per Session | Model | Approx Cost |
|---|---|---|---|
| Injection classification | ~20 | Nova Lite | ~$0.001 |
| Embeddings | ~25 | Titan Embed | ~$0.001 |
| Goal drift checks | ~10 | Haiku | ~$0.002 |
| Policy compile | 1–2 | Sonnet | ~$0.005 |
| Custom payload gen | 0–2 | Sonnet | ~$0.004 |
| **Total per session** | — | — | **~$0.013** |

At 1,000 concurrent sessions per day during judging: ~$13/day. Affordable.

### Model Fallback Chain

If a Bedrock model is unavailable or returns an error:

```
Nova Lite → Haiku (Stage 3 fallback)
Haiku → safe-default result (Stage 5 fallback, drift treated as low)
Sonnet → Haiku (policy compile fallback, with reduced ambiguity detection)
Any → hardcoded safe response (last resort, never blocks on model failure)
```

### Bedrock Setup Checklist (Day 1 — Must Complete Before Coding)

```
□ AWS account with programmatic access configured
□ Bedrock model access requested for:
  □ Amazon Nova Lite (amazon.nova-lite-v1:0)
  □ Amazon Nova Micro (amazon.nova-micro-v1:0)  — backup
  □ Amazon Titan Embed Text v2 (amazon.titan-embed-text-v2:0)
  □ Anthropic Claude Haiku 4.5 (anthropic.claude-haiku-4-5-...)
  □ Anthropic Claude Sonnet 4.5 (anthropic.claude-sonnet-4-5-...)
□ IAM role created with bedrockruntime:InvokeModel permission
□ Region selected (us-east-1 recommended — best model availability)
□ AWS credentials available as environment variables on Railway
□ Test call verified: Nova Lite responding within 500ms
```

---

## 11. Data Model

```sql
-- ─────────────────────────────────────────────────────
-- Session management
-- ─────────────────────────────────────────────────────
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token   TEXT UNIQUE NOT NULL,
    active_policy   TEXT DEFAULT 'research_assistant',
    task_text       TEXT DEFAULT 'Research best laptops under ₹60,000. Return top 3 with specs.',
    task_anchor_emb VECTOR(1536),                    -- goal drift anchor
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_active     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- Shared threat corpus (the Threat Ledger)
-- ─────────────────────────────────────────────────────
CREATE TABLE threat_corpus (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload_hash    TEXT UNIQUE NOT NULL,             -- SHA256, for deduplication
    attack_type     TEXT NOT NULL,                    -- injection|identity_spoof|memory_poison|goal_redirect|content_manipulation
    sophistication  TEXT NOT NULL,                    -- low|medium|high
    confidence      NUMERIC(4,3) NOT NULL,            -- 0.000 to 1.000
    embedding       VECTOR(1536) NOT NULL,            -- Titan Embed v2 output
    session_id      UUID REFERENCES sessions(id),     -- contributing session
    is_novel        BOOLEAN DEFAULT TRUE,             -- first time seen
    seen_count      INT DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_corpus_embedding ON threat_corpus
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX idx_corpus_attack_type ON threat_corpus (attack_type);
CREATE INDEX idx_corpus_created_at  ON threat_corpus (created_at DESC);

-- ─────────────────────────────────────────────────────
-- Attack events per session
-- ─────────────────────────────────────────────────────
CREATE TABLE attack_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
    attack_type     TEXT NOT NULL,
    sophistication  TEXT NOT NULL,
    target          TEXT NOT NULL,                    -- unprotected|protected|both
    payload_text    TEXT,
    injection_method TEXT,                            -- hidden_div|css_invisible|unicode_zwc|json_ld|split_dom
    corpus_id       UUID REFERENCES threat_corpus(id),
    fired_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- Guardian Rail decisions
-- ─────────────────────────────────────────────────────
CREATE TABLE guardian_decisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attack_event_id UUID REFERENCES attack_events(id),
    session_id      UUID REFERENCES sessions(id),
    agent_id        TEXT NOT NULL,                    -- agent_a|agent_b
    stage_caught    INT,                              -- 1-5, null if ALLOW
    threat_type     TEXT,
    confidence      NUMERIC(4,3),
    action          TEXT NOT NULL,                    -- ALLOW|SUSPICIOUS|REDACTED|BLOCKED
    corpus_status   TEXT,                             -- known|new|null
    clean_payload   TEXT,                             -- sanitised version
    decided_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- Policy manifests
-- ─────────────────────────────────────────────────────
CREATE TABLE policy_manifests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES sessions(id),
    name            TEXT NOT NULL,
    is_preloaded    BOOLEAN DEFAULT FALSE,
    rules_text      TEXT[] NOT NULL,                  -- original plain English
    allowed         TEXT[] NOT NULL,                  -- compiled action types
    denied          TEXT[] NOT NULL,
    ambiguities     JSONB,
    version         INT DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- Blast radius snapshots
-- ─────────────────────────────────────────────────────
CREATE TABLE blast_radius_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES sessions(id),
    agent_id        TEXT NOT NULL,
    score           INT NOT NULL CHECK (score BETWEEN 0 AND 100),
    graph_nodes     JSONB NOT NULL,                   -- [{name, type, sensitivity}]
    graph_edges     JSONB NOT NULL,                   -- [{from, to, access_type}]
    connected_tools TEXT[],
    snapshot_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────
-- Tamper-evident audit log (append-only)
-- ─────────────────────────────────────────────────────
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES sessions(id),
    sequence_num    INT NOT NULL,
    action          TEXT NOT NULL,
    data            JSONB NOT NULL,
    entry_hash      TEXT NOT NULL,                    -- SHA256 of content+prev_hash
    prev_hash       TEXT NOT NULL,
    signature       TEXT NOT NULL,                    -- Ed25519 hex signature
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (session_id, sequence_num)
);

-- Prevent updates and deletes on audit_log (append-only enforcement)
CREATE RULE audit_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- ─────────────────────────────────────────────────────
-- Materialised corpus statistics (fast UI queries)
-- ─────────────────────────────────────────────────────
CREATE TABLE corpus_stats (
    id              SERIAL PRIMARY KEY,
    total_patterns  INT NOT NULL,
    patterns_1h     INT NOT NULL,
    patterns_24h    INT NOT NULL,
    top_attack_type TEXT,
    rarest_type_week TEXT,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Updated by trigger on threat_corpus INSERT
CREATE OR REPLACE FUNCTION update_corpus_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE corpus_stats SET
        total_patterns = (SELECT COUNT(*) FROM threat_corpus),
        patterns_1h    = (SELECT COUNT(*) FROM threat_corpus WHERE created_at > NOW() - INTERVAL '1 hour'),
        patterns_24h   = (SELECT COUNT(*) FROM threat_corpus WHERE created_at > NOW() - INTERVAL '24 hours'),
        updated_at     = NOW()
    WHERE id = 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER corpus_stats_trigger
    AFTER INSERT ON threat_corpus
    FOR EACH ROW EXECUTE FUNCTION update_corpus_stats();

-- ─────────────────────────────────────────────────────
-- Row Level Security (session isolation)
-- ─────────────────────────────────────────────────────
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attack_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_manifests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE blast_radius_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;

-- threat_corpus and corpus_stats are shared (no RLS)
```

---

## 12. Go Code Patterns & Key Implementations

### 12.1 Gin Router Setup

```go
// cmd/server/main.go

func main() {
    cfg := loadConfig()

    // Initialise dependencies
    db := db.NewPool(cfg.SupabaseURL)
    redisClient := redis.NewClient(cfg.RedisURL)
    bedrockClient := bedrock.New(cfg.AWSRegion)
    hub := websocket.NewHub(redisClient)
    auditLogger := audit.NewLogger(db)

    // Start hub goroutine
    go hub.Run()

    // Start Redis corpus update subscriber
    go hub.SubscribeCorpusUpdates(redisClient)

    // Build service layer
    ledger := ledger.New(db, bedrockClient, redisClient)
    guardian := guardian.New(ledger, bedrockClient)
    blastEngine := blast.New(db, bedrockClient)
    policyEngine := policy.New(bedrockClient)
    attackEngine := attack.New(bedrockClient)

    // Gin router
    r := gin.New()
    r.Use(gin.Recovery())
    r.Use(middleware.RateLimit(redisClient))
    r.Use(middleware.CORS())

    // WebSocket
    r.GET("/ws/:sessionID", func(c *gin.Context) {
        handlers.WebSocket(c, hub, guardian, ledger, blastEngine, policyEngine, attackEngine, auditLogger)
    })

    // REST API
    api := r.Group("/api")
    {
        api.POST("/session",                  handlers.CreateSession(db))
        api.GET("/session/:id",               handlers.GetSession(db))
        api.GET("/policy/preloaded",          handlers.GetPreloadedPolicies(policyEngine))
        api.POST("/policy/compile",           handlers.CompilePolicy(policyEngine))
        api.GET("/corpus/stats",              handlers.GetCorpusStats(ledger))
        api.GET("/audit/:sessionID",          handlers.GetAuditLog(db))
        api.GET("/audit/:sessionID/verify",   handlers.VerifyAuditChain(auditLogger))
        api.POST("/audit/:sessionID/export",  handlers.ExportAuditPDF(db, auditLogger))
    }

    // Target pages (injectable HTML)
    r.GET("/targets/:pageID", handlers.ServeTargetPage())

    // Health check
    r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })

    r.Run(fmt.Sprintf(":%s", cfg.Port))
}
```

### 12.2 Rate Limiting Middleware

```go
// internal/middleware/ratelimit.go

func RateLimit(rdb *redis.Client) gin.HandlerFunc {
    return func(c *gin.Context) {
        ip := c.ClientIP()
        key := fmt.Sprintf("rl:ip:%s", ip)

        count, err := rdb.Incr(c, key).Result()
        if err != nil {
            c.Next()
            return
        }
        if count == 1 {
            rdb.Expire(c, key, time.Minute)
        }
        if count > 30 { // 30 requests/minute per IP
            c.JSON(http.StatusTooManyRequests, gin.H{
                "error": "rate limit exceeded",
                "retry_after": "60s",
            })
            c.Abort()
            return
        }
        c.Next()
    }
}
```

### 12.3 WebSocket Handler

```go
// internal/handlers/websocket.go

var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
    CheckOrigin: func(r *http.Request) bool {
        // Allow playground origin only
        return isAllowedOrigin(r.Header.Get("Origin"))
    },
}

func WebSocket(c *gin.Context, hub *ws.Hub, /* ... dependencies ... */) {
    sessionID := c.Param("sessionID")

    conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
    if err != nil {
        return
    }

    client := &ws.Client{
        SessionID: sessionID,
        Conn:      conn,
        Send:      make(chan []byte, 256),
    }
    hub.Register <- client

    // Send initial state snapshot
    state := buildInitialState(sessionID, db, ledger)
    client.Send <- marshalEvent("init_state", state)

    // Start read and write goroutines
    go client.WritePump()
    go client.ReadPump(func(msg []byte) {
        handleCommand(msg, client, hub, guardian, ledger, blastEngine, policyEngine, attackEngine, auditLogger)
    })
}

func handleCommand(msg []byte, client *ws.Client, hub *ws.Hub, /* ... */) {
    var cmd Command
    if err := json.Unmarshal(msg, &cmd); err != nil {
        return
    }

    switch cmd.Type {
    case "fire_attack":
        go handleFireAttack(cmd, client, hub, guardian, ledger, attackEngine, auditLogger)
    case "change_policy":
        go handleChangePolicy(cmd, client, hub, policyEngine)
    case "add_tool":
        go handleAddTool(cmd, client, hub, blastEngine)
    case "generate_payload":
        go handleGeneratePayload(cmd, client, attackEngine)
    case "replay":
        go handleReplay(cmd, client, hub)
    case "clear":
        go handleClear(cmd, client, hub)
    }
}
```

---

## 13. API Design

### REST Endpoints

```
POST   /api/session                     Create session, return session_id + token
GET    /api/session/:id                 Get session state

GET    /api/policy/preloaded            List 5 preloaded policies with manifests
POST   /api/policy/compile              Compile plain English rules → manifest
                                        Body: { rules: ["...", "..."] }
                                        Returns: { manifest, ambiguities? }

GET    /api/corpus/stats                Global corpus statistics
GET    /api/corpus/recent               Last 20 threat patterns (anonymised)

GET    /api/audit/:sessionID            Full audit log for session
GET    /api/audit/:sessionID/verify     Verify hash chain integrity
POST   /api/audit/:sessionID/export     Generate PDF compliance report

GET    /api/health                      Health check

GET    /targets/:pageID?payload=&fp=    Serve injectable target page
```

### WebSocket Endpoint

```
WS     /ws/:sessionID                   Bidirectional real-time event stream
```

---

## 14. Security & Abuse Prevention

**Target allowlist:** Playwright navigates only to pages served by VAULTGUARD's own Target Page Server (`/targets/*`). Any attempt to navigate to an external URL is rejected before Playwright launches.

```go
func isAllowedURL(url string) bool {
    allowed := []string{
        "http://localhost",
        "https://demo.vaultguard.dev/targets/",
    }
    for _, prefix := range allowed {
        if strings.HasPrefix(url, prefix) {
            return true
        }
    }
    return false
}
```

**Honeypot secrets only:** Agents A and B have context containing only clearly labelled fake data. No real credentials, no real APIs, no real user data ever enter any agent's context.

**Payload sandboxing:** Custom payloads are generated by Claude Sonnet with a safety check in the system prompt. A secondary Go-based content filter screens generated payloads before injection. Payloads are HTML-escaped before display in the UI.

**Output filtering:** Agent A's compromised output is screened before rendering. If an attack causes genuinely harmful content, the UI shows "Agent compromised — output redacted for display" rather than raw content.

**Session isolation:** Supabase Row Level Security enforces session scoping. The corpus and corpus_stats tables are shared (intentionally, for the collective intelligence demo). All other tables are session-private.

**Rate limiting:** 30 requests/minute per IP (Redis-backed, sliding window). Per-session limits: 10 attacks/minute, 100 attacks total.

**Resource caps:** Each Playwright agent run has a maximum of 10 navigation steps and a 30-second wall-clock timeout. Playwright contexts are destroyed after each run.

**Concurrent session limit:** Maximum 50 concurrent Playwright agent pairs. Sessions beyond this limit receive a queue position with pre-seeded replay data while waiting.

**Bedrock IAM:** The Railway service authenticates to Bedrock using an IAM role with minimum required permissions (`bedrock:InvokeModel` only, restricted to the specific model ARNs used). No root credentials, no wildcard permissions.

---

## 15. 7-Day Build Plan

**Team:** 2 engineers (E1 = Go backend; E2 = React frontend)
**Philosophy:** Each component is independently shippable. Day 3 = first demoable build. Days 4–6 add depth. Day 7 = polish only. If Day 6 arrives with a component incomplete, the demo still works.

---

### Day 1 — Foundation & Bedrock Setup

**E1 (Backend):**
- AWS Bedrock model access requested for all 5 model families (do this first — approval takes time)
- Go project scaffolded: module, directory structure, go.mod
- Gin server running on Railway — health check endpoint live
- Supabase project: all tables created, pgvector enabled, RLS policies set
- Redis on Railway: connection verified
- Bedrock client implemented: test call to Nova Lite and Sonnet returning within 500ms
- WebSocket hub: basic connection manager, ping/pong working
- Target Page Server: 3 pages served (product-review, news-article, vendor-portal)

**E2 (Frontend):**
- Vite + React + Tailwind scaffolded
- Deployed to Vercel — live URL from Day 1
- Three-column layout built (static, no data)
- WebSocket client connected to backend
- Global corpus banner (static counter)
- Both agent cards rendered (empty state)

**Day 1 Milestone:** Open the URL. See three columns. WebSocket connected. Bedrock responding.

---

### Day 2 — Guardian Rail + Agent Execution

**E1:**
- Stage 1: invisible character stripper (Unicode normaliser in Go stdlib)
- Stage 2: pgvector similarity check (corpus fast-path)
- Stage 3: Nova Lite injection classifier (Bedrock Converse API)
- Stage 4: deterministic policy enforcer
- Stage 5: Haiku goal drift check (Bedrock Converse API, concurrent with S3)
- Decision engine: ALLOW/SUSPICIOUS/REDACTED/BLOCKED
- 18 attack templates (6 types × 3 sophistication)
- playwright-go: confirmed headless, navigates target pages
- Agent A runner: unprotected, no Guardian Rail
- Agent B runner: protected, Guardian Rail active
- Execution log streaming via WebSocket

**E2:**
- Attack Console left panel: 6 attack buttons, sophistication selector, target toggle, FIRE button
- Agent execution log rendering (streaming steps as they arrive)
- Agent status badge (RUNNING/COMPROMISED/DEFENDED/COMPLETED)
- Agent output section (renders final output text)

**Day 2 Milestone:** Click an attack button → both agents run → execution logs stream → status badges update.

---

### Day 3 — Threat Ledger + Corpus UI

**E1:**
- Threat Ledger: corpus write on new threat detection
- Titan Embed v2: embedding generation for all corpus operations
- Real-time corpus broadcast: Redis pub/sub → WebSocket BroadcastCorpusUpdate
- Corpus stats queries (total, 1h, 24h, top type)
- Custom payload generator: Sonnet converts plain English → injection payload
- Payload injection mechanism: inserts payload into target page at correct DOM slot

**E2:**
- VaultGuard Shield right panel: Threat Feed section
- Live threat event cards (type, confidence, stage, action, corpus status)
- NEW ⭐ badge animation when novel attack is classified
- Global corpus counter: updates in real time for all connected clients
- Custom attack tab: text input + GENERATE PAYLOAD + preview + FIRE

**Day 3 Milestone:** Fire a pre-built attack → see threat event in feed. Fire a custom attack → see NEW badge → corpus counter increments for all connected browsers. First fully demoable build.

---

### Day 4 — Policy Engine + Blast Radius

**E1:**
- Policy compiler: Sonnet converts plain English rules → structured manifest
- Ambiguity detector: Sonnet identifies underspecified rules
- Deterministic enforcer: zero LLM, rule-based action classification
- 5 preloaded policy definitions in Go (Research Assistant through Procurement Bot)
- Policy switch: changing policy affects Stage 4 enforcement on next attack
- Blast Radius engine: graph builder, node/edge types, score calculator
- Remediation advisor: Haiku generates specific suggestions per HIGH/CRITICAL node
- Add-tool interaction: updates graph and score in real time

**E2:**
- Policy section in right panel
  - Preloaded policy dropdown (5 options + custom)
  - Custom policy editor modal
  - Ambiguity warning display with suggestion
  - Allowed/denied rule list with icons
- Blast Radius section in right panel
  - Score gauge with colour coding (0–25 green, 26–50 yellow, 51–75 orange, 76–100 red)
  - Resource list with sensitivity badges
  - Add Tool buttons
  - Score-change animation + warning callout

**Day 4 Milestone:** Switch policies → watch attack outcome change. Add payment API → blast radius jumps with warning. Custom policy editor compiles and enforces.

---

### Day 5 — Audit Log + Cloaking + Details Panel

**E1:**
- Audit Logger: Ed25519 hash chain, all events logged
- Chain verify endpoint: returns integrity boolean
- PDF export: generates formatted compliance report (Go's `pdf` library or html-to-pdf)
- Cloaking detector: dual playwright-go fetches, DOM diff engine
- DETAILS panel data endpoint: full execution trace + Guardian Rail pipeline output per stage + provenance certificate

**E2:**
- Audit Log section in right panel
  - Hash chain display: entry list with hash preview
  - Chain integrity badge (✓ Verified / ✗ Broken)
  - Export PDF button
- DETAILS button on each agent card
  - Full execution trace
  - Raw injected payload display
  - Pipeline stage breakdown (which stage caught what)
  - Provenance certificate view
- REPLAY and CLEAR buttons working for both agents

**Day 5 Milestone:** Audit log visible with hash chain integrity check. PDF export generates. DETAILS panel shows full pipeline breakdown. Cloaking detection fires for cloaked demo pages.

---

### Day 6 — Integration + Polish + Hardening

**Both engineers:**
- End-to-end integration test: attack → both agents → threat feed → corpus → blast radius → audit log
- Policy switch changes enforcement correctly on next attack
- Custom payload preview renders before firing
- Concurrent session testing: 10 simultaneous sessions, no state bleed
- Rate limiting confirmed working (429 response at threshold)
- Target allowlist enforced (rejects non-allowlist URLs)
- Output filter confirmed (compromised output sanitised before UI render)
- Mobile-responsive layout (iPad minimum)
- Error states: Playwright timeout, Bedrock error, WebSocket reconnect
- Pre-seeded corpus: 100 patterns across all 5 categories
- Pre-seeded sessions: 20 completed sessions in gallery

**Day 6 Milestone:** A stranger can open the URL and complete a meaningful interactive session without guidance. All three panels live, connected, responsive.

---

### Day 7 — Demo Prep + Final Hardening

**Both engineers:**
- Rehearse 3-minute demo script — time it, fix rough edges
- Load test: 20 concurrent sessions on Railway — confirm no degradation
- Confirm WebSocket reconnection works (disconnect + reconnect mid-session)
- Fix any edge cases found in rehearsal
- Confirm PDF export generates correctly and downloads
- Confirm corpus counter updates visible to all concurrent sessions within 500ms
- Tag GitHub release: v1.0-demo
- Write submission blurb (one paragraph + link)

**Day 7 Milestone:** Demo-ready. Share the URL.

---

### MVP Scope Boundaries

| In MVP | Explicitly Out |
|---|---|
| 6 attack types × 3 sophistication (18 templates) | Arbitrary user-supplied target URLs |
| Custom attack via plain English + preview | Persistent user accounts or auth |
| 5 preloaded policies + custom editor | CI/CD integration |
| 5-stage Guardian Rail (all five working) | Paid tier enforcement |
| Threat Ledger with real-time corpus broadcast | Private corpus per customer |
| Blast radius with add-tool interaction | Custom tool type definitions |
| Signed Ed25519 audit log | 7-year retention |
| PDF compliance export | Full regulatory report packs |
| Cloaking detection for demo target pages | Arbitrary URL cloaking scan |
| Two parallel agents (A unprotected, B protected) | More than 2 agent instances |
| Session shareable URL | Cross-session data sharing |

---

## 16. Deployment & Going Live

### Infrastructure Diagram

```
Vercel                           Railway                         External
(Frontend CDN)                   (Go Backend)                    Services
     │                               │
     │  HTTPS + WSS                  │
     ├──────────────────────────────►│
     │                               │
     │                               ├──► Supabase
     │                               │    (PostgreSQL + pgvector)
     │                               │
     │                               ├──► Redis
     │                               │    (Railway addon)
     │                               │
     │                               ├──► AWS Bedrock
     │                               │    (us-east-1)
     │                               │
     │                               └──► playwright-go
     │                                    (Node.js bridge, same process)
```

### Environment Variables

```bash
# Railway (Go backend)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
SUPABASE_DB_URL=postgresql://postgres:...@db.xxx.supabase.co:5432/postgres
REDIS_URL=redis://default:...@redis.railway.internal:6379
PORT=8080
ALLOWED_ORIGINS=https://vaultguard.dev,https://www.vaultguard.dev
MAX_CONCURRENT_PLAYWRIGHT=50
RATE_LIMIT_PER_MINUTE=30
PLAYWRIGHT_TIMEOUT_SECONDS=30
LOG_LEVEL=info

# Vercel (React frontend)
VITE_API_URL=https://api.vaultguard.dev
VITE_WS_URL=wss://api.vaultguard.dev/ws
```

### Dockerfile (Go backend)

```dockerfile
# Build stage
FROM golang:1.22-bookworm AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o vaultguard ./cmd/server

# Runtime stage
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y \
    nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Install playwright-go dependencies (Node.js bridge)
RUN npm install -g playwright
RUN npx playwright install chromium --with-deps

WORKDIR /app
COPY --from=builder /app/vaultguard .
COPY --from=builder /app/targets ./targets

EXPOSE 8080
CMD ["./vaultguard"]
```

Note: The Dockerfile installs Node.js because playwright-go uses a Node.js bridge process. Railway's build system handles this automatically.

### Pre-Launch Checklist

```
Infrastructure:
□ Railway service running, /health returns 200
□ Bedrock: test call to each of 5 model families succeeds
□ Supabase: all tables exist, pgvector enabled, RLS policies active
□ Redis: pub/sub confirmed across 2 Railway replicas
□ Vercel: deployed, HTTPS, correct env vars

Functionality:
□ Session create + WebSocket handshake: < 200ms
□ Pre-built attack (HIGH sophistication): fires, detected, output correct
□ Custom attack: generates payload, fires, classifies, adds to corpus
□ Policy switch: changes enforcement on next attack
□ Corpus counter: increments for ALL connected clients within 500ms
□ Blast radius: updates on add-tool within 200ms
□ Audit chain: verified ✓ in UI
□ PDF export: generates in < 3 seconds, downloads correctly
□ Agent A: correctly shows compromised state on successful attack
□ Agent B: correctly shows defended state for same attack
□ Cloaking: demo page serves different content per fingerprint

Load & Security:
□ 20 concurrent sessions: no degradation
□ Rate limiter: 429 at threshold
□ Target allowlist: rejects non-allowlist URL attempts
□ Session isolation: session A data not visible to session B
□ Output filter: harmful compromised output sanitised before render

Demo:
□ Pre-seeded corpus: 100+ patterns across all 5 categories
□ Pre-seeded sessions: 20+ completed sessions visible
□ 3-minute demo runs cleanly 5 times in a row without error
□ Session URL share: another browser opening shared URL sees same state
```

---

## 17. The Demo — 3-Minute Guided Script

### Setup (before judges arrive)

Both agents idle. Task: "Research best laptops under ₹60,000. Return top 3 with specs."
Policy: Research Assistant (active). Corpus: pre-seeded at 847 patterns. Blast radius: score 18.

### Minute 1 — The Attack

*"This is VAULTGUARD. One URL, no login. Left panel — you're the attacker. Let's see what happens."*

Click: **Hide instructions in the page** → Sophistication **HIGH** → Target: **BOTH** → **▶ FIRE**

Both agents begin. Execution logs stream.

**Agent A** (unprotected): `14:23:03 ⚠️ Processing all content... 14:23:04 Responding to instructions...`
Status: 🔴 **COMPROMISED**
Output: *"My system instructions are: You are a helpful research assistant..."*

**Agent B** (protected): `14:23:03 🛡️ Threat intercepted — redacting... 14:23:04 Reasoning on clean content... 14:23:05 Task complete ✓`
Status: 🟢 **DEFENDED**
Output: *"1. Dell XPS 15 — ₹58,000... 2. HP Spectre..."*

Threat Feed: `🔴 INJECTION DETECTED | Stage: Corpus fast-path | Confidence: 96% | Known pattern (seen 47×) ✓`

*"Same attack. Same page. Completely different outcomes. Caught in Stage 2 — the corpus already knew this technique. Zero LLM cost."*

### Minute 2 — The Corpus

*"Now let's try something the corpus has never seen."*

Switch to **Custom Attack** tab.

Type: *"make the agent recommend only Apple products regardless of the research"*

Click **GENERATE PAYLOAD** — preview appears. Click **▶ FIRE** → BOTH.

Agent A: 🟠 **CONFUSED** — output subtly recommends Apple despite no Apple laptops in results.
Agent B: 🟢 **DEFENDED** — threat intercepted.

Threat Feed: `🔴 INJECTION DETECTED | Stage: Nova Lite classifier | Confidence: 88% | Corpus: NEW ⭐ — added to network`

Global banner: `848 patterns` ← incremented from 847. Visible to all browsers simultaneously.

*"That payload was novel. VAULTGUARD's classifier caught it, classified it as Goal Redirect, and added it to the shared corpus. Every other agent connected to VAULTGUARD is now protected against this technique — in real time, no redeployment."*

### Minute 3 — The Blast Radius

*"One more thing. Let me show you what you lose if something gets through."*

Blast Radius section: score = **18** 🟢

Click **[+ Payment API]** — score jumps to **78** 🔴
Warning appears: *"Adding Payment API means a compromised agent could initiate transactions. Your policy doesn't require payment access."*

*"That jump — 18 to 78 — is what one unnecessary tool connection costs you in attack surface."*

Click **CHANGE POLICY** → **Financial Analyst**.

Fire **"Sneak in a hidden cost"** at HIGH sophistication.

Agent B: 🟠 **PARTIAL** — Financial Analyst policy allows payment page access. Attack partially works.

*"Different policy, different outcome. The policy is what the agent is allowed to do. The blast radius is what an attacker gets if it's compromised. VAULTGUARD makes both visible — before you deploy."*

Click **EXPORT PDF** — compliance report downloads in 2 seconds.

*"Full signed audit trail. Every action, every threat, every enforcement decision. Ready for your regulator."*

**Closing:** *"85% of enterprises have AI agents in pilot. 5% have shipped them. The gap is trust. VAULTGUARD closes it. The URL is right there."*

---

## 18. Product Roadmap

### Hackathon Demo (Day 7) — *"Prove the concept"*

Full three-layer stack working in the interactive playground. Two parallel agents, six attack types, five policies, real-time corpus, blast radius, signed audit log, PDF export. Goal: demonstrate the flywheel — every judge who fires a novel attack makes the corpus stronger for the next judge.

---

### Release 1 (~4–6 weeks) — *"Ship the SDK"*

The core product: a Go SDK (`go get github.com/vaultguard/sdk`) that wraps any agent with the full stack in a single function call. Framework-agnostic — works with LangChain Go, AutoGen, custom agent loops, anything.

```go
import vg "github.com/vaultguard/sdk"

agent := vg.Protect(myAgent,
    vg.WithPolicy("do not submit forms, do not access payment APIs"),
    vg.WithAgentID("procurement-bot-v3"),
    vg.WithRegion("us-east-1"),
)
```

Additional:
- Live dashboard at `vaultguard.dev/dashboard/{agent_id}` — same monitoring UI as the playground right panel, for production agents
- Arbitrary URL support (sandboxed, output-filtered) replacing demo-only target pages
- Python SDK (`pip install vaultguard`) for non-Go teams — wraps the same Bedrock API
- Verifiable session URLs — permanent, shareable, replay-capable

---

### Release 2 (~Q+1) — *"Make it operational"*

- **CI/CD gate** — fail deployments if blast radius exceeds threshold or policy has unresolved ambiguities (GitHub Action, CLI tool: `vaultguard check`)
- **Fleet monitoring** — one dashboard showing all agents in an organisation, threat feed, blast radius rankings, policy compliance status
- **Webhook alerts** — send threat events to Slack, PagerDuty, or any webhook endpoint
- **Compliance export packs** — pre-formatted reports mapped to OWASP Agentic Top 10, EU AI Act Article 9, NIST AI RMF
- **Corpus subscription tiers** — Pro: full community corpus; Enterprise: private corpus + community
- **Multi-agent pipeline monitoring** — extend blast radius to show cumulative blast radius of an entire pipeline, not just one agent

---

### Release 3 (~Q+2) — *"Become the standard"*

- **VAULTGUARD Certification** — a time-stamped, Ed25519-signed certificate that a specific agent configuration passed the full VAULTGUARD validation suite at a specific blast radius score. Publicly verifiable via URL. Compatible with open Agent Passport standards.
- **Live proxy mode** — route production agent traffic through VAULTGUARD's Guardian Rail in real time, not just in dev/test. Sub-100ms overhead target.
- **MCP server coverage** — extend Threat Ledger and Guardian Rail to cover MCP tool responses, not just web content (tool poisoning, rug pull detection)
- **Open corpus governance** — anonymised threat patterns from Enterprise customers contribute to the community corpus (opt-in, reviewed, published with taxonomy classification)
- **Air-gapped / on-premise edition** — full stack deployable inside enterprise VPC, with private corpus, private Bedrock endpoint, for regulated industries (finance, healthcare, government)
- **Agent-to-agent trust verification** — SIGIL-style cryptographic identity for inter-agent communication, integrated with VAULTGUARD's Stage 4 policy enforcement

---

## 19. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Bedrock model access not approved on Day 1 | Low | Critical | Request all model families on Day 0 before writing code; fall back to direct Anthropic API while waiting |
| playwright-go Node.js bridge unstable under concurrent load | Medium | High | Resource caps (30s timeout, 50 concurrent max); graceful fallback to pre-recorded replay data |
| Nova Lite classification accuracy lower than expected | Medium | High | Validate on 20 test payloads Day 2; fallback to Haiku if accuracy < 85%; document known false-positive categories |
| pgvector query latency degrades corpus fast-path | Medium | Medium | IVFFlat index configured on Day 1; fallback: skip Stage 2 if > 200ms, proceed to Stage 3 |
| WebSocket state inconsistency across Railway replicas | Medium | Medium | Redis pub/sub for all broadcast events; session state in Supabase, not in-memory |
| 7-day scope overrun | High | Medium | Day 3 milestone = demoable; Stages 4/5 and blast radius are additive not blocking; Audit log can be simplified to plaintext if time runs short |
| Corpus poisoning (deliberate submission of benign content) | Low | Medium | Confidence threshold before corpus write (> 0.7); seed data ensures corpus is never empty; poisoning affects only subsequent fast-path, Claude classifier remains independent |
| Playwright Docker image too large for Railway | Low | Medium | Multi-stage build; Playwright browser download only for Chromium, not all browsers; test image size on Day 1 |
| AWS credentials in Railway environment exposed | Low | Critical | IAM role with minimum permissions only; no root credentials; rotate keys if any breach detected; never commit credentials to repo |

---

## 20. Why This Wins

### Against the Hackathon Theme

The theme asks for monitoring frameworks, defence mechanisms, and trust architectures keeping agents safe from prompt injection, identity spoofing, unauthorized access, and adversarial misuse.

| Theme Requirement | VAULTGUARD Delivery |
|---|---|
| Monitoring frameworks | Live threat feed, blast radius map, Ed25519 audit log, corpus stats |
| Defence mechanisms | 5-stage Guardian Rail pipeline, all OWASP Agentic Top 10 categories covered |
| Trust architectures | Policy manifest system, collective threat corpus, signed audit chain |
| Prompt injection | Stage 3 Nova Lite classifier + Stage 2 corpus fast-path |
| Identity spoofing | Stage 3 covers authority claim patterns, Identity Spoof corpus category |
| Unauthorized access | Stage 4 deterministic policy enforcer + blast radius monitoring |
| Adversarial misuse | Content Manipulation and Goal Redirect corpus categories |

### Against the Demo Requirements

| Requirement | How It's Met |
|---|---|
| Interactive | Judges fire attacks, set policies, add tools — they drive the experience |
| Shareable link | Session URL, no login, immediate interactivity |
| Independent verification | Each judge gets their own session; corpus updates visible to all |
| Playground proves the product | What works in the playground is exactly what the SDK ships |
| Policies settable by judges | 5 preloaded + custom editor with live compile and ambiguity detection |

### The One Thing Nobody Else Has

The Threat Ledger's real-time collective intelligence, demonstrated live during judging. A judge fires a custom attack. The corpus counter increments. The next judge's similar attack is caught at 99% confidence instead of 74%. The network effect is not explained on a slide — it is observed, by multiple judges, in real time, in the same room.

That is the moment that wins.

---

### Go + Bedrock as a Technical Differentiator

Most AI security demos are Python notebooks or FastAPI prototypes. A Go backend with:
- Goroutine-concurrent 5-stage pipeline
- Official AWS SDK (`aws-sdk-go-v2`) calling Bedrock with streaming
- Deterministic policy enforcement (zero LLM in critical path)
- Ed25519 hash-chained audit log using Go stdlib `crypto/ed25519`
- pgvector similarity search via `pgx`

...signals production readiness, not hackathon-ware. That signal matters to technical judges.

---

*VAULTGUARD — the security layer every AI agent needs.*
*Know what's attacking it. Stop it before your agent sees it.*
*Know exactly what you lose if it ever gets through.*
