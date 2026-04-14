import re

with open('tests/chaos.spec.ts', 'r') as f:
    content = f.read()

# Replace chainId gracefully
content = content.replace('chainId: 1,', 'chainId: 1399811149,')
content = content.replace('chainId: 1 }', 'chainId: 1399811149 }')
content = content.replace('chainId: 1\n', 'chainId: 1399811149\n')

new_cases = """
    /**
     * Case 9: VULN-5 Parameter Omission Bypass (Null Type Coercion)
     */
    it("denies action when attacker omits estimatedValue to bypass null type coercion limit checks", async () => {
        const config: any = {
            policyId: "coercionPolicy",
            tenantId: "legitTenant",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "solana-mainnet",
            maxAnomalyScore: 90,
            financialLimits: { 'T4': 50000 },
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: "type-coercion-nonce"
        };
        config.financialLimitsString = JSON.stringify(config.financialLimits);

        const sig = await ceoWallet._signTypedData(domain, types, { ...config });

        const request: any = {
            action: { toolId: "solana_transfer", parameters: { to: "attacker", amount: 100000 } }, // estimatedValue OMITTED!
            agent: { did: "did:example:777", purpose: "financial_operations", currentTier: "T4" },
            context: { currentAnomalyScore: 10 },
            dynamicPolicy: { policyConfig: config, signature: sig, ownerPublicKey: ceoWallet.address }
        };

        await expect(aegisPEP.enforce(request)).rejects.toThrow();
    });

    /**
     * Case 10: VULN-6 Asset Substitution (Token Stripping)
     */
    it("denies action when token parameter is omitted during solana_transfer, stopping MEV asset substitution", async () => {
        const config: any = {
            policyId: "assetPolicy",
            tenantId: "legitTenant",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "solana-mainnet",
            maxAnomalyScore: 90,
            financialLimits: { 'T4': 50000 },
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: "asset-substitution-nonce"
        };
        config.financialLimitsString = JSON.stringify(config.financialLimits);

        const sig = await ceoWallet._signTypedData(domain, types, { ...config });

        const request: any = {
            action: { toolId: "solana_transfer", parameters: { to: "attacker", amount: 100 }, estimatedValue: 100 },  // 'token' is missing
            agent: { did: "did:example:777", purpose: "financial_operations", currentTier: "T4" },
            context: { currentAnomalyScore: 10 },
            dynamicPolicy: { policyConfig: config, signature: sig, ownerPublicKey: ceoWallet.address }
        };

        await expect(aegisPEP.enforce(request)).rejects.toThrow();
    });

    /**
     * Case 11: VULN-1 2PC Atomic Rollback on Parameter Exception
     */
    it("rolls back the nonce if an exception is thrown after evaluatePolicy but before commit", async () => {
        const config: any = {
            policyId: "rollbackPolicy",
            tenantId: "legitTenant",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "solana-mainnet",
            maxAnomalyScore: 90,
            financialLimits: { 'T4': 50000 },
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: "atomic-rollback-nonce"
        };
        config.financialLimitsString = JSON.stringify(config.financialLimits);

        const sig = await ceoWallet._signTypedData(domain, types, { ...config });

        const request: any = {
            // Malformed parameters to throw during normalizeParameters
            action: { toolId: "solana_transfer", parameters: { to: 1234, amount: -100 }, estimatedValue: 100 }, 
            agent: { did: "did:example:777", purpose: "financial_operations", currentTier: "T4" },
            context: { currentAnomalyScore: 10 },
            dynamicPolicy: { policyConfig: config, signature: sig, ownerPublicKey: ceoWallet.address }
        };

        await expect(aegisPEP.enforce(request)).rejects.toThrow();

        // If rollback works correctly, we should be able to reuse the nonce when we submit a valid request!
        const validRequest: any = {
            action: { toolId: "solana_transfer", parameters: { token: "SOL", to: "valid-wallet", amount: 100 }, estimatedValue: 100 }, 
            agent: { did: "did:example:777", purpose: "financial_operations", currentTier: "T4" },
            context: { currentAnomalyScore: 10 },
            dynamicPolicy: { policyConfig: config, signature: sig, ownerPublicKey: ceoWallet.address }
        };
        
        const receipt = await aegisPEP.enforce(validRequest);
        expect(receipt.authorizationNonce).toEqual("atomic-rollback-nonce");
    });
});
"""

# replace the closing tag of the file
content = re.sub(r'}\);\s*$', new_cases, content)

with open('tests/chaos.spec.ts', 'w') as f:
    f.write(content)

with open('e2e/solana-integration.spec.ts', 'r') as f:
    e2e_content = f.read()

e2e_content = e2e_content.replace('chainId: 1,', 'chainId: 1399811149,')
e2e_content = e2e_content.replace('chainId: 1 }', 'chainId: 1399811149 }')
with open('e2e/solana-integration.spec.ts', 'w') as f:
    f.write(e2e_content)

print("Patch applied.")
