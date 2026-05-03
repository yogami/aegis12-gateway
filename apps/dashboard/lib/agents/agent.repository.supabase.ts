import { Agent, CreateAgentDTO } from './agent.types';
import { AgentRepository } from './agent.repository';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export class SupabaseAgentRepository implements AgentRepository {
    async createAgent(data: CreateAgentDTO): Promise<Agent> {
        // Using supabaseAdmin to bypass RLS for registration
        const { data: result, error } = await supabaseAdmin
            .from('agents')
            .insert({
                name: data.name,
                description: data.description,
                website_url: data.website_url,
                compliance_tags: data.compliance_tags,
                is_verified: false
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating agent:', error);
            throw new Error(error.message);
        }

        return result as Agent;
    }

    async getAgents(): Promise<Agent[]> {
        const { data, error } = await supabase
            .from('agents')
            .select('*');

        if (error) {
            console.error('Error fetching agents:', error);
            throw new Error(error.message);
        }

        return data as Agent[];
    }

    async getAgentById(id: string): Promise<Agent | null> {
        const { data, error } = await supabase
            .from('agents')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data as Agent;
    }
}
