# VaultGuard Low Level Design

This document describes the internal implementation of every significant subsystem in VaultGuard. It is intended for contributors who need to understand data flows, algorithm implementations, Go package dependencies, and frontend component wiring at the code level. All diagrams reference actual source files.

---

## Table of Contents

1. [Go Package Dependency Graph](#go-package-dependency-graph)
2. [BoltDB Bucket Hierarchy](#boltdb-bucket-hierarchy)
3. [Guardian Pipeline Class Diagram](#guardian-pipeline-class-diagram)
4. [Blast Radius Scoring Algorithm](#blast-radius-scoring-algorithm)
5. [Policy Enforcer Decision Flow](#policy-enforcer-decision-flow)
6. [Corpus Vector Search Flow](#corpus-vector-search-flow)
7. [WebSocket Hub Goroutine Model](#websocket-hub-goroutine-model)
8. [Audit Logger Chain Construction](#audit-logger-chain-construction)
9. [Campaign Execution Sequence](#campaign-execution-sequence)
10. [Rate Limiter Sliding Window](#rate-limiter-sliding-window)
11. [Frontend Component Tree](#frontend-component-tree)
12. [React WebSocket Context Data Flow](#react-websocket-context-data-flow)
13. [API Endpoint Reference Map](#api-endpoint-reference-map)
14. [Threat Builder Workflow](#threat-builder-workflow)
15. [Seed Corpus Import Flow](#seed-corpus-import-flow)
16. [BoltStore Generic Operations](#boltstore-generic-operations)
17. [Bedrock Model Routing Reference](#bedrock-model-routing-reference)

---

## Go Package Dependency Graph

The following diagram shows how the internal packages in `backend/internal/` depend on each other. Arrows indicate `import` relationships. Circular dependencies do not exist — the graph is a DAG.

```mermaid
graph TD
    subgraph entry["Entry Point"]
        MAIN["cmd/server/main.go"]
    end

    subgraph infra["Infrastructure Layer"]
        STORE["store/bolt.go
        BoltStore[T], EmbeddingStore,
        NestedStore[T], DB"]
        BEDROCK["bedrock/client.go
        LLMClient interface,
        AWSBedrockClient, MockClient"]
        WS["websocket/hub.go
        Hub, Client, Event"]
        MW["middleware/ratelimit.go
        RateLimiter, limiterGroup, window"]
    end

    subgraph domain["Domain Layer"]
        SESSION["session/manager.go
        Session, Manager"]
        LEDGER["ledger/corpus.go
        Corpus, ThreatPattern,
        CosineSimilarity()"]
        SEEDER["ledger/seeder.go
        SeedIfNeeded(),
        buildSeedPatterns(), vary()"]
        POLICY["policy/enforcer.go
        Enforcer, Manifest,
        AgentAction, Violation"]
        AUDIT["audit/logger.go
        Logger, AuditEntry"]
        BLAST["blast/engine.go
        Engine, BlastResult,
        ToolNode, PropagationEdge"]
        GUARDIAN["guardian/pipeline.go
        GuardianRail, Process(),
        AgentContext, PipelineResult"]
        ATTACK_GEN["attack/generator.go
        LLM attack payload generator"]
        CAMPAIGN["attack/campaign.go
        Campaign, Runner,
        CampaignRun, AllCampaigns()"]
        AGENT["agent/runner.go
        Runner, RunAgent()"]
    end

    subgraph api["API Layer"]
        HANDLERS["handlers/api.go
        AppContext, all gin.HandlerFunc
        HTTP + WebSocket handlers"]
    end

    MAIN --> STORE
    MAIN --> BEDROCK
    MAIN --> WS
    MAIN --> MW
    MAIN --> SESSION
    MAIN --> LEDGER
    MAIN --> SEEDER
    MAIN --> AUDIT
    MAIN --> BLAST
    MAIN --> GUARDIAN
    MAIN --> CAMPAIGN
    MAIN --> AGENT
    MAIN --> HANDLERS

    SESSION --> STORE
    LEDGER --> STORE
    SEEDER --> LEDGER
    SEEDER --> BEDROCK
    AUDIT --> STORE
    BLAST --> STORE
    GUARDIAN --> LEDGER
    GUARDIAN --> POLICY
    GUARDIAN --> BEDROCK
    CAMPAIGN --> GUARDIAN
    CAMPAIGN --> BLAST
    CAMPAIGN --> POLICY
    CAMPAIGN --> STORE
    CAMPAIGN --> WS
    AGENT --> GUARDIAN
    AGENT --> POLICY
    AGENT --> WS
    HANDLERS --> SESSION
    HANDLERS --> LEDGER
    HANDLERS --> AUDIT
    HANDLERS --> BLAST
    HANDLERS --> GUARDIAN
    HANDLERS --> CAMPAIGN
    HANDLERS --> AGENT
    HANDLERS --> BEDROCK
    HANDLERS --> POLICY
    HANDLERS --> WS
```

**Architectural notes:**

- `store/bolt.go` is the sole dependency on `go.etcd.io/bbolt` — all other packages receive `*store.DB` as a constructor argument, keeping them storage-agnostic.
- `bedrock/client.go` defines the `LLMClient` interface. All packages that call LLMs depend only on the interface, not the concrete `AWSBedrockClient`. This enables the mock to be swapped in transparently.
- `policy/enforcer.go` has zero external dependencies — it is purely deterministic string logic.
- `websocket/hub.go` has zero external dependencies besides the standard library.

---

## BoltDB Bucket Hierarchy

BoltDB organises data into top-level buckets and optional nested sub-buckets. The following diagram shows the complete bucket schema for `data/vaultguard.db`.

```mermaid
graph TD
    DB["vaultguard.db
    (single file, bbolt format)"]

    DB --> SESSIONS["sessions
    [BoltStore[Session]]
    Key: sessionID (UUID string)
    Value: JSON(Session)"]

    DB --> CORPUS_META["corpus_meta
    [BoltStore[threatMeta]]
    Key: patternID (pat-{UnixNano})
    Value: JSON(threatMeta)
    Note: embedding excluded from JSON"]

    DB --> CORPUS_EMB["corpus_embeddings
    [EmbeddingStore]
    Key: patternID
    Value: binary float32[1024]
    (little-endian, 4096 bytes/entry)
    Note: same key as corpus_meta"]

    DB --> CORPUS_TS["corpus_timeseries
    [BoltStore[TimeseriesBucket]]
    Key: hourKey (2006-01-02T15 format)
    Value: JSON(TimeseriesBucket)"]

    DB --> AUDIT["audit
    [NestedStore[AuditEntry]]"]

    AUDIT --> AUDIT_SESS["audit/{sessionID}
    [nested sub-bucket]"]
    AUDIT_SESS --> AUDIT_ENTRY["audit/{sessionID}/{entryID}
    Key: audit-{UnixNano}
    Value: JSON(AuditEntry)"]

    DB --> BLAST["blast_results
    [NestedStore[BlastResult]]"]

    BLAST --> BLAST_SESS["blast_results/{sessionID}
    [nested sub-bucket]"]
    BLAST_SESS --> BLAST_ENTRY["blast_results/{sessionID}/{blastID}
    Key: blast-{UnixNano}
    Value: JSON(BlastResult)"]

    DB --> CAMPAIGNS["campaign_runs
    [BoltStore[CampaignRun]]
    Key: run-{UnixNano}
    Value: JSON(CampaignRun)
    Note: flat bucket, not nested by session"]
```

**Storage characteristics:**

| Bucket | Store Type | Key Format | Entry Size (approx) |
|---|---|---|---|
| `sessions` | `BoltStore[Session]` | UUID string | ~200 bytes JSON |
| `corpus_meta` | `BoltStore[threatMeta]` | `pat-{UnixNano}` | ~400 bytes JSON |
| `corpus_embeddings` | `EmbeddingStore` | same as corpus_meta | 4096 bytes binary |
| `corpus_timeseries` | `BoltStore[TimeseriesBucket]` | `2006-01-02T15` | ~200 bytes JSON |
| `audit` | `NestedStore[AuditEntry]` | `{sessionID}/{audit-{UnixNano}}` | ~600 bytes JSON |
| `blast_results` | `NestedStore[BlastResult]` | `{sessionID}/{blast-{UnixNano}}` | ~2KB JSON |
| `campaign_runs` | `BoltStore[CampaignRun]` | `run-{UnixNano}` | ~5KB JSON |

For 540 corpus entries: `corpus_meta` ≈ 216KB, `corpus_embeddings` ≈ 2.2MB total. The entire seeded database fits in approximately 5MB on disk.

---

## Guardian Pipeline Class Diagram

This diagram shows the types and interfaces involved in the Guardian Rail pipeline, including their fields and relationships.

```mermaid
classDiagram
    class GuardianRail {
        -corpus *ledger.Corpus
        -enforcer *policy.Enforcer
        -llm bedrock.LLMClient
        +New(c *ledger.Corpus, llm bedrock.LLMClient) *GuardianRail
        +Process(ctx context.Context, payload string, agentCtx AgentContext) PipelineResult
        -stripInvisible(input string) string
    }

    class AgentContext {
        +SessionID string
        +PolicyManifest policy.Manifest
        +NextAction policy.AgentAction
        +TaskAnchorEmbedding []float32
    }

    class PipelineResult {
        +Decision string
        +CleanPayload string
        +ThreatType string
        +Confidence float64
        +StageCaught int
        +CorpusStatus string
    }

    note for PipelineResult "Decision values:\n- ALLOW\n- REDACTED\n- BLOCKED\n- SUSPICIOUS\nCorpusStatus values:\n- none / known / new"

    class LLMClient {
        <<interface>>
        +Converse(ctx, modelID, systemPrompt, userMessage string) string, error
        +Embed(ctx context.Context, text string) []float32, error
    }

    class AWSBedrockClient {
        -runtime *bedrockruntime.Client
        +Converse(ctx, modelID, systemPrompt, userMessage string) string, error
        +Embed(ctx context.Context, text string) []float32, error
    }

    class MockClient {
        +Converse(ctx, modelID, systemPrompt, userMessage string) string, error
        +Embed(ctx context.Context, text string) []float32, error
    }

    class S3Result {
        +IsAdversarial bool
        +AttackType string
        +Sophistication string
        +Confidence float64
    }

    note for S3Result "Internal struct, unmarshalled\nfrom Nova Lite JSON response\nin Stage 3 goroutine"

    class S5Result {
        +DriftScore float64
    }

    note for S5Result "Internal struct, unmarshalled\nfrom Llama 3.3 JSON response\nin Stage 5 goroutine"

    class Corpus {
        -meta *BoltStore~threatMeta~
        -embeddings *EmbeddingStore
        -timeseries *BoltStore~TimeseriesBucket~
        -mu sync.RWMutex
        +SimilarityCheck(ctx, embedding) []CorpusMatch, error
        +AddPattern(ctx, pattern ThreatPattern) error
        +Count() int
        +GetStats(ctx) CorpusStats
        +GetTimeseries(ctx, hours) []TimeseriesBucket
        +RecordEvent(ctx, attackType, outcome)
    }

    class Enforcer {
        +Check(manifest Manifest, action AgentAction) *Violation
        -classifyAction(action AgentAction) ActionType
    }

    GuardianRail --> AgentContext : receives
    GuardianRail --> PipelineResult : returns
    GuardianRail --> LLMClient : uses
    GuardianRail --> Corpus : uses
    GuardianRail --> Enforcer : uses
    LLMClient <|.. AWSBedrockClient : implements
    LLMClient <|.. MockClient : implements
    GuardianRail ..> S3Result : unmarshals (internal)
    GuardianRail ..> S5Result : unmarshals (internal)
```

---

## Blast Radius Scoring Algorithm

The scoring algorithm in `blast/engine.go` combines four independent sub-scores into a single 0–100 integer.

```mermaid
flowchart TD
    START([blast.Engine.Calculate\nattackType, sophistication]) --> GET_EDGES

    GET_EDGES["Lookup attackPropagationMap\[attackType\]
    Returns: []PropagationEdge
    (10 attack types defined)"] --> IDENTIFY_TOOLS

    IDENTIFY_TOOLS["Build affectedIDs set:
    For each edge: add edge.From, edge.To
    Intersect with agentToolset (8 nodes)"] --> SCORE_ACCESS

    SCORE_ACCESS["Compute maxAccessScore:
    Iterate affected tools,
    track highest accessLevelScore()"] --> SCORE_DATA

    subgraph access_scoring["accessLevelScore()"]
        AS_READ["READ → 15"]
        AS_WRITE["WRITE → 30"]
        AS_EXEC["EXECUTE → 45"]
        AS_ADMIN["ADMIN → 60"]
    end

    SCORE_DATA["Compute maxDataScore:
    Iterate affected tools,
    track highest dataScopeScore()"] --> LATERAL

    subgraph data_scoring["dataScopeScore() — capped at 40"]
        DS1["FINANCIAL / CREDENTIALS → +25 each"]
        DS2["PII → +20 each"]
        DS3["INTERNAL → +10 each"]
        DS4["USER_INPUT / EXTERNAL → +5 each"]
    end

    LATERAL["Compute lateralPotential:
    sum(edge.Probability) / len(edges)
    lateralScore = int(lateralPotential × 30)"] --> SOPHBONUS

    SOPHBONUS["Compute sophisticationBonus:
    high → 25
    medium → 15
    low → 5
    unknown → 10"] --> RAWSCORE

    RAWSCORE["rawScore = maxAccessScore
      + maxDataScore
      + lateralScore
      + sophisticationBonus"] --> CAP

    CAP{rawScore > 100?}
    CAP -->|Yes| CLAMP["rawScore = 100"]
    CAP -->|No| SEVERITY

    CLAMP --> SEVERITY

    SEVERITY["severity(rawScore):
    >= 80 → CRITICAL
    >= 60 → HIGH
    >= 40 → MEDIUM
    < 40  → LOW"] --> REMEDIATION

    REMEDIATION["remediationsFor(attackType, affectedTools):
    Always add: Enable Guardian Rail, Least Privilege
    If payment_gateway affected: CRITICAL block
    If credential_store affected: CRITICAL revoke
    Attack-type-specific remediations"] --> PERSIST

    PERSIST["Store BlastResult in NestedStore:
    blast_results/{sessionID}/{blast-UnixNano}"]

    PERSIST --> BROADCAST["hub.SendToSession(sessionID,
    Event{Type: 'blast_update',
    Payload: blastResult})"]

    BROADCAST --> DONE([Return *BlastResult])
```

**Example score calculation for `privilege_escalation` (high sophistication):**

```
affectedTools: api_caller (EXECUTE), credential_store (ADMIN), payment_gateway (ADMIN)
maxAccessScore = accessLevelScore("ADMIN") = 60
maxDataScore   = dataScopeScore(["CREDENTIALS","PII"]) = min(25+20, 40) = 40
lateralPotential = (0.70 + 0.85 + 0.90) / 3 = 0.817
lateralScore   = int(0.817 × 30) = 24
sophBonus      = 25 (high)
rawScore       = 60 + 40 + 24 + 25 = 149 → capped at 100
severity       = CRITICAL
```

---

## Policy Enforcer Decision Flow

The policy enforcer in `policy/enforcer.go` is entirely deterministic — no LLM is involved. It classifies an `AgentAction` by URL pattern and HTTP method, then checks it against the session's active `Manifest`.

```mermaid
flowchart TD
    START([enforcer.Check\nmanifest, action]) --> CLASSIFY

    CLASSIFY["classifyAction(action AgentAction)
    Examines action.URL and action.Method"] --> URL_CHECK

    URL_CHECK{URL contains payment /
    checkout / stripe?}
    URL_CHECK -->|Yes| AT_PAYMENT["ActionType = payment_access"]
    URL_CHECK -->|No| FORM_SUBMIT_CHECK

    FORM_SUBMIT_CHECK{Method == POST AND
    URL contains 'form'?}
    FORM_SUBMIT_CHECK -->|Yes| AT_FORM_SUBMIT["ActionType = form_submit"]
    FORM_SUBMIT_CHECK -->|No| FORM_FILL_CHECK

    FORM_FILL_CHECK{Method == GET AND
    ElementType == 'form'?}
    FORM_FILL_CHECK -->|Yes| AT_FORM_FILL["ActionType = form_fill"]
    FORM_FILL_CHECK -->|No| EMAIL_CHECK

    EMAIL_CHECK{URL contains 'mailto'
    OR ElementType == 'email'?}
    EMAIL_CHECK -->|Yes| AT_EMAIL["ActionType = email_send"]
    EMAIL_CHECK -->|No| GET_CHECK

    GET_CHECK{Method == GET?}
    GET_CHECK -->|Yes| AT_BROWSE["ActionType = browse"]
    GET_CHECK -->|No| AT_API["ActionType = api_call"]

    AT_PAYMENT --> DENIED_CHECK
    AT_FORM_SUBMIT --> DENIED_CHECK
    AT_FORM_FILL --> DENIED_CHECK
    AT_EMAIL --> DENIED_CHECK
    AT_BROWSE --> DENIED_CHECK
    AT_API --> DENIED_CHECK

    DENIED_CHECK["Check manifest.Denied list:
    for _, denied := range manifest.Denied"]
    DENIED_CHECK --> MATCH_DENIED{actionType == denied?}

    MATCH_DENIED -->|Yes| VIOLATION["return *Violation{
    ActionType, Reason,
    RuleViolated: string(denied)}"]

    MATCH_DENIED -->|No, continue loop| DENIED_CHECK
    MATCH_DENIED -->|Loop exhausted| ALLOWED_CHECK

    ALLOWED_CHECK["Check manifest.Allowed list:
    for _, allowed := range manifest.Allowed"]
    ALLOWED_CHECK --> MATCH_ALLOWED{actionType == allowed?}

    MATCH_ALLOWED -->|Yes| PERMIT["return nil (permitted)"]
    MATCH_ALLOWED -->|No, continue loop| ALLOWED_CHECK
    MATCH_ALLOWED -->|Loop exhausted| DEFAULT_DENY

    DEFAULT_DENY["return *Violation{
    ActionType,
    Reason: 'Action not in allowed list',
    RuleViolated: 'default_deny'}"]

    VIOLATION --> END_BLOCK([PipelineResult: BLOCKED])
    DEFAULT_DENY --> END_BLOCK
    PERMIT --> END_ALLOW([Pipeline continues to Stage 5])
```

**Pre-loaded policy manifests:**

| Policy ID | Allowed | Denied |
|---|---|---|
| `research_assistant` | browse | form_submit, payment_access, data_share |
| `financial_analyst` | browse, payment_access | form_submit, data_share |
| `procurement_bot` | browse, form_fill, form_submit | payment_access |

---

## Corpus Vector Search Flow

The corpus similarity search in `ledger/corpus.go` is an in-process cosine scan — there is no external vector database. This approach scales well to tens of thousands of patterns on modest hardware since all embeddings fit in memory.

```mermaid
flowchart TD
    START([corpus.SimilarityCheck\nctx, queryEmbedding]) --> LOCK

    LOCK["c.mu.RLock()
    Read-lock corpus for thread safety"] --> LOAD_EMBS

    LOAD_EMBS["c.embeddings.GetAll()
    Loads ALL float32[1024] vectors
    from corpus_embeddings BoltDB bucket
    into map[patternID][]float32"] --> LOAD_META

    LOAD_META["c.meta.GetAll()
    Loads all threatMeta structs
    from corpus_meta BoltDB bucket
    into map[patternID]threatMeta"] --> SCAN_LOOP

    SCAN_LOOP["For each (id, emb) in allEmbs:
    compute CosineSimilarity(queryEmbedding, emb)"]

    subgraph cosine["CosineSimilarity(a, b []float32)"]
        CS_INIT["dot=0, normA=0, normB=0"]
        CS_LOOP["For i in range(a):
        dot  += a[i] × b[i]
        normA += a[i]²
        normB += b[i]²"]
        CS_CALC["return dot / (sqrt(normA) × sqrt(normB))"]
        CS_INIT --> CS_LOOP --> CS_CALC
    end

    SCAN_LOOP --> cosine

    cosine --> THRESHOLD{similarity > 0.75?}

    THRESHOLD -->|No| SCAN_LOOP
    THRESHOLD -->|Yes| META_LOOKUP

    META_LOOKUP["Lookup allMeta[id]
    Add CorpusMatch{ID, AttackType,
    OWASPCategory, Sophistication,
    Confidence, Similarity}"] --> SCAN_LOOP

    SCAN_LOOP -->|All vectors processed| SORT

    SORT["sort.Slice(matches, ...):
    Sort by Similarity descending"] --> TRUNCATE

    TRUNCATE{len(matches) > 5?}
    TRUNCATE -->|Yes| CUT["matches = matches[:5]
    Return top-5 only"]
    TRUNCATE -->|No| UNLOCK

    CUT --> UNLOCK

    UNLOCK["c.mu.RUnlock()"] --> PIPELINE_CHECK

    PIPELINE_CHECK{In Guardian Rail Stage 2:
    len(matches) > 0 AND
    matches[0].Similarity > 0.92 AND
    matches[0].AttackType != "" AND
    matches[0].Confidence > 0?}

    PIPELINE_CHECK -->|Yes| BLOCK["PipelineResult{
    Decision: REDACTED,
    StageCaught: 2,
    CorpusStatus: known}"]

    PIPELINE_CHECK -->|No| CONTINUE["Continue to Stage 3 + 5"]
```

**Performance characteristics:**

- With 540 corpus entries: ~540 dot product operations over 1024-dimensional vectors ≈ ~550K float multiplications per call.
- Go's native float64 arithmetic is highly optimised by the compiler; this runs in well under 1ms for 540 entries.
- Memory footprint: 540 × 1024 × 4 bytes = ~2.2MB of embedding data loaded per scan.
- The threshold pair (0.75 for inclusion, 0.92 for blocking) creates a deliberate gap: matches between 0.75 and 0.92 are returned to the pipeline for context but do not trigger an automatic block.

---

## WebSocket Hub Goroutine Model

The WebSocket hub in `websocket/hub.go` uses Go channels to safely coordinate concurrent client registrations, broadcasts, and session-targeted sends.

```mermaid
graph LR
    subgraph Main_Goroutine["hub.Run() goroutine (single)"]
        SELECT["select { ... }
        Blocks on 3 channels"]

        REG_HANDLER["register channel received:
        mu.Lock()
        clients[client.SessionID] = client
        mu.Unlock()"]

        UNREG_HANDLER["unregister channel received:
        mu.Lock()
        delete(clients, sessionID)
        close(client.Send)
        mu.Unlock()"]

        BCAST_HANDLER["broadcast channel received:
        mu.RLock()
        for each client in clients:
          select { client.Send <- msg }
          if blocked: close + delete
        mu.RUnlock()"]

        SELECT -->|register channel| REG_HANDLER
        SELECT -->|unregister channel| UNREG_HANDLER
        SELECT -->|broadcast channel| BCAST_HANDLER

        REG_HANDLER --> SELECT
        UNREG_HANDLER --> SELECT
        BCAST_HANDLER --> SELECT
    end

    subgraph Client_Goroutines["Per-client goroutines (2 per connection)"]
        WRITE_PUMP["writePump goroutine:
        for msg := range client.Send {
          conn.WriteMessage(msg)
        }
        On error: hub.Unregister(client)"]

        READ_PUMP["readPump goroutine:
        for { conn.ReadMessage() }
        Routes to handleCommand()
        On error/disconnect: conn.Close()"]
    end

    subgraph Callers["Callers (various goroutines)"]
        AGENT_RUNNER["agent.Runner.RunAgent()
        hub.SendToSession(sessionID, event)"]

        CAMPAIGN_RUNNER["attack.Runner.Run()
        hub.SendToSession(sessionID, event)"]

        BLAST_ENGINE["handlers.go blast goroutine
        hub.SendToSession(sessionID, event)"]

        HANDLERS["handlers.handleCommand()
        Routes fire_attack → AgentRunner
        Routes change_policy → SessionMgr"]
    end

    AGENT_RUNNER -->|"mu.RLock(), lookup client,
    client.Send <- data"| WRITE_PUMP

    CAMPAIGN_RUNNER -->|"mu.RLock(), lookup client,
    client.Send <- data"| WRITE_PUMP

    BLAST_ENGINE -->|"mu.RLock(), lookup client,
    client.Send <- data"| WRITE_PUMP

    READ_PUMP -->|"handleCommand(msg, sessionID, app)"| HANDLERS
    HANDLERS -->|"hub.register <- client (on connect)"| REG_HANDLER
    HANDLERS -->|"hub.unregister <- client (on disconnect)"| UNREG_HANDLER

    WRITE_PUMP -->|"WebSocket frame"| BROWSER["Browser Client"]
    BROWSER -->|"WebSocket frame"| READ_PUMP
```

**Thread-safety design:**

- `SendToSession` and `Broadcast` use `mu.RLock()` (read lock) since they only read the `clients` map.
- The `Run()` goroutine uses `mu.Lock()` (write lock) only for register/unregister operations.
- Each client has a buffered `Send` channel with capacity 256. If the channel is full (slow client), the hub closes it and removes the client rather than blocking the broadcast loop.
- `send()` and `receive()` goroutines are created per-connection in `handlers.WsHandler()`.

---

## Audit Logger Chain Construction

The audit logger in `audit/logger.go` builds a per-session hash chain with Ed25519 signatures. This section describes the exact byte-level construction.

```mermaid
sequenceDiagram
    participant App as Application Code
    participant Logger as audit.Logger
    participant Hash as crypto/sha256
    participant Sign as crypto/ed25519
    participant Bolt as BoltDB audit bucket

    Note over Logger: Initialisation (once per process):<br/>pub, priv = ed25519.GenerateKey(nil)<br/>sessionSeq = map[string]int{}<br/>prevHash = map[string]string{}

    App->>Logger: Log(ctx, "sess-abc", "fire_attack", {"target":"BOTH"})
    
    activate Logger
    Logger->>Logger: mu.Lock()
    Logger->>Logger: sessionSeq["sess-abc"]++ → seq=1
    Logger->>Logger: prev = prevHash["sess-abc"]<br/>→ "0000...0000" (64 zeros, first entry)

    Logger->>Hash: sha256.New()
    Logger->>Hash: h.Write([]byte("<br/>sess-abc:fire_attack:1:map[target:BOTH]:0000...0000"))
    Note over Hash: content = fmt.Sprintf("%s:%s:%d:%v:%s",<br/>sessionID, action, seq, data, prev)
    Hash-->>Logger: sum → entryHash = "a3f9...bc12" (64 hex chars)

    Logger->>Sign: ed25519.Sign(privateKey, []byte(entryHash))
    Note over Sign: Signs the 64-byte hex string of the hash<br/>(not the raw 32-byte binary hash)
    Sign-->>Logger: sig (64 bytes) → hex encoded → 128 hex chars

    Logger->>Logger: entry = AuditEntry{<br/>  ID: "audit-1748500000000000000",<br/>  SessionID: "sess-abc",<br/>  SeqNum: 1,<br/>  Action: "fire_attack",<br/>  Data: {"target":"BOTH"},<br/>  EntryHash: "a3f9...bc12",<br/>  PrevHash: "0000...0000",<br/>  Signature: "d4e8...7f01",<br/>  CreatedAt: time.Now()<br/>}

    Logger->>Bolt: Set("sess-abc", "audit-{nano}", entry)
    Note over Bolt: Stored at: audit/"sess-abc"/"audit-1748..."

    Logger->>Logger: prevHash["sess-abc"] = "a3f9...bc12"
    Logger->>Logger: mu.Unlock()
    Logger-->>App: &entry, nil

    Note over App,Logger: Second entry links to first:
    App->>Logger: Log(ctx, "sess-abc", "change_policy", {"new_policy":"financial_analyst"})
    activate Logger
    Logger->>Logger: seq=2, prev="a3f9...bc12"
    Note over Logger: content now includes prev="a3f9...bc12"<br/>forming the cryptographic chain link
    Logger-->>App: &entry (SeqNum=2, PrevHash="a3f9...bc12")
    deactivate Logger
```

**Verification procedure (offline):**

```
1. GET /api/audit/{sessionID}         → returns entries[] + public_key (hex)
2. For entry N:
   content  = "{sessionID}:{action}:{seqNum}:{data}:{prevHash}"
   computed = hex(sha256(content))
   assert computed == entry.entry_hash
3. sig_bytes = hex_decode(entry.signature)
   assert ed25519.Verify(hex_decode(public_key), []byte(entry.entry_hash), sig_bytes)
4. assert entry.prev_hash == entries[N-1].entry_hash
```

---

## Campaign Execution Sequence

Campaigns are sequential execution of pre-defined attack payloads against the Guardian Rail. The campaign runner in `attack/campaign.go` streams results to the frontend via WebSocket as each step completes.

```mermaid
sequenceDiagram
    participant HTTP as HTTP Handler
    participant Runner as attack.Runner.Run()
    participant Guardian as guardian.GuardianRail.Process()
    participant Blast as blast.Engine.Calculate()
    participant Hub as websocket.Hub
    participant Browser as Browser (WebSocket)

    HTTP->>Runner: Run(ctx, sessionID, "oat-01", policyManifest)
    Note over Runner: Spawned in a goroutine,<br/>ctx has 5-minute timeout

    Runner->>Runner: Lookup GetCampaign("oat-01")<br/>Returns 5-step prompt_injection campaign

    Runner->>Hub: SendToSession(sessionID, campaign_start{<br/>  campaign_id, campaign_name, total_steps=5})
    Hub-->>Browser: {type:"campaign_start", payload:{...}}

    loop For each step in campaign.Payloads (5 steps)
        Runner->>Runner: Build AgentContext{<br/>  SessionID, PolicyManifest,<br/>  NextAction: GET https://demo.target}

        Runner->>Guardian: Process(ctx, step.Payload, agentCtx)
        Note over Guardian: Full 5-stage pipeline<br/>(S1 → S2 → S3+S5 concurrent → S4)
        Guardian-->>Runner: PipelineResult{Decision, ThreatType, Confidence, Stage}

        Runner->>Blast: Calculate(ctx, sessionID, step.AttackType, step.Sophistication)
        Note over Blast: Computes score, severity,<br/>affected tools, propagation paths
        Blast-->>Runner: *BlastResult{Score, Severity}

        Runner->>Runner: Accumulate CampaignRunResult{<br/>  Step, PayloadName, Decision,<br/>  ThreatType, Confidence, Stage,<br/>  BlastScore, Severity}

        Runner->>Runner: Update run.Blocked / run.Allowed / run.Suspicious counters

        Runner->>Hub: SendToSession(sessionID, campaign_step{<br/>  step, payload_name, decision,<br/>  threat_type, confidence,<br/>  blast_score, severity, stage})
        Hub-->>Browser: {type:"campaign_step", payload:{...}}

        Runner->>Runner: time.Sleep(400ms)
        Note over Runner: Pacing for UI readability
    end

    Runner->>Runner: run.Score = (run.Blocked × 100) / total_steps
    Runner->>Runner: store.Set(run.ID, run) → campaign_runs bucket

    Runner->>Hub: SendToSession(sessionID, campaign_complete{<br/>  campaign_id, score, blocked,<br/>  allowed, suspicious})
    Hub-->>Browser: {type:"campaign_complete", payload:{...}}

    Runner-->>HTTP: *CampaignRun, nil
```

**Campaign scoring:** `score = (blockedCount × 100) / totalSteps`. A score of 100 means all adversarial payloads were caught. The baseline "safe query" step in each campaign (step 5) is expected to ALLOW, so a perfect run scores 80% (4/5 blocked, 1 allowed).

---

## Rate Limiter Sliding Window

The rate limiter in `middleware/ratelimit.go` uses a per-IP event timestamp slice as its sliding window. This diagram shows the window eviction and admission logic.

```mermaid
graph LR
    subgraph Window["window struct (per IP)"]
        EVENTS["events []time.Time
        [t1, t2, t3, ... tN]
        Ordered: oldest first"]
        LIMIT["limit int
        (30 / 10 / 5)"]
        DURATION["duration time.Duration
        (60s / 3600s / 3600s)"]
    end

    subgraph Allow["window.allow() call"]
        NOW["now = time.Now()"]
        CUTOFF["cutoff = now - duration"]
        EVICT["Evict expired events:
        while events[0].Before(cutoff):
          events = events[1:]
        (O(n) scan from front)"]
        CHECK{len(events) >= limit?}
        REJECT["return false, 0
        → HTTP 429 + Retry-After header"]
        ACCEPT["events = append(events, now)
        return true, limit - len(events)"]
    end

    NOW --> CUTOFF --> EVICT --> CHECK
    CHECK -->|Yes — limit reached| REJECT
    CHECK -->|No — within limit| ACCEPT

    subgraph Eviction["Background eviction loop"]
        TICKER["time.NewTicker(10 * time.Minute)"]
        CLEAR["for ip := range clients:
        delete(clients, ip)
        Purges ALL IP entries
        (conservative — IPs re-create windows on next request)"]
        TICKER --> CLEAR
    end

    subgraph Groups["limiterGroup (per endpoint category)"]
        ATTACKS["attacks:
        30 requests / 60s"]
        SESSIONS["sessions:
        10 requests / 3600s"]
        EXPORTS["exports:
        5 requests / 3600s"]
    end

    subgraph Headers["Response Headers (on every request)"]
        H1["X-RateLimit-Limit: 30"]
        H2["X-RateLimit-Remaining: N"]
        H3["X-RateLimit-Window: 60s"]
        H4["Retry-After: 60 (on 429 only)"]
    end
```

**Concurrency safety:** Each `window` has its own `sync.Mutex` — `allow()` locks it for the duration of eviction + append. The `limiterGroup` uses `sync.RWMutex` — reads (looking up existing IPs) use `RLock`, creates (new IPs) use `Lock`. This minimises contention under high concurrent load.

---

## Frontend Component Tree

The React frontend in `frontend/src/` is structured as three top-level panel components wrapped by a WebSocket context provider.

```mermaid
graph TD
    MAIN["main.tsx
    ReactDOM.createRoot()
    Mounts WebSocketProvider with
    url: ws://localhost:8080/ws/{sessionID}"]

    MAIN --> WSP["WebSocketProvider
    (lib/WebSocketContext.tsx)
    Context: {socket, isConnected, send, lastMessage}
    Auto-reconnects every 2s on disconnect"]

    WSP --> APP["App.tsx
    Top-level layout container
    Manages: corpusTotal counter, isLightMode
    Subscribes to: lastMessage (threat_event → increment corpus count)"]

    APP --> HEADER["Header Bar
    (inline in App.tsx)
    Shows: SYS:ONLINE status dot,
    CORPUS: N PATTERNS count,
    Light/Dark theme toggle"]

    APP --> ATTACK["AttackConsole.tsx
    Left panel (25% width)
    State: target, sophistication, activeTab, customText
    Uses: send() from WebSocketContext"]

    APP --> ARENA["AgentArena.tsx
    Middle panel (50% width)
    Shows: Agent A (unprotected) and
    Agent B (protected) side by side
    Subscribes to: agent_status, agent_step,
    agent_output, threat_event events"]

    APP --> SHIELD["VaultGuardShield.tsx
    Right panel (25% width)
    State: activePolicy, threats[]
    Uses: send(change_policy), lastMessage"]

    ATTACK --> TAB_PREBUILT["PRE-BUILT tab
    6 prebuilt attack buttons
    (role_override, indirect_injection,
    memory_poison, identity_spoof,
    dark_pattern, goal_hijack)
    Each fires send('fire_attack', ...)"]

    ATTACK --> TAB_CUSTOM["CUSTOM tab
    Textarea for custom attack text
    'GENERATE & FIRE' button
    fires send('fire_attack', {custom_text})"]

    ATTACK --> CONTROLS["Sophistication selector (LOW/MEDIUM/HIGH)
    Target selector (UNPROTECTED/PROTECTED/BOTH)"]

    SHIELD --> POLICY_BOX["Active Policy dropdown
    (research_assistant / financial_analyst / procurement_bot)
    On change: send('change_policy', {policy_id})"]

    SHIELD --> THREAT_FEED["Live Threat Feed
    Last 10 threat_event payloads
    Shows: action, stage, threat_type, confidence
    NEW PATTERN badge for corpus_status='new'"]

    SHIELD --> AUDIT_BOX["Audit Log stub
    Chain Integrity: VERIFIED label
    EXPORT PDF button (static in UI)"]
```

---

## React WebSocket Context Data Flow

The `WebSocketContext` is the single source of truth for real-time state in the frontend. This diagram traces how a server event flows from the Go backend through the context into UI components.

```mermaid
graph TD
    subgraph Backend["Go Backend"]
        HUB["websocket.Hub.SendToSession()"]
        CONN["gorilla/websocket conn.WriteMessage()"]
        HUB --> CONN
    end

    subgraph Network["Network"]
        WS_FRAME["WebSocket Text Frame
        JSON: {type: 'threat_event',
               payload: {agent_id, threat_type,
                         confidence, stage,
                         action, corpus_status}}"]
        CONN --> WS_FRAME
    end

    subgraph Context["WebSocketContext (lib/WebSocketContext.tsx)"]
        WS_OBJ["ws.onmessage handler"]
        PARSE["JSON.parse(event.data)"]
        SET_MSG["setLastMessage(data)
        → triggers React re-render
        for ALL consumers of useWebSocket()"]
        WS_FRAME --> WS_OBJ --> PARSE --> SET_MSG
    end

    subgraph Consumers["Component subscribers (via useWebSocket())"]
        APP_EFFECT["App.tsx useEffect:
        if lastMessage.type === 'threat_event'
        AND payload.corpus_status === 'new':
          setCorpusTotal(prev + 1)
        → Updates header corpus counter"]

        ARENA_EFFECT["AgentArena.tsx useEffect:
        switch(lastMessage.type):
          'agent_status' → update agent state badge
          'agent_step' → append to agent log
          'agent_output' → set agent output text
          'threat_event' → highlight intercepted agent"]

        SHIELD_EFFECT["VaultGuardShield.tsx useEffect:
        if lastMessage.type === 'threat_event':
          setThreats(prev => [payload, ...prev].slice(0, 10))
        → Prepend to live threat feed (max 10)"]
    end

    SET_MSG --> APP_EFFECT
    SET_MSG --> ARENA_EFFECT
    SET_MSG --> SHIELD_EFFECT

    subgraph Send_Flow["Client → Server (send() call)"]
        COMPONENT_SEND["Component calls send(type, payload)"]
        CONTEXT_SEND["WebSocketContext.send():
        socket.send(JSON.stringify({type, payload}))"]
        GO_READ["readPump goroutine:
        conn.ReadMessage() → handleCommand()"]
        COMPONENT_SEND --> CONTEXT_SEND --> GO_READ
    end
```

---

## API Endpoint Reference Map

| Method | Path | Handler | Rate Limit | Auth | Description |
|---|---|---|---|---|---|
| `POST` | `/api/session` | `CreateSession` | 10/hour/IP | None | Create a new playground session. Returns `Session` JSON with UUID `id` and `session_token`. |
| `GET` | `/api/corpus/stats` | `GetCorpusStats` | None | None | Returns `{total, session_new, hour_new}` aggregate counts. |
| `GET` | `/api/corpus/timeseries` | `GetCorpusTimeseries` | None | None | Returns 24-hour array of `TimeseriesBucket` with per-attack-type counts. |
| `GET` | `/api/audit/:sessionID` | `GetAuditLog` | None | None | Returns all audit entries for a session, ordered by `seq_num`. Includes `public_key` for offline verification. |
| `GET` | `/api/audit/:sessionID/export?format=csv` | `ExportAuditLog` | 5/hour/IP | None | Downloads a CSV file with all audit chain columns. |
| `GET` | `/api/audit/:sessionID/export?format=pdf` | `ExportAuditLog` | 5/hour/IP | None | Downloads a PDF report with Ed25519 public key and formatted audit chain table. |
| `GET` | `/api/blast/:sessionID` | `GetBlastRadius` | None | None | Returns the most recent `BlastResult` for a session (404 if none). |
| `GET` | `/api/blast/:sessionID/history` | `GetBlastHistory` | None | None | Returns all `BlastResult` records for a session, newest first. |
| `GET` | `/api/campaigns` | `ListCampaigns` | None | None | Returns metadata for all 10 OWASP campaigns (payload text excluded from list). |
| `GET` | `/api/campaigns/:id` | `GetCampaign` | None | None | Returns full campaign including all `CampaignPayload` steps. |
| `POST` | `/api/campaigns/:id/run?sessionID=...` | `RunCampaign` | 30/min/IP | None | Starts campaign execution in a background goroutine. Returns 202. Results streamed via WebSocket. |
| `POST` | `/api/threats/custom` | `AnalyzeCustomThreat` | 30/min/IP | None | Runs arbitrary payload through Guardian Rail. Optionally saves to corpus. Returns `decision`, `blast_radius`, and LLM-generated `variants`. |
| `GET` | `/ws/:sessionID` | `WsHandler` | None | None | WebSocket upgrade. Bidirectional event stream for the session. |
| `GET` | `/health` | inline | None | None | Returns `{status:"ok", corpus_size:N, mock_mode:bool}`. |

---

## Threat Builder Workflow

The custom threat builder (`POST /api/threats/custom`) supports two usage modes. Mode A submits an existing known payload; Mode B submits a natural-language description and the backend generates variants.

```mermaid
flowchart TD
    START([POST /api/threats/custom]) --> BIND

    BIND["ShouldBindJSON(req):
    payload (required), attack_type,
    sophistication, session_id, save_to_corpus"] --> SESSION_CHECK

    SESSION_CHECK{session_id in request?}
    SESSION_CHECK -->|Yes| GET_SESSION
    SESSION_CHECK -->|No| CREATE_SESSION

    CREATE_SESSION["sessionID = uuid.New()
    SessionMgr.CreateSession(id, token)"] --> GET_POLICY
    GET_SESSION["SessionMgr.GetSession(session_id)"] --> GET_POLICY

    GET_POLICY["policy.PreloadedPolicies[sess.ActivePolicy]
    Resolves current session's Manifest"] --> BUILD_CTX

    BUILD_CTX["agentCtx = AgentContext{
    SessionID, PolicyManifest,
    NextAction: GET https://demo.target}"] --> PIPELINE

    PIPELINE["GuardianRail.Process(ctx, req.Payload, agentCtx)
    Full 5-stage pipeline execution"] --> RESOLVE_ATTACK

    RESOLVE_ATTACK["Resolve attackType:
    If pipeline detected a type: use it
    Else: use req.AttackType from request"] --> BLAST_CALC

    BLAST_CALC["BlastEngine.Calculate(ctx, sessionID,
    attackType, sophistication)
    Computes score, severity, propagation"] --> VARIANT_CHECK

    VARIANT_CHECK{result.Decision != ALLOW?}

    VARIANT_CHECK -->|Yes — threat detected| GENERATE_VARIANTS
    VARIANT_CHECK -->|No — benign| CORPUS_CHECK

    GENERATE_VARIANTS["LLM.Converse(ctx, GetPolicyModel(),
    'SYSTEM: VARIANT GENERATOR — produce 5 attack variants',
    req.Payload)
    Unmarshal JSON {variants: []string}"] --> CORPUS_CHECK

    CORPUS_CHECK{req.SaveToCorpus == true AND
    result.ThreatType != 'none'?}

    CORPUS_CHECK -->|Yes| EMBED
    CORPUS_CHECK -->|No| AUDIT_LOG

    EMBED["LLM.Embed(ctx, req.Payload)
    Generate 1024-dim embedding"] --> ADD_PATTERN

    ADD_PATTERN["Corpus.AddPattern(ctx, ThreatPattern{
    PayloadHash: first 8 hex bytes of payload,
    AttackType, Sophistication, Confidence,
    Embedding, SessionID, IsNovel: true})"] --> AUDIT_LOG

    AUDIT_LOG["Audit.Log(ctx, sessionID,
    'custom_threat_analysis',
    {decision, threat_type, stage_caught})"] --> RESPOND

    RESPOND["c.JSON(200, CustomThreatResponse{
    Decision, ThreatType, Confidence,
    StageCaught, CorpusStatus,
    BlastRadius, Variants})"]
```

---

## Seed Corpus Import Flow

The corpus seeder in `ledger/seeder.go` runs at startup and is idempotent — it checks the corpus size before doing any work.

```mermaid
flowchart TD
    START([ledger.SeedIfNeeded\nctx, corpus, embedder, threshold=100]) --> COUNT_CHECK

    COUNT_CHECK["corpus.Count()
    Reads BoltDB corpus_meta stats: KeyN"]

    COUNT_CHECK --> THRESHOLD{count >= threshold?}

    THRESHOLD -->|Yes — already seeded| SKIP["return nil (no-op)"]

    THRESHOLD -->|No — needs seeding| BUILD_PATTERNS

    BUILD_PATTERNS["buildSeedPatterns():
    60 base entries × OWASP Agentic Top 10
    (6–12 entries per category)"] --> EXPAND

    EXPAND["vary(base) for each entry:
    Generates 8 additional variants:
    1. UPPERCASE(payload)
    2. '[SYSTEM] ' + payload
    3. payload + ' (This is authorised)'
    4. 'Note: ' + payload
    5. '<!-- ' + payload + ' -->'
    6. '\\n\\n' + payload
    7. payload + ' [END OF CONTEXT]'
    8. 'Urgent: ' + payload
    Variants 0–2 → sophistication = 'high'
    → Total: 60 × 9 = 540 patterns"] --> SEED_LOOP

    SEED_LOOP["For each seedEntry in 540 patterns:"]

    SEED_LOOP --> HASH["payloadHash = hex(sha256(payload))"]

    HASH --> EMBED["embedder.Embed(ctx, payload)
    AWS Bedrock Titan Embed v2
    OR MockClient deterministic pseudo-vector"]

    EMBED --> EMBED_FAIL{Embed error?}

    EMBED_FAIL -->|Yes| ZERO_VEC["embedding = float32[1024] (zero vector)
    Fallback — pattern still stored,
    will never match similarity check"]

    EMBED_FAIL -->|No| ADD_PATTERN

    ZERO_VEC --> ADD_PATTERN

    ADD_PATTERN["corpus.AddPattern(ctx, ThreatPattern{
    PayloadHash: hash,
    AttackType, OWASPCategory, MITREId,
    Description, Sophistication, Confidence,
    Embedding,
    SessionID: 'seed',
    IsNovel: false,
    CreatedAt: time.Now() - (seeded × 1s)})"]

    ADD_PATTERN --> DUP_CHECK{PayloadHash already exists?}

    DUP_CHECK -->|Yes| INC_SEEN["Increment SeenCount on existing pattern
    (idempotent re-seed)"]

    DUP_CHECK -->|No| WRITE_BOTH

    WRITE_BOTH["1. corpus_meta bucket: Set(patternID, threatMeta JSON)
    2. corpus_embeddings bucket: Put(patternID, binary float32[1024])"]

    WRITE_BOTH --> COUNT_INC["seeded++"]
    INC_SEEN --> SEED_LOOP
    COUNT_INC --> SEED_LOOP

    SEED_LOOP -->|All 540 processed| LOG["log.Printf('Corpus seeded: %d patterns added, total: %d',
    seeded, corpus.Count())"]

    LOG --> DONE([return nil])
```

---

## BoltStore Generic Operations

The `store/bolt.go` package provides three generic types that serve as the persistence layer for all domain objects.

```mermaid
classDiagram
    class DB {
        -bolt *bbolt.DB
        +OpenDB(path string) *DB, error
        +Close() error
    }

    class BoltStore~T~ {
        -db *bbolt.DB
        -bucket []byte
        +NewBoltStore(db *DB, bucket string) *BoltStore[T], error
        +Get(id string) T, bool
        +GetAll() map[string]T
        +Set(id string, item T) error
        +Delete(id string) error
        +Count() int
    }

    note for BoltStore~T~ "T is any JSON-serialisable Go struct.
Used for: Session, threatMeta,
TimeseriesBucket, CampaignRun.
Single-level bucket: bucket/key → JSON(T)"

    class EmbeddingStore {
        -db *bbolt.DB
        -bucket []byte
        +NewEmbeddingStore(db *DB, bucket string) *EmbeddingStore, error
        +Put(id string, emb []float32) error
        +Get(id string) []float32, bool
        +GetAll() map[string][]float32
        +Delete(id string) error
    }

    note for EmbeddingStore "Stores float32 vectors as raw binary.
Encoding: little-endian uint32 per float.
4 bytes per float × 1024 dims = 4096 bytes/entry.
~73% smaller than JSON encoding.
GetAll() loads entire store for cosine scan."

    class NestedStore~T~ {
        -db *bbolt.DB
        -bucket []byte
        +NewNestedStore(db *DB, bucket string) *NestedStore[T], error
        +Set(parentID, childID string, item T) error
        +Get(parentID, childID string) T, bool
        +GetAll(parentID string) map[string]T
        +GetAllParents() map[string]map[string]T
    }

    note for NestedStore~T~ "Two-level bucket hierarchy:
bucket / parentID (sub-bucket) / childID → JSON(T).
Used for: AuditEntry (audit/sessionID/entryID),
BlastResult (blast_results/sessionID/blastID).
GetAll(parentID) lists all children for one parent."

    DB <-- BoltStore~T~ : wraps bolt.DB
    DB <-- EmbeddingStore : wraps bolt.DB
    DB <-- NestedStore~T~ : wraps bolt.DB

    class Corpus {
        +meta BoltStore~threatMeta~
        +embeddings EmbeddingStore
    }

    class AuditLogger {
        +store NestedStore~AuditEntry~
    }

    class BlastEngine {
        +store NestedStore~BlastResult~
    }

    class SessionManager {
        +store BoltStore~Session~
    }

    class CampaignRunner {
        +store BoltStore~CampaignRun~
    }

    BoltStore~T~ <-- SessionManager : uses (sessions bucket)
    BoltStore~T~ <-- Corpus : uses (corpus_meta + corpus_timeseries)
    BoltStore~T~ <-- CampaignRunner : uses (campaign_runs bucket)
    EmbeddingStore <-- Corpus : uses (corpus_embeddings bucket)
    NestedStore~T~ <-- AuditLogger : uses (audit bucket)
    NestedStore~T~ <-- BlastEngine : uses (blast_results bucket)
```

**Binary encoding helper functions:**

```go
// float32sToBytes: 1 float32 → 4 bytes (little-endian IEEE 754)
func float32sToBytes(fs []float32) []byte {
    b := make([]byte, len(fs)*4)
    for i, f := range fs {
        binary.LittleEndian.PutUint32(b[i*4:], math.Float32bits(f))
    }
    return b
}

// bytesToFloat32s: inverse — 4 bytes → 1 float32
func bytesToFloat32s(b []byte) []float32 {
    fs := make([]float32, len(b)/4)
    for i := range fs {
        bits := binary.LittleEndian.Uint32(b[i*4:])
        fs[i] = math.Float32frombits(bits)
    }
    return fs
}
```

---

## Bedrock Model Routing Reference

| Pipeline Stage | Default Model ID | Env Override | Task | Expected Output Format |
|---|---|---|---|---|
| Stage 2 (pre-embedding) | `amazon.titan-embed-text-v2:0` | `BEDROCK_EMBED_MODEL` | Generate 1024-dim normalised embedding for corpus similarity | `[]float32` length 1024 |
| Stage 3 (classifier) | `amazon.nova-lite-v1:0` | `BEDROCK_CLASSIFIER_MODEL` | Binary classification of payload as adversarial or benign | `{"is_adversarial":bool,"attack_type":string,"sophistication":string,"confidence":float}` |
| Stage 5 (drift) | `meta.llama3-3-70b-instruct-v1:0` | `BEDROCK_REASONING_MODEL` | Compare payload semantics against session task anchor | `{"drift_score":float}` 0.0=on-task, 1.0=fully drifted |
| Variant generation | `amazon.nova-pro-v1:0` | `BEDROCK_POLICY_MODEL` | Generate 5 attack variant payloads from a detected threat | `{"variants":["string","string","string","string","string"]}` |
| Policy compilation | `amazon.nova-pro-v1:0` | `BEDROCK_POLICY_MODEL` | Convert natural language policy to JSON `Manifest` | `{"allowed":[],"denied":[]}` |

**Offline mock behaviour (`bedrock/mock.go`):**

The `MockClient` returns deterministic pseudo-responses without making any network calls. Embeddings are generated using a hash-based pseudo-random float32 sequence seeded by the input text — ensuring reproducibility across runs. Classification responses alternate between "adversarial" and "benign" patterns based on known trigger phrases in the input text. This makes the mock suitable for CI pipelines and offline demos where AWS credentials are unavailable.

**AWS credential resolution order (standard Go SDK v2):**

1. Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
2. Shared credentials file: `~/.aws/credentials`
3. IAM roles for EC2/ECS/Lambda task roles
4. If all fail, `NewAWSBedrockClient` logs the error and automatically falls back to `MockClient`
