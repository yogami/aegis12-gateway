/**
 * VERA Maturity Service — Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MaturityService } from "../maturity.service";
import { AgentMaturity } from "../maturity.types";

describe('MaturityService', () => {
    let service: MaturityService;
    const now = new Date().toISOString();

    beforeEach(() => {
        service = new MaturityService();
    });

    const makeMaturity = (overrides: Partial<AgentMaturity> = {}): AgentMaturity => ({
        agentId: 'agent-001',
        currentLevel: 'intern',
        promotedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        levelHistory: [],
        incidentCount: 0,
        criticalIncidentCount: 0,
        recommendationAccuracy: 98,
        availability: 99.9,
        ...overrides,
    });

    describe('getNextLevel', () => {
        it('returns junior for intern', () => {
            expect(service.getNextLevel('intern')).toBe('junior');
        });
        it('returns senior for junior', () => {
            expect(service.getNextLevel('junior')).toBe('senior');
        });
        it('returns principal for senior', () => {
            expect(service.getNextLevel('senior')).toBe('principal');
        });
        it('returns null for principal', () => {
            expect(service.getNextLevel('principal')).toBeNull();
        });
    });

    describe('evaluatePromotion — Intern to Junior', () => {
        it('passes all gates for a clean intern', () => {
            const maturity = makeMaturity({ currentLevel: 'intern' });
            const gates = service.evaluatePromotion(maturity);
            expect(service.isPromotionEligible(gates)).toBe(true);
        });

        it('fails Gate 4 with critical incidents', () => {
            const maturity = makeMaturity({ currentLevel: 'intern', criticalIncidentCount: 1 });
            const gates = service.evaluatePromotion(maturity);
            expect(gates.gate4_incidentRecord.passed).toBe(false);
            expect(service.isPromotionEligible(gates)).toBe(false);
        });

        it('fails Gate 1 with insufficient time at level', () => {
            const maturity = makeMaturity({
                currentLevel: 'intern',
                promotedAt: new Date().toISOString(), // Just promoted
            });
            const gates = service.evaluatePromotion(maturity);
            expect(gates.gate1_performance.passed).toBe(false);
        });
    });

    describe('evaluatePromotion — Junior to Senior', () => {
        it('requires pentest grade A or B', () => {
            const maturity = makeMaturity({ currentLevel: 'junior' });

            const gatesA = service.evaluatePromotion(maturity, 'A');
            expect(gatesA.gate2_security.passed).toBe(true);

            const gatesC = service.evaluatePromotion(maturity, 'C');
            expect(gatesC.gate2_security.passed).toBe(false);
        });

        it('requires >95% accuracy', () => {
            const maturity = makeMaturity({ currentLevel: 'junior', recommendationAccuracy: 90 });
            const gates = service.evaluatePromotion(maturity, 'A', undefined, true, true);
            expect(gates.gate1_performance.passed).toBe(false);
        });

        it('requires security team approval', () => {
            const maturity = makeMaturity({ currentLevel: 'junior' });
            const gates = service.evaluatePromotion(maturity, 'A', undefined, true, false);
            expect(gates.gate5_governanceSignoff.passed).toBe(false);
        });
    });

    describe('evaluatePromotion — Senior to Principal', () => {
        it('requires adversarial testing', () => {
            const maturity = makeMaturity({ currentLevel: 'senior', recommendationAccuracy: 99.5, availability: 99.95 });
            const gatesNoAdv = service.evaluatePromotion(maturity, 'A', false, true, true, true, true);
            expect(gatesNoAdv.gate2_security.passed).toBe(false);

            const gatesWithAdv = service.evaluatePromotion(maturity, 'A', true, true, true, true, true);
            expect(gatesWithAdv.gate2_security.passed).toBe(true);
        });

        it('requires risk committee approval', () => {
            const maturity = makeMaturity({ currentLevel: 'senior', recommendationAccuracy: 99.5, availability: 99.95 });
            const gates = service.evaluatePromotion(maturity, 'A', true, true, true, false, true);
            expect(gates.gate5_governanceSignoff.passed).toBe(false);
        });
    });

    describe('promote', () => {
        it('advances agent level and records transition', () => {
            const maturity = makeMaturity({ currentLevel: 'intern' });
            const gates = service.evaluatePromotion(maturity);
            const promoted = service.promote(maturity, gates, 'admin@berlin.ai');

            expect(promoted.currentLevel).toBe('junior');
            expect(promoted.levelHistory).toHaveLength(1);
            expect(promoted.levelHistory[0].from).toBe('intern');
            expect(promoted.levelHistory[0].to).toBe('junior');
            expect(promoted.levelHistory[0].approvedBy).toBe('admin@berlin.ai');
        });

        it('throws if gates not passed', () => {
            const maturity = makeMaturity({ currentLevel: 'intern', criticalIncidentCount: 1 });
            const gates = service.evaluatePromotion(maturity);
            expect(() => service.promote(maturity, gates, 'admin')).toThrow();
        });

        it('throws if already at Principal', () => {
            const maturity = makeMaturity({ currentLevel: 'principal' });
            const gates = service.evaluatePromotion(maturity);
            expect(() => service.promote(maturity, gates, 'admin')).toThrow('Agent is already at Principal level');
        });
    });
});
