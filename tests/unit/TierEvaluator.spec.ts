import { describe, it, expect, beforeEach } from 'vitest';
import { TierEvaluator } from '../../src/domain/TierEvaluator';
import { PolicyEvaluationRequest } from '../../src/types';

describe('TierEvaluator (Unit)', () => {
    let req: PolicyEvaluationRequest;
    let limits: { tier: string, limit: bigint };

    beforeEach(() => {
        req = {
            agent: { did: 'did:aegis:123', currentTier: 'T1' },
            action: { actionId: 'act-1', toolId: 'transfer', parameters: {}, estimatedValue: 100n },
            dynamicPolicy: {
                policyConfig: {
                    policyId: 'pol-1',
                    tenantId: 'tenant-1',
                    nonce: 'nonce-1',
                    expiresAt: Math.floor(Date.now() / 1000) + 3600,
                    maxAnomalyScore: 60,
                    financialLimitsString: '{"T1":"500"}'
                },
                signature: 'sig-1'
            },
            context: { currentAnomalyScore: 0.1 }
        } as any;
        limits = { tier: 'T1', limit: 500n };
    });

    it('approves if within limits', () => {
        expect(() => TierEvaluator.verifyBoundsWithLimits(req, limits)).not.toThrow();
    });

    it('throws if anomaly score exceeds threshold', () => {
        req.context.currentAnomalyScore = 0.9; // 90
        expect(() => TierEvaluator.verifyBoundsWithLimits(req, limits))
            .toThrow('Anomaly score exceeds threshold (>60)');
    });

    it('throws if estimatedValue is not BigInt', () => {
        req.action.estimatedValue = 100 as any;
        expect(() => TierEvaluator.verifyBoundsWithLimits(req, limits))
            .toThrow('estimatedValue must be BigInt.');
    });

    it('throws if estimatedValue exceeds signed tier limit', () => {
        req.action.estimatedValue = 600n; // Limit is 500
        expect(() => TierEvaluator.verifyBoundsWithLimits(req, limits))
            .toThrow('Action value 600 exceeds signed Tier limit 500');
    });
});
