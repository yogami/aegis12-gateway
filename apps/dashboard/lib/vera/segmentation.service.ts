/**
 * VERA Segmentation Service — Policy Enforcement Engine
 * Implements Element 4: "Where can you go?" with policy-as-code evaluation.
 *
 * @see https://cloudsecurityalliance.org/blog/2026/02/02/the-agentic-trust-framework-zero-trust-governance-for-ai-agents
 */

import { AgentMaturityLevel } from './maturity.types';
import { SegmentationPolicy, ResourcePolicy, DEFAULT_POLICIES } from './segmentation.types';

export interface AccessRequest {
    agentId: string;
    agentLevel: AgentMaturityLevel;
    resource: string;
    action: 'read' | 'write' | 'delete' | 'execute';
    /** Optional: target agent ID for A2A communication */
    targetAgentId?: string;
}

export interface AccessDecision {
    allowed: boolean;
    reason: string;
    policy: string;
    evaluatedAt: string;
}

export interface RateLimitState {
    agentId: string;
    operationCount: number;
    windowStart: string;
}

export class SegmentationService {
    private policies: Map<string, SegmentationPolicy> = new Map();
    private rateLimitStates: Map<string, RateLimitState> = new Map();

    /**
     * Register a custom policy for a specific agent.
     */
    registerPolicy(policy: SegmentationPolicy): void {
        this.policies.set(policy.agentId, policy);
    }

    /**
     * Evaluate an access request against the agent's segmentation policy.
     */
    evaluateAccess(request: AccessRequest): AccessDecision {
        const now = new Date().toISOString();
        const policy = this.getEffectivePolicy(request.agentId, request.agentLevel);

        // Check 1: A2A communication permission
        if (request.targetAgentId) {
            if (!policy.allowAgentToAgent) {
                return {
                    allowed: false,
                    reason: `Agent-to-agent communication denied for level: ${request.agentLevel}`,
                    policy: policy.name,
                    evaluatedAt: now,
                };
            }
            if (policy.deniedAgents.includes(request.targetAgentId)) {
                return {
                    allowed: false,
                    reason: `Target agent ${request.targetAgentId} is on the deny list`,
                    policy: policy.name,
                    evaluatedAt: now,
                };
            }
        }

        // Check 2: Rate limiting
        if (!this.checkRateLimit(request.agentId, policy)) {
            return {
                allowed: false,
                reason: `Rate limit exceeded: ${policy.rateLimit.maxOperations} ops per ${policy.rateLimit.windowSeconds}s`,
                policy: policy.name,
                evaluatedAt: now,
            };
        }

        // Check 3: Resource matching
        const matchedResource = this.findMatchingResource(request, policy.resources);
        if (!matchedResource) {
            return {
                allowed: false,
                reason: `No resource policy matches: ${request.resource} [${request.action}]`,
                policy: policy.name,
                evaluatedAt: now,
            };
        }

        // Check 4: Maturity level check
        const levelIndex = ['intern', 'junior', 'senior', 'principal'].indexOf(request.agentLevel);
        const requiredIndex = ['intern', 'junior', 'senior', 'principal'].indexOf(matchedResource.minLevel);
        if (levelIndex < requiredIndex) {
            return {
                allowed: false,
                reason: `Maturity level insufficient: need ${matchedResource.minLevel}, have ${request.agentLevel}`,
                policy: policy.name,
                evaluatedAt: now,
            };
        }

        // All checks passed — increment rate limit counter
        this.incrementRateLimit(request.agentId);

        return {
            allowed: true,
            reason: `Access granted: ${request.resource} [${request.action}]`,
            policy: policy.name,
            evaluatedAt: now,
        };
    }

    /**
     * Get the effective policy for an agent, falling back to maturity-level defaults.
     */
    private getEffectivePolicy(agentId: string, level: AgentMaturityLevel): SegmentationPolicy {
        // Check for custom policy first
        const custom = this.policies.get(agentId);
        if (custom) return custom;

        // Check for wildcard policy
        const wildcard = this.policies.get('*');
        if (wildcard) return wildcard;

        // Fall back to maturity-level defaults
        const defaults = DEFAULT_POLICIES[level];
        return {
            agentId,
            name: `default-${level}`,
            ...defaults,
        };
    }

    /**
     * Match a resource request against policy resource patterns.
     * Supports glob-like matching with "*" wildcards.
     */
    private findMatchingResource(request: AccessRequest, resources: ResourcePolicy[]): ResourcePolicy | null {
        for (const rp of resources) {
            if (this.matchGlob(rp.resource, request.resource) && rp.actions.includes(request.action)) {
                return rp;
            }
        }
        return null;
    }

    /**
     * Simple glob matcher: "*" matches any single segment, "**" matches any path.
     */
    private matchGlob(pattern: string, value: string): boolean {
        if (pattern === '*') return true;
        const regex = new RegExp(
            '^' + pattern.replace(/\*/g, '[^/]*').replace(/\*\*/g, '.*') + '$'
        );
        return regex.test(value);
    }

    /**
     * Check rate limit for an agent.
     */
    private checkRateLimit(agentId: string, policy: SegmentationPolicy): boolean {
        const state = this.rateLimitStates.get(agentId);
        if (!state) return true;

        const windowStart = new Date(state.windowStart).getTime();
        const now = Date.now();
        const windowMs = policy.rateLimit.windowSeconds * 1000;

        // Window expired — reset
        if (now - windowStart > windowMs) {
            this.rateLimitStates.delete(agentId);
            return true;
        }

        return state.operationCount < policy.rateLimit.maxOperations;
    }

    /**
     * Increment rate limit counter for an agent.
     */
    private incrementRateLimit(agentId: string): void {
        const state = this.rateLimitStates.get(agentId);
        if (state) {
            state.operationCount++;
        } else {
            this.rateLimitStates.set(agentId, {
                agentId,
                operationCount: 1,
                windowStart: new Date().toISOString(),
            });
        }
    }
}
