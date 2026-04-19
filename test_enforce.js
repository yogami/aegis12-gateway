const fetch = require('node-fetch');
const ethers = require('ethers');

async function test() {
    const url = "https://c27b0861a2bf2891f43f3556d3aa9526d704f7bc-8000.dstack-pha-prod5.phala.network";
    const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const wallet = new ethers.Wallet(privateKey);
    const nonce = "audit-" + Date.now();
    
    const domain = { name: "Aegis-12-Compliance-Matrix", version: "1.0.0", chainId: 1399811149, verifyingContract: "0x1111111111111111111111111111111111111111" };
    const types = { Policy: [ { name: 'policyId', type: 'string' }, { name: 'tenantId', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'crossChainTarget', type: 'string' }, { name: 'maxAnomalyScore', type: 'uint256' }, { name: 'financialLimitsString', type: 'string' }, { name: 'expiresAt', type: 'uint256' }, { name: 'nonce', type: 'string' } ] };
    const policyConfig = { policyId: "p-audit-001", tenantId: "tenant-001", version: "1.0.0", chainId: 1399811149, crossChainTarget: "solana:devnet", maxAnomalyScore: 100, financialLimitsString: "{\"T4\":1000000}", expiresAt: Math.floor(Date.now() / 1000) + 3600, nonce: nonce };
    const signature = await wallet._signTypedData(domain, types, policyConfig);

    const payload = { agent: { did: "did:solana:auditor", purpose: "financial_operations", currentTier: "T4" }, action: { toolId: "solana_transfer", actionType: "transfer", parameters: { to: "11111111111111111111111111111111", amount: 1, token: "SOL" } }, context: { sessionId: "audit-" + Date.now(), actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 0.1, recentIncidents: 0 }, dynamicPolicy: { policyConfig, ownerPublicKey: wallet.address, signature } };

    const response = await fetch(`${url}/enforce`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json();
    console.log("RESPONSE:", body);
}
test();
