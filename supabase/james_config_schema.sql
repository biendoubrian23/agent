-- =====================================================
-- SCHEMA POUR LA CONFIGURATION DE JAMES
-- À exécuter dans Supabase SQL Editor
-- =====================================================

-- Supprimer les anciennes policies si elles existent (pour éviter les conflits)
DROP POLICY IF EXISTS "Users can view own rules" ON classification_rules;
DROP POLICY IF EXISTS "Users can insert own rules" ON classification_rules;
DROP POLICY IF EXISTS "Users can update own rules" ON classification_rules;
DROP POLICY IF EXISTS "Users can delete own rules" ON classification_rules;
DROP POLICY IF EXISTS "Allow all for dev" ON classification_rules;

DROP POLICY IF EXISTS "Users can view own prompts" ON agent_prompts;
DROP POLICY IF EXISTS "Users can insert own prompts" ON agent_prompts;
DROP POLICY IF EXISTS "Users can update own prompts" ON agent_prompts;
DROP POLICY IF EXISTS "Allow all for dev" ON agent_prompts;

DROP POLICY IF EXISTS "Users can view own permissions" ON agent_permissions;
DROP POLICY IF EXISTS "Users can insert own permissions" ON agent_permissions;
DROP POLICY IF EXISTS "Users can update own permissions" ON agent_permissions;
DROP POLICY IF EXISTS "Users can delete own permissions" ON agent_permissions;
DROP POLICY IF EXISTS "Allow all for dev" ON agent_permissions;

-- Supprimer les anciennes tables si elles existent
DROP TABLE IF EXISTS classification_rules CASCADE;
DROP TABLE IF EXISTS agent_prompts CASCADE;
DROP TABLE IF EXISTS agent_permissions CASCADE;

-- =====================================================
-- CRÉATION DES TABLES (sans contrainte FK sur auth.users)
-- =====================================================

-- Table des règles de classification personnalisées
CREATE TABLE classification_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,  -- Pas de FK car on utilise un ID fixe en dev
    pattern TEXT NOT NULL,
    folder TEXT NOT NULL,
    rule_type TEXT DEFAULT 'sender' CHECK (rule_type IN ('sender', 'subject', 'contains')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour le prompt personnalisé de James
CREATE TABLE agent_prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    agent_name TEXT NOT NULL,
    base_prompt TEXT NOT NULL,
    custom_instructions TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, agent_name)
);

-- Table pour les permissions des agents
CREATE TABLE agent_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    agent_name TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    permission_label TEXT NOT NULL,
    permission_description TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, agent_name, permission_id)
);

-- =====================================================
-- INDEX POUR LA PERFORMANCE
-- =====================================================

CREATE INDEX idx_classification_rules_user ON classification_rules(user_id);
CREATE INDEX idx_agent_prompts_user_agent ON agent_prompts(user_id, agent_name);
CREATE INDEX idx_agent_permissions_user_agent ON agent_permissions(user_id, agent_name);

-- =====================================================
-- ROW LEVEL SECURITY - DÉSACTIVÉ POUR LE DEV
-- (À activer en production avec une vraie auth)
-- =====================================================

-- On active RLS mais avec une policy permissive pour le dev
ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_permissions ENABLE ROW LEVEL SECURITY;

-- Policy permissive pour le développement (accès total)
CREATE POLICY "Allow all for dev" ON classification_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for dev" ON agent_prompts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for dev" ON agent_permissions FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGER POUR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_classification_rules_updated_at ON classification_rules;
CREATE TRIGGER update_classification_rules_updated_at
    BEFORE UPDATE ON classification_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_prompts_updated_at ON agent_prompts;
CREATE TRIGGER update_agent_prompts_updated_at
    BEFORE UPDATE ON agent_prompts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_permissions_updated_at ON agent_permissions;
CREATE TRIGGER update_agent_permissions_updated_at
    BEFORE UPDATE ON agent_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FIN DU SCRIPT
-- Les tables sont prêtes pour l'utilisation
-- =====================================================
