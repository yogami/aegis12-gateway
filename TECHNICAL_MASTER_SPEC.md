# Aegis-12: Master Technical Specification

**Version:** 3.0.0  
**Status:** Canonical Source of Truth (Post-Veracity Audit)  
**Last Updated:** 2026-05-07  
**Production Server:** `phala_cvm_server.ts` (raw Node.js `http` module, no framework)

This document is the single source of truth for the Aegis-12 Gateway. Every claim in this document is verified against the current codebase.

---

## 1. Architecture Overview

Aegis-12 is a **Hardware-Attested Policy Enforcement Point (PEP)** for autonomous AI agents on Solana. It runs inside a Phala Network CVM (Confidential Virtual Machine) backed by Intel TDX hardware attestation.

### Production Entrypoint

The production server is [`src/phala_cvm_server.ts`](src/phala_cvm_server.ts) — a raw Node.js `http.createServer()` with explicit route handling. No web framework is used in production.

### Core Pipeline

```
Client Request → HTTP Server → PhalaEntrypoint.processRequest()
  → validatePayloadSize (128KB max)
  → parsePayload (JSON)
  → TappdClient.getQuote() (hardware attestation)
  → Pcr0Verifier.verify() (code integrity check)
  → AegisPEP.enforce() (policy evaluation)
    → validateRequestStructure (envelope, anomaly, expiry)
    → Eip712Verifier.verifySignature (cryptographic proof)
    → mergeVaultedPolicy (secret override from vault)
    → normalizeAction + OfacValidator (sanctions check)
    → SimulationEngine.simulateAndParse (anti-evasion)
    → evaluateEscalation (amount ≥ 10B → escalate, else approve)
    → generateReceipt + signReceipt (EIP-712)
  → saveEvidence (initial "batching" state)
  → dispatchBackground (async Solana anchor + ZK seal)
  → Return JSON response (always HTTP 200)
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Raw `http` module, no Fastify | Minimizes memory footprint for 2GB TEE enclaves |
| All responses HTTP 200 | Denial info is in the JSON body (`status: "denied"`) |
| Async anchoring | Solana TX anchoring happens in background to avoid blocking |
| Synthetic ZK fallback | RISC Zero requires specific hardware; CVM uses synthetic seals |

---

## 2. API Endpoints

### `POST /sign_and_execute`

The primary enforcement endpoint. Accepts a `PolicyEvaluationRequest` JSON payload.

**Required fields:**
- `action.toolId` — `"solana_transfer"` or `"swap"`
- `action.parameters` — `{ to, amount, token }` for transfers
- `context.currentAnomalyScore` — float between 0.0 and 1.0
- `dynamicPolicy.policyConfig` — EIP-712 signed policy configuration
- `dynamicPolicy.signature` — EIP-712 signature from authorized tenant

**Responses (all HTTP 200):**
- `{ status: "approved", receipt: {...}, ledger_tx: "batching" }` — Request approved, Solana anchoring in progress
- `{ status: "escalated", receipt: {..., envelope: {...}} }` — Amount ≥ 10B lamports, requires human oversight
- `{ status: "denied", error: "..." }` — Terminal refusal with reason

### `POST /vault/policy`

Upload sensitive policy data to the confidential vault inside the enclave.

**Required fields:**
- `tenantId` — Tenant identifier
- `policyId` — Policy identifier (must match the signed policy's `policyId`)
- `sensitiveData` — Object containing secret overrides (e.g., `financialLimitsString`)

**Response:** `{ status: "success", vaultId: "...", message: "Policy vaulted successfully" }`

### `GET /evidence/{receiptId}`

Poll for evidence status after an approved request.

**Response:** `{ status: "COMPLETED"|"pending"|"NOT_FOUND", receiptId, ars_anchor, ledger_tx }`

### `GET /health`

Health check with enclave metadata.

**Response:** `{ status: "alive", ledgerPayer, enclaveDid, version, commit_hash, hardware, timestamp }`

### `GET /logs`

Protected log endpoint. Requires `Authorization: Bearer <ADMIN_LOG_TOKEN>`.

---

## 3. Security Enforcement Rules

### 3.1 EIP-712 Policy Signature Verification
- Every request MUST include a `dynamicPolicy` with an EIP-712 signature
- The signer address is recovered and checked against the `AUTHORIZED_TENANTS` trust store
- `crossChainTarget` in the signed policy MUST match `solana:{SOLANA_CLUSTER}`
- Policy `expiresAt` MUST be in the future (replay prevention)

### 3.2 Nonce Double-Spend Prevention
- Each `tenantId::nonce` pair is reserved atomically before enforcement
- If the nonce was already used, the request is denied
- The nonce is burned on commit, rolled back on failure

### 3.3 Financial Limits & Tier Evaluation
- `financialLimitsString` is parsed and the tier key MUST match `agent.currentTier`
- Only single-tier limit objects are accepted (multi-tier is structurally unsafe)
- `estimatedValue` is validated against the signed limit via `TierEvaluator`
- Cumulative spend is tracked per-tenant in the WAL engine

### 3.4 Anomaly Score Bounds
- `context.currentAnomalyScore` (0.0–1.0) is scaled by 100 and compared against signed `maxAnomalyScore`
- Anomaly check runs BEFORE escalation decision (Phase 1)
- Tier limit check runs AFTER escalation decision (Phase 2, autonomous only)

### 3.5 OFAC/Sanctions Kill Switch
- `OfacValidator.inspectParameters()` runs on every normalized parameter set
- Known sanctioned addresses trigger immediate `TerminalRefusalError`

### 3.6 Prompt Injection Detection
- `sanitizeContext()` checks for `"IGNORE ALL PREVIOUS INSTRUCTIONS"` and `"MALICIOUS_INTENT"`
- Detection triggers immediate denial

### 3.7 Anti-Evasion Simulation
- `SimulationEngine.simulateAndParse()` inspects inner instructions for stealth `SystemProgram.assign` calls
- **Current limitation:** Uses mock RPC simulation; not connected to live Helius RPC

### 3.8 Eviction Watermark (Anti-Replay)
- A monotonic watermark file prevents acceptance of policies with `expiresAt` below the last eviction timestamp

---

## 4. Solana Anchoring

### 4.1 SPL Memo Anchoring (Default)
- Receipts are anchored to Solana Devnet via SPL Memo instructions
- Memo format: `a12:{base64url(JSON)}` containing `{ v, act, h, d, did, ts }`
- RPC: Helius Devnet (`devnet.helius-rpc.com`)
- Payer: Pre-funded keypair via `SOLANA_PAYER_SECRET`

### 4.2 On-Chain Registry (Optional)
- If `ENABLE_ONCHAIN_REGISTRY=true`, uses the Anchor program at `FPVw3tMxjARfaPFqkDRJSp19vPrzGQ1fW4oJwkUgeyxS`
- PDAs: `[b"aegis_compliance_v1", AgentPubKey, ReceiptID]`
- **Not enabled in current production deployment**

### 4.3 Batch Anchoring
- `BatchAnchorWorker` sweeps unbatched journal entries every 30 seconds
- Constructs a Merkle root from all pending `article12LogHash` values
- Anchors the root as a single Solana transaction

---

## 5. Escalation (Article 14 Human Oversight)

When `amount >= 10_000_000_000` (10B lamports ≈ 10 SOL):
1. The PEP generates an `AegisIntentEnvelope` with `vault_pda`, `squads_multisig`, `instruction_digest`, and `state_predicates`
2. The envelope is signed by the TEE enclave
3. `SquadsRouter.routeIfEscalated()` is called (placeholder for Squads V4 multisig integration)
4. The receipt is returned with `status: "escalated"`

**Current limitation:** SquadsRouter is a stub; no actual Squads proposal is created.

---

## 6. ZK Proof Generation

- `ZkProofGenerator.generate()` runs asynchronously after approval
- Attempts to use RISC Zero prover via `AegisZKClient`
- **In production CVM:** Falls back to synthetic seal due to missing `AEGIS_ZK_PROVER_HASH`
- Synthetic seal format: `base64("synthetic-seal-{timestamp}-{error}-{padding}")`
- The ZK seal is stored via `updateZkSeal()` and is available via `/evidence/{receiptId}`

---

## 7. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SOLANA_PAYER_SECRET` | Production | Base64-encoded Solana keypair secret |
| `SOLANA_RPC_URL` | Yes | Helius RPC endpoint for Solana Devnet |
| `SOLANA_CLUSTER` | Yes | `devnet`, `localnet`, or `mainnet-beta` |
| `AUTHORIZED_TENANTS` | Yes | JSON map of `tenantId → [eth_addresses]` |
| `PHALA_SIMULATED_ROOT_SEED` | CVM Boot | Hex seed for deterministic enclave key derivation |
| `AEGIS_ZK_PROVER_HASH` | Optional | SHA-256 hash of RISC Zero prover binary |
| `PORT` | Optional | Server port (default: 8000) |
| `NODE_ENV` | Optional | `production` or `test` |
| `WAL_SECRET` | Production | Encryption key for WAL engine |
| `ENABLE_ONCHAIN_REGISTRY` | Optional | `true` to use Anchor program instead of Memo |
| `ADMIN_LOG_TOKEN` | Optional | Bearer token for `/logs` endpoint |

---

## 8. Known Limitations

1. **ZK proofs are synthetic** — RISC Zero requires specific hardware and prover binary
2. **SimulationEngine is mocked** — Anti-evasion checks use mock RPC, not live Helius
3. **SquadsRouter is a stub** — Escalated receipts are signed but no Squads proposal is created
4. **x402 payment validation is not enforced** — `X402PayGate` exists but is not wired into the server
5. **JitoBundler is not used** — MEV protection via Jito is not integrated
6. **Circuit Breaker is not wired** — The pattern exists but is not connected to the request pipeline
7. **Nonces are in-memory only** — Restart clears nonce registry (WAL persists spend data)
