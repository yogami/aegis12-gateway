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
    policyId?: string;
    tenantId?: string;
    maxTradeSol: number;
    escalationThresholdSol?: number;
    dailyVaRLimitSol?: number;
    allowedDestinations: string[];
    allowedProtocols?: string[];
    blockedTokens?: string[];
    requireHumanApprovalIf?: {
        newRecipient: boolean;
        amountGreaterThanSol: number;
        riskScoreGreaterThan: number;
    };
}

export interface PolicyDecisionResult {
    approved: boolean;
    escalated?: boolean;
    reason: string;
}

export class PolicyEvaluator {
    constructor(private readonly ruleset: PolicyRuleset) {}

    evaluate(
        intent: TradeIntent,
        dailySpentSol: number = 0,
        recipientIsNew: boolean = false,
        riskScore: number = 0,
    ): PolicyDecisionResult {
        return (
            this.checkHardLimits(intent, dailySpentSol) ??
            this.checkEscalation(intent) ??
            this.checkConditionalEscalation(intent, recipientIsNew, riskScore) ??
            this.checkDestination(intent) ??
            { approved: true, reason: 'Policy check passed' }
        );
    }

    policyHash(): string {
        const canonical = JSON.stringify(this.ruleset);
        return createHash('sha256').update(canonical).digest('hex');
    }

    private checkHardLimits(intent: TradeIntent, dailySpentSol: number): PolicyDecisionResult | null {
        if (intent.amountSol > this.ruleset.maxTradeSol) {
            return this.deny(`Amount ${intent.amountSol} SOL exceeds max ${this.ruleset.maxTradeSol} SOL`);
        }
        if (this.ruleset.dailyVaRLimitSol && dailySpentSol + intent.amountSol > this.ruleset.dailyVaRLimitSol) {
            return this.deny(`Transaction exceeds daily VaR budget (${this.ruleset.dailyVaRLimitSol} SOL)`);
        }
        return null;
    }

    private checkEscalation(intent: TradeIntent): PolicyDecisionResult | null {
        if (this.ruleset.escalationThresholdSol && intent.amountSol > this.ruleset.escalationThresholdSol) {
            return this.escalate(
                `Amount ${intent.amountSol} SOL requires human co-signer (exceeds ${this.ruleset.escalationThresholdSol} SOL)`,
            );
        }
        return null;
    }

    private checkConditionalEscalation(
        intent: TradeIntent,
        recipientIsNew: boolean,
        riskScore: number,
    ): PolicyDecisionResult | null {
        const rules = this.ruleset.requireHumanApprovalIf;
        if (!rules) return null;

        if (rules.newRecipient && recipientIsNew) {
            return this.escalate('New recipient detected. Routing to Squads.');
        }
        if (intent.amountSol > rules.amountGreaterThanSol) {
            return this.escalate('Amount exceeds conditional human approval threshold.');
        }
        if (riskScore > rules.riskScoreGreaterThan) {
            return this.escalate('Transaction risk score is too high.');
        }
        return null;
    }

    private checkDestination(intent: TradeIntent): PolicyDecisionResult | null {
        if (this.ruleset.allowedDestinations.length > 0 && !this.ruleset.allowedDestinations.includes(intent.destination)) {
            return this.deny(`Destination ${intent.destination} is not in allowlist`);
        }
        return null;
    }

    private escalate(reason: string): PolicyDecisionResult {
        return { approved: false, escalated: true, reason };
    }

    private deny(reason: string): PolicyDecisionResult {
        return { approved: false, reason };
    }
}
