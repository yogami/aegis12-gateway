import { describe, it, expect, vi } from 'vitest';
import { AgentService } from '../agent.service';
import { Agent, CreateAgentDTO } from '../agent.types';

// Mock Supabase client later, for now we test pure logic or mocked dependency
// Since we don't have the real DB connected in unit tests usually, we'll mock the repository/client.

describe('AgentService', () => {
    it('should create an agent with default values', async () => {
        const mockRepo = {
            createAgent: vi.fn().mockResolvedValue({
                id: '123',
                name: 'Test Agent',
                description: 'A test agent',
                compliance_tags: [],
                is_verified: false,
                creator_id: null,
                website_url: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as Agent),
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const service = new AgentService(mockRepo as any);
        const dto: CreateAgentDTO = { name: 'Test Agent', description: 'A test agent' };

        const result = await service.createAgent(dto);

        expect(result).toBeDefined();
        expect(result.name).toBe('Test Agent');
        expect(mockRepo.createAgent).toHaveBeenCalledWith(dto);
    });

    it('should list agents', async () => {
        const mockRepo = {
            getAgents: vi.fn().mockResolvedValue([
                { id: '1', name: 'Agent 1' }
            ]),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const service = new AgentService(mockRepo as any);
        const agents = await service.getAgents();
        expect(agents).toHaveLength(1);
        expect(agents[0].name).toBe('Agent 1');
    });
});
