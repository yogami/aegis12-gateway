# AEGIS-12: Hardware-Attested ATF Enforcement (VERA Enterprise)

> [!NOTE]
> Aegis-12 is the hardware-enforced evolution of **VERA** (Verifiable Enforcement for Runtime Agents), specifically designed to satisfy the **Cloud Security Alliance's Agentic Trust Framework (ATF)** at the silicon level.

**Let enterprise AI agents operate safely without handing them the private keys.**

## The Agentic Compliance Gap (Why software isn't enough)
The Cloud Security Alliance (CSA) published the Agentic Trust Framework to standardize how enterprises stay in control of autonomous agents. Our initial reference implementation (VERA) mapped these rules to software. However, adversarial red-teaming proved that software-defined firewalls remain vulnerable: if an agent achieves host-OS compromise, software rules fail.

Aegis-12 solves this by taking the 5 pillars of the ATF and locking them inside an **Active Policy Engine** running in a Trusted Execution Environment (TEE).

## Mapping Aegis-12 to the Agentic Trust Framework (ATF)

Aegis-12 acts as a **Fiduciary Firewall**, completely stripping cryptographic authority from the agent and mapping directly to the ATF:

### 1. Identity (Hardware-Bound)
Instead of relying on software-generated DID:web signatures, the agent's identity is cryptographically tied to a TEE Attestation Quote. Even if the host OS is fully compromised, the agent's identity cannot be stolen or spoofed.

### 2. Behavior (Proof of Intent)
We enforce behavior not just by monitoring logs, but by demanding a cryptographically verifiable **x402 Proof of Intent (PoI)**. The hardware mathematically refuses to sign transactions without this PoI.

### 3. Data Governance (Enclave Shielding)
The agent's proprietary prompts, API keys, and intermediate reasoning are processed inside the Phala CVM. The data is mathematically invisible to the host infrastructure.

### 4. Segmentation (Policy-in-Enclave)
Policies are loaded directly into the TEE. An attacker cannot bypass the segmentation rules because doing so would instantly invalidate the hardware attestation signature.

### 5. Incident Response (HOTL Circuit Breakers)
If an anomaly score spikes, Aegis-12 instantly freezes the transaction inside the enclave and pages a human (via an Enterprise PagerDuty hook or Squads V4 on-chain proposal) to review the edge-case (Satisfying EU AI Act Article 14).

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
