import { PolicyEvaluationRequest } from '../types';
import { TerminalRefusalError } from '../errors';

/**
 * [EXTREME QUALITY] TierEvaluator
 * Cyclomatic Complexity: <= 3 per method.
 */
export class TierEvaluator {
    /**
     * Full bounds check: anomaly score + tier limit.
     * Use for autonomous (non-escalated) transactions where both checks apply.
     */
    public static verifyBoundsWithLimits(request: PolicyEvaluationRequest, limits: { tier: string, limit: bigint }): void {
        this.validateAnomalyScore(request.context?.currentAnomalyScore, request.dynamicPolicy?.policyConfig?.maxAnomalyScore);
        this.validateValueAgainstLimit(request.action.estimatedValue, limits.limit);
    }

    /**
     * [PHASE 1 - Pre-Escalation] Anomaly score check only.
     * MUST run before the Article 14 escalation decision.
     * Tier limit is NOT checked here — high-value txns must escalate, not be flat-denied.
     */
    public static verifyAnomalyOnly(request: PolicyEvaluationRequest): void {
        this.validateAnomalyScore(request.context?.currentAnomalyScore, request.dynamicPolicy?.policyConfig?.maxAnomalyScore);
    }

    /**
     * [PHASE 2 - Post-Escalation] Tier spending limit check only.
     * Only called for non-escalated (autonomous) transactions.
     */
    public static verifyValueLimit(request: PolicyEvaluationRequest, limits: { tier: string, limit: bigint }): void {
        this.validateValueAgainstLimit(request.action.estimatedValue, limits.limit);
    }

    private static validateAnomalyScore(current: any, max: any): void {
        const currentNumeric = (current || 0) * 100;
        const maxNumeric = max || 0;
        if (currentNumeric > maxNumeric) throw new Error(`Anomaly score exceeds threshold (>${maxNumeric})`);
    }

    private static validateValueAgainstLimit(value: any, limit: bigint): void {
        if (typeof value !== 'bigint') throw new TerminalRefusalError('estimatedValue must be BigInt.');
        if (value > limit) throw new Error(`Action value ${value} exceeds signed Tier limit ${limit}`);
    }
}
