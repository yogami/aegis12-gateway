import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Agent } from '@/lib/agents/agent.types';

export const dynamic = 'force-dynamic';

export async function GET() {
    if (process.env.USE_MOCK_REPO === 'true') {
        // Return deterministic mock data for E2E tests
        return NextResponse.json([
            { id: '1', name: 'MediChat AI', trust_score: 95, compliance_tags: ['GDPR', 'HIPAA'] },
            { id: '3', name: 'MentalHealth Ally', trust_score: 88, compliance_tags: ['MDR', 'GDPR'] }
        ]);
    }

    try {
        const query = `
            SELECT 
                a.id, 
                a.name, 
                a.description, 
                a.compliance_tags,
                COALESCE(t.overall_score, 0) as trust_score
            FROM public.agents a
            LEFT JOIN public.trust_scores t ON a.id = t.agent_id
            WHERE a.is_verified = true
            ORDER BY trust_score DESC, a.created_at DESC
            LIMIT 10
        `;
        
        const res = await db.query(query);
        return NextResponse.json(res.rows);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
