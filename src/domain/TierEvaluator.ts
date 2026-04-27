import { PolicyEvaluationRequest } from '../types';
import { TerminalRefusalError } from '../errors';

/**
 * [EXTREME QUALITY] TierEvaluator
 * Cyclomatic Complexity: <= 3 per method.
 */
export class TierEvaluator {
    public static verifyBoundsWithLimits(request: PolicyEvaluationRequest, limits: { tier: string, limit: bigint }): void {
        this.validateAnomalyScore(request.context?.currentAnomalyScore, request.dynamicPolicy?.policyConfig?.maxAnomalyScore);
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
