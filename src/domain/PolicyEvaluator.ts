/**
 * PolicyEvaluator — Domain Service
 *
 * Pure business logic for evaluating trade intents against a ruleset.
 * Zero I/O dependencies. Cyclomatic complexity per method ≤ 3.
 *
 * SRP: Only responsible for policy evaluation and hash computation.
 */
import { createHash } from 'crypto';
import { TradeIntent } from './TradeIntent';

export interface PolicyRuleset {
    maxTradeSol: number;
    allowedDestinations: string[];
}

export interface PolicyDecisionResult {
    approved: boolean;
    reason: string;
}

export class PolicyEvaluator {
    constructor(private readonly ruleset: PolicyRuleset) {}

    evaluate(intent: TradeIntent): PolicyDecisionResult {
        if (intent.amountSol > this.ruleset.maxTradeSol) {
            return this.deny(
                `Amount ${intent.amountSol} SOL exceeds max ${this.ruleset.maxTradeSol} SOL`,
            );
        }
        if (!this.isAllowedDestination(intent.destination)) {
            return this.deny(
                `Destination ${intent.destination} is not in allowlist`,
            );
        }
        return { approved: true, reason: 'Policy check passed' };
    }

    policyHash(): string {
        const canonical = JSON.stringify(this.ruleset);
        return createHash('sha256').update(canonical).digest('hex');
    }

    private isAllowedDestination(dest: string): boolean {
        return this.ruleset.allowedDestinations.includes(dest);
    }

    private deny(reason: string): PolicyDecisionResult {
        return { approved: false, reason };
    }
}
