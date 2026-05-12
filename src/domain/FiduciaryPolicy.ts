/**
 * FiduciaryPolicy — Standalone Domain Model
 *
 * A standalone, expressive policy class for evaluating agent trade intents
 * against institutional-grade fiduciary rules. Used by the Eliza Plugin
 * and the Aegis-12 Data Plane for standalone validation.
 *
 * SRP: Only responsible for evaluating an intent against a configuration.
 * Cyclomatic complexity per method ≤ 3 (sub-checks extracted).
 */

export interface FiduciaryPolicyConfig {
    policyId: string;
    maxAutonomousSol: number;
    dailyLimitSol: number;
    allowedProtocols: string[];
    allowedDestinations: string[];
    blockedTokens: string[];
    requireHumanApprovalIf: {
        newRecipient: boolean;
        amountGreaterThanSol: number;
        riskScoreGreaterThan: number;
    };
}

export interface FiduciaryDecision {
    approved: boolean;
    escalateToHuman: boolean;
    reason?: string;
}

export class FiduciaryPolicy {
    constructor(private config: FiduciaryPolicyConfig) {}

    public evaluate(
        intent: { amountSol: number; destination: string },
        dailySpentSol: number = 0,
        recipientIsNew: boolean = false,
        riskScore: number = 0,
    ): FiduciaryDecision {
        return (
            this.checkHardLimits(intent, dailySpentSol) ??
            this.checkDestination(intent) ??
            this.checkConditionalEscalation(intent, recipientIsNew, riskScore) ??
            { approved: true, escalateToHuman: false }
        );
    }

    public getConfig(): FiduciaryPolicyConfig {
        return this.config;
    }

    private checkHardLimits(
        intent: { amountSol: number },
        dailySpentSol: number,
    ): FiduciaryDecision | null {
        if (intent.amountSol > this.config.maxAutonomousSol) {
            return {
                approved: false,
                escalateToHuman: true,
                reason: `Requested amount (${intent.amountSol} SOL) exceeds max autonomous limit (${this.config.maxAutonomousSol} SOL). Routing to Squads.`,
            };
        }
        if (dailySpentSol + intent.amountSol > this.config.dailyLimitSol) {
            return {
                approved: false,
                escalateToHuman: true,
                reason: `Transaction exceeds daily VaR budget (${this.config.dailyLimitSol} SOL).`,
            };
        }
        return null;
    }

    private checkDestination(
        intent: { destination: string },
    ): FiduciaryDecision | null {
        if (this.config.allowedDestinations.length > 0 && !this.config.allowedDestinations.includes(intent.destination)) {
            return {
                approved: false,
                escalateToHuman: false,
                reason: `POLICY DENIED: Destination ${intent.destination} is not in allowlist`,
            };
        }
        return null;
    }

    private checkConditionalEscalation(
        intent: { amountSol: number },
        recipientIsNew: boolean,
        riskScore: number,
    ): FiduciaryDecision | null {
        const rules = this.config.requireHumanApprovalIf;
        if (rules.newRecipient && recipientIsNew) {
            return { approved: false, escalateToHuman: true, reason: 'New recipient detected.' };
        }
        if (intent.amountSol > rules.amountGreaterThanSol) {
            return { approved: false, escalateToHuman: true, reason: 'Amount exceeds human approval threshold.' };
        }
        if (riskScore > rules.riskScoreGreaterThan) {
            return { approved: false, escalateToHuman: true, reason: 'Transaction risk score is too high.' };
        }
        return null;
    }
}
