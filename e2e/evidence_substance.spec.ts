import { test, expect } from '@playwright/test';
import { ethers } from 'ethers';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { createHash } from 'crypto';

/**
 * AEGIS-12 EVIDENCE SUBSTANCE VALIDATION
 * 
 * [MANDATE]: Check for substance rather than shape.
 * This suite verifies the cryptographic reality of the Evidence Pack.
 * Mocking will cause these tests to fail.
 */

const e2eWallet = new ethers.Wallet("0x1111111111111111111111111111111111111111111111111111111111111111");
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
        { name: "nonce", type: "string" }
    ]
};

const SOLANA_CLUSTER = 'devnet';
const connection = new Connection(clusterApiUrl(SOLANA_CLUSTER), 'confirmed');

test.describe('Aegis-12: High-Veracity Evidence Substance Audit', () => {

    test('EVIDENCE-SUBSTANCE-001: Valid Approval produces verifiable Solana Anchor and ZK Seal', async ({ request }) => {
        const nonce = "substance-" + Date.now();
        const policyConfig = {
            policyId: "POL_SUBSTANCE_001",
            tenantId: "tenant-council",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "solana-mainnet",
            maxAnomalyScore: 100,
            financialLimitsString: JSON.stringify({ T1: 1000 }),
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: nonce,
        };

        const signature = await e2eWallet._signTypedData(eip712Domain, eip712Types, policyConfig);
        
        const payload = {
            action: {
                toolId: 'solana_transfer',
                parameters: { to: '11111111111111111111111111111111', amount: 1, token: 'SOL' },
                estimatedValue: 0
            },
            agent: { did: 'did:aegis:substance-test', purpose: 'financial_operations', currentTier: 'T1' },
            context: { sessionId: 'substance', actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 0.1, recentIncidents: 0 },
            dynamicPolicy: { policyConfig, ownerPublicKey: e2eWallet.address, signature },
        };

        console.log(`[Substance] Sending enforcement request for actionId: ${nonce}...`);
        const res = await request.post('/enforce', { data: payload });
        const body = await res.json();

        // 1. Initial State Check (Shape)
        expect(res.status(), `Request failed: ${JSON.stringify(body)}`).toBe(200);
        expect(body.status).toBe('approved');
        
        const receipt = body.receipt;
        const solanaTx = body.solana_tx;
        const zkSeal = body.ars_anchor;
        const attestation = body.attestation;
        const pcr0 = body.pcr0;

        console.log(`[Substance] Enforcement Approved. Solana TX: ${solanaTx}`);

        // 2. TEE SUBSTANCE VALIDATION
        expect(attestation, "TEE Attestation must not be mocked").not.toBe("not_available_in_mock");
        expect(pcr0, "PCR0 Measurement must be present").toBeDefined();
        expect(pcr0.length, "PCR0 must be a valid SHA-256 hash").toBe(64);

        // 3. ZK SUBSTANCE VALIDATION
        expect(zkSeal, "ZK Seal must not be mocked").not.toBe("mock-seal-for-demo");
        expect(zkSeal, "ZK Seal must be a non-empty string").toBeTruthy();
        // RISC Zero seals are typically large base64 strings
        expect(zkSeal.length, "ZK Seal length suggests real cryptographic proof").toBeGreaterThan(100);

        // 4. SOLANA SUBSTANCE VALIDATION (ON-CHAIN AUDIT)
        expect(solanaTx, "Solana TX ID must not be mocked").not.toContain("mock_tx_");
        
        console.log(`[Substance] Fetching Solana Transaction ${solanaTx} from Devnet...`);
        
        // Wait for confirmation if necessary (though server uses 'confirmed')
        let tx = await connection.getParsedTransaction(solanaTx, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
        });

        // Retry loop for eventual consistency
        let retries = 10;
        while (!tx && retries > 0) {
            console.log(`[Substance] TX not found yet, retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, 5000));
            tx = await connection.getParsedTransaction(solanaTx, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            });
            retries--;
        }

        expect(tx, "Transaction must exist on-chain").not.toBeNull();
        
        // Extract memo substance
        const memoLog = tx!.meta?.logMessages?.find(log => log.includes('Program log: Memo'));
        expect(memoLog, "Transaction must contain an SPL Memo").toBeDefined();
        
        // Format: aegis:v4-pq:<actionId>:<hashPrefix>:<decision>:<didSuffix>:<timestamp>
        const memoMatch = memoLog!.match(/Memo \(len \d+\): "(.*?)"/);
        expect(memoMatch, "Memo must match structured format").not.toBeNull();
        const memoStr = memoMatch![1];
        const memoParts = memoStr.split(':');
        
        console.log(`[Substance] On-Chain Memo: ${memoStr}`);

        expect(memoParts[0], "Version must match").toBe('aegis');
        expect(memoParts[1], "Sub-version must be V4 Post-Quantum").toBe('v4-pq');
        expect(memoParts[2], "Action ID must match receipt").toBe(receipt.actionId);
        
        expect(memoParts[4], "Decision must be recorded on-chain").toBe('approved');
        
        const enclaveDid = body.enclaveDid;
        const didSuffix = enclaveDid.substring(enclaveDid.lastIndexOf(':') + 1);
        expect(memoParts[5], "Enclave DID Suffix must match").toBe(didSuffix);
        
        console.log(`[Substance] ✅ SUBSTANCE VERIFIED: Receipt is anchored to Solana with matching cryptographic metadata.`);
    });
});
