# Aegis-12: Hardware-Enforced Active Policy Engine for Solana AI Agents

**Let AI agents operate safely without handing them the private keys.**

As the Solana ecosystem rapidly adopts autonomous AI agents (e.g., Eliza, SendAI), protocols face a critical security vulnerability: **Agent Hallucinations and Prompt Injections.** If an agent holds the private keys to a treasury, a single prompt-injection or algorithmic drift can drain the entire protocol. 

## The Problem: Passive Logging is Flawed
Current compliance and security tools rely on "passive logging" (saving intent hashes to a database or ledger) or soft API-level middleware. These are fundamentally broken models for autonomous capital allocation. 

If an agent goes rogue or the host server is compromised, a passive log will not stop a $40M treasury drain. The attacker simply signs the malicious transaction because the agent's environment *still holds the keys*.

## The Solution: Hardware-Rooted "Active Policy Engine"
Aegis-12 solves this by entirely stripping cryptographic authority from the agent. We act as an **Attested Agent Wallet & TEE Remote Signer**. 

1. **Zero-Custody Integration:** Agents formulate *unsigned* intents and pass them to the Aegis-12 SDK.
2. **Hardware Interception:** The Aegis Phala Network TEE (Trusted Execution Environment) intercepts the payload. The hardware enclave physically evaluates the transaction against immutable policy parameters.
3. **Deterministic Enforcement:** If approved, the TEE signs the transaction with its enclave-held key. If the intent violates policy (e.g., exceeding a daily SOL limit), the TEE mathematically refuses to sign.
4. **Human-on-the-loop Escalation:** Blocked transactions are instantly routed to an on-chain **Squads V4 Multisig** proposal, requiring human signers to review and approve the edge-case.

## Architecture: Solving the Oracle Latency Bottleneck
Putting an oracle network in the hot path of an agent's transaction destroys zero-latency execution. Furthermore, sending a 4.5KB hardware quote synchronously on-chain violates Solana's strict 1,232-byte IPv6 MTU transaction limit.

We solved this via **Asynchronous Attestation**:
1. **Setup Phase:** The Phala TDX enclave boots locally, generates an ephemeral session key, and asynchronously submits a 4.5KB hardware quote to Switchboard. Switchboard cryptographically verifies the silicon and whitelists the session key on-chain.
2. **Execution Phase (0-latency):** The agent trades directly with the blockchain. The local JSON policy engine evaluates intents in <1ms. The heavy cryptographic oracle network is completely bypassed in the hot path.

## Hackathon Codebase Overview
This repository contains the live Aegis-12 backend, the Next.js control plane, and the core protocol simulator built for the Colosseum Frontier Hackathon.

- `/src/application/EnclaveService.ts`: The core Confidential Virtual Machine (CVM) simulator that enforces hardware isolation and root-of-trust execution.
- `/src/infrastructure/SquadsRouter.ts`: The logic that routes blocked hardware payloads into on-chain Squads V4 multisig proposals.
- `/src/demo-server.ts`: The backend API that tracks true sub-millisecond execution latency through the TEE.
- `/apps/dashboard/`: The Next.js developer control plane that visualizes the TEE telemetry and Fiduciary Audit Registry in real-time.

## E2E Verification Suite
We rely on strict End-to-End determinism. Every component is rigorously tested against edge cases.

To audit the live simulated execution and verify the resilience of the hardware interdiction, run our verification suite:
```bash
npm run test
```
*This suite asserts that whitelisted agents can execute within bounds, and that prompt-injected agents are deterministically blocked and routed to Squads V4.*

## Quickstart: Running the Next.js Control Plane
To spin up the full 3-pane Aegis-12 control plane locally and interact with the hardware simulator:

```bash
# 1. Install dependencies at the root
npm install

# 2. Build the gateway backend
npm run build

# 3. Start the gateway backend (Port 8000)
npm run start:demo

# 4. In a new terminal, run the Next.js UI
cd apps/dashboard
npm install
npm run dev
```
Navigate to `http://localhost:3000`. You can trigger valid intent streams or maliciously force the circuit breaker to watch the TEE block the transaction and generate real Devnet hashes.
