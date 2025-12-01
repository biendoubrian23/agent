-- Table pour stocker les statistiques des agents
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS agent_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL UNIQUE,
  
  -- Stats James
  emails_processed INTEGER DEFAULT 0,
  emails_today INTEGER DEFAULT 0,
  urgent_emails INTEGER DEFAULT 0,
  
  -- Stats générales (requêtes)
  requests_total INTEGER DEFAULT 0,
  requests_today INTEGER DEFAULT 0,
  
  -- Stats Magali
  transactions_processed INTEGER DEFAULT 0,
  transactions_today INTEGER DEFAULT 0,
  
  -- Stats Kiara
  tasks_created INTEGER DEFAULT 0,
  
  -- Timestamps
  last_sync TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches par agent
CREATE INDEX IF NOT EXISTS idx_agent_stats_agent_name ON agent_stats(agent_name);

-- Insérer les agents par défaut
INSERT INTO agent_stats (agent_name) VALUES 
  ('james'),
  ('magali'),
  ('kiara'),
  ('brian')
ON CONFLICT (agent_name) DO NOTHING;

-- Politique RLS (désactivée pour le service_role)
ALTER TABLE agent_stats ENABLE ROW LEVEL SECURITY;

-- Permettre à tous de lire (pour le dashboard frontend)
CREATE POLICY "Allow public read access" ON agent_stats
  FOR SELECT USING (true);

-- Permettre les updates depuis le backend (service_role)
CREATE POLICY "Allow service role full access" ON agent_stats
  USING (true)
  WITH CHECK (true);
