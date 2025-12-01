-- =====================================================
-- BiendouCorp Agent - Schéma de base de données Supabase
-- =====================================================
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- 1. Table des profils utilisateurs (extension de auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table des agents (configuration par utilisateur)
CREATE TABLE IF NOT EXISTS public.user_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  agent_name TEXT NOT NULL, -- 'james', 'magali', 'kiara', 'brian'
  is_active BOOLEAN DEFAULT true,
  system_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, agent_name)
);

-- 3. Table des permissions des agents
CREATE TABLE IF NOT EXISTS public.agent_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_agent_id UUID REFERENCES public.user_agents(id) ON DELETE CASCADE NOT NULL,
  permission_key TEXT NOT NULL, -- 'read_emails', 'send_emails', etc.
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_agent_id, permission_key)
);

-- 4. Table des statistiques des agents
CREATE TABLE IF NOT EXISTS public.agent_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  agent_name TEXT NOT NULL,
  stat_date DATE DEFAULT CURRENT_DATE,
  emails_processed INTEGER DEFAULT 0,
  emails_today INTEGER DEFAULT 0,
  urgent_emails INTEGER DEFAULT 0,
  transactions_processed INTEGER DEFAULT 0,
  tasks_created INTEGER DEFAULT 0,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, agent_name, stat_date)
);

-- 5. Table des activités (historique)
CREATE TABLE IF NOT EXISTS public.agent_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT DEFAULT 'success', -- 'success', 'error', 'warning'
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Table des connexions externes (Outlook, WhatsApp, etc.)
CREATE TABLE IF NOT EXISTS public.user_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  service_name TEXT NOT NULL, -- 'outlook', 'whatsapp', 'bank'
  is_connected BOOLEAN DEFAULT false,
  access_token TEXT, -- Chiffré en production !
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, service_name)
);

-- 7. Table des conversations WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message_id TEXT,
  direction TEXT NOT NULL, -- 'incoming', 'outgoing'
  from_number TEXT,
  to_number TEXT,
  message_text TEXT,
  agent_name TEXT, -- Quel agent a répondu
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Politiques de sécurité Row Level Security (RLS)
-- =====================================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Politiques pour profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Politiques pour user_agents
CREATE POLICY "Users can view own agents" ON public.user_agents
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can manage own agents" ON public.user_agents
  FOR ALL USING (auth.uid() = user_id);

-- Politiques pour agent_permissions
CREATE POLICY "Users can view own permissions" ON public.agent_permissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_agents WHERE id = agent_permissions.user_agent_id AND user_id = auth.uid())
  );
  
CREATE POLICY "Users can manage own permissions" ON public.agent_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_agents WHERE id = agent_permissions.user_agent_id AND user_id = auth.uid())
  );

-- Politiques pour agent_stats
CREATE POLICY "Users can view own stats" ON public.agent_stats
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can manage own stats" ON public.agent_stats
  FOR ALL USING (auth.uid() = user_id);

-- Politiques pour agent_activities
CREATE POLICY "Users can view own activities" ON public.agent_activities
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own activities" ON public.agent_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politiques pour user_connections
CREATE POLICY "Users can view own connections" ON public.user_connections
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can manage own connections" ON public.user_connections
  FOR ALL USING (auth.uid() = user_id);

-- Politiques pour whatsapp_messages
CREATE POLICY "Users can view own messages" ON public.whatsapp_messages
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own messages" ON public.whatsapp_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- Triggers et Fonctions
-- =====================================================

-- Fonction pour créer automatiquement un profil après inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  
  -- Créer les agents par défaut
  INSERT INTO public.user_agents (user_id, agent_name, system_prompt) VALUES
    (NEW.id, 'brian', 'Tu es Brian, l''assistant principal. Tu coordonnes les autres agents.'),
    (NEW.id, 'james', 'Tu es James, l''assistant email. Tu gères les emails Outlook.'),
    (NEW.id, 'magali', 'Tu es Magali, l''assistante bancaire. Tu surveilles les transactions.'),
    (NEW.id, 'kiara', 'Tu es Kiara, l''assistante CEO. Tu aides à la gestion et planification.');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour appeler la fonction après inscription
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_agents_updated_at BEFORE UPDATE ON public.user_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_agent_permissions_updated_at BEFORE UPDATE ON public.agent_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_agent_stats_updated_at BEFORE UPDATE ON public.agent_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_connections_updated_at BEFORE UPDATE ON public.user_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- Index pour de meilleures performances
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_agent_stats_user_date ON public.agent_stats(user_id, stat_date);
CREATE INDEX IF NOT EXISTS idx_agent_activities_user_created ON public.agent_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_created ON public.whatsapp_messages(user_id, created_at DESC);
