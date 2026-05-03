/**
 * VERA Segmentation Service — Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SegmentationService } from "../segmentation.service";
import { SegmentationPolicy } from "../segmentation.types";

describe('SegmentationService', () => {
    let service: SegmentationService;

    beforeEach(() => {
        service = new SegmentationService();
    });

    describe('default policies', () => {
        it('allows intern to read', () => {
            const decision = service.evaluateAccess({
                agentId: 'agent-001',
                agentLevel: 'intern',
                resource: 'api/users/read',
                action: 'read',
            });
            expect(decision.allowed).toBe(true);
        });

        it('denies intern write access', () => {
            const decision = service.evaluateAccess({
                agentId: 'agent-001',
                agentLevel: 'intern',
                resource: 'api/users/write',
                action: 'write',
            });
            expect(decision.allowed).toBe(false);
        });

        it('allows senior to write', () => {
            const decision = service.evaluateAccess({
                agentId: 'agent-002',
                agentLevel: 'senior',
                resource: 'api/users',
                action: 'write',
            });
            expect(decision.allowed).toBe(true);
        });

        it('allows principal full access', () => {
            const decision = service.evaluateAccess({
                agentId: 'agent-003',
                agentLevel: 'principal',
                resource: 'anything/at/all',
                action: 'delete',
            });
            expect(decision.allowed).toBe(true);
        });
    });

    describe('A2A communication', () => {
        it('denies intern A2A', () => {
            const decision = service.evaluateAccess({
                agentId: 'agent-001',
                agentLevel: 'intern',
                resource: 'api/data/read',
                action: 'read',
                targetAgentId: 'agent-002',
            });
            expect(decision.allowed).toBe(false);
            expect(decision.reason).toContain('Agent-to-agent communication denied');
        });

        it('allows senior A2A', () => {
            const decision = service.evaluateAccess({
                agentId: 'agent-002',
                agentLevel: 'senior',
                resource: 'api/data',
                action: 'read',
                targetAgentId: 'agent-003',
            });
            expect(decision.allowed).toBe(true);
        });
    });

    describe('custom policies', () => {
        it('respects deny list', () => {
            const policy: SegmentationPolicy = {
                agentId: 'agent-locked',
                name: 'locked-agent-policy',
                resources: [{ resource: '*', actions: ['read', 'write', 'delete', 'execute'], minLevel: 'intern' }],
                rateLimit: { maxOperations: 100, windowSeconds: 3600 },
                maxCascadeDepth: 1,
                allowAgentToAgent: true,
                deniedAgents: ['evil-agent'],
            };
            service.registerPolicy(policy);

            const decision = service.evaluateAccess({
                agentId: 'agent-locked',
                agentLevel: 'senior',
                resource: 'api/data',
                action: 'read',
                targetAgentId: 'evil-agent',
            });
            expect(decision.allowed).toBe(false);
            expect(decision.reason).toContain('deny list');
        });
    });

    describe('rate limiting', () => {
        it('blocks after exceeding rate limit', () => {
            // Register a tight rate limit policy
            const policy: SegmentationPolicy = {
                agentId: 'rate-test',
                name: 'rate-limit-test',
                resources: [{ resource: '*', actions: ['read'], minLevel: 'intern' }],
                rateLimit: { maxOperations: 3, windowSeconds: 3600 },
                maxCascadeDepth: 0,
                allowAgentToAgent: false,
                deniedAgents: [],
            };
            service.registerPolicy(policy);

            // First 3 should pass
            for (let i = 0; i < 3; i++) {
                const d = service.evaluateAccess({ agentId: 'rate-test', agentLevel: 'intern', resource: 'any', action: 'read' });
                expect(d.allowed).toBe(true);
            }

            // 4th should fail
            const blocked = service.evaluateAccess({ agentId: 'rate-test', agentLevel: 'intern', resource: 'any', action: 'read' });
            expect(blocked.allowed).toBe(false);
            expect(blocked.reason).toContain('Rate limit exceeded');
        });
    });
});
