import { NextResponse } from 'next/server';
import { TrustScoreService } from '@/lib/trustscore/trustscore.service';
import { SupabaseAgentRepository } from '@/lib/agents/agent.repository.supabase';

import { MockAgentRepository } from '@/lib/agents/agent.repository.mock';

export const dynamic = 'force-dynamic';

const trustScoreService = new TrustScoreService();
const agentRepository = process.env.USE_MOCK_REPO === 'true'
    ? new MockAgentRepository()
    : new SupabaseAgentRepository();

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const id = (await params).id;
    const agent = await agentRepository.getAgentById(id);

    if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const breakdown = trustScoreService.calculateBreakdown(agent);

    return NextResponse.json({
        agent_id: id,
        agent_name: agent.name,
        trust_score: breakdown.normalized,
        breakdown: {
            verified: { points: breakdown.verified, max: 40, description: 'Verified agent status' },
            gdpr: { points: breakdown.gdpr, max: 25, description: 'GDPR compliance' },
            mdr: { points: breakdown.mdr, max: 30, description: 'MDR certification' },
            uptime: { points: breakdown.uptime, max: 20, description: 'Uptime > 97%' },
        },
        raw_score: breakdown.total,
        max_possible: 115,
    });
}
