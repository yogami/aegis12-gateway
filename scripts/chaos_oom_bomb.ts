import { ethers } from 'ethers';

async function runChaos() {
    const url = process.argv[2] || "http://localhost:8000";
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    console.log(`[Chaos] 🌪️ Initiating Vector 1: The ZK-Collision OOM Bomb against ${baseUrl}`);

    // Create a base valid payload
    const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const wallet = new ethers.Wallet(privateKey);
    const nonce = "chaos-" + Date.now();
    
    const domain = { name: "Aegis-12-Compliance-Matrix", version: "1.0.0", chainId: 1399811149 };
    const types = { Policy: [
        { name: 'policyId', type: 'string' }, { name: 'tenantId', type: 'string' },
        { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' },
        { name: 'crossChainTarget', type: 'string' }, { name: 'maxAnomalyScore', type: 'uint256' },
        { name: 'financialLimitsString', type: 'string' }, { name: 'expiresAt', type: 'uint256' },
        { name: 'nonce', type: 'string' }
    ]};

    const policyConfig = {
        policyId: "p-audit-001", tenantId: "tenant-001", version: "1.0.0", chainId: 1399811149,
        crossChainTarget: "solana:devnet", maxAnomalyScore: 100, financialLimitsString: "{\"T4\":1000000}",
        expiresAt: Math.floor(Date.now() / 1000) + 3600, nonce: nonce
    };

    const signature = await wallet._signTypedData(domain, types, policyConfig);

    // Deep nesting generator to stress the JSON stringifier
    function createNestedBomb(depth: number): any {
        if (depth === 0) return "pad".repeat(100);
        return { a: createNestedBomb(depth - 1), b: createNestedBomb(depth - 1) };
    }

    const bombPayload = {
        agent: { did: "did:solana:auditor", purpose: "financial_operations", currentTier: "T4" },
        action: { toolId: "solana_transfer", actionType: "transfer", parameters: { to: "11111111111111111111111111111111", amount: 1, token: "SOL" } },
        context: { sessionId: nonce, bomb: createNestedBomb(10) }, // Depth 10 binary tree = ~1024 leaves
        dynamicPolicy: { policyConfig, ownerPublicKey: wallet.address, signature }
    };

    const payloadString = JSON.stringify(bombPayload);
    console.log(`[Chaos] 💣 Bomb Payload Size: ${(Buffer.byteLength(payloadString, 'utf8') / 1024).toFixed(2)} KB`);

    console.log(`[Chaos] ⏱️ Step 1: Firing initial request to spin up the ZK-Prover child process...`);
    await fetch(`${baseUrl}/enforce`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payloadString
    });

    console.log(`[Chaos] ⏳ Waiting 2500ms for ZK-Prover memory allocation to peak...`);
    await new Promise(r => setTimeout(r, 2500));

    console.log(`[Chaos] 🚀 Step 2: Firing 150 concurrent OOM Bombs...`);
    const promises = [];
    for (let i = 0; i < 150; i++) {
        promises.push(fetch(`${baseUrl}/enforce`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payloadString
        }).then(res => res.status).catch(err => "NETWORK_ERROR"));
    }

    const results = await Promise.all(promises);
    const counts = results.reduce((acc, status) => { acc[status] = (acc[status] || 0) + 1; return acc; }, {} as Record<string, number>);
    
    console.log(`[Chaos] 📊 Bomb Results:`, counts);

    const maxAllowedNetworkErrors = 5;
    const networkErrors = counts["NETWORK_ERROR"] || 0;

    if (counts["502"] || counts["503"] || networkErrors > maxAllowedNetworkErrors) {
        console.error(`[Chaos] ❌ FAILURE: The gateway crashed or dropped connections under memory pressure. OS OOM Kill suspected.`);
        process.exit(1);
    }

    if (networkErrors > 0) {
        console.warn(`[Chaos] ⚠️ WARNING: ${networkErrors} connections dropped, but within acceptable internet variance.`);
    }

    console.log(`[Chaos] ✅ SUCCESS: The gateway survived the ZK-Collision OOM Bomb.`);
}

runChaos().catch(err => {
    console.error(`[Chaos] 💥 Chaos script crashed: ${err.message}`);
    process.exit(1);
});
