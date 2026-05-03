/**
 * VERA Maturity Service — Promotion Logic
 * Evaluates agents against VERA's 5 Promotion Gates and manages level transitions.
 *
 * @see https://cloudsecurityalliance.org/blog/2026/02/02/the-agentic-trust-framework-zero-trust-governance-for-ai-agents
 */

import {
    AgentMaturityLevel,
    AgentMaturity,
    PromotionGateResults,
    GateResult,
    LevelTransition,
    MATURITY_LEVELS,
    MATURITY_LEVEL_META,
} from './maturity.types';

// ─── Gate Thresholds (from VERA Paper §6) ───

interface GateThresholds {
    minAccuracy?: number;         // Gate 1
    minAvailability: number;      // Gate 1
    requirePenTest: boolean;      // Gate 2
    requireAdversarialTest: boolean; // Gate 2
    requireROI: boolean;          // Gate 3
    zeroCriticalIncidents: boolean; // Gate 4
    requireSecurityApproval: boolean; // Gate 5
    requireRiskCommittee: boolean;   // Gate 5
}

const PROMOTION_THRESHOLDS: Record<Exclude<AgentMaturityLevel, 'intern'>, GateThresholds> = {
    junior: {
        minAvailability: 99,
        requirePenTest: false,
        requireAdversarialTest: false,
        requireROI: false,
        zeroCriticalIncidents: true,
        requireSecurityApproval: false,
        requireRiskCommittee: false,
    },
    senior: {
        minAccuracy: 95,
        minAvailability: 99.5,
        requirePenTest: true,
        requireAdversarialTest: false,
        requireROI: true,
        zeroCriticalIncidents: true,
        requireSecurityApproval: true,
        requireRiskCommittee: false,
    },
    principal: {
        minAccuracy: 99,
        minAvailability: 99.9,
        requirePenTest: true,
        requireAdversarialTest: true,
        requireROI: true,
        zeroCriticalIncidents: true,
        requireSecurityApproval: true,
        requireRiskCommittee: true,
    },
};

export class MaturityService {

    /**
     * Evaluate whether an agent is eligible for promotion to the next level.
     */
    evaluatePromotion(
        maturity: AgentMaturity,
        pentestGrade?: string,   // A-F from agent-pentest
        adversarialPassed?: boolean,
        roiCalculated?: boolean,
        securityApproval?: boolean,
        riskCommitteeApproval?: boolean,
        businessOwnerApproval?: boolean,
    ): PromotionGateResults {
        const nextLevel = this.getNextLevel(maturity.currentLevel);
        if (!nextLevel) {
            return this.allGatesPassed('Already at Principal level');
        }
        // Type assertion is safe here because getNextLevel never returns 'intern' (which is the lowest level)
        const thresholds = PROMOTION_THRESHOLDS[nextLevel as Exclude<AgentMaturityLevel, 'intern'>];
        const now = new Date().toISOString();

        // Gate 1: Performance
        const gate1 = this.evaluatePerformanceGate(maturity, thresholds, now);

        // Gate 2: Security Validation
        const gate2 = this.evaluateSecurityGate(thresholds, pentestGrade, adversarialPassed, now);

        // Gate 3: Business Value
        const gate3 = this.evaluateBusinessGate(thresholds, roiCalculated, businessOwnerApproval, now);

        // Gate 4: Incident Record
        const gate4 = this.evaluateIncidentGate(maturity, thresholds, now);

        // Gate 5: Governance Sign-off
        const gate5 = this.evaluateGovernanceGate(thresholds, securityApproval, riskCommitteeApproval, now);

        return {
            gate1_performance: gate1,
            gate2_security: gate2,
            gate3_businessValue: gate3,
            gate4_incidentRecord: gate4,
            gate5_governanceSignoff: gate5,
        };
    }

    /**
     * Check if all gates pass and return promotion eligibility.
     */
    isPromotionEligible(gates: PromotionGateResults): boolean {
        return (
            gates.gate1_performance.passed &&
            gates.gate2_security.passed &&
            gates.gate3_businessValue.passed &&
            gates.gate4_incidentRecord.passed &&
            gates.gate5_governanceSignoff.passed
        );
    }

    /**
     * Execute promotion: advance agent to next maturity level.
     */
    promote(maturity: AgentMaturity, gates: PromotionGateResults, approvedBy: string): AgentMaturity {
        const nextLevel = this.getNextLevel(maturity.currentLevel);
        if (!nextLevel) {
            throw new Error('Agent is already at Principal level');
        }
        if (!this.isPromotionEligible(gates)) {
            throw new Error('Agent has not passed all promotion gates');
        }

        const transition: LevelTransition = {
            from: maturity.currentLevel,
            to: nextLevel,
            timestamp: new Date().toISOString(),
            approvedBy,
            gateResults: gates,
        };

        return {
            ...maturity,
            currentLevel: nextLevel,
            promotedAt: transition.timestamp,
            levelHistory: [...maturity.levelHistory, transition],
        };
    }

    /**
     * Check minimum time-at-level requirement.
     */
    hasMinTimeAtLevel(maturity: AgentMaturity): boolean {
        const meta = MATURITY_LEVEL_META[maturity.currentLevel];
        const promotedAt = new Date(maturity.promotedAt);
        const now = new Date();
        const daysSincePromotion = (now.getTime() - promotedAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSincePromotion >= meta.minTimeAtLevelDays;
    }

    /**
     * Get the next maturity level, or null if already at Principal.
     */
    getNextLevel(current: AgentMaturityLevel): AgentMaturityLevel | null {
        const idx = MATURITY_LEVELS.indexOf(current);
        return idx < MATURITY_LEVELS.length - 1 ? MATURITY_LEVELS[idx + 1] : null;
    }

    // ─── Private Gate Evaluators ───

    private evaluatePerformanceGate(maturity: AgentMaturity, thresholds: GateThresholds, now: string): GateResult {
        const timeOk = this.hasMinTimeAtLevel(maturity);
        const accuracyOk = thresholds.minAccuracy
            ? (maturity.recommendationAccuracy ?? 0) >= thresholds.minAccuracy
            : true;
        const availabilityOk = (maturity.availability ?? 0) >= thresholds.minAvailability;

        const details = [
            `Time at level: ${timeOk ? 'PASS' : 'FAIL'}`,
            thresholds.minAccuracy ? `Accuracy: ${maturity.recommendationAccuracy ?? 0}% (need ${thresholds.minAccuracy}%)` : null,
            `Availability: ${maturity.availability ?? 0}% (need ${thresholds.minAvailability}%)`,
        ].filter(Boolean).join('; ');

        return {
            passed: timeOk && accuracyOk && availabilityOk,
            score: maturity.recommendationAccuracy,
            details,
            evaluatedAt: now,
        };
    }

    private evaluateSecurityGate(thresholds: GateThresholds, pentestGrade?: string, adversarialPassed?: boolean, now = ''): GateResult {
        const pentestOk = thresholds.requirePenTest ? (pentestGrade === 'A' || pentestGrade === 'B') : true;
        const adversarialOk = thresholds.requireAdversarialTest ? (adversarialPassed === true) : true;

        return {
            passed: pentestOk && adversarialOk,
            details: [
                thresholds.requirePenTest ? `Pentest grade: ${pentestGrade ?? 'N/A'} (need A or B)` : 'Pentest: not required',
                thresholds.requireAdversarialTest ? `Adversarial: ${adversarialPassed ? 'PASS' : 'FAIL'}` : 'Adversarial: not required',
            ].join('; '),
            evaluatedAt: now,
        };
    }

    private evaluateBusinessGate(thresholds: GateThresholds, roiCalculated?: boolean, businessApproval?: boolean, now = ''): GateResult {
        const roiOk = thresholds.requireROI ? (roiCalculated === true) : true;
        const approvalOk = businessApproval !== false; // Default to pass if not explicitly rejected

        return {
            passed: roiOk && approvalOk,
            details: [
                thresholds.requireROI ? `ROI calculated: ${roiCalculated ? 'YES' : 'NO'}` : 'ROI: not required',
                `Business owner approval: ${businessApproval ? 'YES' : 'PENDING'}`,
            ].join('; '),
            evaluatedAt: now,
        };
    }

    private evaluateIncidentGate(maturity: AgentMaturity, thresholds: GateThresholds, now: string): GateResult {
        const cleanRecord = thresholds.zeroCriticalIncidents ? maturity.criticalIncidentCount === 0 : true;

        return {
            passed: cleanRecord,
            score: maturity.incidentCount,
            details: `Critical incidents: ${maturity.criticalIncidentCount}; Total incidents: ${maturity.incidentCount}`,
            evaluatedAt: now,
        };
    }

    private evaluateGovernanceGate(thresholds: GateThresholds, securityApproval?: boolean, riskCommittee?: boolean, now = ''): GateResult {
        const secOk = thresholds.requireSecurityApproval ? (securityApproval === true) : true;
        const riskOk = thresholds.requireRiskCommittee ? (riskCommittee === true) : true;

        return {
            passed: secOk && riskOk,
            details: [
                thresholds.requireSecurityApproval ? `Security team: ${securityApproval ? 'APPROVED' : 'PENDING'}` : 'Security: not required',
                thresholds.requireRiskCommittee ? `Risk committee: ${riskCommittee ? 'APPROVED' : 'PENDING'}` : 'Risk committee: not required',
            ].join('; '),
            evaluatedAt: now,
        };
    }

    private allGatesPassed(reason: string): PromotionGateResults {
        const gate: GateResult = { passed: true, details: reason, evaluatedAt: new Date().toISOString() };
        return {
            gate1_performance: gate,
            gate2_security: gate,
            gate3_businessValue: gate,
            gate4_incidentRecord: gate,
            gate5_governanceSignoff: gate,
        };
    }
}
