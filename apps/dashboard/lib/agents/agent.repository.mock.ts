import { Agent, CreateAgentDTO } from './agent.types';
import { AgentRepository } from './agent.repository';

export class MockAgentRepository implements AgentRepository {
    private agents: Agent[] = [];

    constructor() {
        this.agents = [
            {
                id: '1',
                name: 'MediChat AI',
                description: 'Symptom checker and preliminary diagnosis assistant.',
                creator_id: 'user_1',
                website_url: 'https://medichat.ai',
                compliance_tags: ['GDPR', 'HIPAA'],
                is_verified: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: '2',
                name: 'PharmaCompliance Bot',
                description: 'Automated compliance checks for pharmaceutical marketing materials.',
                creator_id: 'user_2',
                website_url: 'https://pharmabot.io',
                compliance_tags: ['GDPR'],
                is_verified: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                id: '3',
                name: 'MentalHealth Ally',
                description: '24/7 mental health support companion.',
                creator_id: 'user_3',
                website_url: 'https://mally.com',
                compliance_tags: ['MDR', 'GDPR'],
                is_verified: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }
        ];
    }

    async createAgent(data: CreateAgentDTO): Promise<Agent> {
        const newAgent: Agent = {
            id: Math.random().toString(36).substring(7),
            name: data.name,
            description: data.description || null,
            creator_id: data.creator_id || null,
            website_url: data.website_url || null,
            compliance_tags: data.compliance_tags || [],
            is_verified: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        this.agents.push(newAgent);
        return newAgent;
    }

    async getAgents(): Promise<Agent[]> {
        return this.agents;
    }

    async getAgentById(id: string): Promise<Agent | null> {
        return this.agents.find(a => a.id === id) || null;
    }
}
