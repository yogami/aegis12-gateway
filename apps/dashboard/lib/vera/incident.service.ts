/**
 * VERA Incident Response — Circuit Breaker & Kill Switch
 * Implements Element 5 runtime containment: "What if you go rogue?"
 *
 * This complements agent-pentest (offensive testing) with defensive runtime controls.
 *
 * @see https://cloudsecurityalliance.org/blog/2026/02/02/the-agentic-trust-framework-zero-trust-governance-for-ai-agents
 */

import { AgentMaturityLevel } from './maturity.types';

// ─── Circuit Breaker States ───

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreaker {
    agentId: string;
    state: CircuitState;
    failureCount: number;
    failureThreshold: number;
    resetTimeoutMs: number;
    lastFailureAt?: string;
    openedAt?: string;
    halfOpenAttempts: number;
    maxHalfOpenAttempts: number;
}

export interface KillSwitchState {
    agentId: string;
    killed: boolean;
    killedAt?: string;
    killedBy?: string;
    reason?: string;
    /** Auto-resume after timeout (ms), or null for permanent kill */
    autoResumeMs?: number | null;
}

export interface IncidentRecord {
    id: string;
    agentId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: 'anomaly' | 'breach' | 'policy_violation' | 'cascade_failure' | 'data_leak';
    description: string;
    containmentAction: 'none' | 'circuit_open' | 'kill_switch' | 'demotion';
    demotedTo?: AgentMaturityLevel;
    timestamp: string;
    resolvedAt?: string;
    rootCauseAnalysis?: string;
}

// ─── Default Thresholds Per Maturity Level ───

const CIRCUIT_BREAKER_DEFAULTS: Record<AgentMaturityLevel, { failureThreshold: number; resetTimeoutMs: number }> = {
    intern: { failureThreshold: 3, resetTimeoutMs: 60_000 },      // Very conservative
    junior: { failureThreshold: 5, resetTimeoutMs: 120_000 },
    senior: { failureThreshold: 10, resetTimeoutMs: 300_000 },
    principal: { failureThreshold: 20, resetTimeoutMs: 600_000 },  // More trust
};

export class IncidentResponseService {
    private breakers: Map<string, CircuitBreaker> = new Map();
    private killSwitches: Map<string, KillSwitchState> = new Map();
    private incidents: IncidentRecord[] = [];

    // ─── Circuit Breaker ───

    /**
     * Initialize a circuit breaker for an agent.
     */
    initBreaker(agentId: string, level: AgentMaturityLevel): CircuitBreaker {
        const defaults = CIRCUIT_BREAKER_DEFAULTS[level];
        const breaker: CircuitBreaker = {
            agentId,
            state: 'closed',
            failureCount: 0,
            failureThreshold: defaults.failureThreshold,
            resetTimeoutMs: defaults.resetTimeoutMs,
            halfOpenAttempts: 0,
            maxHalfOpenAttempts: 3,
        };
        this.breakers.set(agentId, breaker);
        return breaker;
    }

    /**
     * Record a failure for an agent. Opens circuit if threshold exceeded.
     */
    recordFailure(agentId: string): CircuitBreaker {
        const breaker = this.breakers.get(agentId);
        if (!breaker) throw new Error(`No circuit breaker for agent: ${agentId}`);

        breaker.failureCount++;
        breaker.lastFailureAt = new Date().toISOString();

        if (breaker.failureCount >= breaker.failureThreshold) {
            breaker.state = 'open';
            breaker.openedAt = new Date().toISOString();
        }

        return breaker;
    }

    /**
     * Check if an agent's circuit is allowing requests.
     */
    canExecute(agentId: string): { allowed: boolean; state: CircuitState; reason: string } {
        // Check kill switch first
        const ks = this.killSwitches.get(agentId);
        if (ks?.killed) {
            // Check auto-resume
            if (ks.autoResumeMs && ks.killedAt) {
                const elapsed = Date.now() - new Date(ks.killedAt).getTime();
                if (elapsed >= ks.autoResumeMs) {
                    ks.killed = false;
                    ks.reason = 'Auto-resumed after timeout';
                } else {
                    return { allowed: false, state: 'open', reason: `Kill switch active: ${ks.reason}` };
                }
            } else {
                return { allowed: false, state: 'open', reason: `Kill switch active: ${ks.reason}` };
            }
        }

        const breaker = this.breakers.get(agentId);
        if (!breaker) return { allowed: true, state: 'closed', reason: 'No circuit breaker registered' };

        switch (breaker.state) {
            case 'closed':
                return { allowed: true, state: 'closed', reason: 'Circuit closed — operating normally' };

            case 'open': {
                // Check if reset timeout has elapsed
                if (breaker.openedAt) {
                    const elapsed = Date.now() - new Date(breaker.openedAt).getTime();
                    if (elapsed >= breaker.resetTimeoutMs) {
                        breaker.state = 'half-open';
                        breaker.halfOpenAttempts = 0;
                        return { allowed: true, state: 'half-open', reason: 'Circuit half-open — testing recovery' };
                    }
                }
                return { allowed: false, state: 'open', reason: `Circuit open — ${breaker.failureCount} failures` };
            }

            case 'half-open': {
                if (breaker.halfOpenAttempts < breaker.maxHalfOpenAttempts) {
                    breaker.halfOpenAttempts++;
                    return { allowed: true, state: 'half-open', reason: `Half-open attempt ${breaker.halfOpenAttempts}/${breaker.maxHalfOpenAttempts}` };
                }
                return { allowed: false, state: 'half-open', reason: 'Half-open attempts exhausted' };
            }
        }
    }

    /**
     * Record a success — used to close a half-open circuit.
     */
    recordSuccess(agentId: string): void {
        const breaker = this.breakers.get(agentId);
        if (breaker && breaker.state === 'half-open') {
            breaker.state = 'closed';
            breaker.failureCount = 0;
            breaker.halfOpenAttempts = 0;
        }
    }

    // ─── Kill Switch ───

    /**
     * Activate kill switch — immediately halt all agent operations.
     */
    killAgent(agentId: string, killedBy: string, reason: string, autoResumeMs?: number): KillSwitchState {
        const state: KillSwitchState = {
            agentId,
            killed: true,
            killedAt: new Date().toISOString(),
            killedBy,
            reason,
            autoResumeMs: autoResumeMs ?? null,
        };
        this.killSwitches.set(agentId, state);
        return state;
    }

    /**
     * Manually resume a killed agent.
     */
    resumeAgent(agentId: string): KillSwitchState {
        const state = this.killSwitches.get(agentId);
        if (!state) throw new Error(`No kill switch for agent: ${agentId}`);
        state.killed = false;
        state.reason = 'Manually resumed';
        return state;
    }

    // ─── Incident Logging ───

    /**
     * Record an incident and auto-apply containment based on severity.
     */
    recordIncident(
        agentId: string,
        severity: IncidentRecord['severity'],
        type: IncidentRecord['type'],
        description: string,
    ): IncidentRecord {
        let containmentAction: IncidentRecord['containmentAction'] = 'none';

        // Auto-containment rules
        if (severity === 'critical') {
            this.killAgent(agentId, 'system', `Auto-kill: ${description}`);
            containmentAction = 'kill_switch';
        } else if (severity === 'high') {
            const breaker = this.breakers.get(agentId);
            if (breaker) {
                breaker.state = 'open';
                breaker.openedAt = new Date().toISOString();
            }
            containmentAction = 'circuit_open';
        }

        const record: IncidentRecord = {
            id: `INC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            agentId,
            severity,
            type,
            description,
            containmentAction,
            timestamp: new Date().toISOString(),
        };

        this.incidents.push(record);
        return record;
    }

    /**
     * Get all incidents for an agent.
     */
    getIncidents(agentId: string): IncidentRecord[] {
        return this.incidents.filter(i => i.agentId === agentId);
    }

    /**
     * Get count of critical incidents (used by promotion Gate 4).
     */
    getCriticalIncidentCount(agentId: string): number {
        return this.incidents.filter(i => i.agentId === agentId && i.severity === 'critical').length;
    }
}
