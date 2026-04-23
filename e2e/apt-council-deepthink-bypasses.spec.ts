import { test, expect } from '@playwright/test';
import { ethers } from 'ethers';

// Fixed Test Key corresponding to address 0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A
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
        { name: "nonce", type: "string" }
    ]
};

async function createSignedPolicy(nonceStr: string, customFields: any = {}) {
    const value = {
        policyId: "POL_APT_001",
        tenantId: "tenant-e2e", 
        version: "1.0.0",
        chainId: 1399811149,
        crossChainTarget: "solana:devnet",
        maxAnomalyScore: 50,
        financialLimitsString: JSON.stringify({ "T1": 10 }),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        nonce: nonceStr,
        ...customFields
    };

    const signature = await e2eWallet._signTypedData(eip712Domain, eip712Types, value);
    return { policyConfig: value, signature };
}

function buildPayload(amount: any, policy: any, tier: string = 'T1') {
    return {
        action: {
            toolId: 'solana_transfer',
            parameters: { to: '11111111111111111111111111111111', amount, token: 'SOL' },
            estimatedValue: 1,
        },
        agent: { did: 'did:aegis:e2e', purpose: 'financial_operations', currentTier: tier },
        context: { sessionId: 'pentest', actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 0.1, recentIncidents: 0 },
        dynamicPolicy: policy,
    };
}

test.describe('APT-Council DeepThink Security Remediation Verification', () => {

    test('VULN-006: Memo Leviathan - Enclave must safely truncate large nonces and not crash', async ({ request }) => {
        // Attack: 50,000 'A' characters in the nonce
        const massiveNonce = 'A'.repeat(50000) + crypto.randomUUID();
        const policy = await createSignedPolicy(massiveNonce);

        const res = await request.post('/enforce', {
            data: buildPayload(1, policy)
        });
        
        const body = await res.json();
        console.log('VULN-006 Error:', body.error);
        
        // Before patch: The server would crash or silently bypass.
        // After patch: It should safely truncate and process, or fail with a safe rejection.
        expect(res.status()).toBe(200);
        expect(body.status).toBe('approved');
        // Ensure we aren't echoing the massive nonce back un-truncated in the actionId
        expect(body.receipt.actionId.length).toBeLessThanOrEqual(256 + 10); // 'act-' + 256
    });

    test('VULN-007: perTx Logic Collision - Fallback perTx key cannot bypass strict Tier limits', async ({ request }) => {
        // Attack: Try to bypass the strict "Gold: 1" limit by supplying a "perTx: 9999" key in the financialLimitsString
        const maliciousLimits = JSON.stringify({ "Gold": 1, "perTx": 9999 });
        const policy = await createSignedPolicy(Date.now().toString(), { financialLimitsString: maliciousLimits });

        const res = await request.post('/enforce', {
            // Spend amount is 5. If perTx works, this passes (5 < 9999). If Gold limit works, this fails (5 > 1).
            data: buildPayload(5, policy, 'Gold')
        });

        const body = await res.json();
        console.log('VULN-007 Error:', body.error);
        // Before patch: This was approved because perTx superseded Gold.
        // After patch: This must be denied because perTx is ignored.
        expect([403, 200]).toContain(res.status());
        expect(body.status).toBe('denied');
        expect(body.error).toMatch(/exceed|unsafe|structurally unsafe/i);
    });

    test('VULN-008: Infinity RangeError - Mathematically compromised amounts must be rejected', async ({ request }) => {
        // Attack: Inject an amount that evaluates to Infinity when cast to Number
        const policy = await createSignedPolicy(Date.now().toString(), { financialLimitsString: JSON.stringify({ "T1": 10000000 }) });

        const res = await request.post('/enforce', {
            data: buildPayload("9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999", policy)
        });

        const body = await res.json();
        console.log('VULN-008 Error:', body.error);
        // Before patch: Updates state with Infinity, wiping the tracking limit when serialized to JSON.
        // After patch: Throws Infinity Defense Triggered.
        expect([403, 200]).toContain(res.status());
        expect(body.status).toBe('denied');
        expect(body.error).toMatch(/Infinity|Invalid type for amount/i);
    });

    test('VULN-010: Weaponized Circuit Breaker - Validation errors do not trip the gateway', async ({ request }) => {
        // Attack: Send 15 invalid requests rapidly. The breaker should NOT flip.
        // We use a properly formed payload that will fail validation (signature mismatch).
        const promises = [];
        for (let i = 0; i < 15; i++) {
            const policyPromise = createSignedPolicy(`nonce-breaker-${i}-${crypto.randomUUID()}`).then(policy => {
                policy.signature = "0x" + "00".repeat(65);
                return request.post('/enforce', {
                    data: buildPayload(1, policy, 'T1')
                }).then(r => r.json());
            });
            promises.push(policyPromise);
        }

        const responses = await Promise.all(promises);
        const breakerTripped = responses.some(body => body.error && body.error.includes("Circuit OPEN"));

        // After DeepThink patch: The breaker only trips on infrastructure errors, not client validation errors.
        expect(breakerTripped, "Validation errors tripped the circuit breaker! (Weaponized Circuit Breaker Zero-Day)").toBe(false);

        // Verify the gateway is still healthy by sending a valid request
        const validPolicy = await createSignedPolicy(`nonce-breaker-valid-${crypto.randomUUID()}`);
        const validRes = await request.post('/enforce', {
            data: buildPayload(1, validPolicy, 'T1')
        });
        const validBody = await validRes.json();
        expect(validBody.status).toBe('approved');
    });

});
