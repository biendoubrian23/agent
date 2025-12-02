-- =====================================================
-- Migration 005: Table scheduled_posts pour les publications programmées
-- BiendouCorp - Scheduler de publications d'articles
-- =====================================================

-- Table pour stocker les programmations de publication
CREATE TABLE IF NOT EXISTS scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL, -- Copie du titre pour affichage rapide
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'cancelled')),
    outlook_event_id VARCHAR(255), -- ID de l'événement Outlook Calendar
    published_at TIMESTAMP WITH TIME ZONE, -- Quand l'article a été effectivement publié
    cancelled_at TIMESTAMP WITH TIME ZONE, -- Quand la programmation a été annulée
    error_message TEXT, -- Message d'erreur si échec
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Un article ne peut être programmé qu'une seule fois en pending
    CONSTRAINT unique_pending_post UNIQUE (post_id, status) 
        WHERE status = 'pending'
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_at ON scheduled_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_post_id ON scheduled_posts(post_id);

-- Vue pour les programmations en attente
CREATE OR REPLACE VIEW pending_scheduled_posts AS
SELECT 
    sp.id,
    sp.post_id,
    sp.title,
    sp.scheduled_at,
    sp.status,
    sp.created_at,
    bp.slug,
    bp.category,
    bp.excerpt
FROM scheduled_posts sp
JOIN blog_posts bp ON sp.post_id = bp.id
WHERE sp.status = 'pending'
ORDER BY sp.scheduled_at ASC;

-- Fonction pour nettoyer les anciennes programmations (garde 30 jours)
CREATE OR REPLACE FUNCTION cleanup_old_scheduled_posts()
RETURNS void AS $$
BEGIN
    DELETE FROM scheduled_posts 
    WHERE status IN ('published', 'failed', 'cancelled') 
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Policy: lecture publique
CREATE POLICY "scheduled_posts_select_public" ON scheduled_posts
    FOR SELECT USING (true);

-- Policy: insertion/modification publique (pour l'agent)
CREATE POLICY "scheduled_posts_insert_public" ON scheduled_posts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "scheduled_posts_update_public" ON scheduled_posts
    FOR UPDATE USING (true);

-- =====================================================
-- Fin de la migration 005
-- =====================================================
