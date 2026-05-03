import { AgentService } from '@/lib/agents/agent.service';
import { SupabaseAgentRepository } from '@/lib/agents/agent.repository.supabase';
import { AgentDirectory } from '@/components/ui/AgentDirectory';
import { Navbar } from '@/components/ui/Navbar';

import { MockAgentRepository } from '@/lib/agents/agent.repository.mock';

// Force dynamic rendering - Supabase isn't available during build
export const dynamic = 'force-dynamic';

// Initialize service with Repo (Mock or Real)
const agentRepository = process.env.USE_MOCK_REPO === 'true'
    ? new MockAgentRepository()
    : new SupabaseAgentRepository();

const agentService = new AgentService(agentRepository);

interface AgentsPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
    const agents = await agentService.getAgents();
    const resolvedSearchParams = await searchParams;
    const demoAgentName = resolvedSearchParams.demo_agent as string | undefined;

    if (demoAgentName) {
        // Inject demo agent for display if it doesn't exist
        const isAlreadyListed = agents.some(a => a.name === demoAgentName);
        if (!isAlreadyListed) {
            agents.unshift({
                id: 'demo-new-agent',
                name: demoAgentName,
                description: 'Demo Agent (Recently Created)',
                website_url: 'https://demo.example.com',
                compliance_tags: ['Demo', 'New'],
                creator_id: 'demo-user-id',
                is_verified: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
    }

    return (
        <main className="min-h-screen pt-20 pb-16 px-4 md:px-8">
            <Navbar />

            <div className="max-w-7xl mx-auto mt-12">
                <header className="mb-12 text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600 dark:from-blue-400 dark:via-indigo-300 dark:to-violet-400">
                        Agent Directory
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                        Discover verified and compliant AI agents for the Berlin digital health ecosystem.
                    </p>
                </header>

                <AgentDirectory agents={agents} />
            </div>
        </main>
    );
}
