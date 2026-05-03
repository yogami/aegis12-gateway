import { Agent, CreateAgentDTO } from './agent.types';

export interface AgentRepository {
    createAgent(data: CreateAgentDTO): Promise<Agent>;
    getAgents(): Promise<Agent[]>;
    getAgentById(id: string): Promise<Agent | null>;
}
