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

async function generate() {
    const expiresAt = 1893456000; // Jan 1 2030
    
    // SAFE POLICY
    const safePolicy = {
        policyId: "POL_SAFE_01",
        tenantId: "tenant-council",
        version: "1.0.0",
        chainId: 1399811149,
        crossChainTarget: "solana:devnet",
        maxAnomalyScore: 50,
        financialLimitsString: JSON.stringify({ "T4": 1000 }),
        expiresAt,
        nonce: "nonce-safe-12345",
        vaultPda: "CouncilVault_Default",
        squadsMultisig: "CouncilSquads_Default",
        allowedProgramIds: ["11111111111111111111111111111111"]
    };
    const safeSig = await e2eWallet._signTypedData(eip712Domain, eip712Types, safePolicy);
    console.log("SAFE POLICY: ", JSON.stringify({ policyConfig: safePolicy, signature: safeSig }));
    
    // MALICIOUS POLICY
    const malPolicy = {
        ...safePolicy,
        policyId: "POL_MAL_01",
        nonce: "nonce-mal-12345",
    };
    const malSig = await e2eWallet._signTypedData(eip712Domain, eip712Types, malPolicy);
    console.log("MAL POLICY: ", JSON.stringify({ policyConfig: malPolicy, signature: malSig }));
}

generate().catch(console.error);
