# VaultGuard Roadmap

## MVP — Implemented

| Feature | Status | Description |
|---|---|---|
| **Core Guardian Rail Pipeline** | ✅ Done | 5-stage interception: invisible chars → corpus similarity → Nova Lite classification → policy enforcement → Llama 3.3 70B goal-drift detection. |
| **AWS Bedrock Model Routing** | ✅ Done | Amazon Nova Lite (stage 3), Meta Llama 3.3 70B (stage 5), Nova Pro (policy + variants), Titan Embed Text v2 (embeddings). Full offline mock with deterministic SHA-256 embeddings. |
| **BoltDB Threat Corpus** | ✅ Done | 558-pattern seed corpus covering all 10 OWASP Agentic Top 10 categories. Binary float32 embeddings, cosine similarity search. |
| **Tamper-Evident Audit Log** | ✅ Done | Ed25519-signed, SHA-256 hash-chained audit entries. CSV and PDF export via `/api/audit/:id/export`. |
| **Blast Radius Engine** | ✅ Done | Consequence mapping with 0–100 composite scores. Propagation graph across 8 tool nodes with lateral movement detection and auto-generated remediations. |
| **OWASP Agentic Top 10 Campaigns** | ✅ Done | 10 pre-built campaigns (OAT-01 through OAT-10). 4 adversarial + 1 clean baseline payload each, streamed via WebSocket with per-payload results and overall % blocked score. |
| **Manual Threat Builder** | ✅ Done | Mode A: craft and analyze custom payloads, generate variants via Nova Pro, save to corpus. Mode B: define vulnerabilities, simulate blast radius, export as JSON. |
| **Corpus Analytics Dashboard** | ✅ Done | Recharts line/bar/pie charts: attack attempts over 24h, type distribution, blocked/allowed/suspicious. Auto-refresh every 10s. |
| **ReactFlow Blast Radius Graph** | ✅ Done | Interactive propagation graph — severity-coloured nodes, animated edges with probability labels, remediation sidebar, affected tools panel. |
| **Shareable Demo URLs** | ✅ Done | URL hash state: `#s=<sessionID>&p=<policy>&a=<attackType>&tab=<tabName>`. "Share Demo" button copies current state URL. |
| **Rate Limiting** | ✅ Done | Sliding window per IP: 30 attack requests/min, 10 session creates/hour, 5 PDF exports/hour. HTTP 429 with `Retry-After` header. |
| **Docker Deployment** | ✅ Done | Multi-stage Go → scratch backend image. Node → nginx frontend image with SPA routing + WebSocket proxy. Compose file with named volume and health checks. |
| **6-Tab Playground UI** | ✅ Done | Playground, Threat Builder, Campaigns, Blast Radius, Analytics, Audit Trail. All connected via WebSocket context and URL hash state. |

---

## Production Roadmap

| Feature | Priority | Description |
|---|---|---|
| **CI/CD Action Gate** | High | GitHub Action to fail deployment if Agent Policy is too permissive. Integrates Guardian Rail as a pre-merge check. |
| **Multi-Agent Fleet Dashboard** | Medium | Monitor multiple agent sessions simultaneously. Aggregate threat stats, cross-session corpus learning. |
| **VPC Air-Gapped Deployment** | Medium | Full enterprise internal stack with VPC endpoints for Bedrock, private BoltDB-compatible storage. |
| **Threat Intelligence Feed Sync** | Medium | Subscribe to external OWASP and MITRE ATT&CK feed updates. Auto-ingest new patterns into corpus. |
| **Policy-as-Code DSL** | Low | Declarative YAML/HCL policy definitions with version control and diff tooling. |
| **pgvector Migration Option** | Low | Optional migration path from BoltDB to PostgreSQL + pgvector for deployments requiring horizontal scale. |
