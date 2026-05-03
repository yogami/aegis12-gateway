import { Agent, CreateAgentDTO } from './agent.types';
import { AgentRepository } from './agent.repository';
import { db } from '@/lib/db';

export class PgAgentRepository implements AgentRepository {
    async createAgent(data: CreateAgentDTO): Promise<Agent> {
        const query = `
            INSERT INTO agents (name, description, website_url, compliance_tags, is_verified)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const values = [
            data.name,
            data.description,
            data.website_url,
            data.compliance_tags || [],
            false
        ];

        try {
            const result = await db.query<Agent>(query, values);
            return result.rows[0];
        } catch (error: any) {
            console.error('Error creating agent:', error);
            throw new Error(error.message);
        }
    }

    async getAgents(): Promise<Agent[]> {
        const query = `SELECT * FROM agents;`;
        
        try {
            const result = await db.query<Agent>(query);
            return result.rows;
        } catch (error: any) {
            console.error('Error fetching agents:', error);
            throw new Error(error.message);
        }
    }

    async getAgentById(id: string): Promise<Agent | null> {
        const query = `SELECT * FROM agents WHERE id = $1;`;
        
        try {
            const result = await db.query<Agent>(query, [id]);
            if (result.rows.length === 0) return null;
            return result.rows[0];
        } catch (error: any) {
            console.error('Error fetching agent:', error);
            return null;
        }
    }
}
