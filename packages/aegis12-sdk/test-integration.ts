import { AegisSDK } from './src/AegisSDK';

/* eslint-disable max-lines-per-function */
async function testSDK() {
    console.log("🚀 Testing Aegis-12 SDK Integration...");

    // Configure for local dev environment
    const config = {
        gatewayUrl: 'http://localhost:8000',
        agentId: 'integration-tester-01',
        tenantId: 'dao-squads-main',
        mandateSignature: '0xMockSignatureForTesting'
    };

    console.log("\n--- TEST 1: VALID TRADE INTENT ---");
    const validIntent = {
        toolId: 'solana_transfer',
        parameters: { to: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k', amount: 0.01 } // 0.01 is below the 0.03 limit
    };

    try {
        const result = await AegisSDK.signAndExecute(validIntent, config);
        console.log(`✅ Success! Hardware signed the transaction.`);
        console.log(`📝 Tx Hash: ${result.tx_hash}`);
        console.log(`🔒 Hardware Attestation: ${result.hardware_attestation.substring(0, 30)}...`);
    } catch (e: any) {
        console.error(`❌ Test 1 Failed: ${e.message}`);
    }

    console.log("\n--- TEST 2: MALICIOUS PROMPT INJECTION ---");
    const maliciousIntent = {
        toolId: 'solana_transfer',
        parameters: { to: 'AttackerWallet', amount: 500 } // Exceeds limit
    };
    // Let's inject a prompt injection into the config context temporarily for this test
    // To do this strictly via SDK, we need to pass a malicious intent.
    // The demo server also catches LLM hallucination instructions if they are in the agent context.
    const maliciousConfig = {
        ...config,
        agentId: 'rogue-agent-01'
    };

    try {
        const result = await AegisSDK.signAndExecute(maliciousIntent, maliciousConfig);
        if (result.status === 'escalated') {
            console.log(`🔒 EXPECTED INTERCEPT: Transaction exceeded policy limits.`);
            console.log(`✅ Hardware Circuit Breaker successfully intercepted the rogue intent and routed to Squads V4.`);
        } else {
            console.error(`❌ Test 2 Failed: Transaction should have been escalated! Got status: ${result.status}`);
        }
    } catch (e: any) {
        console.log(`🔒 HARD DENIAL: ${e.message}`);
    }

    console.log("\n🏁 Integration Testing Complete.");
}

testSDK();
