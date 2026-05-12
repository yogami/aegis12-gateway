import { test, expect } from '@playwright/test';

/**
 * ATDD Spec: Cryptographic Intent Envelope (HOTL - Article 14)
 * 
 * Acceptance Criteria:
 * AC-1: The Gateway must flag transactions >= 10,000 USDC with status 'escalated'.
 * AC-2: The Gateway must generate a cryptographically bound AegisIntentEnvelope.
 * AC-3: The Envelope must contain valid state predicates and the TEE Ed25519 signature.
 */

const API_URL = process.env.TEST_API_URL || 'http://localhost:8000';

const getPayload = () => ({
    agent: { did: 'did:aegis:treasury-agent', purpose: 'financial_operations', currentTier: 'T3' },
    action: { 
        toolId: 'solana_tx', 
        actionType: 'execute', 
        parameters: { 
            recipient: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
            amount: 50000000000 // 50k USDC
        } 
    },
    context: { 
        currentAnomalyScore: 0.1,
        currentSlot: 1000000 
    },
    dynamicPolicy: {
        policyConfig: {
            policyId: 'pol_hq_treasury_01',
            tenantId: 'tenant-e2e',
            version: '1.0.0',
            chainId: 1399811149,
            crossChainTarget: 'solana:devnet',
            maxAnomalyScore: 60,
            financialLimitsString: '{"T3":"100000000000"}', // Limit is 100k, so PEP doesn't deny it immediately
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: `nonce-${Date.now()}`,
            vaultPda: 'VaultPDA_E2E',
            squadsMultisig: 'Squads_E2E',
            allowedProgramIds: ['Program_E2E']
        },
        ownerPublicKey: 'OwnerKey_E2E',
        signature: '0xMockSignature'
    }
});

test('AC-1 & AC-2: Escalate high-value transaction and generate intent envelope', async ({ request }) => {
        const payload = getPayload();

        const response = await request.post(`${API_URL}/sign_and_execute`, { data: payload });
        
        expect(response.status()).toBe(200);
        
        const result = await response.json();
        
        expect(result.status).toBe('escalated');
        expect(result.receipt).toBeDefined();
        
        const envelope = result.receipt.envelope;
        expect(envelope).toBeDefined();
        
        // AC-3: Check envelope structure and predicates
        expect(envelope.domain_separator).toBe('AEGIS12_ESCALATE_V1');
        expect(envelope.vault_pda).toBe('VaultPDA_E2E');
        expect(envelope.squads_multisig).toBe('Squads_E2E');
        expect(envelope.state_predicates.max_input_amount).toBe(50000000000);
        expect(envelope.state_predicates.allowed_program_ids).toContain('Program_E2E');
        expect(envelope.state_predicates.valid_until_slot).toBe(1001000); // 1000000 + 1000
        
        // Ensure signature is generated
        expect(envelope.tee_signature).toBeDefined();
        expect(result.receipt.signature).toBeDefined();
    });
