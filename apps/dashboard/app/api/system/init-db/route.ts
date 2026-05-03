import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    // Only allow this in non-production or if explicitly triggered
    // For the hackathon, we allow it so Railway DB can be initialized easily
    
    const ddl = `
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";

        -- Create a table for AI Agents
        CREATE TABLE IF NOT EXISTS public.agents (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            creator_id UUID,
            website_url TEXT,
            compliance_tags TEXT[] DEFAULT '{}',
            is_verified BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
        );

        -- Create a table for Trust Scores
        CREATE TABLE IF NOT EXISTS public.trust_scores (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
            overall_score INTEGER NOT NULL DEFAULT 0,
            components JSONB DEFAULT '{}'::jsonb,
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
            UNIQUE(agent_id)
        );

        -- Create a table for API Keys (used in Stripe Webhook)
        CREATE TABLE IF NOT EXISTS public.api_keys (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id TEXT NOT NULL,
            stripe_customer_id TEXT,
            api_key TEXT NOT NULL UNIQUE,
            plan TEXT NOT NULL DEFAULT 'free',
            requests_remaining INTEGER NOT NULL DEFAULT 1000,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
        );
    `;

    try {
        await db.query(ddl);
        
        // Insert some seed data for the demo
        await db.query(`
            INSERT INTO public.agents (name, description, website_url, compliance_tags, is_verified)
            VALUES 
                ('Aegis Sentinel', 'Hardware-attested sovereign monitoring agent', 'https://aegis12.com', ARRAY['GDPR', 'SOC2'], true),
                ('MediBot Pro', 'Clinical documentation assistant', 'https://medibot.health', ARRAY['HIPAA'], true)
            ON CONFLICT DO NOTHING;
        `);

        return NextResponse.json({ 
            success: true, 
            message: "Database initialized successfully! Tables created and seed data inserted." 
        });
    } catch (error: any) {
        console.error("Database initialization failed:", error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
