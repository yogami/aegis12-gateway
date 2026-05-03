# @aegis12/sdk

**Aegis-12 is a Drop-in Hardware Firewall for Autonomous Agents on Solana.**

If you are building an AI Agent for the Colosseum hackathon, you probably have a problem: Your agent has direct access to a private key, and if it hallucinates or gets prompt-injected, it can drain its own treasury.

**Aegis-12 solves this.** We provide a strict cryptographic policy enforcement layer powered by a Phala TEE (Trusted Execution Environment). By wrapping your agent with our SDK, every transaction it attempts is cryptographically verified against your pre-defined policy inside physical hardware before it hits the blockchain.

**Instantly make your hackathon project "Enterprise Ready" to the judges.**

## Installation

```bash
npm install @aegis12/sdk ethers
```

## Quick Start (Under 10 Lines of Code)

First, generate a Policy Signature using your Wallet. This proves to the Hardware Enclave that you authorized these constraints for your agent.

```typescript
import { AegisSDK } from '@aegis12/sdk';

// 1. Define your policy constraints
const policyConfig = {
    policyId: `my-team-policy`,
    tenantId: "my-team",
    version: "1",
    chainId: 1, 
    crossChainTarget: "solana:devnet",
    maxAnomalyScore: 100, // Customize your behavioral limits
    financialLimitsString: "{}",
    expiresAt: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
    nonce: Date.now().toString(),
    vaultPda: "11111111111111111111111111111111",
    squadsMultisig: "11111111111111111111111111111111",
    allowedProgramIds: []
};

// 2. Sign the policy (keep your private key safe!)
const signature = await AegisSDK.createPolicySignature(
    "YOUR_PRIVATE_KEY", 
    policyConfig
);
```

Next, wrap your Agent's transaction execution logic with the Aegis Firewall:

```typescript
// 3. Define your agent's execution function
const executeDeFiSwap = async (amount, destination) => {
    return { toolId: 'swap', parameters: { amount, destination } };
};

// 4. Wrap it with Aegis
const secureExecuteDeFiSwap = AegisSDK.withAegis(executeDeFiSwap, {
    agentId: 'my-trading-bot',
    tenantId: 'my-team',
    policySignature: signature // Pass the signature generated above!
});

// 5. Run your agent. If it attempts a VaultBot heist, Aegis will block it!
try {
    const result = await secureExecuteDeFiSwap(100, "suspicious_wallet");
    console.log("Transaction Approved by Hardware Enclave:", result.receipt);
} catch (error) {
    console.error("HARDWARE PANIC! Transaction Blocked:", error.message);
}
```

## Security Guarantees
- **Fail-Closed by Design**: If the TEE is unreachable or the policy is violated, the transaction throws an error. There is no software bypass.
- **Solana Anchoring**: All blocked intents are logged directly to Solana for transparent auditing.

Happy building! Let's win this hackathon. 🚀
