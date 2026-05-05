# Aegis-12: Master Technical Specification

**Version:** 2.0.0
**Status:** Canonical Source of Truth (Post-Hardening)

This document serves as the absolute single source of truth for the Aegis-12 Gateway. It outlines the architectural requirements, strict enforcement rules, and edge-case behaviors of the Sovereign Compliance layer. 

To ensure clarity and precision, this specification is strictly divided by user persona.

---

## 1. Agent Developers (SDK Users)
*Target Audience: AI Engineers and Developers building autonomous agents (e.g., using LangChain, Eliza, or custom LLM frameworks) who need to route intents through Aegis-12 for cryptographic compliance.*

### 1.1 Core SDK Initialization
- **Requirement:** SDK must be instantiated with a valid `tenantId` and `gatewayUrl`.
- **Edge Case (Timeout):** If the `gatewayUrl` is unresponsive, the SDK must fail-closed after `timeoutMs` (default: 5000ms). Agents MUST NOT default to executing transactions blindly if the compliance gateway is down.

### 1.2 Intent Formulation & Non-Repudiation (EIP-712)
- **Requirement:** Every execution intent submitted to the SDK must include:
  - `prompt`: The raw natural language instruction from the LLM.
  - `targetProgram`: The fully qualified Solana program ID.
  - `amount`: Financial value of the transaction.
- **Strict Signing:** The intent envelope **MUST** be signed using EIP-712 typed data signatures by the Agent's private key. 
- **Edge Case (Key Mismanagement):** If the submitted signature is invalid or belongs to a key not registered in the Tenant's Trust Store, the SDK will receive an immediate HTTP 403 (Terminal Refusal) from the gateway.

### 1.3 Expected Responses & Handling
- **Approved (HTTP 200):** The SDK receives a full Auditor-Grade JSON Evidence Package, containing the `receiptId`, ZK Proof, and the Merkle Root. The Agent is clear to proceed.
- **Escalated (HTTP 202 - Human-on-the-Loop):** If the transaction exceeds the threshold limit, the SDK receives a `squadsProposalId`. The SDK must pause agent execution and alert the user that manual Squads V4 Multisig approval is pending.
- **Denied (HTTP 403):** The SDK receives a `Terminal Refusal` string. The Agent must abort the transaction.

---

## 2. Backend Integrators (Direct API Users)
*Target Audience: Infrastructure engineers, enterprise backends, or custom clients bypassing the SDK to communicate directly with the Phala CVM `api/v1/enforce` endpoints.*

### 2.1 The `/api/v1/enforce` Endpoint
- **Requirement:** Accepts `POST` requests containing the signed EIP-712 payload.
- **Edge Case (Malformed Payload):** Any request missing required fields (`nonce`, `tenantId`, `policyId`) must immediately return HTTP 400. Null-type coercion attacks (e.g., passing `null` for `amount`) are explicitly blocked.

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

### 3.3 Auditability & Evidence Packages (EU AI Act)
- **Requirement:** The Dashboard provides a view of the cryptographic receipts.
- **Schema:** Receipts must contain:
  - The Phala CVM `pcr0` hash (proving hardware integrity).
  - The ZK Seal (proving policy execution without exposing prompt data).
  - The Merkle Root (proving inclusion in the global ledger).
- **Edge Case (Ledger Failure):** If the background Write-Ahead Log (WAL) fails to anchor to Solana due to RPC issues (e.g., `RPC_QUORUM_FAILURE`), the Dashboard will show the receipt as "Pending Anchor" while the gateway automatically retries in the background.

