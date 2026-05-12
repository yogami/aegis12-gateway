# Aegis-12 Gateway Architecture & Rules

## MANDATORY AGENT DIRECTIVE: Audit Before Architect
**DO NOT write new infrastructure components without first checking `src/infrastructure` or `packages/`.**
Aegis-12 has highly developed, battle-tested components. You must map the existing implementation surface area before proposing or writing code.

*   **Circuit Breaking:** We already have robust fault tolerance and terminal rejection mechanisms (`src/infrastructure/CircuitBreaker.ts`, `TerminalRefusalError`). 
*   **TEE Enclave:** We already utilize Phala CVM and Intel TDX for secure agent execution.

## The Core Technical Reality: Asynchronous Anchoring
Aegis-12 **DOES NOT** suffer from multi-second latency bottlenecks. 
*   Our Phala CVM remote attestation and Zero-Knowledge (RiscZero) proofs are generated and anchored to Solana **asynchronously** in the background.
*   Inline transaction checks (like verifying x402 payment headers) are sub-millisecond cryptographic signature verifications.
*   Do not hallucinate synchronous latency flaws.

## The Go-To-Market Strategy: x402 Active Policy Engine
Aegis-12 provides "Agentic Compliance-as-a-Service" for Enterprise Agent Swarms.
*   **x402 Payments**: We embed directly into the HTTP 402 payment standard used by autonomous agents (via `@aegis12/x402-poi`).
*   **Proof of Intent (PoI)**: We do not just hash prompts. We generate human-readable, auditor-grade JSON Evidence Packages (Policy ID, Risk Tier, Model Version) that satisfy MiCA and NIST CAISI requirements.
*   **Active Defense**: Our enclaves evaluate the agent's intent against institutional policies and actively abort (via `CircuitBreaker`) non-compliant payments before they reach the blockchain.
