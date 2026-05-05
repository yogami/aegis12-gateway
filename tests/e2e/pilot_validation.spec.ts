import { test, expect } from '@playwright/test';
import { AegisSigner } from '../../src/infrastructure/AegisSigner';

/**
 * ATDD Spec: Sovereign Kill Switch (Pilot Tier 3)
 * 
 * Acceptance Criteria:
 * AC-1: The Sentinel must block transactions that violate the 'Autonomous Trust Threshold' (> 0.80).
 * AC-2: The Sentinel must generate a NIST-compliant ML-DSA-65 signature for every approved action.
 * AC-3: The Sentinel must physically sever execution for high-velocity drain attempts (100+ instructions).
 */

const API_URL = process.env.TEST_API_URL || 'http://localhost:8000';

test.describe('Enterprise Pilot Validation: Sovereign Sentinel', () => {
    
    test('AC-1: Block transactions violating Trust Threshold', async ({ request }) => {
        const payload = {
            agent: { did: 'did:aegis:malicious-agent', purpose: 'arbitrage', currentTier: 'T1' },
            action: { 
                toolId: 'solana_tx', 
                actionType: 'execute', 
                parameters: { 
                    instructions: 5,
                    recipient: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'
                } 
            },
            context: { currentAnomalyScore: 0.85 } // Critical Anomaly
        };

        const response = await request.post(`${API_URL}/sign_and_execute`, { data: payload });
        
        expect(response.status()).toBe(403);
        const result = await response.json();
        expect(result.status).toBe('denied');
        expect(result.decisionReason).toContain('exceeds autonomous threshold');
    });

    test('AC-2: Generate ML-DSA-65 signature for approved action', async ({ request }) => {
        const payload = {
            agent: { did: 'did:aegis:trusted-agent', purpose: 'liquidity_provision', currentTier: 'T4' },
            action: { 
                toolId: 'solana_tx', 
                actionType: 'execute', 
                parameters: { instructions: 1 } 
            },
            context: { currentAnomalyScore: 0.05 } // Clean
        };

        const response = await request.post(`${API_URL}/sign_and_execute`, { data: payload });
        
        expect(response.status()).toBe(200);
        const result = await response.json();
        expect(result.status).toBe('approved');
        
        // Verify PQ Metadata exists
        const attestationResponse = await request.get(`${API_URL}/attestation/status`);
        const metadata = await attestationResponse.json();
        expect(metadata.pqAlgorithm).toBe('ML-DSA-65 (NIST FIPS 204)');
        expect(metadata.pqPublicKey).toBeDefined();
    });

    test('AC-3: Sever execution for high-velocity drain attempts', async ({ request }) => {
        // High-velocity: 150 instructions in a single tx
        const payload = {
            agent: { did: 'did:aegis:rogue-agent', purpose: 'drain', currentTier: 'T1' },
            action: { 
                toolId: 'solana/enforce-tx', 
                actionType: 'execute', 
                parameters: { instructions: 150 } 
            },
            context: { currentAnomalyScore: 0.1 }
        };

        const response = await request.post(`${API_URL}/solana/enforce-tx`, { 
            data: { serializedTx: Buffer.from(JSON.stringify(payload)).toString('base64') } 
        });

        // The firewall should block this even if the anomaly score is low, 
        // due to structural limits in the enforcement manifest.
        expect(response.status()).toBe(403);
        const result = await response.json();
        expect(result.decision).toBe('BLOCK');
    });
});
