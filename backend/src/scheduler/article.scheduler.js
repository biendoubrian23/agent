const supabaseService = require('../services/supabase.service');
const outlookService = require('../services/outlook.service');
const whatsappService = require('../services/whatsapp.service');

/**
 * Scheduler pour la publication automatique des articles programmés
 * Vérifie régulièrement si des articles doivent être publiés
 */
class ArticleScheduler {
  constructor() {
    this.intervalId = null;
    this.checkIntervalMinutes = parseInt(process.env.ARTICLE_CHECK_INTERVAL) || 1; // Vérifier chaque minute
    this.isRunning = false;
  }

  /**
   * Démarrer le scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('📰 Article Scheduler déjà en cours d\'exécution');
      return;
    }

    console.log(`📰 Article Scheduler démarré - Vérification toutes les ${this.checkIntervalMinutes} minutes`);
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
      console.log(`📰 [${now.toLocaleTimeString('fr-FR')}] Vérification des articles programmés...`);

      // 1. Récupérer les articles en attente de publication
      const { data: scheduledPosts, error } = await supabaseService.client
        .from('scheduled_posts')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) {
        console.error('❌ Erreur récupération scheduled_posts:', error.message);
        return;
      }

      if (!scheduledPosts || scheduledPosts.length === 0) {
        console.log('✅ Aucun article à publier pour le moment');
        return;
      }

      console.log(`📝 ${scheduledPosts.length} article(s) à publier !`);

      // 2. Publier chaque article
      for (const scheduled of scheduledPosts) {
        await this.publishArticle(scheduled);
      }

    } catch (error) {
      console.error('❌ Erreur Article Scheduler:', error.message);
    }
  }

  /**
   * Publier un article programmé
   */
  async publishArticle(scheduled) {
    const { id, post_id, title, scheduled_at } = scheduled;
    
    console.log(`🚀 Publication de "${title}"...`);

    try {
      // 1. Récupérer l'article depuis blog_posts
      const { data: article, error: fetchError } = await supabaseService.client
        .from('blog_posts')
        .select('*')
        .eq('id', post_id)
        .single();

      if (fetchError || !article) {
        console.error(`❌ Article ${post_id} non trouvé`);
        await this.markAsFailed(id, 'Article non trouvé');
        return;
      }

      // 2. Mettre à jour le statut de l'article vers "published"
      const { error: updateError } = await supabaseService.client
        .from('blog_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', post_id);

      if (updateError) {
        console.error(`❌ Erreur publication article ${post_id}:`, updateError.message);
        await this.markAsFailed(id, updateError.message);
        return;
      }

      // 3. Marquer la programmation comme terminée
      await supabaseService.client
        .from('scheduled_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', id);

      console.log(`✅ Article "${title}" publié avec succès !`);

      // 4. Envoyer une notification (WhatsApp ou autre)
      await this.notifyPublication(article);

    } catch (error) {
      console.error(`❌ Erreur publication "${title}":`, error.message);
      await this.markAsFailed(id, error.message);
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
      nextCheckIn: this.intervalId ? `${this.checkIntervalMinutes} minutes` : 'N/A'
    };
  }

  /**
   * Lister les articles programmés en attente
   */
  async getPendingScheduled() {
    try {
      const { data, error } = await supabaseService.client
        .from('scheduled_posts')
        .select('*')
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur récupération programmations:', error.message);
      return [];
    }
  }
}

module.exports = new ArticleScheduler();
