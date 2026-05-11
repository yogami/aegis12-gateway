import { AegisSDK } from '../../packages/aegis12-sdk/src/AegisSDK';
import { describe, it, expect } from 'vitest';

describe('AegisSDK Client Tests', () => {
    it('should require gatewayUrl (no silent default)', async () => {
        await expect(
            AegisSDK.signAndExecute(
                { toolId: 'test', parameters: { to: 'x', amount: 1, token: 'USDC' } },
                { agentId: 'a', tenantId: 't', mandateSignature: 's', gatewayUrl: '' },
            ),
        ).rejects.toThrow(/gatewayUrl is required/);
    });

    it('should require mandateSignature (no MockSignature fallback)', async () => {
        await expect(
            AegisSDK.signAndExecute(
                { toolId: 'test', parameters: { to: 'x', amount: 1, token: 'USDC' } },
                { agentId: 'a', tenantId: 't', mandateSignature: '', gatewayUrl: 'http://localhost' },
            ),
        ).rejects.toThrow(/mandateSignature is required/);
    });

    it('should correctly build payload with fail-closed anomaly score', () => {
        const config = {
            agentId: 'test-agent',
            tenantId: 'test-tenant',
            mandateSignature: '0xabc123',
            gatewayUrl: 'http://localhost',
        };
        const intent = { toolId: 'test_transfer', parameters: { to: 'addr', amount: 100, token: 'USDC' } };

        // Access private method for testing
        const payload = (AegisSDK as any)._buildPayload(intent, config);

        expect(payload.mandateSignature).toBe('0xabc123');
        expect(payload.agent.id).toBe('test-agent');
        expect(payload.agent.tenantId).toBe('test-tenant');
        // Fail-closed: default anomaly score must be 1.0, not 0.5
        expect(payload.context.currentAnomalyScore).toBe(1.0);
    });

    it('should map approved response to ALLOW', () => {
        const mockResponse = { status: 'approved', ledger_tx: '0xTx', attestation: '0xAttest' };
        const result = (AegisSDK as any)._formatResponse(mockResponse);
        expect(result.decision).toBe('ALLOW');
        expect(result.status).toBe('approved');
        expect(result.tx_hash).toBe('0xTx');
    });

    it('should map escalated response to ESCALATED', () => {
        const mockResponse = { status: 'escalated', ars_anchor: { domain: 'test' } };
        const result = (AegisSDK as any)._formatResponse(mockResponse);
        expect(result.decision).toBe('ESCALATED');
        expect(result.envelope).toEqual({ domain: 'test' });
    });

    it('should throw on rejected response', () => {
        const mockResponse = { status: 'rejected', error: 'Fraud detected' };
        expect(() => (AegisSDK as any)._formatResponse(mockResponse)).toThrow(/Fraud detected/);
    });

    it('should not have a withAegis method (dead code removed)', () => {
        expect((AegisSDK as any).withAegis).toBeUndefined();
    });
});
