import { phalaEntrypoint, AegisEnclave } from '../src/application/PhalaEntrypoint';
import { Eip712Verifier } from '../src/domain/Eip712Verifier';
import { AegisGateStub } from '../src/infrastructure/AegisGateStub';

// Mock the signature validation to bypass EIP-712 check for local testing
(Eip712Verifier as any).verifySignature = () => true;

async function runHotlAudit() {
    console.log("=========================================");
    console.log("🛡️  Aegis-12 HOTL Escalation Audit");
    console.log("=========================================\n");

    // Amount > 10_000 USDC (6 decimals) triggers ESCALATE
    const maliciousPayload = {
        agent: { did: "did:key:agent123", purpose: "financial_operations", currentTier: "T2" },
        action: {
            toolId: "solana_transfer",
            actionType: "EXECUTE",
            parameters: { to: "AttackerWallet", amount: 50_000_000_000 } // 50k USDC
        },
        context: { sessionId: "session_1", actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 0.0, recentIncidents: 0 },
        dynamicPolicy: {
            policyConfig: {
                policyId: "pol_hq_treasury_01",
                tenantId: "tenant_alpha",
                crossChainTarget: "solana:devnet",
                maxAnomalyScore: 0.8,
                financialLimitsString: "{\"T2\":\"100000000000\"}", // 100k USDC limit
                expiresAt: Math.floor(Date.now() / 1000) + 3600,
                nonce: "nonce_demo_01",
                vaultPda: "VaultPDA_Test",
                squadsMultisig: "SquadsMultisig_Test",
                allowedProgramIds: ["TargetProgramID_Test"]
            },
            ownerPublicKey: "0xMockOwnerPubKey",
            signature: "0xMockSignature"
        }
    };

    console.log("[Test] 1. Agent submits a $50k transaction...");
    let resultJson;
    try {
        resultJson = await phalaEntrypoint(JSON.stringify(maliciousPayload));
    } catch (e: any) {
        console.error("FATAL ERROR IN ENTRYPOINT:", e);
        return;
    }
    const result = JSON.parse(resultJson);

    console.log(`\n[Test] 2. TEE Decision: ${result.status.toUpperCase()}`);
    if (result.error) {
        console.error(`\n[Test] Error Detail: ${result.error}`);
    }
    
    if (result.status === 'escalated') {
        console.log(`\n[Test] 3. Cryptographic Intent Envelope Generated:`);
        console.log(JSON.stringify(result.receipt.envelope, null, 2));

        console.log(`\n[Test] 4. Simulating Squads CPI into AegisGate...`);
        const envelope = result.receipt.envelope;
        const currentSlot = 100000; 
        const attestedKey = result.publicKeyHex; 
        
        try {
            AegisGateStub.verifyAndExecute(
                envelope,
                envelope.instruction_digest, // Simulating a match
                currentSlot,
                attestedKey
            );
            console.log("\n✅ SUCCESS: AegisGate execution passed with valid TEE signature.");
        } catch (e: any) {
            console.error("\n❌ FAILED:", e.message);
        }
    } else {
        console.error("Test Failed: Transaction was not escalated.");
    }
    
    process.exit(0);
}

runHotlAudit().catch((e) => {
    console.error(e);
    process.exit(1);
});
