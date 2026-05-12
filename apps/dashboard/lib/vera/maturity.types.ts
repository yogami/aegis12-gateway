/**
 * VERA Trust Tier Model — Agent Autonomy Levels
 * Implements the Intern → Junior → Senior → Principal progression
 * per VERA specification.
 *
 * @see https://cloudsecurityalliance.org/blog/2026/02/02/the-agentic-trust-framework-zero-trust-governance-for-ai-agents
 */

// ─── Maturity Levels ───

export type AgentMaturityLevel = 'intern' | 'junior' | 'senior' | 'principal';

export const MATURITY_LEVELS: AgentMaturityLevel[] = ['intern', 'junior', 'senior', 'principal'];

export const MATURITY_LEVEL_META: Record<AgentMaturityLevel, {
    label: string;
    autonomy: string;
    humanInvolvement: string;
    awsScope: string;
    minTimeAtLevelDays: number;
}> = {
    intern: {
        label: 'Intern (Observe Only)',
        autonomy: 'Observe + Report',
        humanInvolvement: 'Continuous oversight',
        awsScope: 'Scope 1 (No Agency)',
        minTimeAtLevelDays: 14,
    },
    junior: {
        label: 'Junior (Recommend + Approve)',
        autonomy: 'Recommend + Approve',
        humanInvolvement: 'Human approves all actions',
        awsScope: 'Scope 2 (Prescribed Agency)',
        minTimeAtLevelDays: 28,
    },
    senior: {
        label: 'Senior (Act + Notify)',
        autonomy: 'Act + Notify',
        humanInvolvement: 'Post-action notification',
        awsScope: 'Scope 3 (Supervised Agency)',
        minTimeAtLevelDays: 56,
    },
    principal: {
        label: 'Principal (Autonomous)',
        autonomy: 'Autonomous within domain',
        humanInvolvement: 'Strategic oversight only',
        awsScope: 'Scope 4 (Full Agency)',
        minTimeAtLevelDays: 0, // Terminal level
    },
};

// ─── Agent with Maturity ───

export interface AgentMaturity {
    agentId: string;
    currentLevel: AgentMaturityLevel;
    promotedAt: string; // ISO timestamp of last promotion
    levelHistory: LevelTransition[];
    incidentCount: number;
    criticalIncidentCount: number;
    recommendationAccuracy?: number; // 0-100
    availability?: number; // 0-100 (e.g., 99.5)
}

export interface LevelTransition {
    from: AgentMaturityLevel;
    to: AgentMaturityLevel;
    timestamp: string;
    approvedBy: string;
    gateResults: PromotionGateResults;
}

// ─── Promotion Gates (VERA Paper §6) ───

export interface PromotionGateResults {
    gate1_performance: GateResult;
    gate2_security: GateResult;
    gate3_businessValue: GateResult;
    gate4_incidentRecord: GateResult;
    gate5_governanceSignoff: GateResult;
}

export interface GateResult {
    passed: boolean;
    score?: number;
    details: string;
    evaluatedAt: string;
}
