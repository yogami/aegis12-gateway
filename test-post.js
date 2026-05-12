const { ethers } = require('ethers');
const e2eWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const eip712Domain = { name: "Aegis-12-Compliance-Matrix", version: "1.0.0", chainId: 1399811149 };
const eip712Types = {
    Policy: [
        { name: "policyId", type: "string" },
        { name: "tenantId", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "crossChainTarget", type: "string" },
        { name: "maxAnomalyScore", type: "uint256" },
        { name: "financialLimitsString", type: "string" },
        { name: "expiresAt", type: "uint256" },
        { name: "nonce", type: "string" },
        { name: "vaultPda", type: "string" },
        { name: "squadsMultisig", type: "string" },
        { name: "allowedProgramIds", type: "string[]" }
    ]
};
const nonce = "substance-" + Date.now();
const policyConfig = {
    policyId: "POL_SUBSTANCE_001",
    tenantId: "tenant-council",
    version: "1.0.0",
    chainId: 1399811149,
    crossChainTarget: "solana:devnet",
    maxAnomalyScore: 100,
    financialLimitsString: JSON.stringify({ T1: 1000 }),
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    nonce: nonce,
    vaultPda: "SubstanceVault_Default",
    squadsMultisig: "SubstanceSquads_Default",
    allowedProgramIds: ["11111111111111111111111111111111"]
};

(async () => {
    const signature = await e2eWallet._signTypedData(eip712Domain, eip712Types, policyConfig);
    const payload = {
        action: { toolId: 'solana_transfer', parameters: { to: '11111111111111111111111111111111', amount: 1, token: 'SOL' }, estimatedValue: 0 },
        agent: { did: 'did:aegis:substance-test', purpose: 'financial_operations', currentTier: 'T1' },
        context: { sessionId: 'substance', actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 0.1, recentIncidents: 0 },
        agentContext: { prompt: "Substance test prompt validation", modelVersion: "GPT-Substance", jurisdiction: "GLOBAL" },
        x402PaymentHeader: "mock_solana_tx_signature_x402",
        dynamicPolicy: { policyConfig, ownerPublicKey: e2eWallet.address, signature }
    };

    const fetch = require('node-fetch');
    const res = await fetch('http://127.0.0.1:8000/sign_and_execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    console.log(res.status);
    console.log(await res.text());
})();
