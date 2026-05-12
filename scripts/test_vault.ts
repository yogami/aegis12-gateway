import { AegisController } from '../src/infrastructure/web/AegisController';
import { X402PayGate } from '../src/infrastructure/X402PayGate';
import { SquadsGovernance } from '../src/infrastructure/SquadsGovernance';

async function run() {
    const payGate = new X402PayGate({ enabled: false, pricePerCall: 0 });
    const governance = new SquadsGovernance();
    const controller = new AegisController(payGate, governance);

    console.log("1. Uploading secret policy to Vault...");
    const req1: any = {
        body: {
            tenantId: "tenant-x-123",
            policyId: "vault-policy-x402",
            sensitiveData: {
                financialLimitsString: JSON.stringify({ "T4": 1500 }), // Override to 1500
                maxAnomalyScore: 0.05
            }
        }
    };
    
    let statusCode = 200;
    const rep1: any = {
        status: (code: number) => { statusCode = code; return rep1; },
        send: (data: any) => { console.log(`Response [${statusCode}]:`, data); }
    };

    await controller.uploadVaultPolicy(req1, rep1);

    console.log("\n2. Simulating Execution via Vault...");
    
    // We send an intent that asks for a 1000 limit, but refers to vault-policy-x402
    const req2: any = {
        ip: '127.0.0.1',
        headers: {},
        body: {
            agent: { did: "did:test", purpose: "financial_operations", currentTier: "T4" },
            action: { toolId: "transfer", actionType: "execute", parameters: { amount: 1200, to: "0x123" } },
            context: { sessionId: "s1", actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 0.01 },
            dynamicPolicy: {
                policyConfig: {
                    tenantId: "tenant-x-123",
                    policyId: "vault-policy-x402",
                    maxAnomalyScore: 0.99, // weak config
                    financialLimitsString: JSON.stringify({ "T4": 500 }), // strict config 500
                    expiresAt: Math.floor(Date.now() / 1000) + 3600,
                    nonce: Date.now().toString()
                },
                ownerPublicKey: "0x0",
                signature: "sig123"
            }
        }
    };

    const rep2: any = {
        status: (code: number) => { statusCode = code; return rep2; },
        send: (data: any) => { console.log(`Response [${statusCode}]:`, data.status || data); }
    };

    // Since the vault has limits at 1500, a transfer of 1200 should be APPROVED.
    // If it didn't use the vault, it would use 500 and either escalate or fail.
    await controller.enforce(req2, rep2);
}

run().catch(console.error);
