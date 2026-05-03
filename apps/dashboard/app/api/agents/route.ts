import { NextResponse } from 'next/server';
import { SupabaseAgentRepository } from '@/lib/agents/agent.repository.supabase';
import { CreateAgentDTO } from '@/lib/agents/agent.types';

import { MockAgentRepository } from '@/lib/agents/agent.repository.mock';

export const dynamic = 'force-dynamic';

const agentRepository = process.env.USE_MOCK_REPO === 'true'
    ? new MockAgentRepository()
    : new SupabaseAgentRepository();

export async function GET() {
    const agents = await agentRepository.getAgents();
    return NextResponse.json(agents);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Basic validation
        if (!body.name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const dto: CreateAgentDTO = {
            name: body.name,
            description: body.description,
            website_url: body.website_url,
            compliance_tags: body.compliance_tags || [],
            creator_id: undefined // Mock auth for now
        };

        const newAgent = await agentRepository.createAgent(dto);
        return NextResponse.json(newAgent, { status: 201 });
    } catch (error: unknown) {
        console.error('Failed to create agent:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ error: errorMessage || 'Internal Server Error' }, { status: 500 });
    }
}
