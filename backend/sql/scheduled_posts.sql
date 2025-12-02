-- Table pour stocker les articles programmés
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'cancelled', 'failed')),
  outlook_event_id TEXT,  -- ID de l'événement Outlook Calendar
  error_message TEXT,     -- Message d'erreur si échec
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Un article ne peut être programmé qu'une fois en mode pending
  UNIQUE(post_id, status) WHERE (status = 'pending')
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_at ON scheduled_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_post_id ON scheduled_posts(post_id);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_scheduled_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scheduled_posts_updated_at ON scheduled_posts;
CREATE TRIGGER trigger_scheduled_posts_updated_at
  BEFORE UPDATE ON scheduled_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_posts_updated_at();

-- RLS (Row Level Security) - optionnel si tu utilises l'authentification
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre toutes les opérations (ajuster selon tes besoins)
CREATE POLICY "Allow all for service role" ON scheduled_posts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Vérifier que la colonne scheduled_at existe dans blog_posts
-- Si elle n'existe pas, l'ajouter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'blog_posts' AND column_name = 'scheduled_at'
  ) THEN
    ALTER TABLE blog_posts ADD COLUMN scheduled_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON TABLE scheduled_posts IS 'Table pour gérer les publications programmées d''articles';
COMMENT ON COLUMN scheduled_posts.post_id IS 'Référence vers l''article dans blog_posts';
COMMENT ON COLUMN scheduled_posts.outlook_event_id IS 'ID de l''événement dans le calendrier Outlook';
