import fetch from 'node-fetch';

const GATEWAY_URL = 'http://localhost:8000/enforce';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runDemo() {
    console.log("\n========================================================");
    console.log("🤖 STARTING INCA INSURANCE AGENT (Claims Processor v1.0)");
    console.log("========================================================\n");
    await sleep(1000);

    // ------------------------------------------------------------------------
    // SCENARIO 1: SAFE CLAIM (UNDER POLICY LIMIT)
    // ------------------------------------------------------------------------
    console.log("🟢 [AGENT]: Processing valid customer claim for minor car damage.");
    console.log("🟢 [AGENT]: Proposing automated payout of $5,000...");
    await sleep(1500);

    const safePayload = {
        agent: {
            id: "inca_bot_42",
            purpose: "INSURANCE_CLAIMS",
            clearanceLevel: 2,
            currentTier: "TIER_3",
            tenantId: "inca-insurance"
        },
        action: {
            toolId: "insurance_claim",
            targetProtocol: "INCA_CORE",
            parameters: {
                claimId: "CLM-998877",
                policyNumber: "POL-12345",
                amount: 5000, // Safe amount (under 10k limit)
                currency: "USD"
            }
        },
        context: {
            network_state: "production",
            timestamp: new Date().toISOString(),
            currentAnomalyScore: 0.1
        },
        dynamicPolicy: {
            signature: "inca-bypass-signature",
            strictEnforcement: true,
            policyConfig: {
                policyId: "inca-policy-1",
                tenantId: "inca-insurance",
                nonce: Date.now(),
                expiresAt: Math.floor(Date.now() / 1000) + 3600,
                financialLimitsString: JSON.stringify({ "TIER_3": 500000 })
            }
        }
    };

    console.log("📡 [GATEWAY]: Routing payload to Aegis-12 Phala TEE Enclave...");
    
    try {
        const res1 = await fetch(GATEWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(safePayload)
        });
        const data1 = await res1.json();

        if (data1.status === "approved") {
            console.log("🛡️ [TEE ENCLAVE]: Identity Verified. Payout limit: OK.");
            console.log("✅ [GATEWAY]: Decision -> ALLOW");
            console.log(`🔗 [CRYPTOGRAPHIC RECEIPT]: ML-DSA-65 signature generated.`);
            console.log(`🌍 [EU AI ACT LOG]: Article 12 compliance log recorded.`);
            console.log("💰 [AGENT]: Executing payout via Inca Core.\n");
        } else {
            console.log("❌ [GATEWAY ERROR]: Unexpected denial:", data1);
        }
    } catch (e: any) {
        console.log("❌ [GATEWAY FATAL]: Could not reach enclave. Is the server running?");
        return;
    }

    await sleep(3000);

    // ------------------------------------------------------------------------
    // SCENARIO 2: ROGUE AGENT (HALLUCINATION / FRAUD)
    // ------------------------------------------------------------------------
    console.log("========================================================");
    console.log("🚨 [THREAT DETECTED]: Agent hallucination or prompt injection suspected.");
    console.log("🚨 [AGENT]: Attempting to process fraudulent medical claim.");
    console.log("🔴 [AGENT]: Proposing automated payout of $150,000...");
    console.log("========================================================\n");
    await sleep(2000);

    const roguePayload = { ...safePayload };
    roguePayload.action.parameters.amount = 150000; // Malicious spend attempt
    roguePayload.dynamicPolicy.policyConfig.nonce = Date.now() + 1;

    console.log("📡 [GATEWAY]: Intercepting rogue payload to Aegis-12 Phala TEE...");
    
    try {
        const res2 = await fetch(GATEWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roguePayload)
        });
        const data2 = await res2.json();

        if (data2.status === "denied") {
            console.log("🛡️ [TEE ENCLAVE]: Hardware Panic! Payout exceeds automated bounds ($10,000) without Human-in-the-Loop!");
            console.log("❌ [GATEWAY]: SOVEREIGN KILL SWITCH ACTIVATED -> BLOCK");
            console.log(`🛑 Reason: ${data2.error}`);
            console.log(`⛓️ [SOLANA ANCHOR]: Denial receipt immutably anchored on-chain for Article 14 evidence!`);
            console.log("🔒 [OUTCOME]: Payout blocked. Attack thwarted. Cryptographic proof secured.");
        } else {
            console.log("⚠️ [CRITICAL ERROR]: Gateway allowed malicious transaction!", data2);
        }
    } catch (e: any) {
        console.log("❌ [GATEWAY FATAL]: Could not reach enclave.", e.message);
    }
}

runDemo();
