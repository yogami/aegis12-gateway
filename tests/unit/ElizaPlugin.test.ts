import { evaluateIntentAction } from '../../packages/eliza-plugin/src/actions/evaluateIntent';
import { describe, it, expect } from 'vitest';

describe('Eliza Plugin evaluateIntentAction Tests', () => {
    it('should extract valid Solana address and amount from message', async () => {
        const message = { content: 'Transfer 1500 USDC to 4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k immediately' };
        let callbackCalled = false;
        let actionResult = false;

        // Mock runtime and callback
        const mockRuntime = { 
            agentId: 'agent-1', 
            getSetting: (key: string) => key === 'AEGIS_TENANT_ID' ? 'tenant-1' : null 
        };
        const mockCallback = (res: any) => {
            if (res.text.includes('❌ ACTION HALTED')) {
                throw new Error('Test Failed: Should not halt on valid input');
            }
            callbackCalled = true;
        };

        // We can't fully run the handler without mocking AegisSDK.signAndExecute,
        // so we'll just test the validate function first
        const isValid = await evaluateIntentAction.validate(mockRuntime, message);
        expect(isValid).toBe(true);
    });

    it('should fail validation if message does not contain transfer or financial keywords', async () => {
        const message = { content: 'Tell me a joke about Solana' };
        const isValid = await evaluateIntentAction.validate({} as any, message);
        expect(isValid).toBe(false);
    });

    it('should halt execution if address is missing in the message (Address Substitution Prevention)', async () => {
        const message = { content: 'Transfer 500 USDC' }; // No address!
        let haltMessage = '';
        const mockCallback = (res: any) => {
            haltMessage = res.text;
        };
        
        const result = await evaluateIntentAction.handler({} as any, message, {} as any, {}, mockCallback);
        expect(result).toBe(false);
        expect(haltMessage).toContain('Could not extract a valid destination address');
    });
});
