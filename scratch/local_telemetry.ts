import phalaEntrypoint from '../src/application/PhalaEntrypoint';
import { ethers } from 'ethers';

async function run() {
    process.env.PHALA_SIMULATED_ROOT_SEED = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    process.env.AUTHORIZED_TENANTS = JSON.stringify({ "tenant-001": ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"] });
    process.env.SOLANA_PAYER_SECRET = "test";
    
    const e2eWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

    const policyConfig = {
        policyId: "tenant-001-policy",
        tenantId: "tenant-001",
        nonce: Date.now().toString(),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        financialLimitsString: JSON.stringify({
            "T1": 500000
        })
    };

    const domain = {
        name: "Aegis-12-Compliance-Matrix",
        version: "1.0.0",
        chainId: 1399811149
    };
    const types = {
        PolicyConfig: [
            { name: 'policyId', type: 'string' },
            { name: 'tenantId', type: 'string' },
            { name: 'nonce', type: 'string' },
            { name: 'expiresAt', type: 'uint256' },
            { name: 'financialLimitsString', type: 'string' }
        ]
    };

    const signature = await e2eWallet._signTypedData(domain, types, policyConfig);

    const payload = {
        agent: { id: "agent-alpha-001", tenantId: "tenant-001", currentTier: "T1" },
        action: {
            toolId: "solana_transfer",
            parameters: { to: "8qXy2s5KGBgq8oGdfvWv9sUeB7d4Wb4nJ3T4G9tQ2P6n", amount: 100, token: "SOL" },
            estimatedValue: 100
        },
        context: { timestamp: new Date().toISOString(), currentAnomalyScore: 0.1 },
        dynamicPolicy: { signature: signature, policyConfig: policyConfig }
    };

    console.log("Invoking Enclave Entrypoint directly...");
    const resStr = await phalaEntrypoint(JSON.stringify(payload));
    const res = JSON.parse(resStr);
    
    console.log("\n=== LOCAL TELEMETRY BREAKDOWN ===");
    console.log(JSON.stringify(res.telemetry || res, null, 2));
    console.log("===================================");
}
run().catch(console.error);
