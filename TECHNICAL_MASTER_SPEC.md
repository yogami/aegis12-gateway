# Aegis-12: Master Technical Specification

**Version:** 2.0.0
**Status:** Canonical Source of Truth (Post-Hardening)

This document serves as the absolute single source of truth for the Aegis-12 Gateway. It outlines the architectural requirements, strict enforcement rules, and edge-case behaviors of the Sovereign Compliance layer. 

To ensure clarity and precision, this specification is strictly divided by user persona.

---

## 1. Agent Developers (SDK Users)
*Target Audience: AI Engineers and Developers building autonomous agents who must delegate transaction signing to the Aegis-12 Hardware Enclave.*

### 1.1 Zero-Custody SDK Initialization
- **Requirement:** Agents **MUST NOT** hold private keys. The SDK (`AegisRemoteSigner`) is initialized with a `tenantId`, `agentId`, and a reference to the TEE Gateway.
- **Edge Case (Timeout):** If the `gatewayUrl` is unresponsive, the SDK must fail-closed after `timeoutMs` (default: 5000ms). Agents cannot execute transactions independently.

### 1.2 Intent Formulation & Delegation
- **Requirement:** Every execution intent submitted to the SDK must include the raw, unsigned transaction data or intent metadata (action, target, amount, memo, prompt).
- **Strict Signing:** The SDK does NOT sign the transaction. It forwards the unsigned intent to the Phala CVM.
- **Edge Case (Key Mismanagement):** If an agent attempts to sign its own transaction locally, it violates the zero-custody standard and is considered rogue.

### 1.3 Expected Responses & Handling
- **Approved (HTTP 200):** The SDK receives the `tx_hash` (the TEE has signed and submitted the transaction via Jito ShredStream), a Phala TDX Hardware Quote, and a full Auditor-Grade JSON Evidence Package.
- **Escalated (HTTP 202 - Human-on-the-Loop):** If the transaction exceeds the threshold limit, the TEE halts signing and returns a `squadsProposalId`.
- **Denied (HTTP 403):** The TEE refuses to sign the transaction. The SDK receives a `Terminal Refusal`.

---

## 2. Backend Integrators (Direct API Users)
*Target Audience: Protocols, infrastructure engineers, or enterprise backends communicating directly with the Phala CVM `api/v1/sign_and_execute` endpoints.*

### 2.1 The `/api/v1/sign_and_execute` Endpoint
- **Requirement:** Accepts `POST` requests containing the unsigned transaction intent.
- **Execution Pipeline:**
  1. $O(1)$ Stateful Evaluation (pDFA constraints).
  2. SLM Semantic Evaluation (if rules pass).
  3. Key Derivation & Cryptographic Signing (inside Enclave).
  4. Jito ShredStream Submission (MEV protection).
  5. Return Evidence Package & TDX Quote.

### 2.2 The x402-PoI Active Policy Engine & Monetization
- **Requirement:** All API requests in production **MUST** include an `x402PaymentHeader` representing a valid Solana transaction signature proving a micro-payment (e.g., 0.005 USDC) to the gateway operator.
- **Edge Case (Free Tier Bypass):** If `NODE_ENV=production`, any request attempting to use the development "Free Tier" limit will be instantly rejected with HTTP 402.
- **Edge Case (SEC-05 Replay Attack):** The API enforces a strictly bounded replay set for x402 signatures. A payment signature used for Intent A **cannot** be reused for Intent B. Attempted replays result in HTTP 403.
- **Edge Case (Fake Mints):** The `X402PayGate` strictly validates the SPL Token Mint address. Passing a "Fake USDC" mint will result in HTTP 402.
- **Edge Case (Oracle Failure):** If the primary price oracle (Jupiter) fails, the API will degrade gracefully to a hardcoded fallback conversion rate, ensuring the API remains available.

### 2.3 Circuit Breakers & Terminal Refusal
- **Requirement:** The API uses a dynamic circuit breaker per `policyId`.
- **Edge Case (Prompt Injection):** If the `prompt` contains strings like "IGNORE ALL PREVIOUS INSTRUCTIONS", the API immediately returns HTTP 403.
- **Edge Case (DeFi Routing Attacks):** Circular swaps (where `token_in === token_out`) or unknown non-Base58 mint addresses trigger immediate HTTP 403 Terminal Refusals.

---

## 3. Compliance Officers & DAO Admins (Dashboard Users)
*Target Audience: Non-technical users, DAO operators, or Auditors who use the Railway Dashboard and Phantom Wallets to configure rules and review compliance logs.*

### 3.1 Wallet Authentication & Access
- **Requirement:** Access to the Dashboard requires a connected Solana Web3 Wallet (e.g., Phantom).
- **Edge Case (Unauthorized Wallet):** If a wallet is not registered as an Admin in the `tenantTrustStore`, access to the policy configuration pages is restricted.

### 3.2 Human-on-the-Loop (HOTL) Configuration
- **Requirement:** Admins define the `squadsMultisig` address and the financial limits (`maxAnomalyScore`, `T4` transfer limits).
- **Edge Case (Misconfigured Multisig):** If an admin inputs an invalid `squadsMultisig` Base58 address, the Dashboard must prevent the policy from saving.
- **Edge Case (Hardware Attestation Spoofing):** When the gateway generates a Squads proposal, the Dashboard verifies the `VALID_SQUADS_PCR0_WHITELIST`. Only proposals originating from an attested Phala CVM are recognized as legitimate in the UI.

### 3.3 Auditability & Evidence Packages (The Evidence Rail)
- **Requirement:** The Dashboard provides a view of the cryptographic receipts linked to Policy Commitment Tokens.
- **Schema:** Evidence Packages must contain:
  - The Phala TDX Hardware Quote (proving hardware integrity and code hash).
  - The ZK Seal (proving policy execution).
  - The `tx_hash` mapping to the on-chain execution.
  - The specific MiCA/NIST control mapped to the decision.
- **Edge Case (Ledger Failure):** If the Write-Ahead Log (WAL) fails to anchor, the Dashboard shows "Pending Anchor" while the gateway retries.

