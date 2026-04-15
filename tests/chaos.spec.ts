import { PolicyEvaluationRequest } from '../src/types';
import { AegisPEP } from '../src/infrastructure/AegisPEP';
import { AegisSigner } from '../src/infrastructure/AegisSigner';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

describe("AegisPEP Chaos Testing Suite", () => {
    let enclaveSigner: AegisSigner;
    let aegisPEP: AegisPEP;
    let ceoWallet: ethers.Wallet;
    
    // EIP-712 Domain
    const domain = { name: "Aegis-12-Compliance-Matrix", version: "1.0.0", chainId: 1399811149 };
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

    beforeEach(() => {
        // Clear the physical WAL file so tests don't permanently Replay-lock each other!
        try {
            fs.rmSync(path.resolve(process.cwd(), '.aegis_wal.json'), { force: true });
        } catch (e) {}

        enclaveSigner = new AegisSigner(); 
        ceoWallet = ethers.Wallet.createRandom();

        // 🛡️ VULNERABILITY 1 FIXED: Hardware Boot-Time KMS Trust Anchoring
        const hardcodedTrustStore = {
            "tenant-abc": [ceoWallet.address],
            "expiredTenant": [ceoWallet.address],
            "tenantX": [ceoWallet.address],
            "legitTenant": [ceoWallet.address]
        };

        aegisPEP = new AegisPEP(enclaveSigner, hardcodedTrustStore);
    });

    /**
     * Case 1: EIP-712 Policy Injection - Forged Typed Data (Math Level)
     */
    it("denies action when EIP-712 signature is functionally forged (Math Fails)", async () => {
        const forgedDynamicPolicy = {
            policyConfig: {
                policyId: "fakePolicy123",
                tenantId: "tenant-abc",
                version: "1.0.0",
                chainId: 1399811149,
                crossChainTarget: "solana-mainnet",
                maxAnomalyScore: 100,
                financialLimits: { 'T4': 50000 },
                financialLimitsString: JSON.stringify({ 'T4': 50000 }),
                expiresAt: Math.floor(Date.now() / 1000) + 60,
                nonce: "1234-5678"
            },
            signature: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12', 
            ownerPublicKey: ceoWallet.address
        };

        const request: any = {
            action: { toolId: "solana_transfer", parameters: { to: "attacker", amount: 100 }, estimatedValue: 100 },
            agent: { did: "did:example:456", purpose: "testing", currentTier: "T1" },
            context: { currentAnomalyScore: 0 },
            dynamicPolicy: forgedDynamicPolicy,
        };

        await expect(aegisPEP.enforce(request)).rejects.toThrow("Cryptographic Payload processing failed");
    });

    /**
     * Case 1B: The Root of Trust Defense (Self-Signing Attack Blocked)
     */
    it("denies action when attacker correctly signs a forged policy using their own key not in Trust Store", async () => {
        // Attacker generates their own key
        const attackerWallet = ethers.Wallet.createRandom();

        const config: any = {
            policyId: "unauthorizedPolicy",
            tenantId: "legitTenant",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "solana-mainnet",
            maxAnomalyScore: 100,
            financialLimits: { 'T4': 5000000 }, // Huge limits!
            expiresAt: Math.floor(Date.now() / 1000) + 60,
            nonce: "attack-nonce"
        };
        config.financialLimitsString = JSON.stringify(config.financialLimits);
        
        // Attacker creates mathematically valid EIP-712 signature using their own key
        const attackerSig = await attackerWallet._signTypedData(domain, types, {
            policyId: config.policyId,
            tenantId: config.tenantId,
            version: config.version,
            chainId: config.chainId,
            crossChainTarget: config.crossChainTarget,
            maxAnomalyScore: config.maxAnomalyScore,
            financialLimitsString: config.financialLimitsString,
            expiresAt: config.expiresAt,
            nonce: config.nonce
        });

        const selfSignedPolicy = {
            policyConfig: config,
            signature: attackerSig,
            ownerPublicKey: attackerWallet.address // They self-certify!
        };

        const request: any = {
            action: { toolId: "solana_transfer", parameters: { token: "SOL", to: "attacker", amount: 100000 }, estimatedValue: 100000 },
            agent: { did: "did:example:777", purpose: "testing", currentTier: "T4" },
            context: { currentAnomalyScore: 0 },
            dynamicPolicy: selfSignedPolicy
        };

        await expect(aegisPEP.enforce(request)).rejects.toThrow("Signer not found in provisioned TEE Root-of-Trust");
    });

    /**
     * Case 2: Expired Policy - Replay Attack Detection
     */
    it("denies action when policy expiration timestamp is in the past", async () => {
        const config: any = {
            policyId: "expiredPolicy",
            tenantId: "expiredTenant",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "solana-mainnet",
            maxAnomalyScore: 80,
            financialLimits: { 'T4': 50000 },
            expiresAt: Math.floor(Date.now() / 1000) - 10,
            nonce: "replay-attack-test"
        };
        config.financialLimitsString = JSON.stringify(config.financialLimits);
        
        const sig = await ceoWallet._signTypedData(domain, types, {
            policyId: config.policyId,
            tenantId: config.tenantId,
            version: config.version,
            chainId: config.chainId,
            crossChainTarget: config.crossChainTarget,
            maxAnomalyScore: config.maxAnomalyScore,
            financialLimitsString: config.financialLimitsString,
            expiresAt: config.expiresAt,
            nonce: config.nonce
        });

        const request: any = {
            action: { toolId: "solana_transfer", parameters: { token: "SOL", to: "x", amount: 10 }, estimatedValue: 10 },
            agent: { did: "did:example:567", purpose: "testing", currentTier: "T2" },
            context: { currentAnomalyScore: 0 },
            dynamicPolicy: { policyConfig: config, signature: sig, ownerPublicKey: ceoWallet.address }
        };

        await expect(aegisPEP.enforce(request)).rejects.toThrow("Policy Expired (Replay Attack Detected)");
    });

    /**
     * Case 3: Payload Parameter Schema Sanitization (Hallucination stripping)
     */
    it("strips LLM hallucinated keys and generates deterministic parameters hash receipt", async () => {
        const config: any = {
            policyId: "legitPolicy",
            tenantId: "legitTenant",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "solana-mainnet",
            maxAnomalyScore: 90,
            financialLimits: { 'T4': 50000 },
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: "sanitizer-nonce"
        };
        config.financialLimitsString = JSON.stringify(config.financialLimits);

        const sig = await ceoWallet._signTypedData(domain, types, {
            policyId: config.policyId,
            tenantId: config.tenantId,
            version: config.version,
            chainId: config.chainId,
            crossChainTarget: config.crossChainTarget,
            maxAnomalyScore: config.maxAnomalyScore,
            financialLimitsString: config.financialLimitsString,
            expiresAt: config.expiresAt,
            nonce: config.nonce
        });

        // VULNERABILITY 2 FIXED: The LLM hallucinations inside the parameters block
        const dirtyLLMParameters = {
            to: "receiver_wallet",
            amount: 50,
            hallucinated_note: "I think this trade is great",
            reasoning: "I calculated the risk and it's 0",
            injectedAttackerField: true
        };

        const request: any = {
            action: { toolId: "solana_transfer", parameters: { ...dirtyLLMParameters, token: "USDC" }, estimatedValue: 50 },
            agent: { did: "did:example:111", purpose: "financial_operations", currentTier: "T4" },
            context: { currentAnomalyScore: 10 },
            dynamicPolicy: { policyConfig: config, signature: sig, ownerPublicKey: ceoWallet.address }
        };

        const receipt = await aegisPEP.enforce(request);

        // The returned validParams should strictly be stripped down
        expect((receipt.validatedParams as any).to).toEqual("receiver_wallet");
        expect((receipt.validatedParams as any).amount).toEqual(50);
        expect((receipt.validatedParams as any).hallucinated_note).toBeUndefined();
        expect((receipt.validatedParams as any).reasoning).toBeUndefined();
        expect((receipt.validatedParams as any).injectedAttackerField).toBeUndefined();

        // The hash must exist instead of raw parameters dumped into canonicalString
        expect(receipt.parametersHash).toBeDefined();
        expect(receipt.parametersHash.startsWith('0x')).toBe(true);
        expect(receipt.authorizationNonce).toEqual("sanitizer-nonce"); // Strict deterministic propagation
    });

    /**
     * Case 4: Double-Spend Replay Nonce Tracking
     */
    it("denies action when an attacker successfully broadcasts the exact same signed payload twice", async () => {
        const config: any = {
            policyId: "doubleSpendPolicy",
            tenantId: "legitTenant",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "solana-mainnet",
            maxAnomalyScore: 90,
            financialLimits: { 'T4': 50000 },
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: "unique-nonce-1"
        };
        config.financialLimitsString = JSON.stringify(config.financialLimits);

        const sig = await ceoWallet._signTypedData(domain, types, {
            policyId: config.policyId,
            tenantId: config.tenantId,
            version: config.version,
            chainId: config.chainId,
            crossChainTarget: config.crossChainTarget,
            maxAnomalyScore: config.maxAnomalyScore,
            financialLimitsString: config.financialLimitsString,
            expiresAt: config.expiresAt,
            nonce: config.nonce
        });

        const request: any = {
            action: { toolId: "solana_transfer", parameters: { token: "SOL", to: "wallet", amount: 10 }, estimatedValue: 10 },
            agent: { did: "did:example:222", purpose: "financial_operations", currentTier: "T4" },
            context: { currentAnomalyScore: 10 },
            dynamicPolicy: { policyConfig: config, signature: sig, ownerPublicKey: ceoWallet.address }
        };

        // First Execution should PASS
        const receipt1 = await aegisPEP.enforce(request);
        expect(receipt1.parametersHash).toBeDefined(); // Passes cleanly

        // Second Execution of the EXACT SAME PAYLOAD should be violently rejected by internal Nonce set
        await expect(aegisPEP.enforce(request)).rejects.toThrow("Nonce already used (Double-Spend Replay Attack Detected)");
    });

    /**
     * Case 5: The Fatal Fallback Loophole (Missing dynamic policy)
     */
    it("denies action entirely when the payload lacks a cryptographic envelope", async () => {
        const request: any = {
            action: { toolId: "solana_transfer", parameters: { token: "SOL", to: "wallet", amount: 10 }, estimatedValue: 10 },
            agent: { did: "did:example:333", purpose: "financial_operations", currentTier: "T4" },
            context: { currentAnomalyScore: 10 },
            // VULNERABILITY 3 FIXED: dynamicPolicy is completely omitted
        };

        await expect(aegisPEP.enforce(request)).rejects.toThrow("Missing Cryptographic Policy envelope. Unsigned requests are structurally denied.");
    });

    /**
     * Case 6: Signature Parameter Bisection Attack
     */
    it("denies action when attacker signs a small limit string but injects a massive unsigned limit JSON object", async () => {
        const config: any = {
            policyId: "bisectionPolicy",
            tenantId: "legitTenant",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "solana-mainnet",
            maxAnomalyScore: 90,
            // Attacker wants to secretly pass this unsigned JSON
            financialLimits: { 'T4': 5000000 }, 
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: "bisection-attack-nonce"
        };
        // But the CEO actually only ever signed a $50 strict limit mathematically
        config.financialLimitsString = JSON.stringify({ 'T4': 50 });

        const sig = await ceoWallet._signTypedData(domain, types, {
            policyId: config.policyId,
            tenantId: config.tenantId,
            version: config.version,
            chainId: config.chainId,
            crossChainTarget: config.crossChainTarget,
            maxAnomalyScore: config.maxAnomalyScore,
            financialLimitsString: config.financialLimitsString,
            expiresAt: config.expiresAt,
            nonce: config.nonce
        });

        const request: any = {
            action: { toolId: "solana_transfer", parameters: { token: "SOL", to: "attacker", amount: 100000 }, estimatedValue: 100000 },
            agent: { did: "did:example:666", purpose: "financial_operations", currentTier: "T4" },
            context: { currentAnomalyScore: 10 },
            dynamicPolicy: { policyConfig: config, signature: sig, ownerPublicKey: ceoWallet.address } // The config carries the unsigned 5M
        };

        // Enclave MUST ignore the unsigned `config.financialLimits` object and enforce the signed $50 string boundary, rejecting it.
        await expect(aegisPEP.enforce(request)).rejects.toThrow("Action value 100000 exceeds mathematically signed Tier limit 50");
    });

    /**
     * Case 8: Cross-Chain Replay Attack
     */
    it("denies action entirely when an attacker replays a valid Ethereum EVM signature against the Solana gateway", async () => {
        const config: any = {
            policyId: "crossChainExploit",
            tenantId: "legitTenant",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "ethereum", // The user signed this for an EVM chain
            maxAnomalyScore: 90,
            financialLimits: { 'T4': 50000 },
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: "cross-chain-nonce"
        };
        config.financialLimitsString = JSON.stringify(config.financialLimits);

        const sig = await ceoWallet._signTypedData(domain, types, {
            policyId: config.policyId,
            tenantId: config.tenantId,
            version: config.version,
            chainId: config.chainId,
            crossChainTarget: config.crossChainTarget,
            maxAnomalyScore: config.maxAnomalyScore,
            financialLimitsString: config.financialLimitsString,
            expiresAt: config.expiresAt,
            nonce: config.nonce
        });

        const request: any = {
            action: { toolId: "solana_transfer", parameters: { token: "SOL", to: "attacker", amount: 100000 }, estimatedValue: 100000 },
            agent: { did: "did:example:999", purpose: "financial_operations", currentTier: "T4" },
            context: { currentAnomalyScore: 10 },
            dynamicPolicy: { policyConfig: config, signature: sig, ownerPublicKey: ceoWallet.address }
        };

        await expect(aegisPEP.enforce(request)).rejects.toThrow("Cross-Chain Replay Defended");
    });

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
            action: { toolId: "solana_transfer", parameters: { token: "SOL", to: "attacker", amount: 100000 } }, // estimatedValue OMITTED!
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
     * Case 11: COUNCIL FIX — Commit-First Nonce Burn (Error Injection Replay Defense)
     * After evaluatePolicy returns 'allow', the nonce is IMMEDIATELY committed.
     * Even if normalizeParameters throws (e.g. malformed params), the nonce is permanently
     * consumed. An attacker cannot cause an intentional error to free the nonce for replay.
     */
    it("permanently burns the nonce even if an exception is thrown after policy approval", async () => {
        const config: any = {
            policyId: "rollbackPolicy",
            tenantId: "legitTenant",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "solana-mainnet",
            maxAnomalyScore: 90,
            financialLimits: { 'T4': 50000 },
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: "atomic-burn-nonce"
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

        // First call: policy passes but params fail — nonce is still burned
        await expect(aegisPEP.enforce(request)).rejects.toThrow("Schema Sanitization Failed");

        // Second call with VALID params but SAME nonce — must be rejected as double-spend
        const validRequest: any = {
            action: { toolId: "solana_transfer", parameters: { token: "SOL", to: "valid-wallet", amount: 100 }, estimatedValue: 100 }, 
            agent: { did: "did:example:777", purpose: "financial_operations", currentTier: "T4" },
            context: { currentAnomalyScore: 10 },
            dynamicPolicy: { policyConfig: config, signature: sig, ownerPublicKey: ceoWallet.address }
        };
        
        // The nonce was irrevocably burned — this MUST fail
        await expect(aegisPEP.enforce(validRequest)).rejects.toThrow("Nonce already used");
    });
});
