import { describe, it, expect } from 'vitest';
import { TierEvaluator } from '../../src/domain/TierEvaluator';
import { PolicyEvaluationRequest } from '../../src/types';

describe('TierEvaluator (Unit)', () => {

    const baseRequest: PolicyEvaluationRequest = {
        agent: {
            did: 'did:sol:test',
            currentTier: 'T2',
            capabilities: []
        },
        context: {
            currentAnomalyScore: 0.5,
            sessionId: 'ses-1'
        },
        action: {
            toolId: 'test_tool',
            parameters: {},
            estimatedValue: 100
        },
        dynamicPolicy: {
            signature: 'sig',
            policyConfig: {
                policyId: 'pol-1',
                tenantId: 'tenant-1',
                nonce: 'nonce-1',
                maxAnomalyScore: 60,
                expiresAt: Math.floor(Date.now() / 1000) + 3600,
                financialLimitsString: JSON.stringify({ T2: 500 })
            }
        }
    };

    it('passes verification with valid bounds', () => {
        expect(() => TierEvaluator.verifyBounds(baseRequest)).not.toThrow();
    });

    it('throws if maxAnomalyScore is NaN', () => {
        const req = structuredClone(baseRequest);
        req.dynamicPolicy!.policyConfig.maxAnomalyScore = 'invalid' as any;
        expect(() => TierEvaluator.verifyBounds(req))
            .toThrow('[TERMINAL REFUSAL] maxAnomalyScore is missing or mathematically invalid. Fail-closed.');
    });

    it('throws if anomaly score exceeds threshold', () => {
        const req = structuredClone(baseRequest);
        req.context.currentAnomalyScore = 0.9; // 90
        expect(() => TierEvaluator.verifyBounds(req))
            .toThrow('Anomaly score exceeds Dynamic TEE threshold (>60)');
    });

    it('throws if financialLimitsString exceeds 1024 bytes', () => {
        const req = structuredClone(baseRequest);
        req.dynamicPolicy!.policyConfig.financialLimitsString = '{"T2": 500}' + ' '.repeat(1025);
        expect(() => TierEvaluator.verifyBounds(req))
            .toThrow('financialLimitsString exceeds 1024 byte safety bound (parser bomb defense)');
    });

    it('throws if financialLimitsString is empty object', () => {
        const req = structuredClone(baseRequest);
        req.dynamicPolicy!.policyConfig.financialLimitsString = '{}';
        expect(() => TierEvaluator.verifyBounds(req))
            .toThrow('[TERMINAL REFUSAL] Empty financial limits string explicitly forbidden. Fail-closed.');
    });

    it('throws if financialLimitsString has multiple tiers', () => {
        const req = structuredClone(baseRequest);
        req.dynamicPolicy!.policyConfig.financialLimitsString = JSON.stringify({ T1: 100, T2: 500 });
        expect(() => TierEvaluator.verifyBounds(req))
            .toThrow('[TERMINAL REFUSAL] Multi-tier limit objects are structurally unsafe. Signature must mathematically lock exactly one Tier attribute.');
    });

    it('throws if agent tier does not match signed tier', () => {
        const req = structuredClone(baseRequest);
        req.agent!.currentTier = 'T1';
        expect(() => TierEvaluator.verifyBounds(req))
            .toThrow("[TERMINAL REFUSAL] Agent tier 'T1' does not perfectly match signed Tier 'T2'. Identity Spoofing Detected. Default-deny.");
    });

    it('throws if estimatedValue is undefined', () => {
        const req = structuredClone(baseRequest);
        req.action.estimatedValue = undefined;
        expect(() => TierEvaluator.verifyBounds(req))
            .toThrow('[TERMINAL REFUSAL] estimatedValue missing or invalid type');
    });

    it('throws if estimatedValue exceeds signed tier limit', () => {
        const req = structuredClone(baseRequest);
        req.action.estimatedValue = 600; // Limit is 500
        expect(() => TierEvaluator.verifyBounds(req))
            .toThrow('Action value 600 exceeds mathematically signed Tier limit 500');
    });
});
