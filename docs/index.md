---
layout: home

hero:
  name: "VaultGuard"
  text: "Trust Infrastructure for Production AI Agents"
  tagline: "5-stage threat interception · Blast radius mapping · Tamper-evident audit trail · OWASP Agentic Top 10 coverage"
  image:
    src: /logo.svg
    alt: VaultGuard
  actions:
    - theme: brand
      text: Architecture
      link: /ARCHITECTURE
    - theme: alt
      text: Low-Level Design
      link: /LOW_LEVEL_DESIGN
    - theme: alt
      text: Deployment Guide
      link: /USER_GUIDE_AND_DEPLOYMENT

features:
  - icon: 🛡️
    title: Guardian Rail Pipeline
    details: 5-stage runtime defence — invisible char stripping → corpus similarity → LLM classification → policy enforcement → goal-drift detection. Stops threats in 1–45 ms.
  - icon: 🧠
    title: Threat Ledger
    details: 540+ OWASP Agentic Top 10 patterns pre-seeded. BoltDB-backed with binary float32 embeddings. Cosine similarity search using Amazon Titan Embed Text v2.
  - icon: 💥
    title: Blast Radius Engine
    details: Consequence mapping with 0–100 composite vulnerability scores. ReactFlow propagation graph across 8 tool nodes. Identifies lateral spread potential and remediations.
  - icon: 📋
    title: Tamper-Evident Audit
    details: Ed25519-signed, SHA-256 hash-chained audit entries. Every event is cryptographically linked. Export to CSV or PDF for compliance reporting.
  - icon: 🎯
    title: OWASP Agentic Top 10
    details: 10 pre-built attack campaigns covering OAT-01 through OAT-10. Each with 4 adversarial + 1 clean baseline payload, real-time WebSocket streaming.
  - icon: ☁️
    title: AWS Bedrock Native
    details: Amazon Nova Lite (classifier), Meta Llama 3.3 70B (drift), Nova Pro (policy + variants), Titan Embed v2 (embeddings). Full offline mode with deterministic mock client.
---
