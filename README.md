# Aegis Firewall: Runtime Protection for Solana AI Agents

**Let AI agents control wallets without letting them nuke the treasury.**

As the Solana ecosystem rapidly adopts autonomous AI agents (e.g., Eliza, SendAI, Griffain), developers and DAOs face a catastrophic vulnerability: **Agent Prompt Injections and Halucinations.** If a DAO deploys a treasury agent, a single prompt-injection or algorithmic drift can drain the entire protocol. 

Agent developers cannot simply hand over raw private keys. They need a runtime firewall.

**Aegis Firewall** wraps any Solana AI agent signer with programmable risk policies, transaction simulation, OFAC screening, and Squads-based human escalation before execution. It physically severs malicious execution paths in a Confidential Virtual Machine (CVM) before they ever reach the Solana RPC, preventing identity spoofing and high-velocity capital drains.

## The Problem: Ephemeral Agent Security

Currently, agent frameworks rely on soft guardrails—API-level prompt filtering or off-chain risk limits that run adjacent to the agent. If the agent gets prompt-injected or the host server is compromised, those soft guardrails are easily bypassed. The agent can construct a transaction to stealthily transfer ownership or send funds to a sanctioned address.

By the time on-chain analytics identify the anomaly, the funds are gone.

## The Solution: Hardware-Enforced Interdiction

Aegis solves this by requiring all agent transactions to pass through a **Phala Network dStack TEE (Trusted Execution Environment)** before interacting with the chain. 

1. **The Exploit Attempt:** A hacked or prompt-injected agent attempts to execute a malicious transaction (e.g., a stealth `SystemProgram.assign` ownership takeover, or a catastrophic spend velocity breach).
2. **The Hardware Interdiction:** The Aegis Phala TEE intercepts the intent payload. The hardware enclave physically simulates the transaction against the immutable policy parameters. Because the enclave is mathematically isolated, it cannot be bypassed by the agent's host server. 
3. **The Agent Firewall:** If a breach is detected, the TEE physically severs the execution path, returning a block and escalating high-risk operations to a Squads V4 multisig for human approval.

## The Result: Verifiable Compliance Evidence

A hardware firewall secures the capital, but we provide an unprecedented secondary value: **Cryptographic Audit Trails.**

Whenever Aegis approves *or* denies an agent transaction, the Phala TEE generates a cryptographic receipt and natively writes an `aegis:v4-pq` formatted SPL Memo directly to the Solana devnet. 

This creates a completely tamper-evident, unalterable on-chain logging trail. This zero-overhead mechanism provides perfect, cryptographic compliance evidence that risk controls were strictly enforced at runtime.

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

If you are building an autonomous agent for the Colosseum Hackathon, you can protect your liquidity and satisfy EU AI Act logging requirements by routing your intents through the Aegis Firewall.

**Endpoint:** `https://c27b0861a2bf2891f43f3556d3aa9526d704f7bc-8000.dstack-pha-prod5.phala.network/enforce`

### Minimal Example (TypeScript)
```typescript
const decision = await fetch('https://c27b0861a2bf2891f43f3556d3aa9526d704f7bc-8000.dstack-pha-prod5.phala.network/enforce', {
    method: 'POST',
    body: JSON.stringify({
        agent: { id: "my_bot" },
        action: { toolId: "swap", parameters: { amount: 100 } }
    })
}).then(res => res.json());

if (decision.status === "approved") {
    // Proceed with trade
} else {
    console.error("TEE Blocked Transaction:", decision.error);
}
```

See the full [Minimal Integration Example](file:///Users/user1000/gitprojects/aegis12-gateway/examples/minimal_agent_integration.ts) for details.
