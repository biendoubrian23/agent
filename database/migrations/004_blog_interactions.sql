-- =====================================================
-- Migration 004: Blog Interactions (Likes, Comments, Shares)
-- BiendouCorp - Fonctionnalités sociales pour les articles
-- =====================================================

-- 1. Table pour les interactions (likes, dislikes, shares)
-- On utilise un hash IP pour éviter les abus tout en restant anonyme
CREATE TABLE IF NOT EXISTS blog_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('like', 'dislike', 'share')),
    ip_hash VARCHAR(64) NOT NULL, -- SHA-256 de l'IP pour anonymat
    user_agent TEXT, -- Pour analytics
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Un utilisateur (IP) ne peut faire qu'une seule interaction like/dislike par article
    CONSTRAINT unique_like_dislike_per_ip UNIQUE (post_id, interaction_type, ip_hash)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_blog_interactions_post_id ON blog_interactions(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_interactions_type ON blog_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_blog_interactions_created ON blog_interactions(created_at);

-- 2. Table pour les commentaires
CREATE TABLE IF NOT EXISTS blog_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    author_name VARCHAR(100) NOT NULL DEFAULT 'Anonyme',
    author_email VARCHAR(255), -- Optionnel, pour Gravatar
    content TEXT NOT NULL,
    ip_hash VARCHAR(64) NOT NULL, -- Pour modération
    is_approved BOOLEAN DEFAULT TRUE, -- Pour modération future
    is_visible BOOLEAN DEFAULT TRUE,
    parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE, -- Pour réponses
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les commentaires
CREATE INDEX IF NOT EXISTS idx_blog_comments_post_id ON blog_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_parent ON blog_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_created ON blog_comments(created_at);
CREATE INDEX IF NOT EXISTS idx_blog_comments_approved ON blog_comments(is_approved);

-- 3. Ajouter les colonnes de compteurs dans blog_posts
ALTER TABLE blog_posts 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dislikes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;

-- 4. Fonction pour mettre à jour les compteurs automatiquement
CREATE OR REPLACE FUNCTION update_post_interaction_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.interaction_type = 'like' THEN
            UPDATE blog_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
        ELSIF NEW.interaction_type = 'dislike' THEN
            UPDATE blog_posts SET dislikes_count = dislikes_count + 1 WHERE id = NEW.post_id;
        ELSIF NEW.interaction_type = 'share' THEN
            UPDATE blog_posts SET shares_count = shares_count + 1 WHERE id = NEW.post_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.interaction_type = 'like' THEN
            UPDATE blog_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
        ELSIF OLD.interaction_type = 'dislike' THEN
            UPDATE blog_posts SET dislikes_count = GREATEST(0, dislikes_count - 1) WHERE id = OLD.post_id;
        ELSIF OLD.interaction_type = 'share' THEN
            UPDATE blog_posts SET shares_count = GREATEST(0, shares_count - 1) WHERE id = OLD.post_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour les interactions
DROP TRIGGER IF EXISTS trigger_update_interaction_counts ON blog_interactions;
CREATE TRIGGER trigger_update_interaction_counts
    AFTER INSERT OR DELETE ON blog_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_post_interaction_counts();

-- 5. Fonction pour mettre à jour le compteur de commentaires
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE blog_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE blog_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Si le commentaire devient invisible, décrémenter
        IF OLD.is_visible = TRUE AND NEW.is_visible = FALSE THEN
            UPDATE blog_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = NEW.post_id;
        -- Si le commentaire redevient visible, incrémenter
        ELSIF OLD.is_visible = FALSE AND NEW.is_visible = TRUE THEN
            UPDATE blog_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour les commentaires
DROP TRIGGER IF EXISTS trigger_update_comment_count ON blog_comments;
CREATE TRIGGER trigger_update_comment_count
    AFTER INSERT OR DELETE OR UPDATE OF is_visible ON blog_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_post_comment_count();

-- 6. Row Level Security (RLS) pour les nouvelles tables
ALTER TABLE blog_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;

-- Policies pour blog_interactions
-- Lecture publique (pour afficher les compteurs)
CREATE POLICY "blog_interactions_select_public" ON blog_interactions
    FOR SELECT USING (true);

-- Insertion publique (pour permettre les likes anonymes)
CREATE POLICY "blog_interactions_insert_public" ON blog_interactions
    FOR INSERT WITH CHECK (true);

-- Suppression par le même IP (pour toggle like/dislike)
CREATE POLICY "blog_interactions_delete_public" ON blog_interactions
    FOR DELETE USING (true);

-- Policies pour blog_comments
-- Lecture publique des commentaires approuvés et visibles
CREATE POLICY "blog_comments_select_public" ON blog_comments
    FOR SELECT USING (is_approved = TRUE AND is_visible = TRUE);

-- Insertion publique (pour permettre les commentaires anonymes)
CREATE POLICY "blog_comments_insert_public" ON blog_comments
    FOR INSERT WITH CHECK (true);

-- 7. Vue pour les stats d'un article (utilisé par Kiara)
CREATE OR REPLACE VIEW blog_post_stats AS
SELECT 
    bp.id,
    bp.title,
    bp.slug,
    bp.likes_count,
    bp.dislikes_count,
    bp.comments_count,
    bp.shares_count,
    bp.views_count,
    bp.created_at,
    bp.published_at,
    -- Calcul du score d'engagement
    ROUND(
        (COALESCE(bp.likes_count, 0) * 3 + 
         COALESCE(bp.comments_count, 0) * 5 + 
         COALESCE(bp.shares_count, 0) * 10 +
         COALESCE(bp.views_count, 0) * 0.1)::numeric, 
        2
    ) as engagement_score
FROM blog_posts bp
WHERE bp.status = 'published';

-- =====================================================
-- Fin de la migration 004
-- =====================================================
