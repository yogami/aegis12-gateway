const { ethers } = require('ethers');

async function getPayload(parserBomb) {
    const wallet = ethers.Wallet.createRandom();
    
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
    const value = {
        policyId: "POL_999",
        tenantId: "TENANT_123",
        version: "1.0.0",
        chainId: 1399811149,
        crossChainTarget: "solana-mainnet",
        maxAnomalyScore: 100,
        financialLimitsString: parserBomb,
        expiresAt: 9999999999,
        nonce: "nonce-xyz"
    };

    const signature = await wallet._signTypedData(domain, types, value);
    return { address: wallet.address, signature, value };
}

(async () => {
    // Generate valid mock
})()
