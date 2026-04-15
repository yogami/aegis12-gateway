import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AegisPEP } from '../src/infrastructure/AegisPEP';
import { AegisSigner } from '../src/infrastructure/AegisSigner';
import { AegisLocalStateStore } from '../src/infrastructure/AegisLocalStateStore';
import { PolicyEvaluationRequest } from '../src/types';
import { ethers } from 'ethers';
import * as fs from 'fs';

describe('Aegis Sentinel: Stateful Behavioral Enforcement', () => {
    let pep: AegisPEP;
    let signer: AegisSigner;
    const WAL_PATH = '.aegis_wal_test.json';

    beforeAll(() => {
        if (fs.existsSync(WAL_PATH)) fs.unlinkSync(WAL_PATH);
        signer = new AegisSigner('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
        const stateStore = new AegisLocalStateStore(WAL_PATH);
        // Tenant trust store with the signer as the human autority
        const trustStore = { "tenant-1": [signer.getAddress()] };
        pep = new AegisPEP(signer, trustStore, undefined, stateStore);
    });

    afterAll(() => {
        if (fs.existsSync(WAL_PATH)) fs.unlinkSync(WAL_PATH);
    });

    it('should catch a structuring attack via cumulative spend ceilings', async () => {
        const solanaAddress = "5zwvS4y7bV84tAisunFh5kKjKxZ7wDcF6wJ1Vysv9vLz";
        
        // Helper to generate a policy-wrapped request
        const createRequest = async (nonce: string, amount: number): Promise<PolicyEvaluationRequest> => {
            const policyConfig = {
                policyId: `pol-${nonce}`,
                tenantId: "tenant-1",
                version: "1.0.0",
                chainId: 1399811149,
                crossChainTarget: "solana-mainnet",
                maxAnomalyScore: 100, // 1.0 scaled to int
                financialLimitsString: JSON.stringify({ perTx: 50000 }),
                expiresAt: Math.floor(Date.now() / 1000) + 3600,
                nonce
            };
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
            const signature = await signer.signEIP712(domain, types, policyConfig);

            return {
                action: { toolId: "solana_transfer", parameters: { to: solanaAddress, amount, token: "SOL" } },
                context: { currentAnomalyScore: 0.1 },
                agent: { currentTier: "perTx" },
                dynamicPolicy: { policyConfig, signature }
            };
        };

        // 1. First transaction: 30,000 SOL (Total: 30k, Limit: 50k) -> ALLOW
        const r1 = await pep.enforce(await createRequest("nonce-1", 30000));
        expect(r1.actionId).toBeDefined();

        // 2. Second transaction: 15,000 SOL (Total: 45k, Limit: 50k) -> ALLOW
        const r2 = await pep.enforce(await createRequest("nonce-2", 15000));
        expect(r2.actionId).toBeDefined();

        // 3. Third transaction: 10,000 SOL (Total: 55k, Limit: 50k) -> DENY (TERMINAL REFUSAL)
        await expect(pep.enforce(await createRequest("nonce-3", 10000)))
            .rejects.toThrow(/Cumulative spend \(55000\) exceeds hardware-locked lifetime ceiling/);
            
        console.log("--- Sentinel Stress Test: PASS ---");
    });
});
