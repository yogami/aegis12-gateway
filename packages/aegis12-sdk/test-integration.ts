import { AegisSDK } from './src/AegisSDK';
import type { AegisIntent } from './src/AegisSDK';

/* eslint-disable max-lines-per-function */
async function testSDK() {
    console.log("🚀 Testing Aegis-12 SDK Integration...");

    const gatewayUrl = process.env.AEGIS_GATEWAY_URL ?? 'http://localhost:8000';

    // Configure for local dev environment
    const config = {
        gatewayUrl,
        agentId: 'integration-tester-01',
        tenantId: 'dao-squads-main',
        mandateSignature: process.env.AEGIS_MANDATE_SIGNATURE ?? '0xTestSignature',
    };

    console.log("\n--- TEST 1: VALID TRADE INTENT ---");
    const validIntent: AegisIntent = {
        toolId: 'solana_transfer',
        parameters: { to: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k', amount: 0.01, token: 'USDC' },
    };

    try {
        const result = await AegisSDK.signAndExecute(validIntent, config);
        console.log(`✅ Success! Hardware signed the transaction.`);
        console.log(`📝 Tx Hash: ${result.tx_hash}`);
        console.log(`🔒 Hardware Attestation: ${result.hardware_attestation?.substring(0, 30)}...`);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`❌ Test 1 Failed: ${msg}`);
    }

    console.log("\n--- TEST 2: MALICIOUS PROMPT INJECTION ---");
    const maliciousIntent: AegisIntent = {
        toolId: 'solana_transfer',
        parameters: { to: 'AttackerWallet', amount: 500, token: 'USDC' },
    };
    const maliciousConfig = {
        ...config,
        agentId: 'rogue-agent-01',
    };

    try {
        const result = await AegisSDK.signAndExecute(maliciousIntent, maliciousConfig);
        if (result.status === 'escalated') {
            console.log(`🔒 EXPECTED INTERCEPT: Transaction exceeded policy limits.`);
            console.log(`✅ Hardware Circuit Breaker successfully intercepted the rogue intent.`);
        } else {
            console.error(`❌ Test 2 Failed: Should have been escalated! Got: ${result.status}`);
        }
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`🔒 HARD DENIAL: ${msg}`);
    }

    console.log("\n🏁 Integration Testing Complete.");
}

testSDK();
