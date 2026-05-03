import { describe, it, expect } from 'vitest';
import { TrustScoreService } from '../trustscore.service';
import { Agent } from '../../agents/agent.types';

describe('TrustScoreService', () => {
    const service = new TrustScoreService();

    it('should calculate correct normalized score for verified agent with GDPR', () => {
        const agent = {
            is_verified: true,
            compliance_tags: ['GDPR']
        } as Agent;

        // verified=40 + gdpr=25 = 65, normalized = 65/115*100 = 57
        expect(service.calculateScore(agent)).toBe(57);
    });

    it('should calculate correct score for unverified agent with no tags', () => {
        const agent = {
            is_verified: false,
            compliance_tags: []
        } as unknown as Agent;

        expect(service.calculateScore(agent)).toBe(0);
    });

    it('should calculate high score for fully compliant agent', () => {
        const agent = {
            is_verified: true,
            compliance_tags: ['GDPR', 'MDR'], // 40 + 25 + 30 = 95, normalized = 95/115*100 = 83
            uptime_percent: 99 // +20 = 115 total, normalized = 100
        } as Agent;

        expect(service.calculateScore(agent)).toBe(100);
    });
});
