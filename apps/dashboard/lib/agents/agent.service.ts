import { Agent, CreateAgentDTO } from './agent.types';
import { AgentRepository } from './agent.repository';

export class AgentService {
    constructor(private repository: AgentRepository) { }

    async createAgent(data: CreateAgentDTO): Promise<Agent> {
        return this.repository.createAgent(data);
    }

    async getAgents(): Promise<Agent[]> {
        return this.repository.getAgents();
    }

    async getAgentById(id: string): Promise<Agent | null> {
        return this.repository.getAgentById(id);
    }
}
