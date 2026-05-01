import { describe, it, expect, beforeAll } from 'vitest';
import phalaEntrypoint, { enclave } from '../../src/application/PhalaEntrypoint';
import { AgentPurpose, PolicyEvaluationRequest, TrustTier } from '../../src/types';
import { AegisSigner } from '../../src/infrastructure/AegisSigner';

describe('AegisPEP & Phala Entrypoint (E2E)', () => {
    let signer: AegisSigner;
    const domain = { name: "Aegis-12-Compliance-Matrix", version: "1.0.0", chainId: 1399811149 };
    const types = { Policy: [ { name: "policyId", type: "string" }, { name: "tenantId", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "crossChainTarget", type: "string" }, { name: "maxAnomalyScore", type: "uint256" }, { name: "financialLimitsString", type: "string" }, { name: "expiresAt", type: "uint256" }, { name: "nonce", type: "string" }, { name: "vaultPda", type: "string" }, { name: "squadsMultisig", type: "string" }, { name: "allowedProgramIds", type: "string[]" } ] };

    beforeAll(async () => {
        signer = await AegisSigner.create();
        await enclave.initialize();
        enclave.pep!.provisionTenant('tenant-1', signer.getAddress());
    });

    const baseAgent = {
        did: "did:web:noahai.agent.testbot",
        purpose: AgentPurpose.FINANCIAL_OPERATIONS,
        currentTier: TrustTier.T4
    };

    it('should approve a legitimate trading request within policy bounds', async () => {
        const policyConfig = { policyId: "pol-1", tenantId: 'tenant-1', version: "1.0", chainId: 1399811149, crossChainTarget: "solana:devnet", nonce: `nonce-${Date.now()}-1`, expiresAt: Math.floor(Date.now() / 1000) + 1000, maxAnomalyScore: 100, financialLimitsString: '{"T4": 100000}', vaultPda: "vault1", squadsMultisig: "sqds1", allowedProgramIds: ["11111111111111111111111111111111"] };
        const signature = await signer.signEIP712(domain, types, policyConfig);
        
        const authorizedPayload: PolicyEvaluationRequest = {
            agent: baseAgent,
            dynamicPolicy: { policyConfig, ownerPublicKey: signer.getAddress(), signature } as any,
            action: {
                toolId: "swap",
                actionType: "swap",
                parameters: {
                    fromMint: "So11111111111111111111111111111111111111112",
                    toMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                    amount: 1000, // Safely under limit
                    slippageBps: 50
                },
                estimatedValue: 1000
            },
            context: { sessionId: "session-1", actionsThisSession: 2, actionsThisHour: 5, currentAnomalyScore: 0.1, recentIncidents: 0 }
        };

        const responseString = await phalaEntrypoint(JSON.stringify(authorizedPayload));
        const res = JSON.parse(responseString);

        expect(res.status).toBe('approved');
        expect(res.receipt).toBeDefined();
        // Check TEE cryptographic signature is present
        expect(res.receipt.signature).toBeDefined();
        expect(res.enclaveDid).toMatch(/^did:aegis:enclave/i);
    });

    it('should enact a TERMINAL REFUSAL when T4 maximum value limit is exceeded', async () => {
        const policyConfig = { policyId: "pol-2", tenantId: 'tenant-1', version: "1.0", chainId: 1399811149, crossChainTarget: "solana:devnet", nonce: `nonce-${Date.now()}-2`, expiresAt: Math.floor(Date.now() / 1000) + 1000, maxAnomalyScore: 100, financialLimitsString: '{"T4": 100000}', vaultPda: "vault1", squadsMultisig: "sqds1", allowedProgramIds: ["11111111111111111111111111111111"] };
        const signature = await signer.signEIP712(domain, types, policyConfig);

        const payload: PolicyEvaluationRequest = {
            agent: baseAgent,
            dynamicPolicy: { policyConfig, ownerPublicKey: signer.getAddress(), signature } as any,
            action: {
                toolId: "swap",
                actionType: "swap",
                parameters: {
                    fromMint: "So11111111111111111111111111111111111111112",
                    toMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                    amount: 150000,
                    slippageBps: 50
                },
                estimatedValue: 150000 // T4 Limit is 100000
            },
            context: { sessionId: "session-2", actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 0.1, recentIncidents: 0 }
        };

        const responseString = await phalaEntrypoint(JSON.stringify(payload));
        const res = JSON.parse(responseString);

        expect(res.status).toBe('denied');
        expect(res.error).toContain('exceeds signed Tier limit');
    });

    it('should enact a TERMINAL REFUSAL when Anomaly score is too high', async () => {
        const policyConfig = { policyId: "pol-3", tenantId: 'tenant-1', version: "1.0", chainId: 1399811149, crossChainTarget: "solana:devnet", nonce: `nonce-${Date.now()}-3`, expiresAt: Math.floor(Date.now() / 1000) + 1000, maxAnomalyScore: 80, financialLimitsString: '{"T4": 100000}', vaultPda: "vault1", squadsMultisig: "sqds1", allowedProgramIds: ["11111111111111111111111111111111"] };
        const signature = await signer.signEIP712(domain, types, policyConfig);

        const payload: PolicyEvaluationRequest = {
            agent: baseAgent,
            dynamicPolicy: { policyConfig, ownerPublicKey: signer.getAddress(), signature } as any,
            action: {
                toolId: "solana_transfer",
                actionType: "withdraw",
                parameters: { to: '11111111111111111111111111111111', token: 'SOL', amount: 50 },
                estimatedValue: 50
            },
            context: { sessionId: "session-3", actionsThisSession: 500, actionsThisHour: 5000, currentAnomalyScore: 0.95, recentIncidents: 1 }
        };

        const responseString = await phalaEntrypoint(JSON.stringify(payload));
        const res = JSON.parse(responseString);

        expect(res.status).toBe('denied');
        expect(res.error).toContain('Anomaly score exceeds threshold');
    });

    it('should enact a TERMINAL REFUSAL when an OFAC sanctioned address is targeted', async () => {
        const policyConfig = { policyId: "pol-4", tenantId: 'tenant-1', version: "1.0", chainId: 1399811149, crossChainTarget: "solana:devnet", nonce: `nonce-${Date.now()}-4`, expiresAt: Math.floor(Date.now() / 1000) + 1000, maxAnomalyScore: 100, financialLimitsString: '{"T4": 100000}', vaultPda: "vault1", squadsMultisig: "sqds1", allowedProgramIds: ["11111111111111111111111111111111"] };
        const signature = await signer.signEIP712(domain, types, policyConfig);

        const payload: PolicyEvaluationRequest = {
            agent: baseAgent,
            dynamicPolicy: { policyConfig, ownerPublicKey: signer.getAddress(), signature } as any,
            action: {
                toolId: "solana_transfer",
                actionType: "transfer",
                parameters: { to: 'OFAC_BLOCKED_ADDRESS_001', token: 'USDC', amount: 50 },
                estimatedValue: 50
            },
            context: { sessionId: "session-4", actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 0.1, recentIncidents: 0 }
        };

        const responseString = await phalaEntrypoint(JSON.stringify(payload));
        const res = JSON.parse(responseString);

        expect(res.status).toBe('denied');
        expect(res.error).toContain('OFAC_VIOLATION_DETECTED');
    });

    it('should enact a TERMINAL REFUSAL when TEE simulation detects an evasion attempt (SystemProgram.assign)', async () => {
        const policyConfig = { policyId: "pol-5", tenantId: 'tenant-1', version: "1.0", chainId: 1399811149, crossChainTarget: "solana:devnet", nonce: `nonce-${Date.now()}-5`, expiresAt: Math.floor(Date.now() / 1000) + 1000, maxAnomalyScore: 100, financialLimitsString: '{"T4": 100000}', vaultPda: "vault1", squadsMultisig: "sqds1", allowedProgramIds: ["11111111111111111111111111111111"] };
        const signature = await signer.signEIP712(domain, types, policyConfig);

        const payload: PolicyEvaluationRequest = {
            agent: baseAgent,
            dynamicPolicy: { policyConfig, ownerPublicKey: signer.getAddress(), signature } as any,
            action: {
                toolId: "solana_transfer",
                actionType: "transfer",
                parameters: { to: 'SafeAddress123', amount: 50, test_evasion_flag: true },
                estimatedValue: 50
            },
            context: { sessionId: "session-5", actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 0.1, recentIncidents: 0 }
        };

        const responseString = await phalaEntrypoint(JSON.stringify(payload));
        const res = JSON.parse(responseString);

        expect(res.status).toBe('denied');
        expect(res.error).toContain('ANTI_EVASION_TRIGGERED');
    });

});
