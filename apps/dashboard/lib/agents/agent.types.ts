export interface Agent {
    id: string;
    name: string;
    description: string | null;
    creator_id: string | null;
    website_url: string | null;
    compliance_tags: string[];
    is_verified: boolean;
    trust_score?: number;
    uptime_percent?: number;
    created_at: string;
    updated_at: string;
}

export interface CreateAgentDTO {
    name: string;
    description?: string;
    website_url?: string;
    creator_id?: string;
    compliance_tags?: string[];
}
