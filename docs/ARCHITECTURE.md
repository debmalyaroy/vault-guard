# VaultGuard Architecture

VaultGuard acts as an interception layer (Guardian Rail) between an AI Agent and external inputs. It leverages LLMs for semantic analysis and deterministic rules for policy enforcement.

## High Level Architecture

```mermaid
graph TD
    UI[Frontend React/Vite] <-->|WebSocket| API[Backend API Go/Gin]
    API <-->|REST| UI

    subgraph VaultGuard Backend
        API --> Hub[WebSocket Hub]
        Hub --> Runner[Agent Runner]
        Runner --> Rail[Guardian Rail Pipeline]

        Rail --> S1[Stage 1: Strip]
        S1 --> S2[Stage 2: Fast Path]
        S2 --> S3[Stage 3: Classify]
        S2 --> S5[Stage 5: Goal Drift]
        S3 --> S4[Stage 4: Policy Check]
        S5 --> S4
        S4 --> Decision[Decision Engine]

        S2 -.-> Ledger[(Threat Ledger)]
        S3 -.-> LLM[AWS Bedrock]
        S5 -.-> LLM
    end

    Runner --> AgentA[Unprotected Agent]
    Runner --> AgentB[Protected Agent]

    AgentA --> Web[Target Websites]
    AgentB -.-> Rail
    Rail --> Web
```

## Guardian Rail Pipeline

The pipeline processes every payload across 5 stages before allowing it into the agent's context.

```mermaid
sequenceDiagram
    participant Web as Target Website
    participant Rail as Guardian Rail
    participant S1 as Stage 1 (Strip)
    participant S2 as Stage 2 (Corpus)
    participant S3 as Stage 3 (LLM)
    participant S4 as Stage 4 (Policy)
    participant S5 as Stage 5 (Drift)
    participant Agent as Agent Context

    Web->>Rail: Inbound Payload
    Rail->>S1: Strip invisible chars
    S1->>S2: Check pgvector corpus

    alt Known Threat (>92% similarity)
        S2-->>Rail: BLOCK/REDACT
    else Novel Content
        par S3 and S5 Run Concurrently
            S2->>S3: LLM Classifier
            S2->>S5: LLM Drift Check
        end

        alt S3 Detects Threat
            S3-->>Rail: REDACT & Add to Corpus
        else
            S3->>S4: Check Action Intent

            alt Action Denied
                S4-->>Rail: BLOCK
            else Action Allowed
                alt S5 Detects Drift
                    S5-->>Rail: SUSPICIOUS
                else
                    S4-->>Agent: ALLOW (Clean Data)
                end
            end
        end
    end
```