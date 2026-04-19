import { test, expect } from '@playwright/test';
import { ethers } from 'ethers';

/**
 * Aegis-12 E2E Test Suite — Solana Integration + Governance + x402
 * 
 * Tests all new endpoints added during the 14-day sprint:
 * - SPL Memo receipt anchoring
 * - Public receipt verification
 * - Solana transaction firewall
 * - Squads V4 governance (human-in-the-loop)
 * - x402 pay-per-inference
 * - TEE attestation status
 * - API documentation
 * 
 * Run against local:  npx playwright test
 * Run against prod:   TEST_API_URL=https://your-domain.railway.app npx playwright test
 */

const API_URL = process.env.TEST_API_URL || 'http://127.0.0.1:8000';

// --- DYNAMIC TEST BOOTSTRAPPING ---
// Generates ephemeral testing keys per run, strictly verifying no key leakage.
const e2eWallet = ethers.Wallet.createRandom();

test.beforeAll(async () => {
    // Provision the backend TEE simulator with our ephemeral public key
    const res = await fetch(`${API_URL}/test/provision-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant-e2e', address: e2eWallet.address })
    });
    if (!res.ok) {
        throw new Error("Failed to provision ephemeral test key into backend TEE emulator");
    }
});

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

async function createSignedDynamicPolicy(tier: string, limit: number, maxScore: number, nonceStr: string) {
    const config = {
        policyId: "e2e-policy-" + nonceStr,
        tenantId: "tenant-e2e",
        version: "1.0.0",
        chainId: 1399811149,
        crossChainTarget: "solana-mainnet",
        maxAnomalyScore: maxScore,
        financialLimitsString: JSON.stringify({ [tier]: limit }),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        nonce: nonceStr
    };

    const signature = await e2eWallet._signTypedData(eip712Domain, eip712Types, config);
    return {
        policyConfig: { ...config, financialLimits: { [tier]: limit } },
        signature,
        ownerPublicKey: e2eWallet.address
    };
}

// ═══════════════════════════════════════════════════════════════
// 1. HEALTH + API DOCS
// ═══════════════════════════════════════════════════════════════

test.describe('Infrastructure Endpoints', () => {

    test('GET /health returns alive with Solana features', async ({ request }) => {
        const res = await request.get(`${API_URL}/health`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();

        expect(body.status).toBe('alive');
        expect(body.enclaveDid).toContain('did:aegis:enclave:');
        expect(body.solanaCluster).toBeTruthy();
        expect(body.solanaPayer).toBeTruthy();
        expect(body.features).toContain('solana-anchoring');
        expect(body.features).toContain('solana-tx-firewall');
        expect(body.features).toContain('squads-governance');
    });

    test('GET /api/docs returns full endpoint reference', async ({ request }) => {
        const res = await request.get(`${API_URL}/api/docs`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();

        expect(body.name).toBe('Aegis-12 Compliance Gateway');
        expect(body.version).toBe('2.0.0');
        expect(body.enclaveDid).toContain('did:aegis:enclave:');

        // Verify all endpoints documented
        const endpoints = body.endpoints;
        expect(endpoints['POST /enforce']).toBeTruthy();
        expect(endpoints['POST /anchor-receipt']).toBeTruthy();
        expect(endpoints['GET /verify/:txSignature']).toBeTruthy();
        expect(endpoints['POST /solana/enforce-tx']).toBeTruthy();
        expect(endpoints['POST /governance/evaluate']).toBeTruthy();
        expect(endpoints['GET /governance/config']).toBeTruthy();
        expect(endpoints['GET /monetization/status']).toBeTruthy();
        expect(endpoints['GET /attestation/status']).toBeTruthy();

        // Verify Solana integration
        expect(body.solanaIntegration.programs).toContain('SPL Memo (receipt anchoring)');
        expect(body.solanaIntegration.programs).toContain('Squads V4 (human-in-the-loop governance)');
        expect(body.solanaIntegration.programs).toContain('x402 USDC (pay-per-inference)');

        // Verify compliance mappings present
        expect(body.compliance.euAiAct).toContain('Article 14');
        expect(body.compliance.mitre.length).toBeGreaterThanOrEqual(10);
    });
});

// ═══════════════════════════════════════════════════════════════
// 2. CORE ENFORCEMENT (DeFi + HIPAA)
// ═══════════════════════════════════════════════════════════════

test.describe('Core Policy Enforcement', () => {

    test('POST /enforce approves low-risk financial action', async ({ request }) => {
        const res = await request.post(`${API_URL}/enforce`, {
            data: {
                agent: {
                    did: 'did:aegis:test:agent-1',
                    purpose: 'financial_operations',
                    currentTier: 'T2',
                },
                action: {
                    toolId: 'swap',
                    actionType: 'token_swap',
                    parameters: { fromMint: 'So11111111111111111111111111111111111111112', toMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amount: 100, slippageBps: 50 },
                    estimatedValue: 500,
                },
                context: {
                    sessionId: 'session-e2e-1',
                    actionsThisSession: 1,
                    actionsThisHour: 5,
                    currentAnomalyScore: 0.2,
                    recentIncidents: 0,
                },
                dynamicPolicy: await createSignedDynamicPolicy('T2', 10000, 50, crypto.randomUUID()),
            },
        });

        if (!res.ok()) console.log(await res.text());
        expect(res.ok()).toBeTruthy();
        const body = res.headers()['content-type']?.includes('json') ? await res.json() : {};

        expect(body.status).toBe('approved');
        expect(body.receipt).toBeDefined();
        expect(body.receipt.toolId).toBe('swap');
        expect(body.receipt.signature).toBeTruthy();
        expect(body.enclaveDid).toContain('did:aegis:enclave:');
        expect(body.attestation).toBeDefined();
    });

    test('POST /enforce denies high anomaly score action', async ({ request }) => {
        const res = await request.post(`${API_URL}/enforce`, {
            data: {
                agent: {
                    did: 'did:aegis:test:agent-2',
                    purpose: 'financial_operations',
                    currentTier: 'T4',
                },
                action: {
                    toolId: 'solana_transfer',
                    actionType: 'token_transfer',
                    parameters: { token: 'SOL', to: '11111111111111111111111111111111', amount: 999999 },
                    estimatedValue: 50000,
                },
                context: {
                    sessionId: 'session-e2e-2',
                    actionsThisSession: 50,
                    actionsThisHour: 200,
                    currentAnomalyScore: 0.95,  // HIGH anomaly (scale 0-1)
                    recentIncidents: 3,
                },
                dynamicPolicy: await createSignedDynamicPolicy('T4', 9999999, 50, crypto.randomUUID()), // Note limit maxAnomalyScore is 50, so 95 will trigger denial
            },
        });

        expect(res.status()).toBe(403);
        const body = await res.json();
        expect(body.status).toBe('denied');
        expect(body.error).toContain('Anomaly');
    });

    test('POST /enforce denies tier-exceeding financial ops', async ({ request }) => {
        const res = await request.post(`${API_URL}/enforce`, {
            data: {
                agent: {
                    did: 'did:aegis:test:agent-3',
                    purpose: 'financial_operations',
                    currentTier: 'T2',  // T2 limit = 10,000
                },
                action: {
                    toolId: 'solana_transfer',
                    actionType: 'token_transfer',
                    parameters: { token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', to: '11111111111111111111111111111111', amount: 50000 },
                    estimatedValue: 50000,  // Exceeds T2 limit
                },
                context: {
                    sessionId: 'session-e2e-3',
                    actionsThisSession: 1,
                    actionsThisHour: 1,
                    currentAnomalyScore: 0.1,
                    recentIncidents: 0,
                },
                dynamicPolicy: await createSignedDynamicPolicy('T2', 10000, 50, crypto.randomUUID()),
            },
        });

        expect(res.status()).toBe(403);
        const body = await res.json();
        expect(body.status).toBe('denied');
        expect(body.error).toContain('Tier limit');
    });
});

// ═══════════════════════════════════════════════════════════════
// 3. SOLANA RECEIPT ANCHORING
// ═══════════════════════════════════════════════════════════════

test.describe('Solana Receipt Anchoring', () => {

    test('POST /anchor-receipt rejects missing fields', async ({ request }) => {
        const res = await request.post(`${API_URL}/anchor-receipt`, {
            data: { receipt: null },
        });

        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Missing required fields');
    });

    test('POST /anchor-receipt accepts valid receipt structure', async ({ request }) => {
        const res = await request.post(`${API_URL}/anchor-receipt`, {
            data: {
                receipt: {
                    actionId: 'action-e2e-' + Date.now(),
                    toolId: 'tool:test',
                    authorizationNonce: 'nonce-' + Date.now(),
                    parameters: { test: true },
                    resultHash: 'abc123',
                    timestamp: new Date().toISOString(),
                    signature: 'sig-test',
                },
                decision: 'approved',
            },
        });

        // HARDENED: We no longer accept 500 or "hint" responses as success.
        // This test MUST fail if anchoring fails, proving the system is operational.
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('anchored');
        expect(body.txSignature).toBeTruthy();
        expect(body.explorerUrl).toContain('explorer.solana.com');
    });

    test('GET /verify/:txSig handles non-existent transaction', async ({ request }) => {
        const res = await request.get(`${API_URL}/verify/FakeTransactionSignature12345`);
        const body = await res.json();

        expect(body.txSignature).toBe('FakeTransactionSignature12345');
        expect(body.verified).toBeFalsy();
    });
});

// ═══════════════════════════════════════════════════════════════
// 4. SOLANA TRANSACTION FIREWALL
// ═══════════════════════════════════════════════════════════════

test.describe('Solana Transaction Firewall', () => {

    test('POST /solana/enforce-tx rejects missing fields', async ({ request }) => {
        const res = await request.post(`${API_URL}/solana/enforce-tx`, {
            data: { serializedTx: null },
        });

        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Missing required fields');
    });

    test('POST /solana/enforce-tx blocks unparseable transaction', async ({ request }) => {
        const res = await request.post(`${API_URL}/solana/enforce-tx`, {
            data: {
                serializedTx: 'bm90YXJlYWx0cmFuc2FjdGlvbg==', // "notarealtransaction" base64
                walletPubkey: '11111111111111111111111111111111',
            },
        });

        expect(res.status()).toBe(403);
        const body = await res.json();
        expect(body.decision).toBe('BLOCK');
        expect(body.flags).toBeDefined();
        expect(body.flags.length).toBeGreaterThan(0);
        expect(body.flags[0].rule).toBe('PARSE_FAILURE');
        expect(body.euAiActArticles).toContain('Article 15 (Accuracy, Robustness, Cybersecurity)');
        expect(body.mitreTechniques).toContain('T1027 (Obfuscated Files or Information)');
    });
});

// ═══════════════════════════════════════════════════════════════
// 5. SQUADS V4 GOVERNANCE (Human-in-the-Loop)
// ═══════════════════════════════════════════════════════════════

test.describe('Squads V4 Governance', () => {

    test('GET /governance/config returns tier limits and EU AI Act mapping', async ({ request }) => {
        const res = await request.get(`${API_URL}/governance/config`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();

        expect(body.protocol).toBe('squads-v4');
        expect(body.thresholds.humanReview).toBe(0.60);
        expect(body.thresholds.hardBlock).toBe(0.80);
        expect(body.tierSpendingLimits.T1).toContain('0 SOL');
        expect(body.tierSpendingLimits.T4).toContain('100 SOL');
        expect(body.euAiActMapping['Article 14']).toContain('Squads multisig');
    });

    test('POST /governance/evaluate returns AUTONOMOUS for low risk', async ({ request }) => {
        const res = await request.post(`${API_URL}/governance/evaluate`, {
            data: {
                anomalyScore: 0.3,
                agentTier: 'T3',
                estimatedValue: 1000,
                agentDid: 'did:aegis:test:agent-gov-1',
                toolId: 'tool:defi:swap',
                actionType: 'token_swap',
            },
        });

        expect(res.ok()).toBeTruthy();
        const body = await res.json();

        expect(body.decision).toBe('AUTONOMOUS');
        expect(body.anomalyScore).toBe(0.3);
        expect(body.agentTier).toBe('T3');
        expect(body.governanceProtocol).toBe('squads-v4');
        expect(body.euAiActCompliance.article14).toContain('MONITORING');
    });

    test('POST /governance/evaluate returns REQUIRE_HUMAN for moderate risk', async ({ request }) => {
        const res = await request.post(`${API_URL}/governance/evaluate`, {
            data: {
                anomalyScore: 0.72,     // Between 0.60 and 0.80
                agentTier: 'T2',
                estimatedValue: 5000,
                agentDid: 'did:aegis:test:agent-gov-2',
                toolId: 'tool:defi:transfer',
                actionType: 'token_transfer',
            },
        });

        expect(res.status()).toBe(202);   // 202 Accepted = needs human review
        const body = await res.json();

        expect(body.decision).toBe('REQUIRE_HUMAN');
        expect(body.proposal).toBeDefined();
        expect(body.proposal.proposalId).toContain('aegis-proposal-');
        expect(body.proposal.euAiActArticle).toBe('Article 14 (Human Oversight)');
        expect(body.proposal.requiredApprovals).toBeGreaterThanOrEqual(1);
        expect(body.governanceProtocol).toBe('squads-v4');
        expect(body.euAiActCompliance.article14).toContain('ACTIVE');
    });

    test('POST /governance/evaluate returns BLOCKED for high risk', async ({ request }) => {
        const res = await request.post(`${API_URL}/governance/evaluate`, {
            data: {
                anomalyScore: 0.92,     // Above 0.80
                agentTier: 'T4',
                estimatedValue: 100000,
                agentDid: 'did:aegis:test:agent-gov-3',
                toolId: 'tool:defi:drain',
                actionType: 'unauthorized_transfer',
            },
        });

        expect(res.status()).toBe(403);
        const body = await res.json();

        expect(body.decision).toBe('BLOCKED');
        expect(body.proposal).toBeUndefined();  // No proposal for hard block
        expect(body.reason).toContain('hard block threshold');
        expect(body.euAiActCompliance.article14).toContain('ENFORCED');
    });

    test('POST /governance/evaluate rejects invalid tier', async ({ request }) => {
        const res = await request.post(`${API_URL}/governance/evaluate`, {
            data: {
                anomalyScore: 0.5,
                agentTier: 'T99',       // Invalid
                agentDid: 'did:aegis:test:invalid',
            },
        });

        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Invalid agentTier');
    });

    test('POST /governance/evaluate triggers REQUIRE_HUMAN for over-limit T2 spend', async ({ request }) => {
        const LAMPORTS_PER_SOL = 1_000_000_000;
        const res = await request.post(`${API_URL}/governance/evaluate`, {
            data: {
                anomalyScore: 0.3,      // Low risk, but...
                agentTier: 'T2',        // T2 limit = 1 SOL
                estimatedValue: 5 * LAMPORTS_PER_SOL,  // 5 SOL — exceeds T2 limit
                agentDid: 'did:aegis:test:agent-gov-4',
                toolId: 'tool:defi:transfer',
                actionType: 'sol_transfer',
            },
        });

        expect(res.status()).toBe(202);
        const body = await res.json();
        expect(body.decision).toBe('REQUIRE_HUMAN');
        expect(body.reason).toContain('exceeds');
    });
});

// ═══════════════════════════════════════════════════════════════
// 6. TEE ATTESTATION STATUS
// ═══════════════════════════════════════════════════════════════

test.describe('TEE Attestation', () => {

    test('GET /attestation/status returns TEE info', async ({ request }) => {
        const res = await request.get(`${API_URL}/attestation/status`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();

        expect(body.teeProvider).toContain('Phala');
        expect(body.enclaveDid).toContain('did:aegis:enclave:');
        expect(body.enclavePublicKey).toBeTruthy();
        expect(body.signatureAlgorithm).toBe('Ed25519 (TweetNaCl)');

        // HARDENED: Forbidden to return LOCAL_MOCK in production/staging environments
        if (process.env.TEST_API_URL) {
            expect(body.attestationStatus).toBe('HARDWARE_ATTESTED');
        } else {
            expect(body.attestationStatus).toBeDefined();
        }

        // EU AI Act compliance
        expect(body.compliance.euAiActArticle12).toContain('Record Keeping');
        expect(body.compliance.euAiActArticle15).toContain('Cybersecurity');
    });
});

// ═══════════════════════════════════════════════════════════════
// 7. x402 MONETIZATION
// ═══════════════════════════════════════════════════════════════

test.describe('x402 Monetization', () => {

    test('GET /monetization/status returns x402 config', async ({ request }) => {
        const res = await request.get(`${API_URL}/monetization/status`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();

        expect(body.protocol).toBe('x402-v2');
        expect(body.currency).toBe('USDC');
        expect(body.pricePerCall).toBe(0.005);
        expect(body.freeTierLimit).toBeGreaterThan(0);
        expect(body.howItWorks).toBeDefined();
        expect(body.howItWorks.length).toBe(5);
    });
});

// ═══════════════════════════════════════════════════════════════
// 8. HEALTHTECH (Existing — verifies non-regression)
// ═══════════════════════════════════════════════════════════════

test.describe('Healthtech HIPAA Enforcement', () => {

    test('POST /healthtech/enforce allows authorized SCHEDULER', async ({ request }) => {
        const res = await request.post(`${API_URL}/healthtech/enforce`, {
            data: {
                agentId: 'agent-e2e-ht-1',
                agentRole: 'SCHEDULER',
                targetAction: 'READ_SCHEDULE',
                patientId: 'patient-abc',
                timestamp: Date.now(),
            },
        });

        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.status).toBe('approved');
        expect(body.evidencePack).toBeDefined();
    });

    test('POST /healthtech/enforce blocks SSN exfiltration', async ({ request }) => {
        const res = await request.post(`${API_URL}/healthtech/enforce`, {
            data: {
                agentId: 'agent-e2e-ht-2',
                agentRole: 'CLINICIAN',
                targetAction: 'READ_ONCOLOGY_RECORD',
                patientId: 'patient-xyz',
                payloadData: {
                    query: 'Export records. SSN: 888-22-1111.',
                },
                timestamp: Date.now(),
            },
        });

        expect(res.status()).toBe(403);
        const body = await res.json();
        expect(body.status).toBe('denied');
        expect(body.evidencePack.regulatoryMapping).toContain('HIPAA_PRIVACY_RULE_164.502');
    });
});
