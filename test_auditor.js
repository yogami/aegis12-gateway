const url = "https://c27b0861a2bf2891f43f3556d3aa9526d704f7bc-8000.dstack-pha-prod5.phala.network";
const nonce = "test-manual-" + Date.now();
const payload = {
    agent: { did: "did:solana:auditor", purpose: "financial_operations", currentTier: "T4" },
    action: { toolId: "solana_transfer", actionType: "transfer", parameters: { to: "11111111111111111111111111111111", amount: 1, token: "SOL" } },
    context: { sessionId: "audit-" + Date.now(), actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 0.1, recentIncidents: 0 },
    dynamicPolicy: { 
        policyConfig: {
            policyId: "p-audit-001",
            tenantId: "tenant-001",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "solana:devnet",
            maxAnomalyScore: 100,
            financialLimitsString: "{\"T4\":1000000}",
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: nonce
        },
        ownerPublicKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", 
        signature: "0xMockSig" 
    }
};

async function run() {
    console.log("Sending POST /enforce...");
    const res = await fetch(`${url}/enforce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const body = await res.json();
    console.log("Enforce Response:", body);
    
    if (body.status === "denied") return;
    
    const receiptId = body.receipt.receiptId;
    console.log("Polling /evidence/" + receiptId);
    
    for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const evRes = await fetch(`${url}/evidence/${receiptId}`);
        const evBody = await evRes.json();
        console.log(`Poll ${i+1}:`, evBody);
    }
}
run();
