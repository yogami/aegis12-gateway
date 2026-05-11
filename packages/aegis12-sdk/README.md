# aegis12-sdk

**Aegis-12 is the Verifiable Agentic Escrow & Fiduciary Firewall for Autonomous Agents.**

If you are building an AI Agent framework (like ElizaOS) or deploying enterprise agents, you have a problem: Your agent has direct access to a private key. If it hallucinates or gets prompt-injected and drains the treasury, there is an **Institutional Liability Gap**. You cannot cryptographically prove what the agent actually intended.

**Aegis-12 solves this.** We provide a strict cryptographic escrow layer powered by a Phala TEE (Trusted Execution Environment). By routing your agent's intents through our SDK, every transaction is evaluated inside physical hardware against an AP2 Intent Mandate.

If the intent is malicious, it is blocked and escalated to a Squads V4 Multisig. If approved, the hardware generates a **Proof of Intent (PoI)** and securely signs the transaction. 

**Zero software bypass. Mathematically enforced escrow.**

## Installation

```bash
npm install aegis12-sdk ethers
```

## Quick Start 

First, generate an Intent Mandate Signature using your Enterprise Wallet. This proves to the Hardware Enclave that you authorized these constraints for your agent.

```typescript
import { AegisSDK } from 'aegis12-sdk';

// 1. Define your Intent Mandate
const mandateConfig = {
    mandateId: `my-team-mandate`,
    tenantId: "my-team",
    version: "1",
    chainId: 1, 
    crossChainTarget: "solana:devnet",
    maxAnomalyScore: 100,
    financialLimitsString: "{}",
    expiresAt: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
    nonce: Date.now().toString(),
    vaultPda: "11111111111111111111111111111111",
    squadsMultisig: "11111111111111111111111111111111",
    allowedProgramIds: []
};

// 2. Sign the mandate (keep your private key safe!)
const signature = await AegisSDK.createMandateSignature(
    "YOUR_PRIVATE_KEY", 
    mandateConfig
);
```

Next, use the Drop-in TEE Remote Signer. Your agent never holds the private key.

```typescript
// 3. Define the agent's unsigned intent
const unsignedIntent = {
    toolId: 'solana_transfer', 
    parameters: { to: '4jKwb8h2vWjZkLzM...', amount: 0.01 }
};

// 4. Pass the intent to the Fiduciary Escrow
try {
    const result = await AegisSDK.signAndExecute(unsignedIntent, {
        agentId: 'my-trading-bot',
        tenantId: 'my-team',
        mandateSignature: signature // Pass the signature generated above!
    });
    
    console.log("✅ Proof of Intent Generated! Tx Hash:", result.tx_hash);
    console.log("🔒 Hardware Attestation:", result.hardware_attestation);
} catch (error) {
    console.error("🛑 Fiduciary Escrow Rejected:", error.message);
}
```

## Security Guarantees
- **Zero-Custody Agent**: The agent never holds a hot wallet key.
- **Fail-Closed by Design**: If the TEE is unreachable or the mandate is violated, the transaction is rejected or escalated to a human-on-the-loop multisig.
- **Cryptographic Evidence**: All actions generate a verifiable Proof of Intent (PoI) anchored to Solana for institutional auditing.
