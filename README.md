# Aegis Firewall: Runtime Protection for Solana AI Agents

**Let AI agents operate safely without handing them the private keys.**

> [!NOTE]
> **[NEW] Post-Submission Architecture Deep Dive**
> *While our official 3-minute demo covers the live gateway, we've released this 4-minute addendum detailing our 2.1ms hardware interception latency, the EU AI Act compliance moat, and our pivot to Fiduciary Firewalls.*
> 
> 🎥 **[Watch the Aegis-12 Master Presentation (4 min)](https://res.cloudinary.com/djol0rpn5/video/upload/v1778325693/colosseum_hackathon/aegis12_master_ultimate_1778325690976.mp4)**

As the Solana ecosystem rapidly adopts autonomous AI agents (e.g., Eliza, SendAI, Griffain), developers and DAOs face a catastrophic vulnerability: **Agent Prompt Injections and Hallucinations.** If an agent holds the private keys to a treasury, a single prompt-injection or algorithmic drift can drain the entire protocol. 

Agent developers cannot simply trust agents with raw private keys. They need a zero-custody hardware root of trust.

**Aegis-12** is an **Attested Agent Wallet & TEE Remote Signer**. It entirely strips cryptographic authority from the agent. Agents formulate *unsigned* intents. The Aegis-12 Phala TEE evaluates the intent against stateful policies, generates the cryptographic signature *inside* the hardware enclave, and automatically routes it via Jito ShredStream for MEV protection. 

## The Problem: Ephemeral Agent Security

Currently, agent frameworks rely on soft guardrails—API-level prompt filtering or high-friction middleware firewalls. If the agent gets prompt-injected or the host server is compromised, those soft guardrails are bypassed. The agent can construct a transaction to stealthily transfer ownership because *it still holds the keys*.

By the time on-chain analytics identify the anomaly, the funds are gone.

## The Solution: Hardware-Rooted Zero-Custody

Aegis solves this by pivoting from a "firewall" to an **Attested Signer**:

1. **Zero-Custody Integration:** The agent passes an unsigned intent to the Aegis-12 SDK.
2. **The Hardware Interdiction:** The Aegis Phala TEE intercepts the intent payload. The hardware enclave physically evaluates the transaction against immutable policy parameters ($O(1)$ stateful evaluation). 
3. **Execution & Evidence:** If approved, the TEE signs the transaction with its enclave-held key and submits it. It returns the `tx_hash`, an Auditor-Grade JSON Evidence Package, and a Phala TDX Hardware Quote. If denied, it issues a Terminal Refusal.

## The Result: Verifiable Compliance Evidence

A zero-custody wallet secures the capital, but we provide an unprecedented secondary value: **Cryptographic Evidence Rails.**

Whenever Aegis-12 approves *or* denies an agent transaction, it generates an Auditor-Readable JSON Evidence Package. This package binds the cryptographic receipt, the Jito transaction hash, and the MiCA/NIST control mapped to the decision. 

This creates a completely tamper-evident, unalterable logging trail linked to on-chain Policy Commitment NFTs. This zero-overhead mechanism provides perfect compliance evidence that risk controls were strictly enforced at runtime by an isolated hardware enclave.

## High-Veracity Status: 🏆 100% SUBSTANCE VERIFIED

Aegis-12 implements the **High-Veracity Mandate**. Every agent action is backed by a trio of cryptographic proofs, ensuring zero trust in the host infrastructure.

- **[L1] Solana Anchor**: Immutable SPL Memo on Devnet (`2PG1ter...`).
- **[ZK] ZK-Seal**: RISC Zero STARK proof of local policy enforcement.
- **[TEE] Hardware Quote**: Phala dStack hardware attestation.

> [!TIP]
> **View the live Proof of Execution:**
> Run `npx tsx scripts/verify_substance.ts` to audit the live Phala CVM and verify the cryptographic integrity of the Aegis Kill Switch.

## 📖 Master Technical Specification

For the complete, exhaustive single source of truth regarding all rules, edge cases, and user personas (SDK Developers, API Integrators, and Dashboard Admins), please refer to the absolute canonical document:
👉 **[Aegis-12 Master Technical Specification](TECHNICAL_MASTER_SPEC.md)**

## Hackathon Codebase Overview

This repository contains the live Aegis-12 backend and the terminal agent demo built for the Colosseum Frontier Hackathon.

- `/src/application/PhalaEntrypoint.ts`: The core Confidential Virtual Machine (CVM) entrypoint that enforces hardware isolation and root-of-trust execution.
- `/src/infrastructure/SolanaAnchor.ts`: The SPL Memo module that creates the immutable on-chain footprint of all agent approvals and interdictions.
- `/src/infrastructure/SolanaTransactionFirewall.ts`: The complex BFT-consensus based firewall logic for high-velocity limit detection.
- `/scripts/demo_agent.ts`: A live autonomous agent test script demonstrating both compliant operations and the "Oh Shit" moment of a rogue transaction being thwarted by the hardware enclave.
- `/nextjs-demo/`: The frontend visualizer representing the Honey-Pot Dashboard for the Sovereign Kill Switch.

### Running the Live "Rogue Agent" Demo
To watch the Aegis-12 TEE sever a malicious agent in real-time:
```bash
# Terminal 1: Boot the TEE Backend
npm run start:cvm

# Terminal 2: Run the Autonomous Agent script
npm run demo:agent
```
You will see the agent complete a safe 500 USDC swap, followed by a simulated prompt-injection attempt to drain 10,000,000 USDC. Watch the TEE physically reject the rogue transaction and verify the immutable Denial SPL Memo anchored on the Solana Devnet Explorer.

---

## 🤝 For Partners: 60-Second Integration

If you are building an autonomous agent for the Colosseum Hackathon, you can protect your liquidity and satisfy EU AI Act logging requirements by routing your intents through the Aegis-12 Remote Signer.

**Endpoint:** `https://33d807c4df82bc98a1378c403181698f1f12bbed-8000.dstack-pha-prod9.phala.network/sign_and_execute`

### Minimal Example (TypeScript)
```typescript
import { AegisSDK } from 'aegis12-sdk';

const decision = await AegisSDK.signAndExecute({
    toolId: "solana_transfer",
    parameters: { to: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin", amount: 100_000_000 }
}, {
    agentId: "my_bot",
    tenantId: "tenant-1",
    gatewayUrl: "https://33d807c4df82bc98a1378c403181698f1f12bbed-8000.dstack-pha-prod9.phala.network"
});

if (decision.decision === "ALLOW") {
    console.log("Executed Hash:", decision.tx_hash);
    console.log("Hardware Quote:", decision.hardware_attestation);
} else {
    console.error("TEE Blocked Transaction:", decision);
}
```

See the full [Minimal Integration Example](file:///Users/user1000/gitprojects/aegis12-gateway/examples/minimal_agent_integration.ts) for details.
