import { ethers } from 'ethers';

async function run() {
    const e2eWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
    const tenantId = "tenant-001";
    
    const policyConfig = {
        policyId: `${tenantId}-policy`,
        tenantId: tenantId,
        version: "1.0",
        chainId: 1399811149,
        crossChainTarget: "solana:devnet",
        maxAnomalyScore: 80,
        financialLimitsString: JSON.stringify({ "T1": 500000 }),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        nonce: Date.now().toString()
    };

    const domain = {
        name: "Aegis-12-Compliance-Matrix",
        version: "1.0.0",
        chainId: 1399811149
    };
    
    const types = {
        Policy: [
            { name: "policyId", type: "string" },
            { name: "tenantId", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "crossChainTarget", type: "string" },
            { name: "maxAnomalyScore", type: "uint256" },
            { name: "financialLimitsString", type: "string" },
            { name: "expiresAt", type: "uint256" },
            { name: "nonce", type: "string" }
        ]
    };

    const signature = await e2eWallet._signTypedData(domain, types, policyConfig);

    const payload = {
        agent: {
            id: "agent-alpha-001",
            tenantId: tenantId,
            currentTier: "T1"
        },
        action: {
            toolId: "solana_transfer",
            parameters: {
                to: "8qXy2s5KGBgq8oGdfvWv9sUeB7d4Wb4nJ3T4G9tQ2P6n",
                amount: 100,
                token: "SOL"
            },
            estimatedValue: 100
        },
        context: {
            timestamp: new Date().toISOString(),
            currentAnomalyScore: 0.1
        },
        dynamicPolicy: {
            signature: signature,
            policyConfig: policyConfig
        }
    };

    console.log("Sending structurally perfect payload to Phala Enclave (Build 116)...");
    const res = await fetch("https://c27b0861a2bf2891f43f3556d3aa9526d704f7bc-8000.dstack-pha-prod5.phala.network/enforce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    
    const body = await res.json();
    console.log("\n=== ENCLAVE PERFORMANCE METRICS ===");
    console.log(JSON.stringify(body, null, 2));
    console.log("===================================");
}
run().catch(console.error);
