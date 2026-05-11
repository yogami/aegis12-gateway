import { AegisSDK } from '../../packages/aegis12-sdk/src/AegisSDK';
import { describe, it, expect } from 'vitest';

describe('AegisSDK Client Tests', () => {
    it('should correctly build payload including mandateSignature (Zero-Custody Enforcement)', () => {
        const config = {
            agentId: 'test-agent',
            tenantId: 'test-tenant',
            mandateSignature: '0xabc123',
            gatewayUrl: 'http://localhost'
        };
        const intent = { toolId: 'test_transfer', parameters: { amount: 100 } };
        
        // Use a sneaky trick to access the private static method for testing
        const payload = (AegisSDK as any)._buildPayload(intent, config);
        
        expect(payload.mandateSignature).toBeDefined();
        expect(payload.mandateSignature).toEqual('0xabc123');
        expect(payload.agent.id).toEqual('test-agent');
        expect(payload.agent.tenantId).toEqual('test-tenant');
    });

    it('should map approved response to ALLOW', () => {
        const mockGatewayResponse = { status: 'approved', ledger_tx: '0xTx', attestation: '0xAttest' };
        const result = (AegisSDK as any)._formatResponse(mockGatewayResponse);
        expect(result.decision).toEqual('ALLOW');
        expect(result.status).toEqual('approved');
    });

    it('should map escalated response to ESCALATED', () => {
        const mockGatewayResponse = { status: 'escalated', ars_anchor: '0xEnvelope' };
        const result = (AegisSDK as any)._formatResponse(mockGatewayResponse);
        expect(result.decision).toEqual('ESCALATED');
        expect(result.status).toEqual('escalated');
    });

    it('should deny response if status is neither approved nor escalated', () => {
        const mockGatewayResponse = { status: 'rejected', error: 'Fraud detected' };
        expect(() => {
            (AegisSDK as any)._formatResponse(mockGatewayResponse);
        }).toThrow(/Aegis Fiduciary Escrow Denied/);
    });
});
