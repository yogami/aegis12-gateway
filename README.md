# AEGIS-12: THE FIDUCIARY FIREWALL FOR AGENTIC CAPITAL

> [!WARNING]
> **Colosseum Submission Note:** The locked pitch video is ARCHIVED. Red-teaming proved passive logging is useless, and generic software firewalls are a dead ocean. 
> **THE REAL PRODUCT:** A Node.js SDK + Phala TEE Gateway that acts as a Verifiable Agentic Escrow, mathematically REFUSING TO SIGN transactions without a hardware-attested Proof of Intent (PoI).

**Let AI agents operate safely without handing them the private keys.**

## Hackathon Evolution: The Pivot to Hardware Enforcement
Our initial registration described a passive Python logger tracking intents via SHA-256 to the Solana SPL Memo program. Mid-hackathon, adversarial red-teaming proved this was security theater: if an agent goes rogue or is prompt-injected, a passive log will not stop a $40M treasury drain. 

We aggressively pivoted. We dropped the passive logger entirely and rebuilt Aegis-12 into an **Active Policy Engine** running inside a Trusted Execution Environment (TEE). 

## The Problem: The Institutional Liability Gap
If a hedge fund gives an AI agent a private key, and the AI hallucinates and sends $10M to a sanctioned wallet, who is legally liable? Current compliance tools rely on "passive logging" or soft API-level "software firewalls". These are fundamentally broken models for autonomous capital allocation because they cannot provide cryptographic proof of what the agent intended versus what actually executed.

## The Solution: Verifiable Agentic Escrow (VAELS)
Aegis-12 solves this by entirely stripping cryptographic authority from the agent. We act as a **Fiduciary Firewall and PoI Attestation Oracle**. 

1. **Zero-Custody Integration:** Agents formulate *unsigned* intents and pass them to the Aegis-12 SDK.
2. **Hardware Interception:** The Aegis Phala Network TEE intercepts the payload. The hardware enclave physically evaluates the transaction against immutable DAO policy parameters and generates a standardized **Proof of Intent (PoI)**.
3. **Deterministic Enforcement:** If approved, the TEE co-signs the transaction, attaching the AP2 Intent Mandate. If the intent violates policy, the TEE mathematically refuses to generate the PoI signature. The Squads V4 Guard contract *literally cannot move funds* without this PoI.
4. **Human-on-the-loop Escalation:** Blocked transactions are instantly routed to an on-chain **Squads V4 Multisig** proposal, requiring human signers to review and approve the edge-case (Satisfying EU AI Act Article 14).

## Architecture: Solving the Oracle Latency Bottleneck
Putting an oracle network in the hot path of an agent's transaction destroys zero-latency execution. Furthermore, sending a 4.5KB hardware quote synchronously on-chain violates Solana's strict 1,232-byte IPv6 MTU transaction limit.

We solved this via **Asynchronous Attestation**:
1. **Setup Phase:** The Phala TDX enclave boots locally, generates an ephemeral session key, and asynchronously submits a hardware quote to Switchboard. Switchboard cryptographically verifies the silicon and whitelists the session key on-chain.
2. **Execution Phase (0-latency):** The agent trades directly with the blockchain. The local JSON policy engine evaluates intents in <1ms. The heavy cryptographic oracle network is completely bypassed in the hot path.

## How to Integrate Aegis-12 (SDK)
Aegis-12 is built to be a frictionless drop-in middleware. Developers do not need to rebuild their Eliza or LangChain agents. You simply route your final intent payload through the `AegisSDK`.

```typescript
import { AegisSDK } from '@aegis12/sdk';

// 1. Configure the connection to your dedicated Aegis TEE Gateway
const config = {
    gatewayUrl: 'https://aegis12-dashboarduprailwayapp-production.up.railway.app', // Or your self-hosted Phala endpoint
    agentId: 'eliza-trading-bot-01',
    tenantId: 'dao-squads-main',
    policySignature: '0xYourCryptographicPolicyEnvelope...'
};

// 2. The Agent generates an unsigned intent (Zero Custody)
const unsignedIntent = {
    toolId: 'solana_transfer',
    parameters: { to: '4jKwb...', amount: 0.01 }
};

// 3. Let the Hardware generate the Proof of Intent (PoI) and sign
try {
    const result = await AegisSDK.signAndExecute(unsignedIntent, config);
    console.log(`✅ Success! Executed by TEE: ${result.tx_hash}`);
} catch (error) {
    console.error(`🔒 BLOCKED BY HARDWARE CIRCUIT BREAKER: ${error.message}`);
}
```

## Hackathon Codebase Overview
This repository contains the live Aegis-12 backend, the Next.js control plane, and the core protocol simulator built for the Colosseum Frontier Hackathon.

- `/packages/aegis12-sdk/`: The drop-in developer SDK for agent frameworks.
- `/src/application/EnclaveService.ts`: The core Confidential Virtual Machine (CVM) simulator that enforces hardware isolation and root-of-trust execution.
- `/src/infrastructure/SquadsRouter.ts`: The logic that routes blocked hardware payloads into on-chain Squads V4 multisig proposals.
- `/src/demo-server.ts`: The backend API that tracks true sub-millisecond execution latency through the TEE.
- `/apps/dashboard/`: The Next.js developer control plane that visualizes the TEE telemetry and Fiduciary Audit Registry in real-time.

## Quickstart: Running the Next.js Control Plane
To spin up the full 3-pane Aegis-12 control plane locally and interact with the hardware simulator:

```bash
# 1. Install dependencies at the root
npm install

# 2. Build the gateway backend
npm run build

# 3. Start the gateway backend (Port 8000)
npm run start

# 4. In a new terminal, run the Next.js UI
cd apps/dashboard
npm install
npm run dev
```
Navigate to `http://localhost:3000`. You can trigger valid intent streams or maliciously force the circuit breaker to watch the TEE block the transaction and generate real Devnet hashes.
