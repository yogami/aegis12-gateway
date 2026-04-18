# Aegis-12: The Sovereign Kill Switch for Agentic Capital

**The missing security primitive for the Solana Developer Platform (SDP).**

As the Solana Foundation heavily pushes to onboard enterprise financial institutions (Mastercard, Western Union, Worldpay) via the SDP, the ecosystem faces a catastrophic vulnerability: **Autonomous Agents.** If institutions deploy multi-million dollar liquidity pools via autonomous agents, a single prompt-injection or algorithmic drift can drain the entire protocol. 

Institutions will not deploy capital to agents without a mathematically guaranteed kill switch.

**Aegis-12** is that kill switch. It is a sovereign, hardware-enforced blast door for AI agents on Solana. It physically severs malicious execution paths in a Confidential Virtual Machine (CVM) before they ever reach the Solana RPC, preventing identity spoofing and high-velocity capital drains.

## The Problem: Ephemeral Agent Security

Currently, agent frameworks rely on soft guardrails—API-level prompt filtering or off-chain risk limits that run adjacent to the agent. If the agent gets prompt-injected or the host server is compromised, those soft guardrails are easily bypassed, resulting in fatal transactions being signed and broadcasted.

By the time on-chain analytics identify the anomaly, the funds are gone.

## The Solution: Hardware-Enforced Interdiction

Aegis-12 solves this by requiring all agent transactions to pass through a **Phala Network dStack TEE (Trusted Execution Environment)** before interacting with the chain. 

1. **The Exploit Attempt:** A hacked or prompt-injected agent attempts to execute a malicious transaction (e.g., identity spoofing to bypass limits, or a catastrophic spend velocity breach).
2. **The Hardware Interdiction:** The Aegis-12 Phala TEE intercepts the EIP-712 intent payload. The hardware enclave physically evaluates the transaction against the immutable policy parameters. Because the enclave is mathematically isolated, it cannot be bypassed or tampered with by the agent's host server. 
3. **The Sovereign Kill Switch:** If a breach is detected, the TEE physically severs the execution path, returning a `Hardware Panic` and refusing to synthesize the final transaction.

## The Trojan Horse: Frictionless Enterprise Compliance

A hardware kill switch secures the capital, but we provide an unprecedented secondary value for institutions: **Frictionless Compliance.**

Whenever Aegis-12 approves *or* denies an agent transaction, the Phala TEE generates a cryptographic receipt and natively writes an `aegis:v4-pq` formatted SPL Memo directly to the Solana devnet. 

This creates a completely tamper-evident, unalterable on-chain logging trail. This zero-overhead mechanism perfectly and automatically satisfies the rigorous logging requirements of **Article 12 of the EU AI Act** (which legally classifies algorithmic financial bots as High-Risk AI Systems) and SOC2 compliance.

Aegis-12 doesn't just stop the attack—it gives you the cryptographic, on-chain proof required by European regulators that you did everything in your power to prevent it.

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

If you are building an autonomous agent for the Colosseum Hackathon, you can protect your liquidity and satisfy EU AI Act logging requirements by routing your intents through the Aegis-12 gateway.

**Endpoint:** `https://aegis12-gateway-production.up.railway.app/enforce`

### Minimal Example (TypeScript)
```typescript
const decision = await fetch('https://aegis12-gateway-production.up.railway.app/enforce', {
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
