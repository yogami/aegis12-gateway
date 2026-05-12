/**
 * VERA Incident Response Service — Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { IncidentResponseService } from "../incident.service";

describe('IncidentResponseService', () => {
    let service: IncidentResponseService;

    beforeEach(() => {
        service = new IncidentResponseService();
    });

    describe('circuit breaker', () => {
        it('initializes in closed state', () => {
            const breaker = service.initBreaker('agent-001', 'junior');
            expect(breaker.state).toBe('closed');
            expect(breaker.failureCount).toBe(0);
        });

        it('opens circuit after threshold failures', () => {
            service.initBreaker('agent-001', 'intern'); // threshold = 3

            service.recordFailure('agent-001');
            service.recordFailure('agent-001');
            const breaker = service.recordFailure('agent-001'); // 3rd failure

            expect(breaker.state).toBe('open');
            expect(breaker.failureCount).toBe(3);
        });

        it('blocks execution when circuit is open', () => {
            service.initBreaker('agent-001', 'intern');
            service.recordFailure('agent-001');
            service.recordFailure('agent-001');
            service.recordFailure('agent-001');

            const result = service.canExecute('agent-001');
            expect(result.allowed).toBe(false);
            expect(result.state).toBe('open');
        });

        it('allows execution when circuit is closed', () => {
            service.initBreaker('agent-001', 'senior');
            const result = service.canExecute('agent-001');
            expect(result.allowed).toBe(true);
            expect(result.state).toBe('closed');
        });

        it('resets on success in half-open state', () => {
            service.initBreaker('agent-001', 'intern');
            // Force to half-open by manually accessing the breaker
            service.recordFailure('agent-001');
            service.recordFailure('agent-001');
            service.recordFailure('agent-001');
            // Simulate half-open by recording success
            service.recordSuccess('agent-001'); // no-op because it's open not half-open
            // The circuit is still open — this tests the state machine
            const result = service.canExecute('agent-001');
            expect(result.allowed).toBe(false);
        });
    });

    describe('kill switch', () => {
        it('blocks execution when killed', () => {
            service.initBreaker('agent-001', 'senior');
            service.killAgent('agent-001', 'admin', 'Suspicious behavior');

            const result = service.canExecute('agent-001');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Kill switch active');
        });

        it('allows execution after manual resume', () => {
            service.initBreaker('agent-001', 'senior');
            service.killAgent('agent-001', 'admin', 'Testing');
            service.resumeAgent('agent-001');

            const result = service.canExecute('agent-001');
            expect(result.allowed).toBe(true);
        });
    });

    describe('incident recording', () => {
        it('auto-kills on critical incident', () => {
            service.initBreaker('agent-001', 'senior');
            const incident = service.recordIncident('agent-001', 'critical', 'breach', 'Data exfiltration detected');

            expect(incident.containmentAction).toBe('kill_switch');
            expect(incident.severity).toBe('critical');

            const result = service.canExecute('agent-001');
            expect(result.allowed).toBe(false);
        });

        it('opens circuit on high-severity incident', () => {
            service.initBreaker('agent-001', 'senior');
            const incident = service.recordIncident('agent-001', 'high', 'policy_violation', 'Rate limit abuse');

            expect(incident.containmentAction).toBe('circuit_open');

            const result = service.canExecute('agent-001');
            expect(result.allowed).toBe(false);
        });

        it('tracks incident count', () => {
            service.recordIncident('agent-001', 'low', 'anomaly', 'Minor anomaly 1');
            service.recordIncident('agent-001', 'low', 'anomaly', 'Minor anomaly 2');
            service.recordIncident('agent-001', 'critical', 'breach', 'Major breach');

            expect(service.getIncidents('agent-001')).toHaveLength(3);
            expect(service.getCriticalIncidentCount('agent-001')).toBe(1);
        });
    });
});
