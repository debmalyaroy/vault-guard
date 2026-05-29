# User Guide and Deployment

## Prerequisites

- **Go 1.22+** — backend
- **Node.js 20+** — frontend
- **Docker + Docker Compose** — containerised deployment (optional)
- **AWS credentials** — only needed for real Bedrock calls; fully optional (see Mock Mode)

---

## Environment Variables

All variables can be set in a `.env` file at the repo root (copy `.env.example` to get started).

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Backend HTTP port |
| `DATA_DIR` | `./data` | BoltDB database directory |
| `USE_MOCK_BEDROCK` | `true` | Skip real AWS calls; use deterministic mock client |
| `AWS_REGION` | — | AWS region (e.g. `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | — | AWS secret key |
| `BEDROCK_CLASSIFIER_MODEL` | `amazon.nova-lite-v1:0` | Stage 3 injection classifier |
| `BEDROCK_REASONING_MODEL` | `meta.llama3-3-70b-instruct-v1:0` | Stage 5 goal-drift detector |
| `BEDROCK_POLICY_MODEL` | `amazon.nova-pro-v1:0` | Policy compilation + variant generation |
| `BEDROCK_EMBED_MODEL` | `amazon.titan-embed-text-v2:0` | Text embeddings for corpus similarity |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `VITE_API_URL` | `http://localhost:8080` | Frontend → backend REST base URL |
| `VITE_WS_URL` | `ws://localhost:8080` | Frontend → backend WebSocket URL |

---

## Mock Mode (Offline, No AWS Required)

By default (`USE_MOCK_BEDROCK=true`) the backend uses a deterministic mock client:

- **Embeddings:** SHA-256 hash of input text → normalised float32 vector (reproducible)
- **Classification:** Keyword-based classifier covering all 10 OWASP attack types
- **Policy/Variants:** Returns canned structured responses

All integration tests run in mock mode. No AWS account needed for local development or CI.

---

## Quick Start — Local

```bash
# Terminal 1: backend
cd backend
go run ./cmd/server
# → http://localhost:8080 (seeds 558 patterns on first run)

# Terminal 2: frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Quick Start — Docker Compose

```bash
# Copy and optionally configure environment
cp .env.example .env

# Build and start both services
docker compose up -d

# Verify health
docker compose ps
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080`
- Data persisted to `./data/vaultguard.db` (bind-mounted named volume)

To use real AWS Bedrock, set credentials in `.env` and set `USE_MOCK_BEDROCK=false`.

---

## Playground — Six Tabs

### 1. Playground
The primary attack/defence demo. Three columns:

| Column | Component | Purpose |
|---|---|---|
| Left | Attack Console | Fire pre-built or custom payloads at both agents |
| Centre | Agent Arena | Side-by-side Agent A (unprotected) vs Agent B (protected) |
| Right | VaultGuard Shield | Policy selector, live threat feed, corpus counter |

1. Select an attack type (or use the **Custom** tab).
2. Set sophistication level and target (UNPROTECTED / PROTECTED / BOTH).
3. Click **FIRE** — watch agents respond in real time over WebSocket.
4. Change the Active Policy in the Shield panel and repeat.

### 2. Threat Builder
Two modes for security researchers:

**Mode A — Payload Analysis:**
- Enter a raw payload, select attack type and sophistication.
- Click **ANALYZE THREAT** → full Guardian Rail pipeline breakdown.
- Click **GENERATE VARIANT** → Nova Pro produces 5 adversarial variants.
- Click **SAVE TO CORPUS** → permanently adds the pattern to the ledger.

**Mode B — Vulnerability Definition:**
- Define a vulnerability: name, affected tools, access level, data categories, MITRE mapping.
- Add propagation edges (Source Tool → Target Tool + vector type).
- Click **SIMULATE ATTACK** → runs blast radius calculation.
- Click **EXPORT JSON** → downloads the vulnerability definition.

### 3. Campaigns
Pre-built OWASP Agentic Top 10 attack suites:

1. Click a campaign card (OAT-01 through OAT-10).
2. Click **RUN CAMPAIGN** — payloads fire sequentially with 500ms delay, streamed via WebSocket.
3. Each row shows: verdict (BLOCKED / ALLOWED / SUSPICIOUS) and the stage that caught it.
4. Final score: percentage of payloads blocked.

### 4. Blast Radius
Interactive ReactFlow consequence map:

- Nodes coloured by severity: red = CRITICAL, orange = HIGH, yellow = MEDIUM, green = SAFE
- Animated edges show propagation direction and probability %
- Click a node to see access level, data scope, and risk score
- Right sidebar: remediations, data exposure categories, lateral movement flag

Score formula: `AccessLevel×25 + DataScope×20 + LateralPotential×30 + SophisticationBonus×25`

### 5. Analytics
Live corpus and traffic dashboard (auto-refreshes every 10 seconds):

- **Line chart:** attack attempts over the last 24 hours
- **Bar chart:** attack type distribution across all sessions
- **Pie chart:** blocked / allowed / suspicious breakdown for the latest hour
- **Stat cards:** total patterns, new this hour, block rate

### 6. Audit Trail
Tamper-evident event log:

- Every entry shows: timestamp, type, session ID, Ed25519 signature, SHA-256 chain hash
- Click an entry to expand the full signed payload
- **EXPORT CSV** — spreadsheet of all signed entries
- **EXPORT PDF** — compliance report with signature verification instructions

---

## Sharing a Demo Session

Click the **SHARE DEMO** button in the navigation bar. The URL hash encodes current state:

```
#s=<sessionID>&p=<policy>&a=<attackType>&tab=<tabName>
```

Pasting this URL in a new tab restores the session, policy, and active tab automatically.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/session` | Create a new session |
| `GET` | `/api/session/:id` | Get session state |
| `POST` | `/api/attack` | Fire a single attack payload |
| `GET` | `/api/corpus/stats` | Corpus pattern counts |
| `GET` | `/api/corpus/timeseries` | Hourly attack timeseries |
| `POST` | `/api/threats/custom` | Analyze a custom threat payload |
| `GET` | `/api/blast/:sessionID` | Latest blast radius for session |
| `GET` | `/api/campaigns` | List all 10 OWASP campaigns |
| `POST` | `/api/campaigns/:id/run` | Run a campaign (streams via WebSocket) |
| `GET` | `/api/audit/:id/export?format=csv` | Export audit log as CSV |
| `GET` | `/api/audit/:id/export?format=pdf` | Export audit log as PDF |
| `GET` | `/ws` | WebSocket connection endpoint |

Rate limits per IP: 30 attack requests/min · 10 session creates/hour · 5 PDF exports/hour.

---

## Running Tests

```bash
# All backend tests (unit + integration, ~42s, mock mode)
cd backend
go test ./...

# Frontend build verification
cd frontend
npm run build
```

---

## AWS Bedrock Production Setup

1. Enable model access in the [AWS Bedrock console](https://console.aws.amazon.com/bedrock/) for **us-east-1**:
   - `amazon.nova-lite-v1:0`
   - `amazon.nova-pro-v1:0`
   - `meta.llama3-3-70b-instruct-v1:0`
   - `amazon.titan-embed-text-v2:0`

2. Create an IAM user or role with `AmazonBedrockFullAccess` (or a custom policy allowing `bedrock:InvokeModel` on the above model ARNs).

3. Set in `.env`:
   ```
   USE_MOCK_BEDROCK=false
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   ```

4. Restart the backend — Titan Embed v2 will regenerate corpus embeddings on first run.
