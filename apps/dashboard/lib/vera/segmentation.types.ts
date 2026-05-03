/**
 * VERA Pillar 3: Data Sovereignty & Segmentation — "Where can you go?"
 * Implements policy-as-code agent access control per VERA specification.
 *
 * @see https://cloudsecurityalliance.org/blog/2026/02/02/the-agentic-trust-framework-zero-trust-governance-for-ai-agents
 */

import { AgentMaturityLevel } from './maturity.types';

// ─── Policy Types ───

export interface ResourcePolicy {
    /** Glob pattern for allowed resources (e.g., "api/read/*", "db/users/select") */
    resource: string;
    /** Allowed actions on this resource */
    actions: ('read' | 'write' | 'delete' | 'execute')[];
    /** Minimum maturity level required */
    minLevel: AgentMaturityLevel;
}

export interface RateLimitPolicy {
    /** Max operations per window */
    maxOperations: number;
    /** Time window in seconds */
    windowSeconds: number;
    /** Per maturity level overrides */
    levelOverrides?: Partial<Record<AgentMaturityLevel, number>>;
}

export interface TransactionLimit {
    /** Max monetary value per transaction (cents) */
    maxValueCents: number;
    /** Max cumulative value per day (cents) */
    maxDailyCents: number;
    /** Per maturity level overrides */
    levelOverrides?: Partial<Record<AgentMaturityLevel, number>>;
}

export interface SegmentationPolicy {
    /** Agent ID this policy applies to (or "*" for default) */
    agentId: string;
    /** Human-readable policy name */
    name: string;
    /** Allowed resources and actions */
    resources: ResourcePolicy[];
    /** Rate limiting rules */
    rateLimit: RateLimitPolicy;
    /** Transaction limits */
    transactionLimit?: TransactionLimit;
    /** Blast radius containment: max cascade depth */
    maxCascadeDepth: number;
    /** Whether agent can communicate with other agents */
    allowAgentToAgent: boolean;
    /** Explicit agent denylist (agent IDs) */
    deniedAgents: string[];
}

// ─── Default Policies Per Maturity Level ───

export const DEFAULT_POLICIES: Record<AgentMaturityLevel, Omit<SegmentationPolicy, 'agentId' | 'name'>> = {
    intern: {
        resources: [
            { resource: 'api/*/read', actions: ['read'], minLevel: 'intern' },
        ],
        rateLimit: { maxOperations: 100, windowSeconds: 3600 },
        maxCascadeDepth: 0,
        allowAgentToAgent: false,
        deniedAgents: [],
    },
    junior: {
        resources: [
            { resource: 'api/*/read', actions: ['read'], minLevel: 'intern' },
            { resource: 'api/*/write', actions: ['read', 'write'], minLevel: 'junior' },
        ],
        rateLimit: { maxOperations: 500, windowSeconds: 3600 },
        maxCascadeDepth: 1,
        allowAgentToAgent: false,
        deniedAgents: [],
    },
    senior: {
        resources: [
            { resource: 'api/*', actions: ['read', 'write', 'execute'], minLevel: 'senior' },
        ],
        rateLimit: { maxOperations: 2000, windowSeconds: 3600 },
        transactionLimit: { maxValueCents: 50000, maxDailyCents: 500000 },
        maxCascadeDepth: 3,
        allowAgentToAgent: true,
        deniedAgents: [],
    },
    principal: {
        resources: [
            { resource: '*', actions: ['read', 'write', 'delete', 'execute'], minLevel: 'principal' },
        ],
        rateLimit: { maxOperations: 10000, windowSeconds: 3600 },
        transactionLimit: { maxValueCents: 500000, maxDailyCents: 5000000 },
        maxCascadeDepth: 10,
        allowAgentToAgent: true,
        deniedAgents: [],
    },
};
