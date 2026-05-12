-- TrustScore MVP Seed Data
-- Run this in Supabase SQL Editor

-- Add new columns if they don't exist
ALTER TABLE agents ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS uptime_percent numeric(5,2) DEFAULT 99.50;

-- Insert 10 Berlin health agents
INSERT INTO agents (id, name, description, compliance_tags, is_verified, website_url, trust_score, uptime_percent) VALUES
  (gen_random_uuid(), 'Ada Health', 'AI-powered symptom assessment and health guidance platform', ARRAY['GDPR', 'MDR', 'ISO27001'], true, 'https://ada.com', 95, 99.80),
  (gen_random_uuid(), 'Doctolib', 'Medical appointment booking and practice management', ARRAY['GDPR', 'HIPAA'], true, 'https://doctolib.de', 90, 99.50),
  (gen_random_uuid(), 'Clue', 'Period and cycle tracking for reproductive health', ARRAY['GDPR'], true, 'https://helloclue.com', 85, 99.20),
  (gen_random_uuid(), 'Kry/Livi', 'Video consultations with licensed doctors', ARRAY['GDPR', 'MDR'], true, 'https://kry.de', 88, 98.90),
  (gen_random_uuid(), 'Mediteo', 'Medication reminder and adherence tracking', ARRAY['GDPR'], false, 'https://mediteo.com', 70, 97.50),
  (gen_random_uuid(), 'mySugr', 'Diabetes management and blood glucose logging', ARRAY['GDPR', 'MDR', 'FDA'], true, 'https://mysugr.com', 92, 99.70),
  (gen_random_uuid(), 'Caspar Health', 'Digital rehabilitation and physiotherapy programs', ARRAY['GDPR', 'DiGA'], true, 'https://caspar-health.com', 89, 99.10),
  (gen_random_uuid(), 'Selfapy', 'Online therapy for mental health conditions', ARRAY['GDPR', 'DiGA'], true, 'https://selfapy.com', 87, 98.80),
  (gen_random_uuid(), 'Oviva', 'Diet and nutrition coaching for chronic conditions', ARRAY['GDPR'], false, 'https://oviva.com', 75, 98.00),
  (gen_random_uuid(), 'TeleClinic', 'Telemedicine platform for video doctor visits', ARRAY['GDPR', 'MDR'], true, 'https://teleclinic.com', 91, 99.40)
ON CONFLICT (id) DO NOTHING;
