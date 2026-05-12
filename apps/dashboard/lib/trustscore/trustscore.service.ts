import { Agent } from '../agents/agent.types';

export interface TrustScoreBreakdown {
    verified: number;
    gdpr: number;
    mdr: number;
    uptime: number;
    total: number;
    normalized: number;
}

export class TrustScoreService {
    calculateScore(agent: Agent): number {
        const breakdown = this.calculateBreakdown(agent);
        return breakdown.normalized;
    }

    calculateBreakdown(agent: Agent): TrustScoreBreakdown {
        let verified = 0;
        let gdpr = 0;
        let mdr = 0;
        let uptime = 0;

        // Verified: +40 points
        if (agent.is_verified) {
            verified = 40;
        }

        // GDPR compliance: +25 points
        if (agent.compliance_tags?.some(tag => tag.toUpperCase() === 'GDPR')) {
            gdpr = 25;
        }

        // MDR compliance: +30 points
        if (agent.compliance_tags?.some(tag => tag.toUpperCase() === 'MDR')) {
            mdr = 30;
        }

        // Uptime > 97%: +20 points
        const uptimeValue = agent.uptime_percent ?? 0;
        if (uptimeValue > 97) {
            uptime = 20;
        }

        const total = verified + gdpr + mdr + uptime;
        // Normalize to 100 (max possible is 115)
        const normalized = Math.min(100, Math.round((total / 115) * 100));

        return { verified, gdpr, mdr, uptime, total, normalized };
    }
}
