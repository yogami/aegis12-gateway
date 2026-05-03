-- Create a table for public profiles linked to auth.users
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  organization TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create a table for AI Agents
CREATE TABLE public.agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES public.profiles(id), -- Nullable for unverified/unclaimed agents initially
  website_url TEXT,
  compliance_tags TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create a table for Trust Scores
CREATE TABLE public.trust_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  overall_score INTEGER NOT NULL DEFAULT 0,
  components JSONB DEFAULT '{}'::jsonb, -- e.g., {"uptime": 20, "verified": 50}
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(agent_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_scores ENABLE ROW LEVEL SECURITY;

-- Policies (Basic MVP policies)
-- Public read access
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Agents are viewable by everyone." ON public.agents FOR SELECT USING (true);
CREATE POLICY "Trust scores are viewable by everyone." ON public.trust_scores FOR SELECT USING (true);

-- Authenticated update access (users can update their own profile)
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Agent management policies (MVP: Only authenticated users can create agents for now, need finer control later)
CREATE POLICY "Authenticated users can create agents." ON public.agents FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Only creator can update
CREATE POLICY "Creators can update their agents." ON public.agents FOR UPDATE USING (auth.uid() = creator_id);
