import phalaEntrypoint from './src/application/PhalaEntrypoint';

const payload = {
    agent: { did: "test", purpose: "financial_operations", currentTier: "T1" },
    action: { toolId: "solana_transfer", parameters: { to: "address", amount: 1 } },
    context: { sessionId: "test", actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 1.0 },
    dynamicPolicy: { 
        policyConfig: { tenantId: "tenant-e2e", nonce: "1", expiresAt: 4102444800 },
        signature: "0x0",
        ownerPublicKey: "0x0"
    }
};

async function run() {
    const resultString = await phalaEntrypoint(JSON.stringify(payload));
    const result = JSON.parse(resultString);
    console.log("STATUS:", result.status);
    console.log("ERROR:", result.error);
}

run();
