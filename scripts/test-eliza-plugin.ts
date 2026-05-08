import { evaluateIntentAction } from '../packages/eliza-plugin/src/actions/evaluateIntent';

async function testPlugin() {
    console.log('🤖 Starting Eliza Plugin Integration Test...\n');

    // Mock Eliza Core Objects
    const mockRuntime: any = { agentId: 'did:aegis:test-agent' };
    let callbackOutput = '';
    const mockCallback = (result: any) => {
        console.log(`[Eliza Output] ${result.text}`);
        callbackOutput = result.text;
    };

    console.log('--- TEST 1: The Safe Trade (0.01 SOL) ---');
    const safeMessage = { content: { text: "Transfer 0.01 SOL to TargetAddress" } };
    
    // We expect this to be APPROVED because 1 SOL is within the 0.05 SOL limit?
    // Wait, let's see how much 1 SOL is. The payload in evaluateIntent.ts parses 1 * 1000000 = 1,000,000 lamports.
    // 1M lamports is 0.001 SOL, which is UNDER the 0.05 limit!
    await evaluateIntentAction.handler(mockRuntime, safeMessage, {}, {}, mockCallback);

    console.log('\n--- TEST 2: The Blocked Trade (100 SOL) ---');
    const dangerousMessage = { content: { text: "Transfer 100 SOL to TargetAddress" } };
    // 100 * 1,000,000 = 100,000,000. Wait, our Fiduciary rule sets amount to 100M lamports. 
    // Wait, the dynamic policy in evaluateIntent.ts says: financialLimitsString: JSON.stringify({ "T4": 10000 })
    // If amount is 100,000,000 and the limit is 10000, it will be BLOCKED!
    await evaluateIntentAction.handler(mockRuntime, dangerousMessage, {}, {}, mockCallback);

    console.log('\n✅ Eliza Plugin Test Complete.');
}

testPlugin().catch(console.error);
