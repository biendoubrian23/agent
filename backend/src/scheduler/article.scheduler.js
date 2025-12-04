const supabaseService = require('../services/supabase.service');
const outlookService = require('../services/outlook.service');
const whatsappService = require('../services/whatsapp.service');

/**
 * Scheduler pour la publication automatique des articles programmés
 * Vérifie régulièrement si des articles doivent être publiés
 * 
 * Flux de publication:
 * 1. Vérifie d'abord scheduled_posts (table de suivi) pour status='pending'
 * 2. En fallback, vérifie blog_posts pour status='scheduled'
 * 3. Publie les articles dont scheduled_at <= maintenant
 * 4. Met à jour le status vers 'published'
 * 5. Envoie une notification WhatsApp
 */
class ArticleScheduler {
  constructor() {
    this.intervalId = null;
    this.checkIntervalMinutes = parseInt(process.env.ARTICLE_CHECK_INTERVAL) || 1; // Vérifier chaque minute
    this.isRunning = false;
    this.lastCheck = null;
    this.checksCount = 0;
    this.publishedCount = 0;
  }

  /**
   * Démarrer le scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('📰 Article Scheduler déjà en cours d\'exécution');
      return;
    }

    console.log(`📰 Article Scheduler démarré - Vérification toutes les ${this.checkIntervalMinutes} minute(s)`);
    console.log('📰 Première vérification dans 10 secondes...');
    this.isRunning = true;

    // Vérifier immédiatement au démarrage (après 10 secondes)
    setTimeout(() => this.checkScheduledPosts(), 10000);

    // Puis vérifier périodiquement
    this.intervalId = setInterval(
      () => this.checkScheduledPosts(),
      this.checkIntervalMinutes * 60 * 1000
    );
  }

  /**
   * Arrêter le scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('📰 Article Scheduler arrêté');
    }
  }

  /**
   * Vérifier et publier les articles programmés
   */
  async checkScheduledPosts() {
    try {
      const now = new Date();
      this.lastCheck = now;
      this.checksCount++;
      
      console.log(`📰 [${now.toLocaleTimeString('fr-FR')}] Vérification #${this.checksCount} des articles programmés...`);

      // 1. D'abord essayer avec scheduled_posts (table de suivi)
      let scheduledPosts = [];
      let useScheduledPostsTable = true;
      
      const { data: fromScheduledTable, error: scheduledError } = await supabaseService.client
        .from('scheduled_posts')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true });

      if (scheduledError) {
        console.log('⚠️ Table scheduled_posts non disponible, fallback vers blog_posts');
        useScheduledPostsTable = false;
      } else {
        scheduledPosts = fromScheduledTable || [];
        if (scheduledPosts.length > 0) {
          console.log(`📋 Trouvé ${scheduledPosts.length} article(s) dans scheduled_posts`);
        }
      }

      // 2. FALLBACK: Vérifier aussi blog_posts directement si pas de résultats
      // Cela permet de publier même si scheduled_posts n'a pas été correctement rempli
      if (scheduledPosts.length === 0) {
        console.log('📰 Vérification dans blog_posts (fallback)...');
        
        const { data: fromBlogPosts, error: blogError } = await supabaseService.client
          .from('blog_posts')
          .select('*')
          .eq('status', 'scheduled')
          .lte('scheduled_at', now.toISOString())
          .order('scheduled_at', { ascending: true });

        if (blogError) {
          console.error('❌ Erreur récupération blog_posts:', blogError.message);
        } else if (fromBlogPosts && fromBlogPosts.length > 0) {
          // Transformer en format compatible avec scheduled_posts
          scheduledPosts = fromBlogPosts.map(article => ({
            id: null, // Pas d'entrée scheduled_posts
            blog_post_id: article.id,  // Utiliser blog_post_id comme dans la table Supabase
            title: article.title,
            scheduled_at: article.scheduled_at,
            status: 'pending',
            fromFallback: true // Marquer comme venant du fallback
          }));
          useScheduledPostsTable = false;
          console.log(`📝 ${scheduledPosts.length} article(s) trouvé(s) via blog_posts (fallback)`);
        }
      }

      if (!scheduledPosts || scheduledPosts.length === 0) {
        console.log('✅ Aucun article à publier pour le moment');
        return;
      }

      console.log(`📝 ${scheduledPosts.length} article(s) à publier !`);

      // 3. Publier chaque article
      for (const scheduled of scheduledPosts) {
        const success = await this.publishArticle(scheduled, useScheduledPostsTable);
        if (success) this.publishedCount++;
      }

    } catch (error) {
      console.error('❌ Erreur Article Scheduler:', error.message);
    }
  }

  /**
   * Publier un article programmé
   * @param {Object} scheduled - L'entrée de programmation
   * @param {boolean} useScheduledPostsTable - Si true, met à jour scheduled_posts
   * @returns {boolean} - true si publié avec succès
   */
  async publishArticle(scheduled, useScheduledPostsTable = true) {
    // Supporter les deux noms de colonnes: blog_post_id (Supabase) ou post_id (ancien)
    const { id, blog_post_id, post_id, title, scheduled_at, fromFallback } = scheduled;
    const articleId = blog_post_id || post_id;  // Priorité à blog_post_id
    
    console.log(`🚀 Publication de "${title || 'Article'}"... (via ${fromFallback ? 'blog_posts fallback' : 'scheduled_posts'})`);

    try {
      // 1. Récupérer l'article depuis blog_posts
      const { data: article, error: fetchError } = await supabaseService.client
        .from('blog_posts')
        .select('*')
        .eq('id', articleId)
        .single();

      if (fetchError || !article) {
        console.error(`❌ Article ${articleId} non trouvé`);
        if (id) await this.markAsFailed(id, 'Article non trouvé');
        return false;
      }

      // Vérifier que l'article n'est pas déjà publié
      if (article.status === 'published') {
        console.log(`⚠️ Article "${title}" déjà publié, skip`);
        // Nettoyer scheduled_posts si nécessaire
        if (id && useScheduledPostsTable) {
          await supabaseService.client
            .from('scheduled_posts')
            .update({ status: 'published', published_at: article.published_at || new Date().toISOString() })
            .eq('id', id);
        }
        return false;
      }

      // 2. Mettre à jour le statut de l'article vers "published"
      const { error: updateError } = await supabaseService.client
        .from('blog_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', articleId);

      if (updateError) {
        console.error(`❌ Erreur publication article ${articleId}:`, updateError.message);
        if (id) await this.markAsFailed(id, updateError.message);
        return false;
      }

      // 3. Marquer la programmation comme terminée (si on utilise scheduled_posts)
      if (id && useScheduledPostsTable) {
        await supabaseService.client
          .from('scheduled_posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString()
          })
          .eq('id', id);
      }

      console.log(`✅ Article "${title}" publié avec succès !`);

      // 4. Envoyer une notification (WhatsApp ou autre)
      await this.notifyPublication(article);
      
      return true; // Succès

    } catch (error) {
      console.error(`❌ Erreur publication "${title}":`, error.message);
      if (id) await this.markAsFailed(id, error.message);
      return false; // Échec
    }
  }

  /**
   * Marquer une programmation comme échouée
   */
  async markAsFailed(scheduledId, errorMessage) {
    try {
      await supabaseService.client
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduledId);
    } catch (e) {
      console.error('Erreur mise à jour status failed:', e.message);
    }
  }

  /**
   * Notifier de la publication (WhatsApp, etc.)
   */
  async notifyPublication(article) {
    const message = `🎉 *Article publié automatiquement !*

📝 *${article.title}*
📂 Catégorie: ${article.category || 'Non catégorisé'}
🔗 https://brian-biendou.com/blog/${article.slug}

✅ Publication programmée effectuée avec succès par Kiara.`;

    try {
      // Notification WhatsApp si connecté
      if (whatsappService.client && process.env.MY_PHONE_NUMBER) {
        await whatsappService.sendMessage(
          process.env.MY_PHONE_NUMBER,
          message
        );
        console.log('📱 Notification WhatsApp envoyée');
      }
    } catch (error) {
      console.log('⚠️ Notification WhatsApp non envoyée:', error.message);
    }

    try {
      // Notification Outlook Calendar - Marquer l'événement comme terminé
      if (outlookService.isConnected()) {
        // On pourrait mettre à jour l'événement ou en créer un nouveau de confirmation
        console.log('📅 Outlook notifié');
      }
    } catch (error) {
      console.log('⚠️ Notification Outlook non envoyée:', error.message);
    }
  }

  /**
   * Obtenir le statut du scheduler
   */
  getStatus() {
    return {
      running: this.isRunning,
      intervalMinutes: this.checkIntervalMinutes,
      nextCheckIn: this.intervalId ? `${this.checkIntervalMinutes} minute(s)` : 'N/A',
      lastCheck: this.lastCheck ? this.lastCheck.toISOString() : null,
      checksCount: this.checksCount,
      publishedCount: this.publishedCount
    };
  }

  /**
   * Lister les articles programmés en attente
   * Vérifie les deux sources: scheduled_posts ET blog_posts
   */
  async getPendingScheduled() {
    try {
      const results = [];
      
      // 1. Depuis scheduled_posts
      const { data: fromScheduled, error: err1 } = await supabaseService.client
        .from('scheduled_posts')
        .select('*')
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true });

      if (!err1 && fromScheduled) {
        results.push(...fromScheduled.map(p => ({ ...p, source: 'scheduled_posts' })));
      }
      
      // 2. Depuis blog_posts (fallback)
      const { data: fromBlog, error: err2 } = await supabaseService.client
        .from('blog_posts')
        .select('id, title, scheduled_at, status')
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true });

      if (!err2 && fromBlog) {
        // Ajouter ceux qui ne sont pas déjà dans scheduled_posts
        const existingPostIds = results.map(r => r.post_id);
        for (const article of fromBlog) {
          if (!existingPostIds.includes(article.id)) {
            results.push({
              id: null,
              post_id: article.id,
              title: article.title,
              scheduled_at: article.scheduled_at,
              status: 'pending',
              source: 'blog_posts (fallback)'
            });
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error('Erreur récupération programmations:', error.message);
      return [];
    }
  }
}

module.exports = new ArticleScheduler();
